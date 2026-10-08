#!/usr/bin/env node
// record-all.mjs — batch 4K capture across courses, pulling narration from GitHub as it lands.
//
//   npm run record:all                        # every course, in syllabus order
//   npm run record:all -- --courses internals,performance
//   npm run record:all -- --wait 0            # never wait; skip any course missing audio
//   npm run record:all -- --no-pull           # use the working tree as-is
//
// WHY THIS EXISTS: the narration wavs are produced by a Colab + Chatterbox pass that commits them
// to the repo's branch one section at a time, so the audio for a course arrives WHILE this is
// running. A plain `for c in …; do npm run record -- $c; done` would reach `internals` before its
// nine wavs existed and silently record six sections of 3s silence (record-course.mjs's documented
// fallback — it keeps the pipeline from hanging, which is right for one missing clip and wrong for a
// whole chapter). So before each course this does: git pull → count that course's wavs against
// scripts/audio-manifest.json → if any are missing, keep pulling every --poll until they land or
// --wait expires. A course is only recorded when it is COMPLETE; an incomplete one is skipped and
// named in the summary, never half-recorded.
//
// Everything else is record-course.mjs's job, unchanged: the 2.4s pulse-period loop window, the
// bell lead-in, the per-segment fingerprint cache (so a re-run after a skip costs nothing for the
// courses already done) and the final concat into scripts/out/<course>.mp4.
//
// SLEEP: the repo's `record:all` script wraps this in `caffeinate -ims` so a multi-hour batch
// survives the machine going idle — `"record:all": "caffeinate -ims graphl-record-all"`. -i no idle
// sleep, -m no disk sleep, -s no system sleep (AC power only). -d is deliberately NOT set: capture
// is headless, so forcing the display on all night buys nothing. The wrapper stays in the repo
// rather than inside this script because `caffeinate` is macOS-only and re-exec'ing ourselves under
// it would hide a process layer from anyone reading the batch's output.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoDir, dataDir, pkgDir } from './_paths.mjs'

const manifestPath = join(dataDir, 'audio-manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`No scripts/audio-manifest.json in ${repoDir} — generate it first: npm run gen:audio`)
  process.exit(1)
}
const entries = JSON.parse(readFileSync(manifestPath, 'utf8')).entries ?? []

// The recorder is PACKAGE-owned, so resolving it from this file is correct (see _paths.mjs: the rule
// is never to resolve repo data that way). Spawned directly rather than through `npm run record` —
// one less process between the batch and ffmpeg/puppeteer for signals to cross, and it does not
// require the consuming repo to have declared a `record` script.
const RECORDER = join(pkgDir, 'record-course.mjs')

// ---- CLI ---------------------------------------------------------------------------------
function parse(argv) {
  const o = { courses: [], waitMin: 240, pollS: 120, pull: true, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--courses') o.courses.push(...(argv[++i] ?? '').split(',').filter(Boolean))
    else if (a.startsWith('--courses=')) o.courses.push(...a.slice(10).split(',').filter(Boolean))
    else if (a === '--wait') o.waitMin = +(argv[++i] ?? 0)
    else if (a.startsWith('--wait=')) o.waitMin = +a.slice(7)
    else if (a === '--poll') o.pollS = +(argv[++i] ?? 120)
    else if (a.startsWith('--poll=')) o.pollS = +a.slice(7)
    else if (a === '--no-pull') o.pull = false
    else if (a === '--force') o.force = true
    else { console.error(`unknown argument: ${a}`); process.exit(2) }
  }
  return o
}
const opt = parse(process.argv.slice(2))

