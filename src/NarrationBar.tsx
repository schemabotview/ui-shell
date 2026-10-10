import { useEffect, useState } from 'react'

export const SEEK_S = 10

const EVENTS = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'ended', 'emptied', 'error'] as const

const fmt = (s: number) => {
  const t = Number.isFinite(s) && s > 0 ? s : 0
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}

export function NarrationBar({ audio }: { audio: HTMLAudioElement | null }) {
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!audio) return
    const sync = () => {
      setTime(audio.currentTime)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    sync()
    EVENTS.forEach((e) => audio.addEventListener(e, sync))
    return () => EVENTS.forEach((e) => audio.removeEventListener(e, sync))
  }, [audio])

  if (!audio || !duration) return null

  const seek = (t: number) => {
    audio.currentTime = Math.min(duration, Math.max(0, t))
    setTime(audio.currentTime)
  }

  const seekToX = (track: HTMLElement, clientX: number) => {
    const { left, width } = track.getBoundingClientRect()
    seek(((clientX - left) / width) * duration)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = { ArrowLeft: -SEEK_S, ArrowRight: SEEK_S, Home: -duration, End: duration }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    e.stopPropagation()
    seek(audio.currentTime + delta)
  }

  const pct = `${Math.min(100, (time / duration) * 100)}%`
  return (
    <span className="reel-foot__audio">
      <span className="reel-foot__count reel-foot__time">{fmt(time)}</span>
      <div
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
          e.currentTarget.setPointerCapture(e.pointerId)
          seekToX(e.currentTarget, e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekToX(e.currentTarget, e.clientX)
        }}
      >
        <span className="reel-foot__fill" style={{ width: pct }} />
        <span className="reel-foot__thumb" style={{ left: pct }} />
      </div>
      <span className="reel-foot__count reel-foot__time">{fmt(duration)}</span>
    </span>
  )
}
