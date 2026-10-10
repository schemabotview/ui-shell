# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ui-shell

The concept-app shell, published as `@graphlearning/shell`. Extracted from the seven content repos
on 2026-09-19, the same way the render engine was extracted into `ui-flow`.

Read `README.md` first — it carries the integration, the three contracts and the route contract.

## What this package is, in one line

`ui-flow` draws a scene. **This draws everything else**: the router, the section composition
(scene left / slide right), the slide panel, the catalog, the narration channel, the stylesheet.

## Commands

```bash
npm run dev     # fixture harness on :5176 — the review surface for any shell change
npm run build   # vite lib build → dist/index.js, then tsc → dist/index.d.ts, then cp styles.css
npm run watch   # vite build --watch, for use against a content repo on a file: install
npx tsc --noEmit -p tsconfig.json   # typecheck only
```

**There is no test runner, no linter and no `npm run check` here** — the workspace `CLAUDE.md`
names all three as the pre-handover guard, but in this repo only `npm run build` and
`tsc --noEmit` exist. `build` already runs `tsc`, so it is the real gate; see the verification bar
below for why a green build is a floor and not proof.

`build` is three steps chained with `&&` and the third is a plain `cp` — `dist/styles.css` is
copied, not bundled, so a `styles.css` edit does NOT reach a consumer until a build runs. A
consumer on a `file:` install sees `src/` changes only through `dist/`.

Port 5176 is deliberate: 5173 is a content repo, 5174 is `ui-flow`, and all three run side by side.

## Invariants

- **`ConceptApp` and `SiteHeader` are the only exports.** `SectionView`, `CourseIndex`,
  `SlidePanel`, `useNarration` and `useSlideScale` are deliberately withheld. The route contract
  (`#/<slug>`, `?capture=1`, `window.__scene.plan()`) is what every repo's recorder drives, and it
  only holds if every repo composes the pieces identically. Exporting the parts would ship a
  supported way to diverge again — which is the thing this package exists to end. Same reasoning as
  `ui-flow` withholding `computeLayout`. `SiteHeader` is the one exception and it proves the rule:
  it has no route surface, renders on the catalog page only, and python-lab needs it without
  `ConceptApp` — there is nothing in it to compose differently.
- **No build-time magic.** `import.meta.env` cannot be read here (see README, contract 3). Anything
  that depends on the consuming app's vite config arrives as a prop.
- **The engine is a peer.** Never a dependency — one engine copy per app, pinned by the app. The
  vite `external` list is load-bearing for the same reason: bundling `@graphlearning/flow` would
  put a second engine (and a second react-flow store) inside this package.
- **`theme` is the DECK's declared look; the READER may override it, and capture ignores the reader.**
  `ConceptApp` takes `theme?: 'dark' | 'light'` and forwards it to every `SceneView`. One value,
  because a light scene inside dark chrome is a white rectangle on a dark page. A reader can
  override it from a toggle in TWO places, both of which are suppressed at capture: `SiteHeader` (the
  catalog page — SiteHeader never renders on a section) and the section's own footer control bar,
  which already exists as an interactive-only cluster behind `!capture` alongside Home, narration and
  the pager. So the control can never appear in a captured frame from either route. The two render
  differently on purpose: the bar uses a text glyph because it is a character-for-character port of
  ui-graphl, the footer uses lucide because every sibling in that cluster is lucide. `?capture=1`
  pins to the declared prop and ignores stored choice entirely; without that pin a 4K capture would
  depend on whoever last used the browser. Consequence of a repo going light: it must ALSO re-pick
  `--brand` / `--brand-hover` / `--accent-2` — a brand tuned to glow on slate can fall under 3:1 on
  off-white, and the shell cannot repick those without taking ownership of the one surface it
  deliberately leaves to the repo.
- **The reader's choice IS the platform's.** Key `graphl:theme`, values `light`/`dark`/absent,
  switch `data-theme` on `<html>` — the same four things ui-graphl/theme.js owns, because every
  GraphL app is same-origin under graphl.in and a reader who picks light on the catalog should walk
  into a concept app already light. Cross-tab `storage` sync and the one-frame `.theme-swap` are
  ported too. TWO DELIBERATE DIVERGENCES, both from the same fact — a deck is authored and a catalog
  is not:
  1. The catalog CYCLES through three states (system → light → dark); this TOGGLES between two. The
     neutral step would have to be labelled "Deck theme", which means nothing to a reader and costs
     them a press to get where they were going.
  2. At the catalog an absent value means "follow the OS"; here it means "follow the DECK". Letting
     an OS setting silently repaint scenes, slides and narration that were built and reviewed in one
     look is not the same decision as letting it repaint a directory page.
  The stored VALUES stay identical (`light`/`dark`/absent), so the two apps never disagree about an
  explicit choice — only the absence is read differently, and this one never writes it back.
