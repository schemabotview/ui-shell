// The theme control, for SiteHeader's `actions` slot. A PORT of ui-graphl's #theme button — same
// three-step cycle, same glyphs, same "where you are AND what the press does" accessible name.
//
// WHY IT IS SAFE TO HAVE A READER CONTROL AT ALL, given a deck is a video: this renders inside
// SiteHeader, and SiteHeader renders on the CATALOG PAGE ONLY, never on a section. The control
// itself can therefore never appear in a captured frame. The choice it stores does carry into
// sections when a human browses them, which is the point — and capture pins to the declared deck
// theme regardless (see useTheme's resolveTheme).
//
// The neutral step is labelled "Deck theme", not "System": here it means the look the repo authored,
// not the OS. See the note in useTheme.ts about that one deliberate divergence from the catalog.

import { THEME_CYCLE, type ThemeChoice } from './useTheme'

const FACE: Record<ThemeChoice, { glyph: string; label: string }> = {
  deck: { glyph: '◐', label: 'Deck theme' },
  light: { glyph: '☀', label: 'Light theme' },
  dark: { glyph: '☾', label: 'Dark theme' },
}

export function ThemeToggle({ choice, onCycle }: { choice: ThemeChoice; onCycle: () => void }) {
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(choice) + 1) % THEME_CYCLE.length]
  // The glyph alone cannot say where you are or what pressing does, so the name says both.
  const label = `${FACE[choice].label}. Switch to ${FACE[next].label.toLowerCase()}.`
  return (
    <button className="site__icon" type="button" onClick={onCycle} aria-label={label} title={label}>
      {FACE[choice].glyph}
    </button>
  )
}
