// Public surface. Types and slug helpers land now; ConceptApp and SiteHeader join in later steps
// and stay the only components exported (the route contract only holds if every repo composes the
// parts identically).
export type { Section, Course, SceneLookup } from './types'
export { slugOf, allSections } from './types'
