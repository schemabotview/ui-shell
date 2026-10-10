#!/usr/bin/env node

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

const RECORDER = join(pkgDir, 'record-course.mjs')

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

const allCourses = [...new Set(entries.map((e) => e.course))]
const courses = opt.courses.length ? opt.courses : allCourses
const unknown = courses.filter((c) => !allCourses.includes(c))
if (unknown.length) {
  console.error(`unknown course(s): ${unknown.join(', ')}\nknown: ${allCourses.join(', ')}`)
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const hhmm = () => new Date().toTimeString().slice(0, 8)

function audioState(course) {
  const want = entries.filter((e) => e.course === course)
  const missing = want.filter((e) => !existsSync(join(repoDir, 'public', 'audio', e.file)))
  return { total: want.length, have: want.length - missing.length, missing: missing.map((e) => e.section) }
}

function currentBranch() {
  try {
    const b = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return b && b !== 'HEAD' ? b : null
  } catch {
    return null
  }
}
const branch = opt.pull ? currentBranch() : null

function pull() {
  if (!opt.pull) return { ok: true, note: 'skipped (--no-pull)' }
  if (!branch) return { ok: true, note: 'skipped (detached HEAD or not a git repo)' }
  try {
    const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim()
    execFileSync('git', ['pull', '--ff-only', 'origin', branch], { cwd: repoDir, stdio: 'pipe' })
    const after = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim()
    return { ok: true, note: before === after ? 'already current' : `${before.slice(0, 7)} → ${after.slice(0, 7)}` }
  } catch (e) {
    return { ok: false, note: (e.stderr?.toString() || e.message).trim().split('\n').pop() }
  }
}

let current = null
function record(course) {
  return new Promise((done) => {
    const args = [RECORDER, course, ...(opt.force ? ['--force'] : [])]
    const child = spawn(process.execPath, args, { cwd: repoDir, stdio: 'inherit', env: process.env })
    current = child
    child.on('exit', (code) => { current = null; done(code ?? 1) })
    child.on('error', () => { current = null; done(1) })
  })
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { current?.kill(sig); console.log(`\n${sig} — stopping batch.`); process.exit(130) })
}

const results = []
console.log(`Batch 4K capture — ${courses.length} course(s): ${courses.join(', ')}`)
console.log(`  pull=${opt.pull}${branch ? ` (origin/${branch})` : ''} wait=${opt.waitMin}min poll=${opt.pollS}s force=${opt.force}\n`)

for (const course of courses) {
  console.log(`${'─'.repeat(72)}\n${course}  [${hhmm()}]`)

  const p = pull()
  console.log(`  git pull: ${p.ok ? p.note : `FAILED — ${p.note} (continuing with local tree)`}`)

  let st = audioState(course)
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
