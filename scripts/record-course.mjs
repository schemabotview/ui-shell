#!/usr/bin/env node
// record-course.mjs — [STEP 3, 4K LANDSCAPE] one course → one 3840×2160 MP4 for YouTube.
//
//   node scripts/record-course.mjs <course> [--force] [--only <id[,id]>]
//
// Blueprint: ../../graphl-studio/aws/scripts/record-course.mjs — the concat-safe encode contract
// (forced CFR + fixed timescale + gradfun deband + identical codec/pix/audio per segment so the
// final `-c copy` join is glitch-free) is lifted verbatim. What's DIFFERENT here: this app is
// SECTION-based, not beat-based — one section = one scene + one slide + one narration wav — so there
// is no reveal fold, no seek/transition/pan machinery. Each section is just: navigate the hash to
// its slug → wait for the painted, fitView-settled frame → hold for the clip → next.
//
// TRUE 4K (no fixed-stage trick): this app's layout is FLUID (react-flow fitView scales the scene
// into its pane; the slide's useSlideScale zooms its 806px design width to the live pane), so we set
// the puppeteer VIEWPORT directly to 3840×2160. page.screencast() records at the CSS viewport size
// (it ignores deviceScaleFactor), so the frames are exactly 3840×2160 = 2160p, natively.
//
// THE BELL = the section SEPARATOR: a synthesized three-note brand bell plays as a lead-in at the
// START of every section (the opening frame is held for STING_MS under the bell, then narration
// begins). Bell-at-each-start → a bell between all nine sections, combined into one video.
//
// Timing is driven by the wav length (ffprobe), never by playback: a missing clip falls back to 3s
// silence so the pipeline yields a video rather than hanging. Audio is read straight from
// public/audio/<course>/<id>.wav on disk (same-repo), not fetched over HTTP.
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

// ---- 4K landscape frame -----------------------------------------------------------------
const CW = process.env.WIDTH ? +process.env.WIDTH : 3840
const CH = process.env.HEIGHT ? +process.env.HEIGHT : 2160
const FPS = process.env.FPS ? +process.env.FPS : 30
// A brief held tail after each section so it breathes and audio is never clipped at the join.
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 500
// The brand bell lead-in that opens (and so separates) each section. STING_MS=0 or NO_STING disables.
const STING_MS = process.env.NO_STING ? 0 : process.env.STING_MS ? +process.env.STING_MS : 2800
const STING_SIG = STING_MS > 0 ? `bell-arp:v1:${STING_MS}` : 'none'

// Prefer a Homebrew ffmpeg (libx264 + gradfun deband kills dark-gradient banding on YouTube's codec);
// fall back to Apple hardware, then plain ffmpeg.
const FFMPEG =
  process.env.FFMPEG ??
  ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ??
  'ffmpeg'
const HAS_X264 = FFMPEG !== 'ffmpeg'
const VIDEO_CODEC = process.env.VIDEO_CODEC ?? (HAS_X264 ? 'libx264' : 'h264_videotoolbox')
const IS_X26X = /^libx26[45]$/.test(VIDEO_CODEC)
const CRF = process.env.VIDEO_CRF ?? '18'
const PRESET = process.env.VIDEO_PRESET ?? 'slow'
const BITRATE = process.env.VIDEO_BITRATE ?? '40M' // 4K needs more than 1080p's 16M
const ENCODE_SIG = IS_X26X ? `${VIDEO_CODEC}:crf${CRF}:${PRESET}` : `${VIDEO_CODEC}:b${BITRATE}`

// ---- ffmpeg helpers ---------------------------------------------------------------------
async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ])
  return parseFloat(stdout.trim())
}

// Concatenate audio inputs into one mono 44.1 kHz WAV via the concat FILTER (per-input resample): the
// bell bed is 44.1 kHz but a narration clip may be another rate, and the concat DEMUXER corrupts the
// timeline on a mismatch. The filter resamples each input first, so the join is clean.
async function concatAudio(inputs, dst) {
  const inArgs = inputs.flatMap((f) => ['-i', f])
  const chains = inputs.map((_, i) => `[${i}:a]aresample=44100[a${i}]`).join(';')
  const joins = inputs.map((_, i) => `[a${i}]`).join('')
  const filter = `${chains};${joins}concat=n=${inputs.length}:v=0:a=1[out]`
  await run(FFMPEG, ['-y', ...inArgs, '-filter_complex', filter, '-map', '[out]', '-ar', '44100', '-ac', '1', dst])
}

