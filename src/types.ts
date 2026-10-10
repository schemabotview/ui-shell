import type { Scene } from '@graphlearning/flow'

export interface Section {
  id: string
  title: string
  scene: string
  focus?: string
  slide: string
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
