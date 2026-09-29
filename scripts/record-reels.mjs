#!/usr/bin/env node
// record-reels.mjs — [STEP 3, PORTRAIT REELS] one course → NINE standalone 1080×1920 MP4s.
//
//   node scripts/record-reels.mjs <course> [--force] [--only <id[,id]>]
//
// The vertical-video sibling of record-course.mjs. Deliberately SELF-CONTAINED (no shared module) so
// the two recorders can diverge freely. What's different from the 4K recorder:
//   • PORTRAIT 1080×1920 (9:16, the standard Reels/Shorts frame). At this viewport the app's portrait
//     CSS kicks in: the slide becomes an off-canvas drawer (hidden under ?capture=1), so the recorded
//     frame is a SCENE-ONLY full-bleed 9:16 — the narration carries the words.
//   • NINE INDEPENDENT files (out/reels/<course>-<id>.mp4), one per section — NOT concatenated. Each
//     reel is its own upload, so there is NO separator bell and NO lead-in sting.
//   • Otherwise the capture contract is identical: navigate the hash → wait for the painted,
//     fitView-settled frame → screencast → mux against the wav's duration (ffprobe) + a short tail.
//
// LOOP CAPTURE, same as the 4K recorder: the only motion in the frame is the edge pulse — ui-flow's
// FlowEdge draws it as an SVG <animateMotion dur="2.4s" repeatCount="indefinite"> per edge — so the
// composition is PERIODIC with a 2.4s period. We screencast ONE window that is a whole number of
// those periods (default ONE, 2.4s — a pulse crosses its whole edge in exactly one period), which by
// construction shows every edge's flow end-to-end and joins back onto itself seamlessly whatever
// phase the recording started in, then LOOP it over
// the narration's length at encode time (-stream_loop -1) instead of holding the browser for the
// whole wav. LOOP_MS snaps to a whole period; NO_LOOP=1 restores the old full-length capture.
//
// TRUE portrait pixels: the layout is fluid, so we set the puppeteer VIEWPORT to 1080×1920 directly
// and page.screencast() records at exactly that CSS size. Audio is read straight off disk from
// public/audio/<course>/<id>.wav; a missing clip falls back to 3s silence so the run never hangs.
//
// Prerequisites: ffmpeg + ffprobe on PATH (Homebrew ffmpeg preferred — libx264 + gradfun deband).

import { execFile, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { join, resolve } from 'node:path'

const run = promisify(execFile)
import { loadPeer, repoDir, dataDir } from './_paths.mjs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)
const pad2 = (n) => String(n).padStart(2, '0')
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }

// ---- portrait reel frame ----------------------------------------------------------------
const CW = process.env.WIDTH ? +process.env.WIDTH : 1080
const CH = process.env.HEIGHT ? +process.env.HEIGHT : 1920
const FPS = process.env.FPS ? +process.env.FPS : 30
// A short held tail so the reel doesn't cut on the last syllable.
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 500

const FFMPEG =
  process.env.FFMPEG ??
  ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ??
  'ffmpeg'
const HAS_X264 = FFMPEG !== 'ffmpeg'
const VIDEO_CODEC = process.env.VIDEO_CODEC ?? (HAS_X264 ? 'libx264' : 'h264_videotoolbox')
const IS_X26X = /^libx26[45]$/.test(VIDEO_CODEC)
const CRF = process.env.VIDEO_CRF ?? '18'
const PRESET = process.env.VIDEO_PRESET ?? 'slow'
const BITRATE = process.env.VIDEO_BITRATE ?? '16M' // 1080×1920 ≈ 1080p pixel budget
const ENCODE_SIG = IS_X26X ? `${VIDEO_CODEC}:crf${CRF}:${PRESET}` : `${VIDEO_CODEC}:b${BITRATE}`

// ---- the loop window --------------------------------------------------------------------
// The edge pulse's period, from ui-flow's FlowEdge (`animateMotion dur="2.4s"`).
const PULSE_S = process.env.PULSE_S ? +process.env.PULSE_S : 2.4
const NO_LOOP = !!process.env.NO_LOOP
// The recorded window, in WHOLE pulse periods: LOOP_MS (or LOOP_CYCLES) is snapped to the nearest
// one, because a window that is not a whole period ends on a different pulse position than it began
// and the loop join then jumps. Default 1 → ONE period, 2.4s: a pulse crosses its whole edge in
// exactly one period, so a single cycle already shows every edge's flow end-to-end and more cycles
// only record the same picture again. The cost of the short window is that a capture hiccup inside
// it (a dropped frame, a late re-fit) repeats for the whole section instead of a fifth of it — raise
// LOOP_CYCLES if a section ever shows one.
const LOOP_CYCLES = Math.max(1, Math.round(
  (process.env.LOOP_MS ? +process.env.LOOP_MS / 1000 : +(process.env.LOOP_CYCLES ?? 1) * PULSE_S) / PULSE_S,
))
const LOOP_S = LOOP_CYCLES * PULSE_S
// LEAD_S is discarded ramp-up (screencast takes a moment to emit its first frame); GUARD_S is
// recorded past the window so the exact trim can never run off the end of the webm.
const LEAD_S = process.env.LOOP_LEAD_S ? +process.env.LOOP_LEAD_S : 0.5
const GUARD_S = 0.5
const LOOP_SIG = NO_LOOP ? 'none' : `loop:v1:${LOOP_S.toFixed(2)}+${LEAD_S.toFixed(2)}`
// Intermediate quality for the loop clip (see makeLoopClip) when the codec is not CRF-based.
const LOOP_BITRATE = process.env.LOOP_BITRATE ?? '40M'

