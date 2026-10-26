import { Home, Volume2, VolumeX, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'
import { Scene, type ThemeKey } from '@graphlearning/graphl-flow'
import type { Section, SceneLookup } from './types'
import { NarrationBar } from './NarrationBar'
import { themeLabel } from './ThemeToggle'

const tip = (label: string) => ({ 'aria-label': label, title: label })

export function SectionView({
  section,
  getScene,
  capture,
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
  const scene = getScene(section.scene)
  if (!scene) return <div className="stage stage--missing">no scene: {section.scene}</div>
  const dark = theme === 'dark'
  return (
    <div className="stage stage--section">
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
        {/* Keyed by scene id: a new scene gets a fresh <Scene>. Unkeyed, hash navigation reused one
            instance, so the next scene was measured under the previous one's fit (sub-pixel route
            drift) and its data-fit could read "ready" before it settled — the recorder's signal.
            Sections that reuse one scene with a different focus keep the instance; nothing moves. */}
        <Scene key={section.scene} scene={scene} focus={section.focus} theme={theme} />
      </div>
    </div>
  )
}
