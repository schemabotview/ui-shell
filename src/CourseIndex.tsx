import { useState } from 'react'
import type { Course } from './types'
import { allSections } from './types'
import { SiteHeader } from './SiteHeader'
import type { ReactNode } from 'react'

// The landing page: the GraphL course catalog. Each course is an ACCORDION — a header row (number ·
// title · section count) that expands to reveal its ordered sections; a section row routes to
// `#/<courseId>-<sectionId>`. Kept deliberately spare so it scales to ~11 courses without clutter.
// This is what an empty hash (`#/`) resolves to in App.tsx.
export function CourseIndex({
  courses,
  subject,
  kind,
  actions,
}: {
  courses: Course[]
  subject: string
  kind?: string // which nav section this app belongs to; see SiteHeader
  // SiteHeader's right-hand slot — the theme toggle. It rides the catalog ONLY, which is the whole
  // reason a reader-facing theme control is compatible with a deck being a video: SiteHeader never
  // renders on a section, so the control can never appear in a captured frame.
  actions?: ReactNode
}) {
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
    // The site bar is a SIBLING of .idx, not a child: it is full-bleed (its rule spans the
    // viewport) while .idx is a 940px centred column. Both use the same width and gutters, so the
    // brand lines up with the card edge below it.
    <>
      <SiteHeader kind={kind} actions={actions} />
      <div className="idx">
        {/* The GraphL wordmark used to be an eyebrow here; it is in the bar above now. What stays
            is `subject` — the repo's own name ("Python", "SQL"), the one piece of this page the
            shell cannot know. */}
        <header className="idx__head">
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
    </>
  )
}
