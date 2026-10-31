/** The section bell — the reader's copy of the one a recorded segment carries.
 *
 *  A WebAudio port of `prepareBell` in scripts/record-course.mjs: three sines a fourth and an
 *  octave apart, struck 200ms apart, each decaying exponentially over 2.4s, summed, attenuated and
 *  low-passed, then hard-cut at 2.6s and followed by silence out to STING_MS before narration
 *  starts. Synthesized rather than shipped as an asset: this package ships `dist` and `scripts`
 *  only, and a wav would be a second copy of a thing ffmpeg already knows how to build.
 *
 *  THE NUMBERS BELOW ARE DUPLICATED from record-course.mjs's filtergraph — see CLAUDE.md. They are
 *  what makes the lead a reader hears the same length as the lead in the video; drift here and the
 *  interactive app and the recording disagree, with a green build. */

/** The silent lead the recorder pads the bell out to, and therefore how long after the bell starts
 *  the narration clip does. `STING_MS` in record-course.mjs. */
export const STING_MS = 2800

const TONE_HZ = [587.33, 880, 1174.66] // D5, A5, D6 — `sine=f=…`
const DELAY_S = [0, 0.2, 0.4] // `adelay=200` / `adelay=400`
const DECAY_S = 2.4 // `afade=t=out:st=0:d=2.4:curve=exp`
const TRIM_S = 2.6 // `-t 2.6`
const GAIN = 0.22 // `volume=0.22` over `amix=normalize=0` (a plain sum)
const LOWPASS_HZ = 3500 // `lowpass=f=3500`
const FLOOR = 1e-4 // exponentialRampToValueAtTime cannot ramp to 0

export interface Sting {
  /** Silence it early — a reader who pauses or navigates mid-bell. Idempotent. */
  cancel: () => void
}

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null

/** Strike the bell. Returns null when the platform has no WebAudio, so a caller can skip the
 *  silent lead rather than hold a reader in front of nothing for 2.8s. */
export function playSting(): Sting | null {
  const Ctx: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  if (!Ctx) return null

  ctx ??= new Ctx()
  const c = ctx
  if (c.state === 'suspended') void c.resume()

  const lowpass = c.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = LOWPASS_HZ
  lowpass.connect(c.destination)

  const t0 = c.currentTime
  const oscs = TONE_HZ.map((hz, i) => {
    const osc = c.createOscillator()
    osc.frequency.value = hz
    const gain = c.createGain()
    const start = t0 + DELAY_S[i]
    gain.gain.setValueAtTime(GAIN, start)
    gain.gain.exponentialRampToValueAtTime(GAIN * FLOOR, start + DECAY_S)
    osc.connect(gain)
    gain.connect(lowpass)
    osc.start(start)
    osc.stop(Math.min(start + DECAY_S, t0 + TRIM_S))
    return osc
  })

  let done = false
  return {
    cancel: () => {
      if (done) return
      done = true
      for (const osc of oscs) {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
        osc.disconnect()
      }
      lowpass.disconnect()
    },
  }
}
