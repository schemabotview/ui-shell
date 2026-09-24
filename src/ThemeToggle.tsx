// The theme control, for SiteHeader's `actions` slot. A PORT of ui-graphl's #theme button — same
// square icon, same "where you are AND what the press does" accessible name.
//
// TWO STATES, dark <-> light. The catalog cycles through a third, `system`; this does not, and the
// difference is deliberate. A concept app has an authored look, so the neutral step would have to be
// labelled "Deck theme" — a phrase that means nothing to a reader and costs them a press to get
// where they were going. The ABSENCE of a stored choice still resolves to the deck's theme, which is
// what a first visit and every capture get; the control just never walks back to it.
//
// WHY A READER CONTROL IS SAFE AT ALL, given a deck is a video: this renders inside SiteHeader, and
// SiteHeader renders on the CATALOG PAGE ONLY, never on a section. The control can therefore never
// appear in a captured frame, and capture pins to the declared deck theme regardless (see useTheme).

import type { ThemeKey } from '@graphlearning/flow'

// The glyph shows where you ARE, not where the press goes — a toggle that previews its destination
// reads as already-switched at a glance.
const FACE: Record<ThemeKey, { glyph: string; label: string }> = {
  dark: { glyph: '☾', label: 'Dark theme' },
  light: { glyph: '☀', label: 'Light theme' },
}

export function ThemeToggle({ theme, onToggle }: { theme: ThemeKey; onToggle: () => void }) {
  const next: ThemeKey = theme === 'dark' ? 'light' : 'dark'
  const label = `${FACE[theme].label}. Switch to ${FACE[next].label.toLowerCase()}.`
  return (
    <button className="site__icon" type="button" onClick={onToggle} aria-label={label} title={label}>
      {FACE[theme].glyph}
    </button>
  )
}
