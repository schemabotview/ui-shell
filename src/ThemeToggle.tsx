import type { ThemeKey } from '@graphlearning/flow'

const FACE: Record<ThemeKey, { glyph: string; label: string }> = {
  dark: { glyph: '☾', label: 'Dark theme' },
  light: { glyph: '☀', label: 'Light theme' },
}

export const themeLabel = (theme: ThemeKey) => {
  const next: ThemeKey = theme === 'dark' ? 'light' : 'dark'
  return `${FACE[theme].label}. Switch to ${FACE[next].label.toLowerCase()}.`
}

export function ThemeToggle({ theme, onToggle }: { theme: ThemeKey; onToggle: () => void }) {
  const label = themeLabel(theme)
  return (
    <button className="site__icon" type="button" onClick={onToggle} aria-label={label} title={label}>
      {FACE[theme].glyph}
    </button>
  )
}
