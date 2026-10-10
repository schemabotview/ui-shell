#!/usr/bin/env node

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { loadRegistry, publishTitles, titleCase, ffprobeDuration, repoDir, dataDir, concept } from './_paths.mjs'

const STING_MS = process.env.NO_STING ? 0 : process.env.STING_MS ? +process.env.STING_MS : 2800
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 500
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫']

const CONCEPT = concept.name
const SITE = concept.site
const APP_PATH = concept.appPath
const HASHTAGS = concept.hashtags

const PUBLISH_TITLES = publishTitles()
const publishTitle = (course) => PUBLISH_TITLES[course.id] ?? course.title

function stamp(sec) {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const p2 = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p2(m)}:${p2(ss)}` : `${m}:${p2(ss)}`
}

const RULE = '━━━━━━━━━━━━━━━━'
function compose({ course, chapters, series }) {
  const L = []
  const headline = publishTitle(course)
  L.push(headline.toLowerCase().startsWith(CONCEPT.toLowerCase()) ? headline : `${headline} · ${CONCEPT}`)
  L.push(RULE)
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
  const series = Object.values(reg.COURSES)
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