- **The attribute goes on `<html>`, not a wrapper.** `ConceptApp` renders a fragment; adding a
  wrapping element would change the section view's box model, which is burned into every recorded
  video. An attribute costs no layout.
- **The narration SCRUB BAR is landscape-only, and it takes the `<audio>` ELEMENT, not state.**
  `NarrationBar` sits between the two footer clusters (inside the same `!capture` footer, so a
  recording can never show it). Three things fixed its shape:
  1. `timeupdate` fires ~4x a second. Lifting position into `ConceptApp` would re-render `SceneView`
     and the react-markdown slide four times a second for a 4px bar, so `useNarration` hands out the
     element and the bar subscribes to it directly. Nothing else in the shell learns that playback
     has a position.
  2. In PORTRAIT it is `display: none`. The control row is already full at phone width, and the only
     other place for it is a second row — which would grow this absolutely-positioned footer UP into
     the frame, because the portrait scene reserve (`.stage--section .scene-area`, `bottom: 7.5vh`)
     is sized for one row. Widening that reserve would re-frame every recorded reel, so the bar
     yields instead. Measured after the change: footer height 63px and scene bottom 862 < footer top
     869 at 430x932 — unchanged.
  3. **The track's focus indicator is the THUMB, never an outline on the track.** A box round a
     ~500px bar is a brand rectangle across the scene, and it appeared without the reader touching
     the bar: Chrome promotes an already mouse-focused element to `:focus-visible` on the NEXT key
     press, so click-scrub then Space (narration — a window-level shortcut unrelated to the bar) lit
     it up and it stayed for the rest of the section. `:focus { outline: none }` plus a halo on the
     10px thumb keeps keyboard focus visible at the size of the control. The ring stays on
     `.reel-foot__ctrl`: those are 28px buttons where the box IS the control.
  A section with no clip (duration never resolves — docker, java) renders NO bar rather than a dead
  track; the volume toggle already carries that state — and that same duration gate now decides what
  the window-level arrows mean (next invariant). The track's own arrows stop propagation so the
  window handler does not step the SAME clip a second time; Esc and Space are left to bubble.
- **← / → belong to the NARRATION, not the pager — when there is a clip.** A section with a loaded
  clip seeks ∓10s; everything else (the catalog, a bare scene view, a section whose wav 404s, a repo
  with no narration yet) still pages, and `Shift`+arrow always pages. The gate is the clip's
  duration, which is the same gate `NarrationBar` renders on — so the rule is *visible*: the arrows
  scrub exactly when the bar is on screen, never a hidden mode. What made the trade payable is that
  the pager already had two other controls (the footer `‹` `›`, and `Esc` out) while a listener had
  none; `SEEK_S` lives in `NarrationBar` and is shared, so the focused-track arrows and the
  window-level ones cannot drift to different step sizes. The track's own handler still
  `stopPropagation`s — with both handlers live on the same clip it would otherwise step TWICE.
  The footer pager's labels say `Shift+←` / `Shift+→` because that is the binding that always works.
- **Section nav walks the GLOBAL stream, the header counter does not.** `globalSections` (every
  course flattened in `COURSES` insertion order) drives `go()` and the narration's auto-advance, so
  → past a course's last section enters the next course's first and narration flows chapter to
  chapter. The per-course `sections` still drives the capture plan and the §n/N header, which stay
  chapter-relative. Only the two ends of the whole catalog fall back to the catalog page.
- **A bare course id in the hash redirects, except under capture.** The GraphL catalog links each
  course to `<slug>/#/<courseId>`, so a human landing there is `replaceState`d into the course's
  first section — but the recorder deliberately lands on `#/<course>` to read
  `window.__scene.plan()`, so the redirect is guarded by `!capture`. Breaking that guard breaks
  every recorder.
- **`--idx-accent` does not exist on a section.** It is declared on `.idx` — the catalog column — so
  every `var(--idx-accent)` in the `.reel-foot*` rules resolved to nothing and the control hover
  colour and focus ring were silently dead. Those now use `--brand`, which is what `.idx` aliases it
  to. `.slide-toggle` (lines above) still has the same dead token and was left alone.
- **`--ink-rgb` is why light was additive.** ~20 `rgba(255,255,255,a)` literals in `styles.css` were
  all "ink at some alpha", so parameterising the CHANNELS converts every one by substitution and
  leaves dark byte-identical — one token instead of eleven alpha tokens. `--line`, `--header-bg`,
  `--hover` and `--idx-line` are alpha over it and so flip for free. `--scrim` is the exception and
  must stay its own token: it follows `--bg`, not the ink, or a light button comes out near-black.
