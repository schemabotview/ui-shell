# CLAUDE.md — ui-shell

The concept-app shell, published as `@graphlearning/shell`. Extracted from the seven content repos
on 2026-09-19, the same way the render engine was extracted into `ui-flow`.

Read `README.md` first — it carries the integration, the three contracts and the route contract.

## What this package is, in one line

`ui-flow` draws a scene. **This draws everything else**: the router, the section composition
(scene left / slide right), the slide panel, the catalog, the narration channel, the stylesheet.

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
- **The engine is a peer.** Never a dependency — one engine copy per app, pinned by the app.
- **`theme` is the DECK's declared look; the READER may override it, and capture ignores the reader.**
  `ConceptApp` takes `theme?: 'dark' | 'light'` and forwards it to every `SceneView`. A reader can
  override it from the toggle in `SiteHeader` — which is safe for exactly one reason: SiteHeader
  renders on the CATALOG PAGE ONLY, never on a section, so the control can never appear in a captured
  frame. `?capture=1` pins to the declared prop and ignores stored choice entirely; without that pin
  a 4K capture would depend on whoever last used the browser.
- **The reader's choice IS the platform's.** Key `graphl:theme`, values `light`/`dark`/absent,
  switch `data-theme` on `<html>` — the same four things ui-graphl/theme.js owns, because every
  GraphL app is same-origin under graphl.in and a reader who picks light on the catalog should walk
  into a concept app already light. Cross-tab `storage` sync and the one-frame `.theme-swap` are
  ported too. ONE DELIBERATE DIVERGENCE: at the catalog the neutral state means "follow the OS"; here
  it means "follow the DECK". A deck is authored — its scenes, slides and narration were built and
  reviewed in one look — and letting an OS setting silently repaint that is not the same decision as
  letting it repaint a directory page. The stored VALUES stay identical, so the two never disagree
  about an explicit choice; only the absence is read differently.
- **The toggle is now a FOURTH thing that must land in all three site bars.** `ThemeToggle` +
  `.site__icon` + `.theme-swap` exist here and at ui-graphl; python-lab's hand-port does NOT have it
  yet, so the bar currently differs across the three. See the site-bar invariant below.
- *(superseded)* `theme` is DECK-level and never a viewer toggle. `ConceptApp` takes `theme?: 'dark' | 'light'`,
  forwards it to every `SceneView`, and sets `data-theme` on `<html>` for the shell's own light token
  block. One value, because a light scene inside dark chrome is a white rectangle on a dark page. It
  is deliberately OUTSIDE the route contract: a deck is a video, and a recorded frame that depended on
  `prefers-color-scheme` would capture differently on two laptops. A repo sets it once in `main.tsx`.
  Consequence: a repo going light must ALSO re-pick `--brand` / `--brand-hover` / `--accent-2` — a
  brand tuned to glow on slate can fall under 3:1 on off-white, and the shell cannot repick those
  without taking ownership of the one surface it deliberately leaves to the repo.
- **The attribute goes on `<html>`, not a wrapper.** `ConceptApp` renders a fragment; adding a
  wrapping element would change the section view's box model, which is burned into every recorded
  video. An attribute costs no layout.
- **`--ink-rgb` is why light was additive.** ~20 `rgba(255,255,255,a)` literals in `styles.css` were
  all "ink at some alpha", so parameterising the CHANNELS converts every one by substitution and
  leaves dark byte-identical — one token instead of eleven alpha tokens. `--line`, `--header-bg`,
  `--hover` and `--idx-line` are alpha over it and so flip for free. `--scrim` is the exception and
  must stay its own token: it follows `--bg`, not the ink, or a light button comes out near-black.
- **`eyebrow` is a prop, not a derivation.** It is burned into every recorded video, and two repos
  brand themselves differently from their title (`Apache Spark` → `SPARK`,
  `Databricks Data Engineer` → `DATABRICKS`).
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
fallback, and `→` crossing the Alpha→Beta course boundary.

For a change that could move pixels, that bar is not enough: screenshot a content repo before and
after and diff. **The capture noise floor is ~0.18% of pixels** (GPU compositing and fitView timing
vary run to run), so a diff only means something when compared against a same-build control run.

## Scenes and content stay in the repos

This package owns no scenes and no courses. `getScene` and `courses` are injected. `Section` and
`Course` live here because the shell renders them, and every repo's copy was byte-identical.

## The scripts

They live here because they drive the route contract this package defines — see README for the
roots (`repoDir` / `dataDir` / `pkgDir`), `loadPeer`, and `concept.json`.

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
