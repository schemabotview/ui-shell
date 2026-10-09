import type { Course } from './types'

// Presentation only: IDs remain the routing/audio contract.
export function courseEyebrow(subject: string, prefix: string | undefined, course: Pick<Course, 'id' | 'title'>, mode: 'title' | 'id'): string {
  const concept = (prefix ?? subject).trim()
  let label = mode === 'id' ? course.id : course.title.trim()
  if (mode === 'title') {
    for (const candidate of [subject.trim(), concept]) {
      if (candidate && label.toLowerCase().startsWith(candidate.toLowerCase() + ' ')) {
        label = label.slice(candidate.length).trim()
        break
      }
    }
  }
  return `${concept.toUpperCase()} · ${label.toUpperCase()}`
}
