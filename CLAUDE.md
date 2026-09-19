# CLAUDE.md — ui-shell

The concept-app shell, published as `@graphlearning/shell`. Extracted from the seven content repos
on 2026-09-19, the same way the render engine was extracted into `ui-flow`.

Read `README.md` first — it carries the integration, the three contracts and the route contract.

## What this package is, in one line

`ui-flow` draws a scene. **This draws everything else**: the router, the section composition
(scene left / slide right), the slide panel, the catalog, the narration channel, the stylesheet.

## Invariants

- **Only `ConceptApp` is exported.** `SectionView`, `CourseIndex`, `SlidePanel`, `useNarration` and
  `useSlideScale` are deliberately withheld. The route contract (`#/<slug>`, `?capture=1`,
  `window.__scene.plan()`) is what every repo's recorder drives, and it only holds if every repo
  composes the pieces identically. Exporting the parts would ship a supported way to diverge again —
  which is the thing this package exists to end. Same reasoning as `ui-flow` withholding
  `computeLayout`.
- **No build-time magic.** `import.meta.env` cannot be read here (see README, contract 3). Anything
  that depends on the consuming app's vite config arrives as a prop.
- **The engine is a peer.** Never a dependency — one engine copy per app, pinned by the app.
- **`eyebrow` is a prop, not a derivation.** It is burned into every recorded video, and two repos
  brand themselves differently from their title (`Apache Spark` → `SPARK`,
  `Databricks Data Engineer` → `DATABRICKS`).

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
