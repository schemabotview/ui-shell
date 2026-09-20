import type { ReactNode } from 'react'

// Platform chrome — the bar that sits above every GraphL page, here and at graphl.in. It is
// deliberately ignorant of courses, scenes and this repo's subject: the whole point is that it
// renders byte-identically on all eight sites, so a reader crossing from the catalog into a
// concept app never leaves "the site". The repo's own name belongs in the <h1> below it.
//
// This is a PORT, not a new design. ui-graphl/index.html + styles.css are the original; the markup,
// the class names and the CSS are the same, because two implementations of one design only stay one
// design if neither drifts. When you change one, change the other.
//
// Not a component contract worth withholding: unlike SectionView, this has no route surface and the
// recorder never sees it (it renders on the catalog page only), so exporting it costs nothing — and
// python-lab, which is React but does not use ConceptApp, needs exactly this and nothing else.

// The nav, mirroring catalog.json's `kinds`. Duplicated rather than fetched: the catalog lives at
// graphl.in and this package is built separately, so reading it would mean a runtime fetch, a
// loading state in the page's chrome, and a dev-server fallback — for a list that has been three
// items all year. `nav` is a prop so a fourth section does not have to wait on seven repo upgrades.
const KINDS = [
  { id: 'courses', label: 'Courses' },
  { id: 'labs', label: 'Labs' },
  { id: 'coach', label: 'Coach' },
]

// The mark, inlined rather than referenced as /icon.svg. A content repo builds with `base` set to
// its own subpath ("/python/"), so a relative src resolves somewhere else on every site and an
// absolute one breaks the dev fixture; 335 bytes of SVG has neither problem, and nothing to flash.
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
  // Which nav item is "you are here" — a catalog.json `kind` id. A content repo is 'courses';
  // python-lab is 'labs'. Defaulted so the seven content repos pass nothing at all.
  kind?: string
  nav?: { id: string; label: string }[]
  // Where the brand points. '/' is the root catalog and is correct for every app deployed under
  // graphl.in; it is a prop only because the ui-shell dev fixture is not deployed under it.
  home?: string
  // Right-hand slot. The theme toggle and the account control land here when they exist, injected
  // by whoever owns them — the shell itself will never import Firebase.
  actions?: ReactNode
}) {
  return (
    <header className="site">
      <div className="site__inner">
        <a className="site__brand" href={home}>
          <Mark />
          <span className="site__name">GraphL</span>
        </a>
        {/* Real anchors to <home>#<kind>, the same links app.js writes at the catalog — so
            middle-click, copy-link and keyboard all work without a single handler here. */}
        <nav className="site__nav" aria-label="Sections">
          {nav.map((k) => (
            <a
              key={k.id}
              className="site__link"
              href={`${home}#${k.id}`}
              {...(k.id === kind ? { 'aria-current': 'page' as const } : {})}
            >
              {k.label}
            </a>
          ))}
        </nav>
        <div className="site__actions">{actions}</div>
      </div>
    </header>
  )
}