- **`eyebrow` is a prop, not a derivation.** It is burned into every recorded video, and two repos
  brand themselves differently from their title (`Apache Spark` → `SPARK`,
  `Databricks Data Engineer` → `DATABRICKS`).
- **The toggle is a FOURTH thing that must land in all three site bars.** `ThemeToggle` +
  `.site__icon` + `.theme-swap` exist here and at ui-graphl; python-lab's hand-port does NOT have it
  yet, so the bar currently differs across the three. See the site-bar invariant below.
- **The site bar exists THREE times on purpose**, and they only stay one design if every change
  lands in all three:
  1. `ui-graphl/index.html` + `styles.css` — the original. Buildless vanilla, so it can never
     import a React component.
  2. **here** — `SiteHeader` + the `.site*` rules, a port of it class for class. Deliberate
     differences: `--site-h` (the bar's 60px row is a literal over there; `.idx` has to subtract
     it here) and an explicit `box-sizing` on `.site__inner`, because ui-graphl has a global
     `* { box-sizing: border-box }` and this stylesheet does NOT — adding one here would move the
     section view, which is burned into video.
  3. `python-lab/src/components/SiteHeader.tsx` + the `.site*` block in its `App.css` — a
     hand-port. It cannot consume this package: the peer `@graphlearning/flow` would drag the
     react-flow engine into an app with no scenes, and this stylesheet re-declares `.idx`,
     `.idx-card`, `.idx-card__num`, `.idx-card__title`, `.idx__grid`, `.idx__head` and
     `.idx__subject` — names that repo already owns with different markup. Deliberate differences:
     `kind` defaults to `"labs"`, and the bar's colour tokens are scoped to `.site` rather than
     `:root`, because that repo's `--accent` is One Dark's `#61afef` (the editor surface, matching
     `@codemirror/theme-one-dark`) while the bar's must stay platform blue.

  A fourth `chrome.css` export — the tokens and `.site*` rules without the catalog — would let a
  consumer take the bar without the collisions, and would retire copy 3. Considered and deferred
  on 2026-09-20; the hand-port was the call.

## Verification bar

No test runner, same as the rest of the workspace: `npm run build` clean **and** the fixture harness
(`npm run dev`, :5176) visually correct — the diagram scene, the code scene, the missing-scene
fallback, and `→` crossing the Alpha→Beta course boundary. Two fixture courses, not one, because
that boundary is the only way to exercise the global section stream.

For a change that could move pixels, that bar is not enough: screenshot a content repo before and
after and diff. **The capture noise floor is ~0.18% of pixels** (GPU compositing and fitView timing
vary run to run), so a diff only means something when compared against a same-build control run.

## Scenes and content stay in the repos

This package owns no scenes and no courses. `getScene` and `courses` are injected. `Section` and
`Course` live in `src/types.ts` because the shell renders them, and every repo's copy was
byte-identical.

## The scripts

They live here because they drive the route contract this package defines — see README for the
roots (`repoDir` / `dataDir` / `pkgDir`), `loadPeer`, and `concept.json`. They are `bin` entries,
run from a content repo's root (never from here — `_paths.mjs` exits if cwd has no `package.json`).

**`record-all.mjs` is a batch over `record-course.mjs`**, uplifted from apache-spark and
system-design on 2026-10-08 (it had been an untracked local file in both, never committed — so this
is also the first time it is under version control). Three things about it are deliberate:

- **It spawns `record-course.mjs` directly** (`process.execPath` + `pkgDir`), not `npm run record`.
  `pkgDir` is the correct root here precisely because the recorder is package-owned — the
  `import.meta.url` trap below is about repo DATA. Going direct also drops an npm layer between the
  batch and ffmpeg/puppeteer for `SIGINT` to cross, and means the batch does not require the
  consuming repo to have declared a `record` script.
- **The git branch is read, not assumed.** Both origin copies hardcoded `origin main`; a packaged
  script cannot, because not every repo records from `main` (aws-lab sits on `rebuild/atom-library`).
  A detached HEAD skips the pull rather than guessing, and the probe swallows git's own stderr so a
  non-repo does not print `fatal:` ahead of the friendly note.
- **`caffeinate` stays in the repo's npm script**, not inside this file. It is macOS-only, and
  re-exec'ing under it would hide a process layer from whoever is reading a multi-hour batch's
  output. The wiring is `"record:all": "caffeinate -ims graphl-record-all"`.

A course is recorded only when every wav the manifest lists for it exists; the point of the whole
script is that `record-course.mjs`'s 3s-silence fallback for a missing clip is right for one clip and
wrong for a whole chapter, and a plain shell `for` loop over `npm run record` silently takes the
latter.

