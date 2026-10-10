import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@graphlearning/flow/styles.css'
import '../src/styles.css'
import './theme.css'
import { ConceptApp } from '../src/ConceptApp'
import { COURSES, getScene } from './fixture'
import type { ThemeKey } from '@graphlearning/flow'

const theme = ((new URLSearchParams(location.search).get('theme') as ThemeKey) || 'dark') as ThemeKey

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptApp subject="Fixture" courses={COURSES} getScene={getScene} theme={theme} />
  </StrictMode>,
)
