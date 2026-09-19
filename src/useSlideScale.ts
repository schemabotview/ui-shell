import { useLayoutEffect, useRef, useState } from 'react'

// The slide is authored at a fixed DESIGN width and scaled with CSS `zoom` to the live pane width,
// so it looks pixel-proportional at any frame — 1440 preview, 1080p, or 4K capture alike. This is
// what makes the slide's dimensions a function of the TARGET video frame, not the browser window.
//
// DESIGN_PANE = 806 = 42% of a 1920-wide design frame (the slide pane's share). zoom = live/806:
//   1440 window → pane ~605 → zoom 0.75   |   1080p → 806 → 1.0   |   4K → 1613 → 2.0
export const DESIGN_PANE = 806

export function useSlideScale() {
  const ref = useRef<HTMLElement>(null)
  const [zoom, setZoom] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setZoom(el.clientWidth / DESIGN_PANE)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, zoom }
}
