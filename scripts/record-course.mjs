#!/usr/bin/env node

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

import { loadPeer, repoDir, dataDir, run, sleep, FFMPEG, ffprobeDuration, openApp, gotoSection, startKeepalive, stopKeepalive } from './_paths.mjs'
const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)
const pad2 = (n) => String(n).padStart(2, '0')
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }

const CW = process.env.WIDTH ? +process.env.WIDTH : 3840
const CH = process.env.HEIGHT ? +process.env.HEIGHT : 2160
const FPS = process.env.FPS ? +process.env.FPS : 30
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 500
const STING_MS = process.env.NO_STING ? 0 : process.env.STING_MS ? +process.env.STING_MS : 2800
const STING_SIG = STING_MS > 0 ? `bell-arp:v1:${STING_MS}` : 'none'

const PULSE_S = process.env.PULSE_S ? +process.env.PULSE_S : 2.4
const NO_LOOP = !!process.env.NO_LOOP
const LOOP_CYCLES = Math.max(1, Math.round(
  (process.env.LOOP_MS ? +process.env.LOOP_MS / 1000 : +(process.env.LOOP_CYCLES ?? 1) * PULSE_S) / PULSE_S,
))
const LOOP_S = LOOP_CYCLES * PULSE_S
const LEAD_S = process.env.LOOP_LEAD_S ? +process.env.LOOP_LEAD_S : 0.5
const GUARD_S = 0.5
const LOOP_SIG = NO_LOOP ? 'none' : `loop:v1:${LOOP_S.toFixed(2)}+${LEAD_S.toFixed(2)}`
const LOOP_BITRATE = process.env.LOOP_BITRATE ?? '120M'

const HAS_X264 = FFMPEG !== 'ffmpeg'
const VIDEO_CODEC = process.env.VIDEO_CODEC ?? (HAS_X264 ? 'libx264' : 'h264_videotoolbox')
const IS_X26X = /^libx26[45]$/.test(VIDEO_CODEC)
const CRF = process.env.VIDEO_CRF ?? '18'
const PRESET = process.env.VIDEO_PRESET ?? 'slow'
const BITRATE = process.env.VIDEO_BITRATE ?? '40M'
const ENCODE_SIG = IS_X26X ? `${VIDEO_CODEC}:crf${CRF}:${PRESET}` : `${VIDEO_CODEC}:b${BITRATE}`

async function concatAudio(inputs, dst) {
  const inArgs = inputs.flatMap((f) => ['-i', f])
  const chains = inputs.map((_, i) => `[${i}:a]aresample=44100[a${i}]`).join(';')
  const joins = inputs.map((_, i) => `[a${i}]`).join('')
  const filter = `${chains};${joins}concat=n=${inputs.length}:v=0:a=1[out]`
  await run(FFMPEG, ['-y', ...inArgs, '-filter_complex', filter, '-map', '[out]', '-ar', '44100', '-ac', '1', dst])
}

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

async function makeLoopClip(webm, dst) {
  const quality = IS_X26X ? ['-preset', 'ultrafast', '-crf', '14'] : ['-b:v', LOOP_BITRATE]
  await run(FFMPEG, [
    '-y', '-i', webm, '-ss', LEAD_S.toFixed(3), '-t', LOOP_S.toFixed(3),
    '-an', '-r', String(FPS), '-vsync', 'cfr',
    '-c:v', VIDEO_CODEC, ...quality, '-pix_fmt', 'yuv420p',
    dst,
  ])
}

async function encodeSegment(video, audio, total, outMp4, { loop = false } = {}) {
  const quality = IS_X26X ? ['-preset', PRESET, '-crf', CRF] : ['-b:v', BITRATE]
  await run(FFMPEG, [
    '-y', ...(loop ? ['-stream_loop', '-1'] : []), '-i', video, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-vf', 'gradfun=strength=0.9:radius=16',
    '-r', String(FPS), '-vsync', 'cfr', '-video_track_timescale', '90000',
    '-c:v', VIDEO_CODEC, ...quality, '-pix_fmt', 'yuv420p',
    '-af', 'apad', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '1',
    outMp4,
  ])
}