// Render the brand bell once → bell.wav, and return a helper that pads/trims it to a lead of STING_MS
// onto `dst`. No-op (returns null) when the sting is disabled.
async function prepareBell(tmp) {
  if (STING_MS <= 0) return null
  const bell = join(tmp, 'bell.wav')
  await run(FFMPEG, ['-y', '-filter_complex',
    'sine=f=587.33:d=2.4:sample_rate=44100,afade=t=out:st=0:d=2.4:curve=exp[a];' +
    'sine=f=880:d=2.4:sample_rate=44100,afade=t=out:st=0:d=2.4:curve=exp,adelay=200[b];' +
    'sine=f=1174.66:d=2.4:sample_rate=44100,afade=t=out:st=0:d=2.4:curve=exp,adelay=400[c];' +
    '[a][b][c]amix=inputs=3:normalize=0,volume=0.22,lowpass=f=3500,aformat=channel_layouts=mono',
    '-t', '2.6', bell])
  const secs = (STING_MS / 1000).toFixed(2)
  return (dst) => run(FFMPEG, ['-y', '-i', bell, '-af', `apad,atrim=0:${secs}`, '-ar', '44100', '-ac', '1', dst])
}

// Mux one section's webm + audio → MP4 with CONCAT-SAFE settings so the final `-c copy` concat is
// glitch-free: forced CFR, fixed video timescale, gradfun deband, and identical codec/pix/audio params
// for every segment. `total` (bell lead + clip + tail) bounds both streams; apad fills the tail.
async function encodeSegment(webm, audio, total, outMp4) {
  const quality = IS_X26X ? ['-preset', PRESET, '-crf', CRF] : ['-b:v', BITRATE]
  await run(FFMPEG, [
    '-y', '-i', webm, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-vf', 'gradfun=strength=0.9:radius=16',
    '-r', String(FPS), '-vsync', 'cfr', '-video_track_timescale', '90000',
    '-c:v', VIDEO_CODEC, ...quality, '-pix_fmt', 'yuv420p',
    '-af', 'apad', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '1',
    outMp4,
  ])
}

// ---- the app dev server -----------------------------------------------------------------
// Spawn `npm run dev` and resolve once Vite prints its Local URL. Set APP_URL to reuse a server.
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

