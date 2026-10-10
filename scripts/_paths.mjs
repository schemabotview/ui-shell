import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

export const pkgDir = dirname(fileURLToPath(import.meta.url))
export const repoDir = process.cwd()
export const dataDir = join(repoDir, 'scripts')

if (!existsSync(join(repoDir, 'package.json'))) {
  console.error(`No package.json in ${repoDir} — run this from a content repo's root (npm run …).`)
  process.exit(1)
}

const CONFIG_PATH = join(dataDir, 'concept.json')
const raw = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {}

export const concept = {
  name: process.env.CONCEPT ?? raw.concept ?? 'GraphL',
  kicker: process.env.CONCEPT_KICKER ?? raw.kicker ?? process.env.CONCEPT ?? raw.concept ?? 'GraphL',
  site: process.env.SITE ?? raw.site ?? 'https://graphl.in',
  appPath: (process.env.APP_PATH ?? raw.appPath ?? '/').replace(/\/$/, ''),
  hashtags: process.env.HASHTAGS ?? raw.hashtags ?? '#TechEducation',
  panelBg: process.env.PANEL_BG ?? raw.panelBg ?? 'radial-gradient(118% 104% at 70% 34%, #5b8cff 0%, #2a4fb8 44%, #0b1330 100%)',
}

export const run = promisify(execFile)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const titleCase = (slug) => slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const FFMPEG =
  process.env.FFMPEG ?? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ?? 'ffmpeg'

export async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return parseFloat(stdout.trim())
}

const requireFromRepo = createRequire(join(repoDir, 'package.json'))

export async function loadPeer(name) {
  try {
    return await import(pathToFileURL(requireFromRepo.resolve(name)).href)
  } catch {
    console.error(
      `Missing "${name}" in ${repoDir}. It is an optional peer of @graphlearning/shell, ` +
        `needed by the capture/record scripts — install it there: npm i -D ${name}`,
    )
    process.exit(1)
  }
}

export async function loadRegistry() {
  const { build } = await loadPeer('esbuild')
  const result = await build({
    entryPoints: [resolve(repoDir, 'src/content/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}

export function publishTitles() {
  try {
    const { _comment, ...titles } = JSON.parse(readFileSync(join(dataDir, 'titles.json'), 'utf8'))
    return titles
  } catch {
    return {}
  }
}

async function startDevServer() {
  console.log(`Starting dev server: ${repoDir} …`)
  const child = spawn('npm', ['run', 'dev'], { cwd: repoDir, env: process.env })
  const url = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('dev server did not print a URL within 60s')), 60000)
    const onData = (buf) => {
      const m = String(buf).match(/https?:\/\/localhost:\d+\/?/)
      if (m) {
        clearTimeout(to)
        child.stdout.off('data', onData)
        res(m[0].replace(/\/?$/, '/'))
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (b) => process.env.DEBUG && process.stderr.write(b))
    child.on('exit', (code) => rej(new Error(`dev server exited early (code ${code})`)))
  })
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(url)).ok) break
    } catch {}
    await sleep(250)
  }
  console.log(`  dev server at ${url}`)
  return { child, url }
}

export const openApp = async () =>
  process.env.APP_URL
    ? { child: null, url: process.env.APP_URL.replace(/\/?$/, '/') }
    : startDevServer()

export async function gotoSection(page, appBase, slug) {
  await page.goto(`${appBase}?capture=1#/${slug}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.react-flow__node', { timeout: 15000 })
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await sleep(700)
}

export async function startKeepalive(page) {
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

export async function stopKeepalive(page) {
  await page.evaluate(() => {
    if (window.__cap_raf) cancelAnimationFrame(window.__cap_raf)
    document.getElementById('__cap_keepalive')?.remove()
  })
}
