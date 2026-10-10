#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadRegistry, dataDir } from './_paths.mjs'

const outFile = resolve(dataDir, 'audio-manifest.json')
const { COURSES } = await loadRegistry()

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

const perCourse = {}
for (const e of entries) perCourse[e.course] = (perCourse[e.course] ?? 0) + 1
console.log(`Wrote ${entries.length} section(s) -> scripts/audio-manifest.json`)
for (const c of Object.values(COURSES))
  console.log(`  ${c.id.padEnd(12)} ${perCourse[c.id] ?? 0} section(s)`)