// Syllabus order = the manifest's own order (it is generated from COURSES), not alphabetical.
const allCourses = [...new Set(entries.map((e) => e.course))]
const courses = opt.courses.length ? opt.courses : allCourses
const unknown = courses.filter((c) => !allCourses.includes(c))
if (unknown.length) {
  console.error(`unknown course(s): ${unknown.join(', ')}\nknown: ${allCourses.join(', ')}`)
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const hhmm = () => new Date().toTimeString().slice(0, 8)

// ---- narration state ---------------------------------------------------------------------
// A course is recordable when every section the manifest lists for it has a wav on disk.
function audioState(course) {
  const want = entries.filter((e) => e.course === course)
  const missing = want.filter((e) => !existsSync(join(repoDir, 'public', 'audio', e.file)))
  return { total: want.length, have: want.length - missing.length, missing: missing.map((e) => e.section) }
}

// ---- git ----------------------------------------------------------------------------------
// The branch is read rather than assumed: most repos record from `main`, but not all of them sit
// there (aws-lab is on `rebuild/atom-library`), and pulling a branch the repo is not on would
// either fail or quietly fetch the wrong wavs. A detached HEAD has nothing to track, so pulling is
// skipped instead of guessed at.
function currentBranch() {
  try {
    // stderr ignored: outside a git repo this prints git's own "fatal: not a git repository" ahead
    // of the note below, which reads like the batch broke when it is a supported case.
    const b = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return b && b !== 'HEAD' ? b : null
  } catch {
    return null
  }
}
const branch = opt.pull ? currentBranch() : null

// Fast-forward only: this repo's working tree is never the place Colab's commits get merged, so a
// non-ff situation means something unexpected and the batch should say so rather than resolve it.
function pull() {
  if (!opt.pull) return { ok: true, note: 'skipped (--no-pull)' }
  if (!branch) return { ok: true, note: 'skipped (detached HEAD or not a git repo)' }
  try {
    const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim()
    execFileSync('git', ['pull', '--ff-only', 'origin', branch], { cwd: repoDir, stdio: 'pipe' })
    const after = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim()
    return { ok: true, note: before === after ? 'already current' : `${before.slice(0, 7)} → ${after.slice(0, 7)}` }
  } catch (e) {
    // Network blips and transient GitHub errors are expected over a multi-hour run — report and
    // carry on with whatever the working tree already has rather than aborting the batch.
    return { ok: false, note: (e.stderr?.toString() || e.message).trim().split('\n').pop() }
  }
}

// ---- record ---------------------------------------------------------------------------------
function record(course) {
  return new Promise((done) => {
    const args = [RECORDER, course, ...(opt.force ? ['--force'] : [])]
    const child = spawn(process.execPath, args, { cwd: repoDir, stdio: 'inherit', env: process.env })
    current = child
    child.on('exit', (code) => { current = null; done(code ?? 1) })
    child.on('error', () => { current = null; done(1) })
  })
}

// Forward Ctrl-C to the running recorder so ffmpeg/puppeteer/vite do not outlive the batch.
let current = null
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { current?.kill(sig); console.log(`\n${sig} — stopping batch.`); process.exit(130) })
}

// ---- the batch --------------------------------------------------------------------------------
const results = []
console.log(`Batch 4K capture — ${courses.length} course(s): ${courses.join(', ')}`)
console.log(`  pull=${opt.pull}${branch ? ` (origin/${branch})` : ''} wait=${opt.waitMin}min poll=${opt.pollS}s force=${opt.force}\n`)

for (const course of courses) {
  console.log(`${'─'.repeat(72)}\n${course}  [${hhmm()}]`)

  const p = pull()
  console.log(`  git pull: ${p.ok ? p.note : `FAILED — ${p.note} (continuing with local tree)`}`)

  let st = audioState(course)
  // Colab commits one section at a time, so an incomplete course is usually just EARLY. Keep
  // pulling until it completes or the budget runs out; --wait 0 turns this into a plain skip.
  const deadline = Date.now() + opt.waitMin * 60_000
  while (st.missing.length && Date.now() < deadline) {
    console.log(`  audio ${st.have}/${st.total} — waiting ${opt.pollS}s for: ${st.missing.join(', ')}`)
    await sleep(opt.pollS * 1000)
    const q = pull()
    if (!q.ok) console.log(`  git pull: FAILED — ${q.note}`)
    st = audioState(course)
  }

  if (st.missing.length) {
    console.log(`  ⊘ SKIP — audio ${st.have}/${st.total}, still missing: ${st.missing.join(', ')}`)
    results.push({ course, status: 'skipped', detail: `${st.have}/${st.total} wavs` })
    continue
  }

  console.log(`  audio ${st.have}/${st.total} ✓ — recording\n`)
  const t0 = Date.now()
  const code = await record(course)
  const mins = ((Date.now() - t0) / 60_000).toFixed(1)
  if (code === 0) {
    console.log(`\n  ✅ ${course} — scripts/out/${course}.mp4 (${mins} min)`)
    results.push({ course, status: 'ok', detail: `${mins} min` })
  } else {
    console.log(`\n  ✗ ${course} — recorder exited ${code} (${mins} min)`)
    results.push({ course, status: 'failed', detail: `exit ${code}` })
  }
}

// ---- summary ------------------------------------------------------------------------------------
console.log(`\n${'═'.repeat(72)}\nSummary  [${hhmm()}]`)
for (const r of results) {
  const mark = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⊘ ' : '✗ '
  console.log(`  ${mark} ${r.course.padEnd(16)} ${r.status.padEnd(8)} ${r.detail}`)
}
const skipped = results.filter((r) => r.status === 'skipped').map((r) => r.course)
if (skipped.length) {
  console.log(`\nRe-run once Colab finishes — completed courses are reused from their segment cache:`)
  console.log(`  npm run record:all -- --courses ${skipped.join(',')}`)
}
process.exit(results.some((r) => r.status === 'failed') ? 1 : 0)
