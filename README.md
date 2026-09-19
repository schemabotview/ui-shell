# @graphlearning/shell

The GraphL concept-app shell: everything a content repo renders *around* its content.

A content repo authors two things — **courses** (sections: scene + slide + narration) and **scenes**
(react-flow diagrams / code cards, drawn by [`@graphlearning/flow`](../ui-flow)). Everything else —
the hash router, the section composition, the slide panel, the course catalog, the narration
channel, the whole stylesheet — was an identical copy in all seven repos. It lives here now.

## Use it

```tsx
import '@graphlearning/flow/styles.css'   // engine: react-flow + the IBM Plex faces
import '@graphlearning/shell/styles.css'  // shell: layout + surface (it paints --bg)
import './theme.css'                      // repo: --brand / --brand-hover / --accent-2
import { ConceptApp } from '@graphlearning/shell'
import { COURSES } from './content'
import { getScene } from './scenes'

<ConceptApp
  subject="Apache Spark"        // the catalog's h1
  eyebrow="SPARK"               // the section eyebrow prefix — omit when it is subject.toUpperCase()
  courses={COURSES}
  getScene={getScene}
  audioBase={import.meta.env.BASE_URL}
/>
```

That is the whole integration. A content repo's `src/` is then `content/`, `scenes/`, `main.tsx`
and `theme.css`.

## The three contracts

**1. Import order.** The three stylesheets cascade: engine, shell, theme. The theme must come last
or the repo's brand tokens lose to the shell's neutral defaults.

**2. The shell paints the canvas.** `SceneView` draws its dots at `#2a2f38` and assumes a dark
surface behind it. That surface (`--bg: #1a1d23`) is defined in this package's stylesheet — it is
the contract each repo used to re-declare by hand.

**3. `audioBase` must be passed in.** `import.meta.env.BASE_URL` is replaced at the *consuming
app's* build time (its vite `base`, e.g. `/python/`). This package is built separately, so a literal
here would bake in the wrong base and 404 on every deployed site.

## The per-repo surface

Three CSS tokens, `subject`, and (when it differs) `eyebrow`. That is all that legitimately varies
between the seven concept apps.

| token | what it colours |
|---|---|
| `--brand` | section eyebrow, slide `h2`, catalog accent, brand-home hover |
| `--brand-hover` | the eyebrow's hover state — a lighter tint of `--brand` |
| `--accent-2` | the slide's `###` subheading — a counter tone to `--brand` |

## The route contract

The recorder (`scripts/record-course.mjs` in each content repo) drives these, so they are API:

- `#/<courseId>-<sectionId>` — the section view, the composited video frame
- `#/<sceneId>` — the bare scene view
- `?capture=1` — suppress every interactive control, leaving a clean frame
- `window.__scene.plan()` — the active course's sections, for the recorder to walk

## Develop

`npm run dev` serves a fixture harness on :5176 — two throwaway courses with a diagram scene, a code
scene and a deliberately missing scene. Two courses, not one, because it is the only way to exercise
the global section stream (→ past a course's last section enters the next course's first). A shell
regression is visible here before it reaches any content repo.

`npm run build` → `dist/index.js` + `dist/index.d.ts` + `dist/styles.css`.

## Why a peer dependency on the engine

`@graphlearning/flow` is a **peer**, not a dependency. Bundling it would put a second engine (and a
second react-flow store) inside this package. The content repo pins the engine itself and must get
exactly one copy — and a wide peer range (`>=0.5.0 <1.0.0`) means an engine minor does not force a
republish of this package.

## The toolchain

The capture / record / publish scripts ship with this package too — they were byte-identical in all
seven repos and they drive the route contract above, so they version with the shell that defines it.
They are `bin` entries, wired through each repo's `npm run`:

| command | what it does |
|---|---|
| `npm run record` | one course → a 3840×2160 MP4 |
| `npm run record:reels` | one course → portrait reels |
| `npm run shots:4k` | one PNG per section, no ffmpeg |
| `npm run thumb` | a branded YouTube thumbnail |
| `npm run gen:desc` | video descriptions + chapters |
| `npm run gen:audio` | the narration manifest |

**Where things live.** Scripts resolve two roots explicitly (`scripts/_paths.mjs`), because from
`node_modules` they can no longer use their own directory:

- `repoDir` = `process.cwd()` — the content repo. `npm run` sets cwd to the package root.
- `dataDir` = `repoDir/scripts` — the repo's script data (`concept.json`, `titles.json`,
  `audio-manifest.json`) **and every output** (`out/`, `segments/`, `.tmp/`), at exactly the paths
  they used before the extraction, so existing `.gitignore` entries still hold.
- `pkgDir` — machinery that ships here (`thumb-template.html`).

**Peer resolution.** `puppeteer` and `esbuild` are optional peers, loaded via `loadPeer()` which
resolves them **from the repo**, not from this package. A bare `import('puppeteer')` resolves by
walking up from the importing file, which under a local `file:` install lands in `ui-shell/` and
never reaches the repo's `node_modules`.

**`scripts/concept.json`** is the per-repo publishing identity — the values that used to be
hardcoded defaults in each repo's copy, which is precisely why they drifted:

```json
{ "concept": "Apache Spark", "kicker": "SPARK", "site": "https://graphl.in",
  "appPath": "/apache-spark", "hashtags": "#ApacheSpark …", "panelBg": "radial-gradient(…)" }
```

`concept` is the name used in descriptions; `kicker` is the thumbnail panel's label and defaults to
`concept` — they differ only where a long name will not fit the panel (apache-spark).
