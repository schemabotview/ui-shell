#!/usr/bin/env node
// gen-descriptions.mjs — write a YouTube description .txt per course.
//
//   node scripts/gen-descriptions.mjs            # all courses
//   node scripts/gen-descriptions.mjs foundations   # just one
//
// Adapted from ../../graphl-studio/aws/scripts/gen-descriptions.mjs for this SECTION-based repo. The
// reference was beat-based and read slide titles from the live DOM (driven in ?capture=1); here one
// SECTION = one scene + one slide + one narration wav, and every section already carries its own
// `title` in the typed registry — so we need NO browser at all. We evaluate the real COURSES registry
// via esbuild (the same bridge scripts/gen-audio-manifest.mjs uses) and read chapter titles straight
// off it; chapter TIMES are ffprobe'd off each section's wav and summed with record-course.mjs's own
// per-section timing (bell STING lead + clip + TAIL), so they line up with the concatenated MP4.
//
// Each description carries: a title + intro, CHAPTER timestamps (one per section, so YouTube
// auto-chapters the video), the full course series with deep links, and hashtags. Output lands at
// scripts/out/<course>.txt, next to the course's .mp4 / .png.
//
// Prerequisites: ffprobe on PATH; the app's audio present under public/audio/<course>/.

import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { join, resolve } from 'node:path'

const run = promisify(execFile)
import { loadPeer, repoDir, dataDir, concept } from './_paths.mjs'
const { build } = await loadPeer('esbuild')

// Match record-course.mjs's timing so chapter marks align with the concatenated video.
const STING_MS = process.env.NO_STING ? 0 : process.env.STING_MS ? +process.env.STING_MS : 2800
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 500
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫']

// The concept + where the app deploys, from the repo's scripts/concept.json (env vars still
// override — see _paths.mjs). Deep link is `${SITE}${APP_PATH}/#/<course>` (hash routing).
const CONCEPT = concept.name
const SITE = concept.site
const APP_PATH = concept.appPath
const HASHTAGS = concept.hashtags

// Curated PUBLISH titles (scripts/titles.json), keyed by course id — the search-facing name a course
// carries on YouTube ("SQL Queries"), deliberately distinct from the registry's narrative
// in-app title ("Data Ingestion"). Used for this video's headline AND every series entry, so the
// description names courses the same way the thumbnails and video titles do. Absent file → registry.
const PUBLISH_TITLES = (() => {
  const f = join(dataDir, 'titles.json')
  if (!existsSync(f)) return {}
  try {
    const { _comment, ...titles } = JSON.parse(readFileSync(f, 'utf8'))
    return titles
  } catch {
    return {}
  }
})()
const publishTitle = (course) => PUBLISH_TITLES[course.id] ?? course.title

const titleCase = (slug) => slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
// m:ss (or h:mm:ss past an hour) — YouTube chapter format; first chapter must be 0:00.
function stamp(sec) {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const p2 = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p2(m)}:${p2(ss)}` : `${m}:${p2(ss)}`
}

async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return parseFloat(stdout.trim())
}

// Evaluate the typed COURSES registry. The content files import ONLY `../types` (`import type` →
// erased), so the bundle has zero runtime deps and imports cleanly from memory.
async function loadRegistry() {
  const result = await build({
    entryPoints: [resolve(repoDir, 'src/content/index.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false,
  })
  const code = result.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}

// Build the description text for one course. Blocks are separated by a VISIBLE rule (not blank lines)
// so grouping survives even if YouTube trims empty lines on paste; chapters stay one-per-line
// (required for auto-chapters) and each series entry is a single line ending in its URL (clickable).
const RULE = '━━━━━━━━━━━━━━━━'
function compose({ course, chapters, series }) {
  const L = []
  // Headline: "<title> · <concept>", but drop the suffix when the publish title already leads with the
  // concept ("SQL Queries · SQL" stammers; the publish title is the whole name).
  const headline = publishTitle(course)
  L.push(headline.toLowerCase().startsWith(CONCEPT.toLowerCase()) ? headline : `${headline} · ${CONCEPT}`)
  L.push(RULE)
  // NB: this used to claim "the diagram assembles top-to-bottom as the narration walks through each
  // idea" — boilerplate inherited from the graphl-studio reveal-engine, where a camera really did
  // build a scene up beat by beat. THIS engine draws each scene SOLID (see record-course.mjs: "no
  // reveal fold, no seek/transition/pan machinery"), so nothing assembles and the sentence described
  // a video that does not exist. Same wrong line is still in the other concept repos' copies.
  L.push(
    `Part of GraphL's ${CONCEPT} series — every section pairs one diagram with the idea it explains, ` +
    `so the picture and the words land together.`,
  )
  L.push(RULE)
  L.push('⏱ CHAPTERS')
  for (const c of chapters) L.push(`${stamp(c.start)} ${c.title}`)
  L.push(RULE)
  L.push(`▶ ${CONCEPT.toUpperCase()} — THE SERIES`)
  series.forEach((s, i) => {
    const label = s.id === course.id ? `${publishTitle(s)}  ◀ this video` : publishTitle(s)
    L.push(`${CIRCLED[i] ?? '•'} ${label} → ${SITE}${APP_PATH}/#/${s.id}`)
  })
  L.push(RULE)
  L.push(`🔗 Watch interactively on GraphL → ${SITE}${APP_PATH}/#/${course.id}`)
  L.push(`🌐 More concepts → ${SITE}`)
  L.push(RULE)
  L.push(HASHTAGS)
  return L.join('\n') + '\n'
}

async function main() {
  const [oneCourse] = process.argv.slice(2)

  const reg = await loadRegistry()
  const series = Object.values(reg.COURSES) // catalog order (registry insertion order)
  const targets = oneCourse ? series.filter((c) => c.id === oneCourse) : series
  if (!targets.length) {
    console.error(`✗ no such course "${oneCourse}" (have: ${series.map((c) => c.id).join(', ')})`)
    process.exit(1)
  }

  const outDir = join(dataDir, 'out')
  mkdirSync(outDir, { recursive: true })

  for (const course of targets) {
    const audioDir = join(repoDir, 'public', 'audio', course.id)
    const chapters = []
    let t = 0
    let missing = 0
    for (const section of course.sections) {
      // Chapter starts at this section's bell lead-in (its first frame) — record-course.mjs holds the
      // opening frame for STING_MS under the bell, then the narration clip, then a TAIL.
      chapters.push({ start: t, title: section.title || titleCase(section.id) })
      const wav = join(audioDir, `${section.id}.wav`)
      const dur = existsSync(wav) ? await ffprobeDuration(wav) : (missing++, 3)
      t += STING_MS / 1000 + dur + TAIL_MS / 1000
    }

    const text = compose({ course, chapters, series })
    const out = join(outDir, `${course.id}.txt`)
    writeFileSync(out, text)
    const warn = missing ? `  ⚠ ${missing} section(s) had no wav (3s fallback)` : ''
    console.log(`✅ ${out}   (${chapters.length} chapters, ${stamp(t)} total)${warn}`)
  }
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1) })