async function recordCourse(course, { force = false, only = [] } = {}) {
  const tmp = join(dataDir, '.tmp', course)
  const segDir = join(dataDir, 'segments', course)
  const outDir = join(dataDir, 'out')
  for (const d of [tmp, segDir, outDir]) mkdirSync(d, { recursive: true })

  const bellBed = await prepareBell(tmp)

  const server = await openApp()
  const appBase = server.url

  const puppeteer = (await loadPeer('puppeteer')).default
  let browser
  const segments = []
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
    console.log(`Course ${course}: ${plan.length} sections @ ${CW}×${CH}\n`)

    let n = 0
    for (const sec of plan) {
      n++
      const tag = `${pad2(n)}-${sec.id}`
      if (only.length && !only.some((t) => sec.id.includes(t) || tag.includes(t))) continue
      const segMp4 = join(segDir, `${tag}.mp4`)
      const sidecar = join(segDir, `${tag}.json`)
      const clip = join(tmp, `${tag}.wav`)

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

      const fp = sha(JSON.stringify({
        v: 2, audioHash, w: CW, h: CH, fps: FPS, tail: TAIL_MS, enc: ENCODE_SIG, sting: STING_SIG,
        loop: LOOP_SIG,
      }))
      const have = existsSync(segMp4) && existsSync(sidecar)
      if (!(force || !have || readJson(sidecar)?.fp !== fp)) {
        console.log(`  §${n} ${sec.id}  reuse`)
        segments.push(segMp4)
        continue
      }

      const total = STING_MS / 1000 + dur + TAIL_MS / 1000
      const roll = NO_LOOP ? total : LEAD_S + LOOP_S + GUARD_S
      await gotoSection(page, appBase, sec.slug)

      const webm = join(tmp, `${tag}.webm`)
      const recorder = await page.screencast({ path: webm })
      await startKeepalive(page)
      const lead = STING_MS > 0 ? `♪ ${(STING_MS / 1000).toFixed(1)}s + ` : ''
      const how = NO_LOOP
        ? `${lead}${dur.toFixed(1)}s`
        : `${roll.toFixed(1)}s window → ${lead}${dur.toFixed(1)}s looped`
      console.log(`  §${n} ${sec.id}  ▶ record ${how}`)
      await sleep(Math.round(roll * 1000))
      await recorder.stop()
      await stopKeepalive(page)

      let video = webm
      if (!NO_LOOP) {
        video = join(tmp, `${tag}-loop.mp4`)
        await makeLoopClip(webm, video)
      }

      let segAudio = clip
      if (STING_MS > 0 && bellBed) {
        const stingWav = join(tmp, `${tag}-sting.wav`)
        await bellBed(stingWav)
        segAudio = join(tmp, `${tag}-audio.wav`)
        await concatAudio([stingWav, clip], segAudio)
      }
      await encodeSegment(video, segAudio, total, segMp4, { loop: !NO_LOOP })
      writeFileSync(sidecar, JSON.stringify({ fp, builtAt: new Date().toISOString() }, null, 2))
      segments.push(segMp4)
      console.log(`  §${n} ${sec.id}  ✓ ${tag}.mp4`)
    }
  } finally {
    if (browser) await browser.close()
    server.child?.kill('SIGTERM')
  }

  if (only.length) {
    console.log(`\n✔ recorded ${segments.length} segment(s) (--only) — skipping merge. Run without --only to build ${course}.mp4.`)
    return null
  }

  const listFile = join(tmp, 'concat.txt')
  writeFileSync(listFile, segments.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  const out = join(outDir, `${course}.mp4`)
  console.log(`\nMerging ${segments.length} segments → scripts/out/${course}.mp4`)
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', out])
  console.log(`\n✅ ${out}`)
  return out
}

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
