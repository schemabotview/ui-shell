import type { Scene } from '@graphlearning/flow'

export interface Section {
  id: string
  title: string
  scene: string
  focus?: string
  slide?: string
  narration: string
}

export interface Course {
  id: string
  title: string
  sections: Section[]
}

export type SceneLookup = (id: string) => Scene | undefined

export const slugOf = (course: Course, section: Section) => `${course.id}-${section.id}`

export const allSections = (course: Course) =>
  course.sections.map((section) => ({ section, slug: slugOf(course, section) }))

/** The aspect of a section's scene area, for content repos that size a fixed frame template to it.
 *
 *  A section frame carries no header by default (ConceptApp's `sectionHeader`), so the scene area
 *  is the whole 16:9 frame and a template of this shape is fitted edge to edge with no slack band.
 *  Derive the template's height from it rather than hardcoding one:
 *
 *      const TOTAL_H = Math.round(TEMPLATE_W / SCENE_ASPECT)
 *
 *  With `sectionHeader` on, the header takes the top 6.5vh and the usable aspect is ~1.91 instead. */
export const SCENE_ASPECT = 16 / 9
