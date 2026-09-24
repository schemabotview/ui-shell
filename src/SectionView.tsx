import { useState } from 'react'
import { Home, Volume2, VolumeX, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'
import { SceneView, type ThemeKey } from '@graphlearning/flow'
import type { Section, SceneLookup } from './types'
import { SlidePanel } from './SlidePanel'

// The SECTION view = the final composited output of a slug (course-section): the vertical scene +
// the fixed-right slide, with an eyebrow + section title header. Layout is responsive (CSS):
//   landscape (laptop → 4K video)  — scene fills the left, slide is a right column; the title lives
//                                    in the slide, so the header shows just the eyebrow.
//   portrait  (mobile → reel)      — scene fills the frame, slide is a full-width drawer toggled at
//                                    top-right; the header shows the full title card.
// Under ?capture=1 the frame is clean for video: just the eyebrow + title + scene — NO footer and NO
// interactive controls (the drawer toggle and the footer control bar are both suppressed).
// Interactively, a footer control bar carries Home + narration + prev/next (raised above the drawer
// so it works while the slide is open), the drawer toggle appears in portrait, and the eyebrow also
// links back to the catalog. Keyboard works everywhere (← / → navigate, Space toggles narration).
export function SectionView({
  section,
  getScene,
  capture = false,
  eyebrow,
  index = 0,
  total = 0,
  onHome,
  onPrev,
  onNext,
  narrating = false,
  onToggleNarration,
  theme = 'dark',
  onToggleTheme,
}: {
  section: Section
  getScene: SceneLookup // the repo's scene registry, injected — the shell owns no scenes
  capture?: boolean // ?capture=1: the footer shows GraphL + §n/N branding (video); else live controls
  eyebrow?: string // header eyebrow (e.g. "PYTHON · SETUP"); also the back-to-catalog link
  index?: number // 0-based position of this section in the course
  total?: number // total sections in the course
  onHome?: () => void // back to the catalog (wired to the eyebrow)
  onPrev?: () => void // previous section (same as ← key) — drives the footer nav
  onNext?: () => void // next section (same as → key)
  narrating?: boolean // is the section clip currently playing (drives the volume icon)
  onToggleNarration?: () => void // play/pause narration (same as Space)
  // Forwarded straight to SceneView. Withheld from the barrel like the rest of SectionView, so the
  // only way a repo sets it is ConceptApp's prop — which is what keeps the scene pane and the
  // shell's chrome on one value.
  theme?: ThemeKey
  // Flips the theme from the section itself. SiteHeader (and its toggle) never renders here — a
  // section is a video frame — but the footer control bar is ALREADY interactive-only and suppressed
  // under ?capture=1, exactly like the pager and the drawer handle beside it. So the control lands in
  // the cluster that exists for precisely this: things a reader may touch and a recording never sees.
  onToggleTheme?: () => void
}) {
  const [open, setOpen] = useState(false) // drawer state; only affects the portrait layout
  const scene = getScene(section.scene)
  if (!scene) return <div className="stage stage--missing">no scene: {section.scene}</div>
  return (
    <div className="stage stage--section">
      {/* Header/footer — shared with the captured video. The eyebrow is a button (back to catalog);
          the section title shows on the portrait title card and is hidden in landscape (it headlines
          the slide there). GraphL + §n/N sit along the bottom. */}
      <header className="reel-head">
        {eyebrow && (
          <button className="reel-head__eyebrow" onClick={onHome} aria-label="Back to catalog (Esc)" title="Back to catalog (Esc)">
            {eyebrow}
          </button>
        )}
        <h1 className="reel-head__title">{section.title}</h1>
      </header>
      {/* Footer control bar — interactive ONLY (narration toggle + prev/next + position). Suppressed
          under ?capture=1 so the captured video frame stays clean: no GraphL wordmark, no counter,
          just the eyebrow/title + scene. Raised above the portrait drawer so nav works while the
          slide is open. */}
      {!capture && (
        <footer className="reel-foot reel-foot--controls">
          <span className="reel-foot__grp">
            <button className="reel-foot__ctrl" onClick={onHome} aria-label="Back to catalog (Esc)" title="Back to catalog (Esc)">
              <Home size={17} />
            </button>
            <button
              className="reel-foot__ctrl"
              onClick={onToggleNarration}
              aria-label={narrating ? 'Pause narration (Space)' : 'Play narration (Space)'}
              title={narrating ? 'Pause narration (Space)' : 'Play narration (Space)'}
            >
              {narrating ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {/* Lucide here, a text glyph in SiteHeader's copy — deliberately. The bar is a port of
                ui-graphl and must match it character for character; this cluster's siblings are all
                lucide at 17-19px, and a text moon beside them would read as a different control. */}
            {onToggleTheme && (
              <button
                className="reel-foot__ctrl"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Dark theme. Switch to light theme.' : 'Light theme. Switch to dark theme.'}
                title={theme === 'dark' ? 'Dark theme. Switch to light theme.' : 'Light theme. Switch to dark theme.'}
              >
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
              </button>
            )}
          </span>
          <span className="reel-foot__nav">
            <button className="reel-foot__ctrl" onClick={onPrev} aria-label="Previous section (←)" title="Previous section (←)">
              <ChevronLeft size={19} />
            </button>
            <span className="reel-foot__count reel-foot__count--live">
              {index + 1} / {total}
            </span>
            <button className="reel-foot__ctrl" onClick={onNext} aria-label="Next section (→)" title="Next section (→)">
              <ChevronRight size={19} />
            </button>
          </span>
        </footer>
      )}
      <div className="scene-area">
        <SceneView scene={scene} focusId={section.focus} theme={theme} />
      </div>
      {/* Drawer toggle — portrait-only affordance to reveal the slide; suppressed at capture. */}
      {!capture && (
        <button
          className="slide-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Hide slide' : 'Show slide'}
        >
          {open ? '›' : '‹'}
        </button>
      )}
      <SlidePanel slide={section.slide} open={open} />
    </div>
  )
}
