import { useEffect, useRef, useState } from 'react'
import { playSting, STING_MS, type Sting } from './sting'

/** The narration channel.
 *
 *  Playback of a section starts with the bell and its silent lead (see sting.ts), so what a reader
 *  hears matches what the recorded segment carries. The bell is WebAudio and never an
 *  HTMLAudioElement: `ended` on the element is the AUTO-ADVANCE, so a bell that was an element —
 *  or the same element with the bell as its src — would page the app forward on its own. Nothing
 *  but the narration clip reaching its end may navigate.
 *
 *  `sting: false` (capture) opts out of the lead entirely — the recorders build the bell in ffmpeg
 *  and never capture page audio, so a bell here would only be a live AudioContext inside a capture
 *  window. See CLAUDE.md. */
export function useNarration(
  src: string | undefined,
  onEnded: () => void,
  { sting = true }: { sting?: boolean } = {},
) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const endedRef = useRef(onEnded)
  const playingRef = useRef(playing)
  const stingRef = useRef<Sting | null>(null)
  const leadRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stingOnRef = useRef(sting)
  endedRef.current = onEnded
  playingRef.current = playing
  stingOnRef.current = sting

  /** Silence the bell and drop the pending start. Safe to call when neither is live. */
  const clearSting = () => {
    stingRef.current?.cancel()
    stingRef.current = null
    if (leadRef.current !== null) {
      clearTimeout(leadRef.current)
      leadRef.current = null
    }
  }

  /** Start a section from the top: bell, lead, clip. Without a bell the clip starts now. */
  const startFromTop = (a: HTMLAudioElement) => {
    clearSting()
    a.currentTime = 0
    stingRef.current = stingOnRef.current ? playSting() : null
    if (!stingRef.current) {
      void a.play().catch(() => {})
      return
    }
    leadRef.current = setTimeout(() => {
      leadRef.current = null
      void a.play().catch(() => {})
    }, STING_MS)
  }

  useEffect(() => {
    const a = new Audio()
    a.addEventListener('ended', () => endedRef.current())
    a.addEventListener('error', () => {
      // No clip (a 404'd wav, a repo with no narration yet): cut the bell rather than ring out
      // over nothing. The lead would otherwise be 2.8s of bell followed by silence.
      clearSting()
      setPlaying(false)
    })
    // A reader who scrubs during the lead wants the clip, not the rest of the bell.
    a.addEventListener('seeking', () => {
      if (leadRef.current === null || a.currentTime === 0) return
      clearSting()
      void a.play().catch(() => {})
    })
    audioRef.current = a
    setAudio(a)
    return () => {
      clearSting()
      a.pause()
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.pause()
    clearSting()
    if (src) {
      a.src = src
      // Navigating while the channel is live (the reader paging, or the auto-advance) starts the
      // next section the way pressing play would: bell first.
      if (playingRef.current) startFromTop(a)
      else a.currentTime = 0
    } else {
      a.removeAttribute('src')
      a.load()
      setPlaying(false)
    }
  }, [src])

  const toggle = () => {
    const a = audioRef.current
    if (!a?.getAttribute('src')) return
    if (playingRef.current) {
      a.pause()
      clearSting()
    } else if (a.currentTime > 0) {
      void a.play().catch(() => {}) // resuming mid-clip — the bell belongs to the start of a section
    } else {
      startFromTop(a)
    }
    setPlaying(!playingRef.current)
  }

  const stop = () => {
    clearSting()
    audioRef.current?.pause()
    setPlaying(false)
  }

  return { playing, toggle, stop, audio }
}
