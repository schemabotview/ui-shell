#!/usr/bin/env node
// gen-audio-manifest.mjs — flatten the typed course catalog into the audio manifest.
//
// The Colab/Chatterbox notebook can't parse our TypeScript course files, so this is the bridge:
// it evaluates the REAL `COURSES` registry (esbuild strips the type-only `../types` imports, so the
// content files have no runtime deps) and folds every SECTION into one flat JSON entry, keyed to the
// audio contract path  `<courseId>/<section-id>.wav`.
//
// Unlike graphl-studio (one wav per BEAT → `<course>/<section>-<beat>.wav`), this repo's model is
// one section = one unit = one narration, so there is NO beat index — just `<course>/<section>.wav`.
//
//   Output: scripts/audio-manifest.json   →  { count, entries: [{ course, section, file, narration }] }
//
// Run:  npm run gen:audio   (then commit the json so the notebook sees it)

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { loadPeer, repoDir, dataDir } from './_paths.mjs'
const { build } = await loadPeer('esbuild')
const entry = resolve(repoDir, 'src/content/index.ts')
const outFile = resolve(dataDir, 'audio-manifest.json')

// Bundle the content registry to an in-memory ESM string. The content files import ONLY `../types`
// (`import type` → erased), so the bundle has zero runtime deps and imports cleanly in Node.
const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const code = result.outputFiles[0].text
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const { COURSES } = mod

const entries = []
for (const course of Object.values(COURSES)) {
  course.sections.forEach((section) => {
    entries.push({
      course: course.id,
      section: section.id,
      file: `${course.id}/${section.id}.wav`,
      narration: section.narration,
    })
  })
}

const manifest = { count: entries.length, entries }
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

// A short human summary — how many sections per course, so a bad fold is obvious at a glance.
const perCourse = {}
for (const e of entries) perCourse[e.course] = (perCourse[e.course] ?? 0) + 1
console.log(`Wrote ${entries.length} section(s) -> scripts/audio-manifest.json`)
for (const c of Object.values(COURSES))
  console.log(`  ${c.id.padEnd(12)} ${perCourse[c.id] ?? 0} section(s)`)