// ---- ffmpeg helpers ---------------------------------------------------------------------
async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ])
  return parseFloat(stdout.trim())
}

// Normalize the recording into the clip that gets looped: exactly LOOP_S starting LEAD_S in, at a
// forced CFR so the frame count is whole and the join lands on a frame boundary. The trim is
// OUTPUT-side (-ss after -i) — frame-accurate, and the source is only seconds long. Near-lossless and
// ultrafast on purpose: this is an intermediate, and the reel's own encode below sets final quality.
async function makeLoopClip(webm, dst) {
  const quality = IS_X26X ? ['-preset', 'ultrafast', '-crf', '14'] : ['-b:v', LOOP_BITRATE]
  await run(FFMPEG, [
    '-y', '-i', webm, '-ss', LEAD_S.toFixed(3), '-t', LOOP_S.toFixed(3),
    '-an', '-r', String(FPS), '-vsync', 'cfr',
    '-c:v', VIDEO_CODEC, ...quality, '-pix_fmt', 'yuv420p',
    dst,
  ])
}

// Mux one reel's video + clip → a standalone MP4. Same crisp encode as the 4K recorder (gradfun
// deband, yuv420p, faststart) but this is a FINAL file, not a concat segment, so it needs no uniform
// timescale. `total` (clip + tail) bounds both streams; apad extends the clip with silence to fill.
// `loop` repeats the input for as long as `total` asks for — that is what turns one 7.2s window into
// a full-length reel — and `-t` is what stops the otherwise endless input.
async function encodeReel(video, clip, total, outMp4, { loop = false } = {}) {
  const quality = IS_X26X ? ['-preset', PRESET, '-crf', CRF] : ['-b:v', BITRATE]
  await run(FFMPEG, [
    '-y', ...(loop ? ['-stream_loop', '-1'] : []), '-i', video, '-i', clip,
    '-map', '0:v:0', '-map', '1:a:0',
    '-vf', 'gradfun=strength=0.9:radius=16',
    '-r', String(FPS), '-vsync', 'cfr',
    '-c:v', VIDEO_CODEC, ...quality, '-pix_fmt', 'yuv420p',
    '-af', 'apad', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '1',
    '-movflags', '+faststart',
    outMp4,
  ])
}

// ---- the app dev server -----------------------------------------------------------------
async function startDevServer() {
  console.log(`Starting dev server: ${repoDir} …`)
  const child = spawn('npm', ['run', 'dev'], { cwd: repoDir, env: process.env })
  const url = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('dev server did not print a URL within 60s')), 60000)
    const onData = (buf) => {
      const m = String(buf).match(/https?:\/\/localhost:\d+\/?/)
      if (m) { clearTimeout(to); child.stdout.off('data', onData); res(m[0].replace(/\/?$/, '/')) }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (b) => process.env.DEBUG && process.stderr.write(b))
    child.on('exit', (code) => rej(new Error(`dev server exited early (code ${code})`)))
  })
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* not up yet */ }
    await sleep(250)
  }
  console.log(`  dev server at ${url}`)
  return { child, url }
}

