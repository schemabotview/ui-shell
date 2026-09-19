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
