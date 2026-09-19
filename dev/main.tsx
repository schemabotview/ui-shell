import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@graphlearning/flow/styles.css'
import '../src/styles.css'
import './theme.css'
import { ConceptApp } from '../src/ConceptApp'
import { COURSES, getScene } from './fixture'

// The fixture harness: the shell wired exactly as a content repo wires it — engine styles, shell
// styles, repo theme, then ConceptApp with two registries and a subject. If the shell is broken,
// it is broken here first.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptApp subject="Fixture" courses={COURSES} getScene={getScene} />
  </StrictMode>,
)
