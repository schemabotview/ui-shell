import { useEffect, useRef, useState } from 'react'

// The narration scrub bar — elapsed / position / duration for the current section's clip, in the
// footer control cluster beside the volume toggle. Interactive ONLY: it lives inside SectionView's
// `!capture` footer, so it can never appear in a recorded frame (same guarantee as the pager and the
// theme toggle beside it).
//
// WHY IT TAKES THE ELEMENT, NOT STATE: `timeupdate` fires ~4x a second. Lifting that into
// ConceptApp would re-render the whole section — SceneView (layout + react-flow) and the
// react-markdown slide — four times a second for a 4px bar. So useNarration hands out the one
// <audio> element and this component subscribes to it directly; the only thing that re-renders on a
// tick is the bar. Nothing else in the shell learns that playback has a position.
//
// A section whose clip is missing or not generated yet (docker, java) has no duration, so the bar
// renders NOTHING rather than a dead track — the volume toggle already carries that state.
export function NarrationBar({ audio }: { audio: HTMLAudioElement | null }) {
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!audio) return
    const sync = () => {
      setTime(audio.currentTime)
      // A clip still loading (or 404'd, or unloaded between sections) reports NaN/Infinity.
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    sync()
    // `emptied` is the one that matters on navigation: useNarration removes the src for a section
    // with no clip, and without this the bar would keep showing the previous clip's length.
    const events = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'ended', 'emptied', 'error'] as const
    events.forEach((e) => audio.addEventListener(e, sync))
    return () => events.forEach((e) => audio.removeEventListener(e, sync))
  }, [audio])

  if (!audio || !duration) return null

  const seekToClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    audio.currentTime = f * duration
    setTime(audio.currentTime) // don't wait for the next timeupdate — the thumb must track the finger
  }

  // Arrow keys scrub when the bar HAS FOCUS and must not also page the section: ConceptApp's ← / →
  // handler is on `window`, so stopping propagation here keeps it from firing. Every other key
  // (Esc home, Space narration) is left to bubble.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = (d: number) => {
      e.preventDefault()
      e.stopPropagation()
      audio.currentTime = Math.min(duration, Math.max(0, audio.currentTime + d))
      setTime(audio.currentTime)
    }
    if (e.key === 'ArrowLeft') step(-5)
    else if (e.key === 'ArrowRight') step(5)
    else if (e.key === 'Home') step(-duration)
    else if (e.key === 'End') step(duration)
  }

  const pct = `${Math.min(100, (time / duration) * 100)}%`
  return (
    <span className="reel-foot__audio">
      <span className="reel-foot__count reel-foot__time">{fmt(time)}</span>
      <div
        ref={trackRef}
        className="reel-foot__track"
        role="slider"
        tabIndex={0}
        aria-label="Narration position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          // Capture so a drag that leaves the 4px track keeps scrubbing (the bar is thin; fingers
          // and mice both wander off it).
          e.currentTarget.setPointerCapture(e.pointerId)
          seekToClientX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekToClientX(e.clientX)
        }}
      >
        <span className="reel-foot__fill" style={{ width: pct }} />
        <span className="reel-foot__thumb" style={{ left: pct }} />
      </div>
      <span className="reel-foot__count reel-foot__time">{fmt(duration)}</span>
    </span>
  )
}

/** m:ss — clips are seconds-to-minutes, never hours. */
function fmt(s: number) {
  const t = Number.isFinite(s) && s > 0 ? s : 0
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}
