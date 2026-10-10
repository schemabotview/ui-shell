import { useState, type ReactNode } from 'react'
import { allSections, type Course } from './types'
import { SiteHeader } from './SiteHeader'

export function CourseIndex({
  courses,
  subject,
  kind,
  actions,
}: {
  courses: Course[]
  subject: string
  kind?: string
  actions?: ReactNode
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <>
      <SiteHeader kind={kind} actions={actions} />
      <div className="idx">
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
                  <button className="idx-card__head" onClick={() => toggle(course.id)} aria-expanded={isOpen}>
                    <span className="idx-card__num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="idx-card__title">{course.title}</span>
                    <span className="idx-card__count">
                      {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                    </span>
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
