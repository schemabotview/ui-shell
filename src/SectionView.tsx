import { useState } from 'react'
import { Home, Volume2, VolumeX, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'
import { SceneView, type ThemeKey } from '@graphlearning/flow'
import type { Section, SceneLookup } from './types'
import { SlidePanel } from './SlidePanel'
import { NarrationBar } from './NarrationBar'
import { themeLabel } from './ThemeToggle'

const tip = (label: string) => ({ 'aria-label': label, title: label })

export function SectionView({
  section,
  getScene,
  capture,
  eyebrow,
  index,
  total,
  onHome,
  onPrev,
  onNext,
  narrating,
  onToggleNarration,
  narrationAudio,
  theme,
  onToggleTheme,
}: {
  section: Section
  getScene: SceneLookup
  capture: boolean
  eyebrow: string
  index: number
  total: number
  onHome: () => void
  onPrev: () => void
  onNext: () => void
  narrating: boolean
  onToggleNarration: () => void
  narrationAudio: HTMLAudioElement | null
  theme: ThemeKey
  onToggleTheme?: () => void
}) {
  const [open, setOpen] = useState(false)
  const scene = getScene(section.scene)
  if (!scene) return <div className="stage stage--missing">no scene: {section.scene}</div>
  const dark = theme === 'dark'
  return (
    <div className="stage stage--section">
      <header className="reel-head">
        <button className="reel-head__eyebrow" onClick={onHome} {...tip('Back to catalog (Esc)')}>
          {eyebrow}
        </button>
        <h1 className="reel-head__title">{section.title}</h1>
      </header>
      {!capture && (
        <footer className="reel-foot reel-foot--controls">
          <span className="reel-foot__grp">
            <button className="reel-foot__ctrl" onClick={onHome} {...tip('Back to catalog (Esc)')}>
              <Home size={17} />
            </button>
            <button
              className="reel-foot__ctrl"
              onClick={onToggleNarration}
              {...tip(narrating ? 'Pause narration (Space)' : 'Play narration (Space)')}
            >
              {narrating ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {onToggleTheme && (
              <button className="reel-foot__ctrl" onClick={onToggleTheme} {...tip(themeLabel(theme))}>
                {dark ? <Moon size={17} /> : <Sun size={17} />}
              </button>
            )}
          </span>
          <NarrationBar audio={narrationAudio} />
          <span className="reel-foot__nav">
            <button className="reel-foot__ctrl" onClick={onPrev} {...tip('Previous section (Shift+←)')}>
              <ChevronLeft size={19} />
            </button>
            <span className="reel-foot__count reel-foot__count--live">
              {index + 1} / {total}
            </span>
            <button className="reel-foot__ctrl" onClick={onNext} {...tip('Next section (Shift+→)')}>
              <ChevronRight size={19} />
            </button>
          </span>
        </footer>
      )}
      <div className="scene-area">
        <SceneView scene={scene} focusId={section.focus} theme={theme} />
      </div>
      {!capture && (
        <button className="slide-toggle" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide slide' : 'Show slide'}>
          {open ? '›' : '‹'}
        </button>
      )}
      <SlidePanel slide={section.slide} open={open} />
    </div>
  )
}
