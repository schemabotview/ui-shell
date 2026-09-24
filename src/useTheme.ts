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

/** What the READER chose. 'deck' is the neutral state: no stored value, defer to the repo's prop. */
export type ThemeChoice = 'deck' | 'light' | 'dark'
export const THEME_CYCLE: ThemeChoice[] = ['deck', 'light', 'dark']

// localStorage throws in some privacy modes. A broken toggle must never take the page with it, so
// every access is guarded and the fallback is simply "deck" — which is the authored look anyway.
export function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'deck'
  } catch {
    return 'deck'
  }
}

function writeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'deck') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* the choice will not survive a reload; everything else still works */
  }
}

/**
 * The theme actually painted. CAPTURE PINS IT TO THE DECK, ignoring both the stored choice and the
 * reader entirely — and that is not a nicety. A recorder runs a fresh headless profile with empty
 * storage, so without this pin the neutral state would have to resolve somewhere, and every 4K
 * capture would depend on the machine that rendered it. The declared prop is the only thing burned
 * into a video.
 */
export const resolveTheme = (deck: ThemeKey, choice: ThemeChoice, capture: boolean): ThemeKey =>
  capture || choice === 'deck' ? deck : choice

/**
 * Owns the reader's choice and keeps <html data-theme> in step with it. Returns the resolved theme
 * to hand SceneView, plus the choice and a cycler for the toggle.
 */
export function useTheme(deck: ThemeKey, capture: boolean) {
  const [choice, setChoice] = useState<ThemeChoice>(() => (capture ? 'deck' : readChoice()))
  const theme = resolveTheme(deck, choice, capture)

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
      if (e.key === KEY || e.key === null) setChoice(readChoice())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [capture])

  // Swapping must look instantaneous. Several elements carry a 0.15s colour transition for hover,
  // and without suppressing them the ground flips at once while the nav and cards cross-fade behind
  // it — the switch reads as a smear rather than a change. Two nested rAFs: the first runs before
  // the paint that applies the new colours, the second after it. Ported from ui-graphl's theme.js.
  const cycle = useCallback(() => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(readChoice()) + 1) % THEME_CYCLE.length]
    writeChoice(next)
    const root = document.documentElement
    root.classList.add('theme-swap')
    setChoice(next)
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-swap')))
  }, [])

  return { theme, choice, cycle }
}
