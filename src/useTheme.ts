// The PLATFORM theme contract, shared with graphl.in. ui-graphl/theme.js is the original; this is
// the React port, and the two only stay one behaviour if neither drifts — same storage key, same
// values, same attribute, same cross-tab sync.
//
//   key        localStorage['graphl:theme']
//   values     'light' | 'dark' | absent
//   switch     data-theme on <html>; absent means "no explicit choice"
//
// Every GraphL app is same-origin under graphl.in, so a reader who picks light on the catalog walks
// into a concept app already light, with nothing passed between them. Keep all four stable.
//
// ONE DELIBERATE DIFFERENCE FROM THE CATALOG, and it is the important one. At graphl.in the neutral
// state means "follow the OS" (prefers-color-scheme). Here it means "follow the DECK" — the theme
// the repo declared on ConceptApp. A deck is authored: its scenes, slides and narration were built
// and reviewed in one look, and letting a reader's OS silently repaint an authored deck is not the
// same decision as letting it repaint a directory page. The stored VALUES stay identical, so the
// two apps never disagree about an explicit choice; only the absence is read differently.
//
// The capture path ignores all of this — see resolveTheme.

import { useCallback, useEffect, useState } from 'react'
import type { ThemeKey } from '@graphlearning/flow'

const KEY = 'graphl:theme'

// The stored choice, or null for "nothing chosen yet" — which means the deck's declared theme.
//
// THE TOGGLE IS TWO-STATE: dark <-> light, and nothing else. There is no reader-visible "deck" or
// "system" step. A third state costs a reader a press to get where they were going and has to be
// labelled something ("Deck theme") that means nothing to them. The ABSENCE of a stored value still
// means the deck's theme — that is what a first visit and every capture get — but once a reader has
// an opinion the control simply flips, which is what every dark-mode toggle they have ever used does.
//
// localStorage throws in some privacy modes. A broken toggle must never take the page with it, so
// every access is guarded and the fallback is simply "nothing chosen".
export function readStored(): ThemeKey | null {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function writeStored(choice: ThemeKey) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* the choice will not survive a reload; everything else still works */
  }
}

/**
 * The theme actually painted. CAPTURE PINS IT TO THE DECK, ignoring the stored choice and the reader
 * entirely — and that is not a nicety. A recorder runs a fresh headless profile with empty storage,
 * so without this pin what a capture painted would depend on the machine that rendered it. The
 * declared prop is the only thing burned into a video.
 */
export const resolveTheme = (deck: ThemeKey, stored: ThemeKey | null, capture: boolean): ThemeKey =>
  capture || !stored ? deck : stored

/**
 * Owns the reader's choice and keeps <html data-theme> in step with it. Returns the theme to hand
 * SceneView, plus a two-state flip for the toggle.
 */
export function useTheme(deck: ThemeKey, capture: boolean) {
  const [stored, setStored] = useState<ThemeKey | null>(() => (capture ? null : readStored()))
  const theme = resolveTheme(deck, stored, capture)

  // The attribute goes on <html>, not a wrapper: ConceptApp renders a fragment, and a wrapping
  // element would change the section view's box model — which is burned into every recorded video.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    return () => document.documentElement.removeAttribute('data-theme')
  }, [theme])

  // Another GraphL app on the same origin changed the choice — follow it, so the platform does not
  // disagree with itself between two tabs. Never while capturing.
  useEffect(() => {
    if (capture) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setStored(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [capture])

  // Swapping must look instantaneous. Several elements carry a 0.15s colour transition for hover,
  // and without suppressing them the ground flips at once while the nav and cards cross-fade behind
  // it — the switch reads as a smear rather than a change. Two nested rAFs: the first runs before
  // the paint that applies the new colours, the second after it. Ported from ui-graphl's theme.js.
  const toggle = useCallback(() => {
    const next: ThemeKey = theme === 'dark' ? 'light' : 'dark'
    writeStored(next)
    const root = document.documentElement
    root.classList.add('theme-swap')
    setStored(next)
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-swap')))
  }, [theme])

  return { theme, toggle }
}
