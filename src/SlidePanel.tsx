import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DESIGN_PANE, useSlideScale } from './useSlideScale'

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
