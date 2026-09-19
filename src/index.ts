// Public surface of @graphlearning/shell. `exports` in package.json makes this the single entry
// point, so a content repo imports these names and nothing else.
//
// The shell is everything around the content: the hash router, the section composition
// (scene left / slide right), the slide panel, the course catalog and the narration channel.
// A repo supplies two registries — courses and scenes — and its own name. That is the contract.
export type { Section, Course, SceneLookup } from './types'
export { slugOf, allSections } from './types'
export { ConceptApp } from './ConceptApp'

// DELIBERATELY NOT EXPORTED: SectionView, CourseIndex, SlidePanel, useNarration, useSlideScale.
// They are reachable only through ConceptApp. Exporting them would ship a supported way to
// reassemble the shell differently per repo — which is the divergence this package exists to end.
// The route contract (#/<slug>, ?capture=1, window.__scene.plan()) is what the recorder drives, and
// it only holds if every repo composes these pieces identically.
