import { useLayoutEffect, useRef, useState } from 'react'

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
