import { useCallback, useEffect, useMemo, useState } from 'react'
import { SceneView, type ThemeKey } from '@graphlearning/flow'
import { SectionView } from './SectionView'
import { allSections, slugOf, type Course, type SceneLookup } from './types'
import { CourseIndex } from './CourseIndex'
import { useNarration } from './useNarration'
import { useTheme } from './useTheme'
import { ThemeToggle } from './ThemeToggle'
import { SEEK_S } from './NarrationBar'

const idOf = (hash: string) => hash.replace(/^#\/?/, '')

export function ConceptApp({
  subject,
  eyebrow,
  courses: COURSES,
  getScene,
  audioBase = '/',
  kind = 'courses',
  theme = 'dark',
}: {
  subject: string
  courses: Record<string, Course>
  eyebrow?: string
  getScene: SceneLookup
  audioBase?: string
  kind?: string
  theme?: ThemeKey
}) {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onHash = () => setHash(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const capture = new URLSearchParams(location.search).get('capture') === '1'
  const { theme: activeTheme, toggle: toggleTheme } = useTheme(theme, capture)
  const id = idOf(hash)

  const activeCourse = useMemo(
    () =>
      (Object.hasOwn(COURSES, id) && COURSES[id]) ||
      Object.values(COURSES).find((c) => c.sections.some((s) => slugOf(c, s) === id)) ||
      Object.values(COURSES)[0],
    [id, COURSES],
  )
  const sections = useMemo(() => (activeCourse ? allSections(activeCourse) : []), [activeCourse])
  const globalSections = useMemo(() => Object.values(COURSES).flatMap(allSections), [COURSES])

  useEffect(() => {
    if (capture || !Object.hasOwn(COURSES, id) || !sections[0]) return
    history.replaceState(null, '', `${location.pathname}${location.search}#/${sections[0].slug}`)
    setHash(`#/${sections[0].slug}`)
  }, [capture, id, sections])

  useEffect(() => {
    if (!capture) return
    ;(window as unknown as { __scene: unknown }).__scene = {
      plan: () =>
        sections.map(({ slug, section }) => ({
          slug,
          course: activeCourse?.id,
          id: section.id,
          scene: section.scene,
          focus: section.focus ?? null,
        })),
    }
  }, [capture, sections, activeCourse])

  const go = useCallback(
    (dir: 1 | -1) => {
      const cur = idOf(location.hash)
      const gidx = globalSections.findIndex(({ slug }) => slug === cur)
      if (gidx !== -1) {
        const target = globalSections[gidx + dir]
        location.hash = target ? `#/${target.slug}` : ''
      } else if (cur === '') {
        if (dir === 1 && globalSections[0]) location.hash = `#/${globalSections[0].slug}`
      } else {
        const target = dir === 1 ? sections[0] : sections[sections.length - 1]
        if (target) location.hash = `#/${target.slug}`
      }
    },
    [sections, globalSections],
  )

  const goHome = useCallback(() => {
    if (location.hash) location.hash = ''
    else if (location.pathname !== '/') location.href = '/'
  }, [])

  const match = sections.find(({ slug }) => slug === id)
  const audioUrl = match && `${audioBase}audio/${activeCourse!.id}/${match.section.id}.wav`
  const { playing, toggle, stop, audio } = useNarration(audioUrl, () => {
    const cur = idOf(location.hash)
    const next = globalSections[globalSections.findIndex(({ slug }) => slug === cur) + 1]
    if (next) location.hash = `#/${next.slug}`
    else stop()
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return goHome()
      const t = e.target as HTMLElement | null
      if (e.ctrlKey || e.metaKey || e.altKey || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        const d = audio?.duration ?? 0
        if (audio && !e.shiftKey && Number.isFinite(d) && d > 0) {
          audio.currentTime = Math.min(d, Math.max(0, audio.currentTime + dir * SEEK_S))
        } else go(dir)
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!id)
    return (
      <CourseIndex
        courses={Object.values(COURSES)}
        subject={subject}
        kind={kind}
        actions={capture ? null : <ThemeToggle theme={activeTheme} onToggle={toggleTheme} />}
      />
    )

  if (match)
    return (
      <SectionView
        section={match.section}
        getScene={getScene}
        capture={capture}
        eyebrow={`${eyebrow ?? subject.toUpperCase()} · ${activeCourse!.id.toUpperCase()}`}
        index={sections.indexOf(match)}
        total={sections.length}
        onHome={goHome}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        narrating={playing}
        onToggleNarration={toggle}
        narrationAudio={audio}
        theme={activeTheme}
        onToggleTheme={capture ? undefined : toggleTheme}
      />
    )

  const scene = getScene(id)
  return (
    <>
      {!capture && (
        <button className="brand-home" onClick={goHome} aria-label="Back to catalog (Esc)" title="Back to catalog (Esc)">
          GraphL
        </button>
      )}
      {scene ? (
        <div className="stage">
          <SceneView scene={scene} theme={activeTheme} />
        </div>
      ) : (
        <div className="stage stage--missing">no scene or slug: {id}</div>
      )}
    </>
  )
}
