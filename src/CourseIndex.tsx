import { useState } from 'react'
import type { Course } from './types'
import { allSections } from './types'

// The landing page: the GraphL course catalog. Each course is an ACCORDION — a header row (number ·
// title · section count) that expands to reveal its ordered sections; a section row routes to
// `#/<courseId>-<sectionId>`. Kept deliberately spare so it scales to ~11 courses without clutter.
// This is what an empty hash (`#/`) resolves to in App.tsx.
export function CourseIndex({ courses, subject }: { courses: Course[]; subject: string }) {
  // Which courses are expanded (multiple may be open). All start collapsed so the catalog opens as a
  // compact one-row-per-course list — it stays tidy as courses grow to ~11.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="idx">
      {/* GraphL = the platform brand (constant across every content repo); the eyebrow links back to
          the root graphl.in catalog. `subject` is the repo's own name ("Python", "SQL"), passed in
          by the app — the one piece of this page the shell cannot know. */}
      <header className="idx__head">
        <a className="idx__brand" href="/">
          GraphL
        </a>
        <h1 className="idx__subject">{subject}</h1>
      </header>

      {courses.length === 0 ? (
        <p className="idx__empty">No courses authored yet — the app shell is ready.</p>
      ) : (
        <ol className="idx__grid">
          {courses.map((course, i) => {
            const sections = allSections(course)
            const isOpen = open.has(course.id)
            return (
              <li key={course.id} className={`idx-card${isOpen ? ' idx-card--open' : ''}`}>
                <button
                  className="idx-card__head"
                  onClick={() => toggle(course.id)}
                  aria-expanded={isOpen}
                >
                  <span className="idx-card__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="idx-card__title">{course.title}</span>
                  <span className="idx-card__count">{sections.length} sections</span>
                  <span className="idx-card__toggle" aria-hidden="true">
                    ⌄
                  </span>
                </button>

                {isOpen && (
                  <ol className="idx-sec">
                    {sections.map(({ section, slug }, j) => (
                      <li key={slug} className="idx-sec__row">
                        <a href={`#/${slug}`}>
                          <span className="idx-sec__num">{j + 1}</span>
                          <span className="idx-sec__title">{section.title}</span>
                          <span className="idx-sec__chev" aria-hidden="true">
                            ›
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <footer className="idx__foot">
        <span className="idx__hint">
          <kbd>→</kbd> next · <kbd>←</kbd> prev · <kbd>Space</kbd> narration
        </span>
      </footer>
    </div>
  )
}
