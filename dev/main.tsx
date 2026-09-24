import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@graphlearning/flow/styles.css'
import '../src/styles.css'
import './theme.css'
import { ConceptApp } from '../src/ConceptApp'
import { COURSES, getScene } from './fixture'
import type { ThemeKey } from '@graphlearning/flow'

// `?theme=light` so the harness can be checked in both. A content repo hardcodes its choice instead
// — the theme is deliberately NOT in the route contract (see ConceptApp), so this query param is a
// harness affordance only and no recorder knows about it.
const theme = ((new URLSearchParams(location.search).get('theme') as ThemeKey) || 'dark') as ThemeKey

// The fixture harness: the shell wired exactly as a content repo wires it — engine styles, shell
// styles, repo theme, then ConceptApp with two registries and a subject. If the shell is broken,
// it is broken here first.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptApp subject="Fixture" courses={COURSES} getScene={getScene} theme={theme} />
  </StrictMode>,
)
