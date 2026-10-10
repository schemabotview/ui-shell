import type { ReactNode } from 'react'

const KINDS = [
  { id: 'courses', label: 'Courses' },
  { id: 'labs', label: 'Labs' },
  { id: 'coach', label: 'Coach' },
]

function Mark() {
  return (
    <svg className="site__logo" width="28" height="28" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="80" fill="#e8804f" />
      <g fill="none" stroke="#ffffff" strokeWidth="58" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M 373 200 A 130 130 0 1 0 373 312" />
        <path d="M 283 312 L 373 312 L 373 410" />
      </g>
    </svg>
  )
}

export function SiteHeader({
  kind = 'courses',
  nav = KINDS,
  home = '/',
  actions,
}: {
  kind?: string
  nav?: { id: string; label: string }[]
  home?: string
  actions?: ReactNode
}) {
  return (
    <header className="site">
      <div className="site__inner">
        <a className="site__brand" href={home}>
          <Mark />
          <span className="site__name">GraphL</span>
        </a>
        <nav className="site__nav" aria-label="Sections">
          {nav.map((k) => (
            <a key={k.id} className="site__link" href={`${home}#${k.id}`} aria-current={k.id === kind ? 'page' : undefined}>
              {k.label}
            </a>
          ))}
        </nav>
        <div className="site__actions">{actions}</div>
      </div>
    </header>
  )
}
