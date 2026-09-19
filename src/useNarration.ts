import { useEffect, useRef, useState } from 'react'

// The narration channel: one <audio> for the app's lifetime, driven by SPACE (toggle) and by
// section navigation. Loading a section's clip keeps the play state — if narration is on, changing
// sections auto-plays the next clip — and a clip that finishes calls `onEnded` so playback
// auto-advances to the next SECTION. Timing comes from the clip length itself (no timestamp
// anchors), so regenerated audio never drifts. A missing clip (not yet generated, or a 404) fails
// silently and resets the play state — paging still works, just no audio.
//
// Adapted from graphl-studio's reveal-engine useNarration: this repo has no beats, so the unit is
// one clip per section (`<audioBase>/<section-id>.wav`) rather than per beat.
export function useNarration(src: string | undefined, onEnded: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const endedRef = useRef(onEnded)
  endedRef.current = onEnded
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const a = new Audio()
    a.addEventListener('ended', () => endedRef.current())
    // A clip that can't load (not generated yet, 404) must not leave a stale "playing" state.
    a.addEventListener('error', () => setPlaying(false))
    audioRef.current = a
    return () => a.pause()
  }, [])

  // Load the current section's clip; resume playing if narration was on. Because playback is
  // gesture-initiated (SPACE), the browser lets the auto-advance chain keep playing.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.pause()
    if (src) {
      a.src = src
      a.currentTime = 0
      if (playingRef.current) a.play().catch(() => {})
    } else {
      // Fully unload so a later play() doesn't resume a stale buffered clip.
      a.removeAttribute('src')
      a.load()
      setPlaying(false)
    }
  }, [src])

  const toggle = () => {
    const a = audioRef.current
    if (!a || !a.getAttribute('src')) return // nothing loaded (a section with no clip)
    if (playingRef.current) {
      a.pause()
      setPlaying(false)
    } else {
      a.play().catch(() => {})
      setPlaying(true)
    }
  }

  /** Hard stop — pause and clear the play state (used at the end of the course). */
  const stop = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  return { playing, toggle, stop }
}
