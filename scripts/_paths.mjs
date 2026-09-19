// Where these scripts read and write, now that they live in a package rather than in each repo.
//
// They used to resolve everything relative to their own file (`here = dirname(import.meta.url)`),
// which worked only because scripts/ sat inside the app. From node_modules that points at the
// package, so the two roots are now explicit:
//
//   repoDir — the content repo being built. npm run <script> sets cwd to the package root, so
//             process.cwd() IS the repo. Source, public/audio and the dev server live here.
//   dataDir — repoDir/scripts: the repo's own script DATA (titles.json, audio-manifest.json) and
//             every output (out/, segments/, .tmp/). Deliberately the same paths as before the
//             extraction, so .gitignore entries and muscle memory still hold.
//   pkgDir  — this package's scripts/: machinery that ships with the shell (thumb-template.html).
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const pkgDir = dirname(fileURLToPath(import.meta.url))
export const repoDir = process.cwd()
export const dataDir = join(repoDir, 'scripts')

if (!existsSync(join(repoDir, 'package.json'))) {
  console.error(`No package.json in ${repoDir} — run this from a content repo's root (npm run …).`)
  process.exit(1)
}

// scripts/concept.json — the per-repo publishing identity. These used to be hardcoded defaults in
// each repo's copy of thumb.mjs / gen-descriptions.mjs, which is exactly why they drifted (aws's
// panel gradient was still AWS-orange in sql's copy for a while). Env vars still override, as before.
const CONFIG_PATH = join(dataDir, 'concept.json')
const raw = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {}

export const concept = {
  // The concept name used in video DESCRIPTIONS ("Apache Spark"). Not necessarily the app's
  // subject — databricks-data-engineer publishes as "Databricks".
  name: process.env.CONCEPT ?? raw.concept ?? 'GraphL',
  // The THUMBNAIL kicker, which is not always the same string: apache-spark's descriptions say
  // "Apache Spark" while its thumbnails say "SPARK" (a long name does not fit the panel). The two
  // lived in separate script copies before the extraction, so the divergence was invisible —
  // collapsing them into one field silently rebrands that concept's thumbnails.
  kicker: process.env.CONCEPT_KICKER ?? raw.kicker ?? process.env.CONCEPT ?? raw.concept ?? 'GraphL',
  site: process.env.SITE ?? raw.site ?? 'https://graphl.in',
  // The catalog path the app deploys under — usually /<repo>, but aws deploys at /aws-content.
  appPath: (process.env.APP_PATH ?? raw.appPath ?? '/').replace(/\/$/, ''),
  hashtags: process.env.HASHTAGS ?? raw.hashtags ?? '#TechEducation',
  // The thumbnail's right-hand panel gradient, anchored on the concept's --brand.
  panelBg: process.env.PANEL_BG ?? raw.panelBg ?? 'radial-gradient(118% 104% at 70% 34%, #5b8cff 0%, #2a4fb8 44%, #0b1330 100%)',
}

// Load a peer dependency (puppeteer, esbuild) from the CONTENT REPO, not from this package.
//
// A bare `import('puppeteer')` resolves by walking up from the importing FILE. These scripts live in
// node_modules/@graphlearning/shell/scripts, and under a local `file:../ui-shell` install that path
// is a symlink — node resolves it to the real ui-shell/ directory and walks up from there, never
// reaching the repo's node_modules. Anchoring the resolution at repoDir works under both layouts,
// and it is also the honest description of the dependency: these are the REPO's tools, which the
// scripts borrow. (esbuild previously resolved only by accident, via ui-shell's own vite install —
// that would have failed outright once this package was consumed from the registry.)
const requireFromRepo = createRequire(join(repoDir, 'package.json'))

export async function loadPeer(name) {
  try {
    return await import(pathToFileURL(requireFromRepo.resolve(name)).href)
  } catch {
    console.error(`Missing "${name}" in ${repoDir}. It is an optional peer of @graphlearning/shell, ` +
                  `needed by the capture/record scripts — install it there: npm i -D ${name}`)
    process.exit(1)
  }
}

export { resolve }
