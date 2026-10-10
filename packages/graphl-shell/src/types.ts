// The content model. The shell owns it because the shell is what renders it: a content repo
// authors data that satisfies these types and never declares them itself.
//
// concept ⊃ course ⊃ section. A SECTION is the atomic unit of a reel: one slug, one scene, one
// slide, one narration clip.
//
//   slide     = terse markdown shown in the slide panel (for the eye)
//   narration = natural-flow spoken script for TTS (for the ear)

export interface Section {
  id: string // "what-is-cloud" → slug: foundations-what-is-cloud
  title: string
  scene: string // id of the scene drawn in the 9:16 stage (may be shared across sections)
  slide: string // markdown → rendered in the slide panel
  narration: string // TTS script
}

export interface Course {
  id: string
  title: string
  sections: Section[]
}

// How a content repo hands its scenes to the shell. The shell never imports a scene registry, so
// scenes stay entirely the repo's business and the shell has nothing to bundle or re-pin.
export type SceneLookup = (id: string) => import('@graphlearning/flow').Scene | undefined

// Slug = `<courseId>-<sectionId>`. Section is the unit, so there is no trailing beat index.
export function slugOf(course: Course, section: Section): string {
  return `${course.id}-${section.id}`
}

export function allSections(course: Course): { section: Section; slug: string }[] {
  return course.sections.map((section) => ({ section, slug: slugOf(course, section) }))
}
