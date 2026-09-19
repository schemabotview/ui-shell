// The content model, owned by the shell because the shell is what renders it. A content repo
// authors data that satisfies these types; it no longer declares them (every repo's copy of
// content/types.ts was byte-identical, which is the definition of a shared contract).
//
// concept ⊃ course ⊃ section. A SECTION is the atomic unit of a video: one slug (course-section),
// one scene, one slide, one narration clip.
//
// The authoring contract:  .md (source of truth) → (.slide, .tts)
//   slide     = terse markdown shown in the SlidePanel (for the eye)
//   narration = natural-flow spoken script for TTS / Chatterbox (for the ear)

export interface Section {
  id: string // "what-is-cloud" → slug: foundations-what-is-cloud
  title: string
  scene: string // scene id shown behind the panel (may be shared across sections)
  focus?: string // node the slide floats clear of (optional)
  slide: string // markdown → rendered in the SlidePanel
  narration: string // natural-flow TTS script (Chatterbox)
}

export interface Course {
  id: string
  title: string
  sections: Section[]
}

// How a content repo hands its scenes to the shell. The shell never imports a scene registry — it
// is given this lookup, so scenes stay entirely the repo's business.
export type SceneLookup = (id: string) => import('@graphlearning/flow').Scene | undefined

// The slug for a section is `<courseId>-<sectionId>` — section IS the unit (one slide, one
// narration), so no trailing beat index.
export function slugOf(course: Course, section: Section): string {
  return `${course.id}-${section.id}`
}

export function allSections(course: Course): { section: Section; slug: string }[] {
  return course.sections.map((section) => ({ section, slug: slugOf(course, section) }))
}
