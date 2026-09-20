import { useCallback, useEffect, useMemo, useState } from 'react'
import { SceneView } from '@graphlearning/flow'
import { SectionView } from './SectionView'
import type { Course, SceneLookup } from './types'
import { allSections, slugOf } from './types'
import { CourseIndex } from './CourseIndex'
import { useNarration } from './useNarration'

// Route contract (hash routing):
//   #/<course-section>  → SECTION view — the final composited output of a slug (scene bg + slide)
//   #/<scene>           → SCENE view — just the diagram
// A bare id resolves to a section if it matches a slug, otherwise to a scene. Slugs (course-section)
// and scene ids never collide, so no prefix is needed.
export function ConceptApp({
  subject,
  eyebrow,
  courses: COURSES,
  getScene,
  audioBase = '/',
  kind = 'courses',
}: {
  subject: string // this repo's name, as the catalog's h1 shows it ("Apache Spark")
  courses: Record<string, Course> // the repo's course registry, in syllabus order
  // The section eyebrow's prefix ("SPARK · EVOLUTION"). Defaults to subject.toUpperCase(), which is
  // right for most repos — but NOT all: apache-spark titles itself "Apache Spark" and brands its
  // sections "SPARK", databricks-data-engineer brands its "DATABRICKS". The eyebrow is burned into
  // every recorded video, so it gets its own prop rather than being derived and quietly changed.
  eyebrow?: string
  getScene: SceneLookup // the repo's scene registry
  // Where the narration wavs are served from — a content repo passes import.meta.env.BASE_URL,
  // which is its vite `base` ("/python/"). It CANNOT be read here: import.meta.env is replaced at
  // the app's build time, and this package is built separately, so a literal here would bake in
  // the shell's own base and 404 on every deployed site. The layout under it is the content
  // model's, not the repo's: audio/<courseId>/<sectionId>.wav.
  audioBase?: string
  // Which section of the site this app belongs to — a catalog.json `kind` id, marked as the
  // current item in the site bar on the catalog page. Every content repo is a course, so the
  // default covers all seven; python-lab passes 'labs'.
  kind?: string
}) {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onHash = () => setHash(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const capture = new URLSearchParams(location.search).get('capture') === '1'
  const id = hash.replace(/^#\/?/, '')

  // Which course are we in? The recorder lands on #/<course> to read the plan; a human lands on a
  // slug. So the active course is: a bare course id, else the course that OWNS the matched slug, else
  // the first course (the nav context for a bare scene view). Everything course-scoped below —
  // section nav, the capture plan, the audio path, the header eyebrow — reads from this.
  const activeCourse = useMemo(() => {
    if (COURSES[id]) return COURSES[id]
    for (const c of Object.values(COURSES)) {
      if (c.sections.some((s) => slugOf(c, s) === id)) return c
    }
    return Object.values(COURSES)[0]
  }, [id, COURSES])
  const sections = useMemo(() => allSections(activeCourse), [activeCourse])
  // The whole catalog as one ordered stream (in COURSES insertion
  // order). Section nav walks THIS so → past a course's last section rolls into the next course's
  // first — and narration flows chapter-to-chapter — instead of dead-ending at the index. The
  // per-course `sections` above still drives the capture plan and the §n/N header (chapter-relative).
  const globalSections = useMemo(() => Object.values(COURSES).flatMap(allSections), [COURSES])

  // A bare COURSE id in the hash has no page of its own — the GraphL catalog links each course to
  // `<slug>/#/<courseId>`, so a human arriving there should ENTER the course at its first section.
  // Guarded by !capture: the recorder deliberately lands on `#/<course>` to read window.__scene.plan
  // (below), so it must not be redirected. Replace (not push) so Back skips the bare course-id URL.
  useEffect(() => {
    if (capture || !COURSES[id]) return
    const first = sections[0]
    if (!first) return
    history.replaceState(null, '', `${location.pathname}${location.search}#/${first.slug}`)
    setHash(`#/${first.slug}`)
  }, [capture, id, sections])

  useEffect(() => {
    if (!capture) return
    // Capture contract (fleshed out in step 2): every slug + its scene + focus node, so the recorder
    // can screenshot each and knows which node the slide must avoid.
    ;(window as unknown as { __scene: unknown }).__scene = {
      plan: () =>
        sections.map(({ slug, section }) => ({
          slug,
          course: activeCourse.id, // audio lives at audio/<course>/<id>.wav
          id: section.id,
          scene: section.scene,
          focus: section.focus ?? null,
        })),
    }
  }, [capture, sections, activeCourse])

  // Section navigation, shared by the ← / → keys AND the on-screen pager. `dir` is +1 (next) / -1
  // (prev). Reads the LIVE hash at call time (not React state) so rapid presses can't act on a stale
  // index; from a non-section view, next enters the first section. Walks the GLOBAL stream, so a
  // course boundary is just another step — → past a course's last section enters the next course's
  // first, ← symmetrically crosses back. Only the two ENDS of the whole catalog fall back to the
  // catalog page (like Esc). Navigating just updates the hash, which re-renders via the listener.
  const go = useCallback(
    (dir: 1 | -1) => {
      const cur = location.hash.replace(/^#\/?/, '')
      const gidx = globalSections.findIndex(({ slug }) => slug === cur)
      if (gidx !== -1) {
        const target = globalSections[gidx + dir]
        location.hash = target ? `#/${target.slug}` : '' // catalog only at the catalog's ends
        return
      }
      // The CATALOG index (empty hash) is the home/start: → begins the stream at its first section;
      // ← does nothing (there is nothing before home — it must not fall into foundations' last).
      if (cur === '') {
        if (dir === 1 && globalSections[0]) location.hash = `#/${globalSections[0].slug}`
        return
      }
      // Otherwise a bare SCENE view (a scene id with course context): → enters the active course's
      // first section, ← its last.
      const target = dir === 1 ? sections[0] : sections[sections.length - 1]
      if (target) location.hash = `#/${target.slug}`
    },
    [sections, globalSections],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      go(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // Back to the catalog: clear the hash (empty hash → CourseIndex). No-ops when already there. Wired
  // to the top-left GraphL brand AND the Esc key (below), so any inner page is one gesture from home.
  const goHome = useCallback(() => {
    if (location.hash) location.hash = '' // inner page → this concept's index
    else if (location.pathname !== '/') location.href = '/' // already at the index → up to the graphl.in catalog
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goHome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goHome])

  // Slug (section) first.
  const match = sections.find(({ slug }) => slug === id)

  // Narration channel. A section's clip lives at public/audio/<courseId>/<section-id>.wav (pushed
  // from the Colab generator). SPACE toggles it; when a clip finishes we roll into the NEXT section
  // (which auto-plays because the play state is preserved) so the whole course narrates hands-free.
  // Outside a section (scene view) src is undefined → the channel unloads.
  const audioUrl = match
    ? `${audioBase}audio/${activeCourse.id}/${match.section.id}.wav`
    : undefined
  const { playing, toggle, stop } = useNarration(audioUrl, () => {
    const cur = location.hash.replace(/^#\/?/, '')
    const idx = globalSections.findIndex(({ slug }) => slug === cur)
    const next = globalSections[idx + 1] // rolls across course boundaries into the next chapter
    if (next) location.hash = `#/${next.slug}`
    else stop() // last section of the whole catalog — nothing to advance to
  })

  // SPACE enables/disables narration. Re-bound every render (no deps) so it always sees the current
  // `toggle`; guarded so it never hijacks the spacebar while typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Empty hash → the course catalog landing page (its own brand, no overlay, no home button here).
  if (!id) return <CourseIndex courses={Object.values(COURSES)} subject={subject} kind={kind} />

  // The bare SCENE view (a scene id, no course context) keeps the top-left GraphL brand as its route
  // home. The SECTION view instead carries the shared header/footer, whose eyebrow IS the home link,
  // so it renders no separate brand. Both are hidden at capture so the recorded frame stays clean.
  let content
  let brand = null
  if (match) {
    const index = sections.findIndex(({ slug }) => slug === id)
    content = (
      <SectionView
        section={match.section}
        getScene={getScene}
        // ?capture=1 suppresses the (interactive-only) drawer toggle so the recorded frame is clean.
        capture={capture}
        // Header eyebrow — subject · course; doubles as the back-to-catalog link.
        eyebrow={`${eyebrow ?? subject.toUpperCase()} · ${activeCourse.id.toUpperCase()}`}
        index={index}
        total={sections.length}
        onHome={goHome}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        narrating={playing}
        onToggleNarration={toggle}
      />
    )
  } else {
    // Otherwise a scene id.
    const scene = getScene(id)
    content = scene ? (
      <div className="stage">
        <SceneView scene={scene} />
      </div>
    ) : (
      <div className="stage stage--missing">no scene or slug: {id}</div>
    )
    brand = capture ? null : (
      <button className="brand-home" onClick={goHome} aria-label="Back to catalog (Esc)" title="Back to catalog (Esc)">
        GraphL
      </button>
    )
  }

  return (
    <>
      {brand}
      {content}
    </>
  )
}
