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

## The site bar

`ConceptApp` renders the platform's header — brand, section nav, an empty actions slot — above its
catalog page, and nowhere else. It is a port of the bar at graphl.in, class for class, so a reader
crossing from the catalog into a concept app never leaves "the site". Nothing to pass: a content
repo is a course, which is the default.

It is deliberately platform-coloured, not `--brand`: looking identical on all eight sites is the
whole reason it exists. It renders on the catalog page ONLY — never on a section, which is a video
frame — so the recorder cannot see it.

An app that is not a course (`python-lab` is a lab) says so, and one that is not a `ConceptApp` at
all imports the bar directly — the one part of this package that is exported on its own:

```tsx
<ConceptApp … kind="labs" />          // marks Labs as the current nav item

import { SiteHeader } from '@graphlearning/shell'
<SiteHeader kind="labs" actions={<ThemeToggle />} />
```

The bar exists **three times** by necessity — `ui-graphl` (buildless vanilla), this package, and
`python-lab` (which hand-ports it rather than take this package as a dependency; see the invariant
in CLAUDE.md). One design, three implementations — **when you change one, change all three**, or
they drift and the seam shows on every crossing.

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

## Keyboard

Interactive only — `?capture=1` suppresses nothing here because none of it fires without a reader.

| Key | What it does |
| --- | --- |
| `←` / `→` | seek the narration −10s / +10s **when the section has a clip** (exactly when the scrub bar is on screen); otherwise page to the previous/next section |
| `Shift`+`←` / `→` | always page, clip or no clip |
| `Space` | play/pause the narration |
| `Esc` | back to the catalog (and from the catalog, up to graphl.in) |
| `←` / `→` / `Home` / `End` | with the scrub bar focused: seek ∓10s / to the start / to the end |

The arrows seek rather than page because the footer's `‹` `›` buttons are the pager's real home and
`Esc` still leaves — while the only thing a *listening* reader has no control for is a 10s jump.
Where there is no clip to seek (the catalog, a bare scene view, a repo whose wavs are not generated
yet) the old paging meaning stands, so the keyboard never goes dead.

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
| `npm run record:all` | every course in syllabus order, waiting for narration to land |
| `npm run record:reels` | one course → portrait reels |
| `npm run shots:4k` | one PNG per section, no ffmpeg |
| `npm run thumb` | a branded YouTube thumbnail |
| `npm run gen:desc` | video descriptions + chapters |
| `npm run gen:audio` | the narration manifest |

`record:all` is the only one whose repo script is not just the bin: it needs a sleep wrapper, because
a full concept is a multi-hour batch and the machine going idle mid-run kills it.

```json
"record:all": "caffeinate -ims graphl-record-all"
```

It exists because narration arrives DURING a batch — the Colab + Chatterbox pass commits wavs one
section at a time — so before each course it pulls the repo's branch and counts that course's wavs
against `scripts/audio-manifest.json`, waiting (`--wait`, default 240 min) for the missing ones.
A course is recorded only when it is complete; an incomplete one is skipped and named in the summary
rather than half-recorded into `record`'s 3s-silence fallback. Re-running is cheap — finished courses
are segment-cache hits.

**Capture is not realtime.** `record` and `record:reels` screencast one short window per section and
loop it over the narration (`-stream_loop`), because the only moving thing in a frame is the engine's
edge pulse and that pulse has a 2.4s period — and a pulse crosses its whole edge in exactly one
period, so one period is the whole picture. A 90-second section is captured in ~3.4s; the output's
timing is unchanged.

| env | default | what it does |
|---|---|---|
| `LOOP_CYCLES` | `1` | window length, in pulse periods → 2.4s |
| `LOOP_MS` | — | window length in ms, snapped to a whole period |
| `PULSE_S` | `2.4` | the engine's `animateMotion dur` — must match `ui-flow`'s `FlowEdge` |
| `LOOP_LEAD_S` | `0.5` | discarded screencast ramp-up before the window |
| `NO_LOOP` | — | set to hold for the whole wav, as before |

The window **must** be a whole multiple of `PULSE_S` or the loop join shows a jump — which is why
`LOOP_MS` is snapped rather than taken literally.

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