**Loop capture (both recorders).** A section is screencast for ONE short window — `LEAD_S` of
discarded ramp-up + `LOOP_CYCLES × PULSE_S` (one 2.4s period by default) + a guard — which is
normalized to an exact CFR clip and repeated over the narration's length by `-stream_loop -1`,
bounded by `-t total`. It rests on the engine: the edge pulse (`FlowEdge`,
`animateMotion dur="2.4s"`) is the only motion in a frame, so the composition is periodic with a
2.4s period and any whole multiple of it joins back onto itself — whatever phase the recording
started in. Hence these rules:

- **The window must be a whole multiple of `PULSE_S`.** `LOOP_MS` / `LOOP_CYCLES` are snapped for
  exactly this reason. Measured on a 48s `models` segment: with a snapped window the frame-to-frame
  difference at each loop join is 41–45 against a median of 43 — indistinguishable from an ordinary
  frame step, at one cycle and at three. Faking a 3.7s period puts a 102 spike (the distribution's
  maximum) at every join, once every 111 frames. The unsnapped version is not subtly worse, it is a
  visible jump.
- **One period is already the whole picture.** A pulse crosses its entire edge in exactly `dur`, so
  cycle 2 is a re-recording of cycle 1 — which is why the default is 1 and not 3. What more cycles
  actually buy is dilution: a capture hiccup inside the window repeats for the whole section, so a
  section that shows one is a reason to raise `LOOP_CYCLES`, not to abandon looping.
- **A run of identical frames is usually the SCENE, not the capture.** Counting near-zero
  frame-to-frame differences looks like a dropped-frame detector and is not one. `FlowEdge`'s label
  pill is opaque by design (it *interrupts* the line rather than crossing it) and renders in
  `EdgeLabelRenderer`, above the edges — so a pulse is invisible while it crosses its path midpoint.
  In a scene where every edge carries a label and the pulses are in phase, all of them vanish
  together for ~0.3s in the middle of each period, and the frame genuinely does not change. Measured
  on `models/graph-shape`: 12.3% "duplicate" frames under the old full-length screencast, 9.0% under
  the looped window, and **11.7% under a deterministic frame-stepped capture that cannot stall** —
  which is what proves it is the scene. Before believing such a metric, step the SMIL clock
  (`pauseAnimations` + `setCurrentTime`) to the static window and look at the frame.
- **`PULSE_S` duplicates a value `ui-flow` owns.** Change the engine's `dur` and every recorded video
  gets that jump back, with a green build. Noted as an invariant in `ui-flow/CLAUDE.md` too.

The segment's timing is unchanged by any of this — `total` is still bell + wav + tail, still driven by
ffprobe — so a loop-captured segment concatenates with an old one. Only the capture is shorter.
`NO_LOOP=1` restores the previous hold-for-the-whole-wav capture. The intermediate clip is encoded
ultrafast/crf 14 (near-lossless) because the segment's own encode is what sets final quality and
carries the gradfun deband; that is a second generation, which flat dark UI tolerates and photographic
content would not.

Three traps, all found the hard way during the extraction:

- **Never use `import.meta.url` to find anything but package-owned files.** From `node_modules`
  that points at the package. Outputs and repo data go through `repoDir` / `dataDir`.
- **Never `import` a peer by bare specifier.** Use `loadPeer`. `esbuild` "worked" for a while only
  because this package's own vite install happened to provide it — that would have failed the
  moment the package was consumed from the registry rather than a sibling checkout.
- **Two scripts, two names.** `gen-descriptions` and `thumb` had *separate* copies of the concept
  name, and apache-spark's had drifted apart on purpose ("Apache Spark" vs "SPARK"). Collapsing
  per-repo constants into one config is where an extraction silently rebrands things — diff the
  real output against the pre-extraction script before believing it.

## Verifying a script change

Run the pre-extraction script from git (`git show HEAD:scripts/<x>.mjs`) and the new one, and diff
the outputs. `gen:desc` is the cheap one — no browser, and it exercises the content registry, the
config and the path roots at once.

## Known doc drift

- README's peer-dependency section still quotes the engine range as `>=0.5.0 <1.0.0`;
  `package.json` has said `>=0.8.0 <2.0.0` since flow went 1.x. The reasoning around it is current.
- The `graphl-capture-shots` bin (`scripts/capture-shots.mjs`) is not in README's toolchain table.
- `scripts/shots-4k.mjs` defaults its course argument to `'foundations'` — a content-repo name that
  leaked into the package during the extraction. Harmless (every repo passes a course) but wrong here.
- The workspace `CLAUDE.md` lists `npm run check` among the pre-handover guards; no such script
  exists here (see Commands).
