import { useEffect, useRef, useState } from 'react'

export function useNarration(src: string | undefined, onEnded: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const endedRef = useRef(onEnded)
  const playingRef = useRef(playing)
  endedRef.current = onEnded
  playingRef.current = playing

  useEffect(() => {
    const a = new Audio()
    a.addEventListener('ended', () => endedRef.current())
    a.addEventListener('error', () => setPlaying(false))
    audioRef.current = a
    setAudio(a)
    return () => a.pause()
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.pause()
    if (src) {
      a.src = src
      a.currentTime = 0
      if (playingRef.current) a.play().catch(() => {})
    } else {
      a.removeAttribute('src')
      a.load()
      setPlaying(false)
    }
  }, [src])

  const toggle = () => {
    const a = audioRef.current
    if (!a?.getAttribute('src')) return
    if (playingRef.current) a.pause()
    else a.play().catch(() => {})
    setPlaying(!playingRef.current)
  }

  const stop = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  return { playing, toggle, stop, audio }
}
