import { useCallback, useEffect, useState } from 'react'
import type { ThemeKey } from '@graphlearning/flow'

const KEY = 'graphl:theme'

const readStored = (): ThemeKey | null => {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function useTheme(deck: ThemeKey, capture: boolean) {
  const [stored, setStored] = useState(readStored)
  const theme = (!capture && stored) || deck

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    return () => document.documentElement.removeAttribute('data-theme')
  }, [theme])

  useEffect(() => {
    if (capture) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setStored(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [capture])

  const toggle = useCallback(() => {
    const next: ThemeKey = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    const root = document.documentElement
    root.classList.add('theme-swap')
    setStored(next)
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-swap')))
  }, [theme])

  return { theme, toggle }
}
