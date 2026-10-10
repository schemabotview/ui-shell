#!/usr/bin/env node

import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, isAbsolute } from 'node:path'

import { loadPeer, loadRegistry, publishTitles, titleCase, repoDir, dataDir, pkgDir, concept, run, sleep, FFMPEG, openApp } from './_paths.mjs'

const W = 1920
const H = 1080
const SCALE = process.env.SCALE ? +process.env.SCALE : 2
const CW = W * SCALE
const CH = H * SCALE

const TEMPLATE = join(pkgDir, 'thumb-template.html')
const LOGO_CANDIDATES = [
  process.env.LOGO_SVG,
  join(dataDir, 'logo.svg'),
  join(repoDir, 'public', 'icon.svg'),
].filter(Boolean)
const LOGO_SVG = LOGO_CANDIDATES.find(existsSync) ?? null

const CONCEPT = concept.kicker
const DEFAULT_PANEL_BG = concept.panelBg
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function parse(argv) {
  const pos = []
  const opt = { section: 0, at: 900, out: null, full4k: false, title: null, kicker: null, number: null, panel: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--section') opt.section = +argv[++i]
    else if (a === '--at') opt.at = +argv[++i]
    else if (a === '--out') opt.out = argv[++i]
    else if (a === '--title') opt.title = argv[++i]
    else if (a === '--kicker') opt.kicker = argv[++i]
    else if (a === '--number') opt.number = argv[++i]
    else if (a === '--panel') opt.panel = argv[++i]
    else if (a === '--full4k') opt.full4k = true
    else pos.push(a)
  }
  return { pos, opt }
}

const PUBLISH_TITLES = publishTitles()

async function courseTitle(course) {
  if (PUBLISH_TITLES[course]) return PUBLISH_TITLES[course]
  try {
    const reg = await loadRegistry()
    return reg.COURSES?.[course]?.title ?? null
  } catch {
    return null
  }
}

async function makeThumb(course, opt) {
  if (!existsSync(TEMPLATE)) throw new Error(`template not found: ${TEMPLATE}`)

  const outDir = join(dataDir, 'out')
  mkdirSync(outDir, { recursive: true })
  const outArg = opt.out ?? `${course}.png`
  const out = isAbsolute(outArg) || outArg.includes('/') ? outArg : join(outDir, outArg)

  const server = await openApp()
  const appBase = server.url

  const puppeteer = (await loadPeer('puppeteer')).default
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: CW, height: CH, deviceScaleFactor: 1 },
      args: [`--window-size=${CW},${CH}`, '--autoplay-policy=no-user-gesture-required'],
    })
    const page = await browser.newPage()

    await page.goto(`${appBase}?capture=1#/${course}`, { waitUntil: 'networkidle2' })
    await page.waitForFunction(() => !!window.__scene, { timeout: 20000 })
    const plan = await page.evaluate(() => window.__scene.plan())
    if (!plan?.length) throw new Error(`course "${course}" has no sections (bad id?)`)
    const sec = plan[opt.section]
    if (!sec) throw new Error(`section ${opt.section} out of range (course has ${plan.length})`)

    await page.goto(`${appBase}?capture=1#/${sec.slug}`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.react-flow__node', { timeout: 15000 })
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready })
    await sleep(opt.at)

    const scenePane = await page.$('.scene-area')
    if (!scenePane) throw new Error('.scene-area not found (SectionView markup changed?)')
    const sceneB64 = await scenePane.screenshot({ encoding: 'base64' })
    const sceneUri = `data:image/png;base64,${sceneB64}`

    const title = opt.title ?? (await courseTitle(course)) ?? titleCase(course)
    const kicker = opt.kicker ?? CONCEPT
    const numberHtml = opt.number ? `<div class="thumb__number">${esc(opt.number)}</div>` : ''
    const logoSvg = LOGO_SVG ? readFileSync(LOGO_SVG, 'utf8').replace('<svg ', '<svg class="thumb__logo" ') : ''
    const panelBg = opt.panel ?? DEFAULT_PANEL_BG

    const html = readFileSync(TEMPLATE, 'utf8')
      .replaceAll('{{SCENE}}', sceneUri)
      .replaceAll('{{KICKER}}', esc(kicker))
      .replaceAll('{{NUMBER}}', numberHtml)
      .replaceAll('{{TITLE}}', esc(title))
      .replaceAll('{{LOGO}}', logoSvg)
      .replaceAll('{{PANEL_BG}}', panelBg)

    await page.evaluate((h) => { document.body.innerHTML = h }, html)
    await page.evaluate(() => document.fonts.ready)
    await sleep(200)

    mkdirSync(dirname(out), { recursive: true })
    const shot = opt.full4k ? out : join(tmpdir(), `thumb-4k-${Date.now()}.png`)
    await page.screenshot({ path: shot })
    if (!opt.full4k) {
      await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', shot, '-vf', 'scale=1280:720:flags=lanczos', out])
      rmSync(shot, { force: true })
    }
    console.log(`\n✅ ${out}   (${kicker} — ${title})`)
    return out
  } finally {
    if (browser) await browser.close()
    server.child?.kill('SIGTERM')
  }
}

const { pos, opt } = parse(process.argv.slice(2))
const [course] = pos
if (!course) {
  console.error('usage: node scripts/thumb.mjs <course> [--section N] [--title T] [--kicker K] [--number NN] [--panel css-gradient] [--out file] [--full4k] [--at ms]')
  process.exit(2)
}
makeThumb(course, opt).catch((e) => {
  console.error('\n✗', e.message)
  process.exit(1)
})
