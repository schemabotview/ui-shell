import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DESIGN_PANE, useSlideScale } from './useSlideScale'

// The slide (a section's `.slide` markdown) — a full-height surface fixed to the RIGHT, lifted off
// the scene canvas for figure-ground. Position is CSS-driven (see index.css):
//   landscape (laptop → video)  — a 42% column beside the scene.
//   portrait  (mobile → reel)   — an off-canvas drawer that slides in from the right when `open`.
// The inner scaler is authored at DESIGN_PANE px and `zoom`-scaled to the live pane, so the slide is
// proportional to the target video frame at any size (see useSlideScale).
export function SlidePanel({ slide, open }: { slide: string; open: boolean }) {
  const { ref, zoom } = useSlideScale()
  return (
    <aside ref={ref} className={`slide-panel${open ? ' slide-panel--open' : ''}`}>
      <div className="slide-panel__scaler" style={{ width: DESIGN_PANE, zoom }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide}</ReactMarkdown>
      </div>
    </aside>
  )
}