// Navigate to a section and wait for its scene to be painted AND fitView-settled. A fresh goto per
// reel forces a clean react-flow remount (it keys on scene id), so no stale prior scene is in frame.
async function gotoSection(page, appBase, slug) {
  await page.goto(`${appBase}?capture=1#/${slug}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.react-flow__node', { timeout: 15000 })
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready })
  await sleep(700) // fitView (instant) + ResizeObserver re-fit + edge-pulse settle
}

// CDP screencast only emits a frame on a VISUAL CHANGE, so an otherwise-static reel records an EMPTY
// webm and the mux fails. A 1px, ~1%-opacity speck nudged every animation frame keeps frames flowing;
// it is quantized away by x264. Removed on stop.
async function startKeepalive(page) {
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = '__cap_keepalive'
    d.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;background:#888;opacity:0.01;' +
      'pointer-events:none;z-index:2147483647;will-change:transform'
    document.body.appendChild(d)
    let x = 0
    const loop = () => {
      x = (x + 3) % 30
      d.style.transform = `translate3d(${x}px,0,0)`
      window.__cap_raf = requestAnimationFrame(loop)
    }
    loop()
  })
}
async function stopKeepalive(page) {
  await page.evaluate(() => {
    if (window.__cap_raf) cancelAnimationFrame(window.__cap_raf)
    document.getElementById('__cap_keepalive')?.remove()
  })
}

// ---- record -----------------------------------------------------------------------------
async function recordReels(course, { force = false, only = [] } = {}) {
  const tmp = join(dataDir, '.tmp', `${course}-reels`)
  const outDir = join(dataDir, 'out', 'reels')
  for (const d of [tmp, outDir]) mkdirSync(d, { recursive: true })

  let server = null
  const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/?$/, '/') : null
  const appBase = base ?? (server = await startDevServer(), server.url)

  const puppeteer = (await loadPeer('puppeteer')).default
  let browser
  const made = []
  try {
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: CW, height: CH, deviceScaleFactor: 1 },
      args: [`--window-size=${CW},${CH}`],
    })
    const page = await browser.newPage()
    await page.goto(`${appBase}?capture=1#/${course}`, { waitUntil: 'networkidle2' })

    await page.waitForFunction(() => !!window.__scene, { timeout: 20000 })
    const plan = await page.evaluate(() => window.__scene.plan())
    if (!plan?.length) throw new Error(`course "${course}" has no sections (bad id?)`)
    console.log(`Course ${course}: ${plan.length} reels @ ${CW}×${CH}\n`)

    let n = 0
    for (const sec of plan) {
      n++
      const tag = `${course}-${sec.id}`
      // Each reel is its own file, so --only truly RESTRICTS the set: skip any section not listed.
      if (only.length && !only.some((t) => sec.id.includes(t) || tag.includes(t))) continue
      const outMp4 = join(outDir, `${tag}.mp4`)
      const sidecar = join(tmp, `${pad2(n)}-${sec.id}.json`)
      const clip = join(tmp, `${pad2(n)}-${sec.id}.wav`)

      // Narration wav straight off disk. Missing → 3s silence so the run never hangs.
      const wav = resolve(repoDir, 'public', 'audio', sec.course, `${sec.id}.wav`)
      let dur, audioHash
      if (existsSync(wav)) {
        const buf = readFileSync(wav)
        writeFileSync(clip, buf)
        audioHash = sha(buf)
        dur = await ffprobeDuration(clip)
      } else {
        await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3', clip])
        audioHash = 'silence3'
        dur = 3
        console.warn(`  §${n} ${sec.id}: no audio → 3s silence`)
      }

      // Incremental reuse: re-record iff missing/changed (or --force / --only match).
      const fp = sha(JSON.stringify({
        v: 2, audioHash, w: CW, h: CH, fps: FPS, tail: TAIL_MS, enc: ENCODE_SIG, loop: LOOP_SIG,
      }))
      if (!(force || !existsSync(outMp4) || readJson(sidecar)?.fp !== fp)) {
        console.log(`  §${n} ${sec.id}  reuse`)
        made.push(outMp4)
        continue
      }

      // Loop capture rolls for the WINDOW (lead + whole pulse periods + guard) and lets the encode
      // repeat it over the reel; NO_LOOP holds for the whole clip + tail as it used to.
      const total = dur + TAIL_MS / 1000
      const roll = NO_LOOP ? total : LEAD_S + LOOP_S + GUARD_S
      await gotoSection(page, appBase, sec.slug)

      const webm = join(tmp, `${pad2(n)}-${sec.id}.webm`)
      const recorder = await page.screencast({ path: webm })
      await startKeepalive(page)
      console.log(`  §${n} ${sec.id}  ▶ record ${NO_LOOP
        ? `${dur.toFixed(1)}s`
        : `${roll.toFixed(1)}s window → ${dur.toFixed(1)}s looped`}`)
      await sleep(Math.round(roll * 1000))
      await recorder.stop()
      await stopKeepalive(page)

      // One exact, seamlessly-loopable window; -stream_loop repeats it to the reel's length.
      let video = webm
      if (!NO_LOOP) {
        video = join(tmp, `${pad2(n)}-${sec.id}-loop.mp4`)
        await makeLoopClip(webm, video)
      }

      await encodeReel(video, clip, total, outMp4, { loop: !NO_LOOP })
      writeFileSync(sidecar, JSON.stringify({ fp, builtAt: new Date().toISOString() }, null, 2))
      made.push(outMp4)
      console.log(`  §${n} ${sec.id}  ✓ reels/${tag}.mp4`)
    }
  } finally {
    if (browser) await browser.close()
    if (server) server.child.kill('SIGTERM')
  }

  console.log(`\n✅ ${made.length} reel(s) → scripts/out/reels/`)
  return made
}

// ---- CLI --------------------------------------------------------------------------------
function parse(argv) {
  const pos = []
  const only = []
  let force = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') force = true
    else if (a === '--only') only.push(...(argv[++i] ?? '').split(',').filter(Boolean))
    else if (a.startsWith('--only=')) only.push(...a.slice(7).split(',').filter(Boolean))
    else pos.push(a)
  }
  return { pos, only, force }
}

const { pos, only, force } = parse(process.argv.slice(2))
const [course] = pos
if (!course) {
  console.error('usage: node scripts/record-reels.mjs <course> [--force] [--only <id[,id]>]')
  process.exit(2)
}
recordReels(course, { force, only }).catch((e) => {
  console.error('\n✗', e.message)
  process.exit(1)
})