// Navigate to a section and wait for its scene to be painted AND fitView-settled — the deterministic
// frame the reproducible-layout model depends on. A fresh goto per section forces a clean react-flow
// remount (it keys on scene id), so there is never a stale prior scene in the frame.
async function gotoSection(page, appBase, slug) {
  await page.goto(`${appBase}?capture=1#/${slug}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.react-flow__node', { timeout: 15000 })
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready })
  await sleep(700) // fitView (instant) + ResizeObserver re-fit + edge-pulse settle
}

// CDP screencast only emits a frame on a VISUAL CHANGE, so an otherwise-static section records an
// EMPTY webm (0 frames) and the mux fails. A 1px, ~1%-opacity speck nudged every animation frame
// keeps frames flowing; at 4K that sub-perceptible pixel is quantized away by x264. Removed on stop.
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
async function recordCourse(course, { force = false, only = [] } = {}) {
  const tmp = join(dataDir, '.tmp', course)
  const segDir = join(dataDir, 'segments', course)
  const outDir = join(dataDir, 'out')
  for (const d of [tmp, segDir, outDir]) mkdirSync(d, { recursive: true })

  const bellBed = await prepareBell(tmp)

  let server = null
  const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/?$/, '/') : null
  const appBase = base ?? (server = await startDevServer(), server.url)

  const puppeteer = (await loadPeer('puppeteer')).default
  let browser
  const segments = [] // ordered { mp4 } to concat
  try {
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: CW, height: CH, deviceScaleFactor: 1 },
      args: [`--window-size=${CW},${CH}`],
    })
    const page = await browser.newPage()
    await page.goto(`${appBase}?capture=1#/${course}`, { waitUntil: 'networkidle2' })

    // The app lays out its own course for the recorder (slug + course + section id + scene per section).
    await page.waitForFunction(() => !!window.__scene, { timeout: 20000 })
    const plan = await page.evaluate(() => window.__scene.plan())
    if (!plan?.length) throw new Error(`course "${course}" has no sections (bad id?)`)
    console.log(`Course ${course}: ${plan.length} sections @ ${CW}×${CH}\n`)

    let n = 0
    for (const sec of plan) {
      n++
      const tag = `${pad2(n)}-${sec.id}`
      // --only RESTRICTS which segments are (re)recorded; a run with it refreshes those segments and
      // SKIPS the final merge (a partial set can't concat into a whole video). A full run merges all.
      if (only.length && !only.some((t) => sec.id.includes(t) || tag.includes(t))) continue
      const segMp4 = join(segDir, `${tag}.mp4`)
      const sidecar = join(segDir, `${tag}.json`)
      const clip = join(tmp, `${tag}.wav`)

      // Narration wav straight off disk (same repo). Missing → 3s silence so the run never hangs.
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
        v: 1, audioHash, w: CW, h: CH, fps: FPS, tail: TAIL_MS, enc: ENCODE_SIG, sting: STING_SIG,
      }))
      const have = existsSync(segMp4) && existsSync(sidecar)
      if (!(force || !have || readJson(sidecar)?.fp !== fp)) {
        console.log(`  §${n} ${sec.id}  reuse`)
        segments.push(segMp4)
        continue
      }

      // Position → wait for the painted, framed frame → roll → hold (bell lead + clip + tail).
      const total = STING_MS / 1000 + dur + TAIL_MS / 1000
      await gotoSection(page, appBase, sec.slug)

      const webm = join(tmp, `${tag}.webm`)
      const recorder = await page.screencast({ path: webm })
      await startKeepalive(page)
      const lead = STING_MS > 0 ? `♪ ${(STING_MS / 1000).toFixed(1)}s + ` : ''
      console.log(`  §${n} ${sec.id}  ▶ record (${lead}${dur.toFixed(1)}s)`)
      await sleep(Math.round(total * 1000))
      await recorder.stop()
      await stopKeepalive(page)

      // Segment audio: bell lead + this section's clip; mirrors the video hold.
      let segAudio = clip
      if (STING_MS > 0 && bellBed) {
        const stingWav = join(tmp, `${tag}-sting.wav`)
        await bellBed(stingWav)
        segAudio = join(tmp, `${tag}-audio.wav`)
        await concatAudio([stingWav, clip], segAudio)
      }
      await encodeSegment(webm, segAudio, total, segMp4)
      writeFileSync(sidecar, JSON.stringify({ fp, builtAt: new Date().toISOString() }, null, 2))
      segments.push(segMp4)
      console.log(`  §${n} ${sec.id}  ✓ ${tag}.mp4`)
    }
  } finally {
    if (browser) await browser.close()
    if (server) server.child.kill('SIGTERM')
  }

  // A --only run refreshed just a subset of segments → there is no complete set to merge. Stop here;
  // a later full run (no --only) reuses every unchanged segment and concatenates the whole course.
  if (only.length) {
    console.log(`\n✔ recorded ${segments.length} segment(s) (--only) — skipping merge. Run without --only to build ${course}.mp4.`)
    return null
  }

  // Merge: concat demuxer + stream copy (uniform params → clean joins, seconds).
  const listFile = join(tmp, 'concat.txt')
  writeFileSync(listFile, segments.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  const out = join(outDir, `${course}.mp4`)
  console.log(`\nMerging ${segments.length} segments → scripts/out/${course}.mp4`)
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', out])
  console.log(`\n✅ ${out}`)
  return out
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
  console.error('usage: node scripts/record-course.mjs <course> [--force] [--only <id[,id]>]')
  process.exit(2)
}
recordCourse(course, { force, only }).catch((e) => {
  console.error('\n✗', e.message)
  process.exit(1)
})
