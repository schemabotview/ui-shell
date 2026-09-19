#!/usr/bin/env node
// Quick 4K visual check — one PNG per section at 3840×2160, no screencast/audio/ffmpeg.
// Mirrors record-course.mjs's viewport + capture route + fit-wait, so the framing matches the video.
//   node scripts/shots-4k.mjs [course] [--only id[,id]]
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { loadPeer, repoDir, dataDir } from './_paths.mjs'
const outDir = join(dataDir, 'out', 'shots-4k')
mkdirSync(outDir, { recursive: true })
const CW = +(process.env.WIDTH ?? 3840), CH = +(process.env.HEIGHT ?? 2160)
const course = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'foundations'
const onlyArg = process.argv.indexOf('--only')
const only = onlyArg !== -1 ? (process.argv[onlyArg + 1] ?? '').split(',').filter(Boolean) : []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Reuse an already-running server (e.g. the frozen `npm run capture` snapshot on :5181) via APP_URL so
// you can keep editing source meanwhile; otherwise spawn a throwaway dev server.
let child = null, url = process.env.APP_URL ? process.env.APP_URL.replace(/\/?$/, '/') : null
if (!url) {
  child = spawn('npm', ['run', 'dev'], { cwd: repoDir, env: process.env })
  url = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('no dev url in 60s')), 60000)
    child.stdout.on('data', (b) => { const m = String(b).match(/https?:\/\/localhost:\d+\/?/); if (m) { clearTimeout(to); res(m[0].replace(/\/?$/, '/')) } })
    child.on('exit', (c) => rej(new Error(`dev exited ${c}`)))
  })
}
for (let i = 0; i < 40; i++) { try { if ((await fetch(url)).ok) break } catch {} await sleep(250) }
console.log(`server ${url} — shooting ${CW}×${CH}`)

const puppeteer = (await loadPeer('puppeteer')).default
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: CW, height: CH, deviceScaleFactor: 1 })

await page.goto(`${url}?capture=1#/`, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => !!window.__scene, { timeout: 20000 })
let plan = await page.evaluate(() => window.__scene.plan())
plan = plan.filter((p) => p.course === course && (only.length === 0 || only.includes(p.id)))

let n = 0
for (const p of plan) {
  await page.goto(`${url}?capture=1#/${p.slug}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.react-flow__node', { timeout: 15000 })
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready })
  await sleep(900) // fitView + ResizeObserver re-fit + edge-pulse settle (matches recorder)
  const file = join(outDir, `${String(++n).padStart(2, '0')}-${p.id}.png`)
  await page.screenshot({ path: file })
  console.log(`  ${p.slug} → ${file}`)
}
await browser.close(); child?.kill('SIGTERM')
console.log(`\n✅ ${n} shots in ${outDir}`)
process.exit(0)
