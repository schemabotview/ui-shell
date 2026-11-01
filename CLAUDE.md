# CLAUDE.md — ui-shell

> Workspace rules and the coupled-values table: `../CLAUDE.md`. Consumer contract: `README.md`
> (integration, the three contracts, the route contract, the toolchain). The WHY behind every
> invariant below: `docs/DECISIONS.md` (cited as D1…D21).

`@graphlearning/shell`. `graphl-flow` draws a scene; **this draws everything else**: the router, the
section frame (the scene, full frame), the catalog, the narration channel, the stylesheet, and the
record/publish toolchain. It owns no scenes and no courses: `getScene` and `courses` are injected.
`Section` and `Course` live in `src/types.ts` because the shell renders them.

## Commands

```bash
npm run dev     # fixture harness on :5176 — the review surface for any shell change
npm run build   # vite lib build → dist/index.js, then tsc → dist/index.d.ts, then cp styles.css
npm run watch   # vite build --watch, for use against a content repo on a file: install
npx tsc --noEmit -p tsconfig.json   # typecheck only
```

- **No test runner, no linter, no `npm run check`.** `build` runs `tsc`, so it is the real gate — a
  floor, not proof (see Verification).
- **`npm publish` builds first** (`prepublishOnly`): `npm publish` packs `dist/` as it finds it (D21).
- `dist/styles.css` is COPIED, not bundled: a `styles.css` edit reaches a consumer only after a
  build, and a consumer on a `file:` install sees `src/` changes only through `dist/`.
- Port 5176 is deliberate: 5173 is a content repo, 5175 graphl-flow's gallery; they run side by side.
  graphl-flow's capture script stays off 5176 for this reason.

## Invariants

- **`ConceptApp` and `SiteHeader` are the only exports.** `SectionView`, `CourseIndex`, `useNarration`
  stay withheld: exporting parts ships a supported way to diverge from the route contract. (D1)
- **No build-time magic.** `import.meta.env` is never read here; anything that depends on the
  consuming app's vite config arrives as a prop. (D2)
- **The engine is a peer, ONE range `>=0.2.0 <1`.** Never a dependency; the vite `external` list is
  load-bearing. `<1` is the gate: an engine MAJOR is what a shell release must vouch for. (D3)
- **`theme` is the deck's declared look; the reader may override it; `?capture=1` ignores the reader.**
  Toggles live in `SiteHeader` and the section footer, both behind `!capture`. A repo going light
  must also re-pick `--brand`. (D4)
- **The reader's choice is the platform's**: key `graphl:theme`, values `light`/`dark`/absent,
  `data-theme` on `<html>`, as ui-graphl. Two deliberate divergences: this TOGGLES (no system step),
  and absent means "follow the DECK". Never write the absence back. (D5)
- **The theme attribute goes on `<html>`**, never a wrapper element (the section box is burned into
  video). (D6)
- **The scrub bar is landscape-only and subscribes to the `<audio>` ELEMENT**, never lifted state;
  its focus indicator is the THUMB, never a track outline; no clip → no bar. (D7)
- **The reader's bell (`src/sting.ts`) is WebAudio, gated `sting: !capture`, renders nothing, and
  duplicates `STING_MS` + the tones from `record-course.mjs`.** Never an `<audio>` element (its
  `ended` would auto-advance). Do not remove the capture gate as "redundant". A 404 clip cancels the
  bell; a scrub during the lead cuts it short. (D8)
- **← / → seek the narration ∓10s when the section has a clip** (exactly when the scrub bar shows),
  else page; `Shift`+arrow always pages. `SEEK_S` lives in `NarrationBar`; the track's own handler
  `stopPropagation`s. (D9)
- **Section nav walks the GLOBAL stream** (`globalSections`, `COURSES` insertion order); the capture
  plan and the §n/N header stay per-course. (D10)
- **A bare `#/<courseId>` redirects to its first section — except under capture** (the recorder
  lands there to read `window.__scene.plan()`). (D11)
- **A section frame is the scene alone**: no header, eyebrow or slide panel; `.scene-area` is exactly
  16:9 at 4K (`SCENE_ASPECT`); portrait keeps `bottom: 7.5vh`. Re-adding chrome is a major. (D12)
- **`<Scene>` is keyed by its scene id**, so each scene's first frame reads `data-fit="pending"`. (D13)
- **Colour tokens**: `--idx-accent` exists only on `.idx` (use `--brand` on a section) (D14);
  `--ink-rgb` parameterises every "ink at some alpha"; `--scrim` stays its own token (D15).
- **The site bar exists three times** (ui-graphl, here, python-lab's hand-port): every change —
  including the theme toggle, which python-lab does NOT have yet — lands in all three. No global
  `box-sizing` here. (D16, D17)

## Verification

`npm run build` clean **and** the fixture harness (`npm run dev`, :5176) visually correct — the
diagram scene, the code scene, the missing-scene fallback, and `→` crossing the Alpha→Beta course
boundary. Two fixture courses, not one, because that boundary is the only way to exercise the global
section stream.

**The harness has no narration wavs in git** — `public/` is ignored. To exercise the channel (the
bell, the 2.8s lead, the auto-advance) generate throwaway clips for the fixture's six sections:

```bash
for s in alpha/diagram alpha/code alpha/missing beta/rollover beta/full beta/end; do
  mkdir -p "public/audio/${s%/*}"
  ffmpeg -y -v error -f lavfi -i "sine=f=220:d=5:sample_rate=44100" -ac 1 "public/audio/$s.wav"
done
```

Measure timing rather than eyeballing it: drive the harness with puppeteer, wrap
`HTMLMediaElement.prototype.play` and `AudioContext.createOscillator`, and assert the clip starts
~2800ms after the bell and that `?capture=1` creates no oscillator at all.

For a change that could move pixels, screenshot a content repo before and after and diff. **The
capture noise floor is ~0.18% of pixels** (GPU compositing and font/fit timing vary run to run), so a
diff only means something against a same-build control run.

## The scripts

They drive the route contract this package defines, so they version with it (README, "The
toolchain"). `bin` entries, run from a content repo's root — never from here (`_paths.mjs` exits if
cwd has no `package.json`).

- **`record-all.mjs`** spawns `record-course.mjs` directly (`process.execPath` + `pkgDir`), reads the
  git branch (never assumes `main`; detached HEAD skips the pull), and records a course only when
  every manifest wav exists. `caffeinate` stays in the repo's npm script. (D18)
- **Loop capture**: the window is a whole multiple of `PULSE_S`; one period is the whole picture;
  identical-frame runs are usually the scene, not the capture; `PULSE_S` duplicates graphl-flow's
  `Edges.tsx`; wait on `.gf-scene[data-fit="ready"]`. Segment timing (bell + wav + tail, via
  ffprobe) is unchanged; `NO_LOOP=1` restores the full-length capture; the intermediate clip is
  ultrafast/crf 14. (D19)
- **Traps** (D20): never `import.meta.url` for anything but package-owned files; never `import` a peer
  by bare specifier (use `loadPeer`); collapsing per-repo constants into `concept.json` can silently
  rebrand — diff the real output.
- `graphl-capture-shots` (`scripts/capture-shots.mjs`) is a stub that exits 1; use `graphl-shots-4k`.

**Verifying a script change:** run the pre-extraction script from git (`git show HEAD:scripts/<x>.mjs`)
and the new one, and diff the outputs. `gen:desc` is the cheap one — no browser, and it exercises the
content registry, the config and the path roots at once.

## Not in this package (yet)

`film.mjs`, `thumb-film.mjs`, `check-content.mjs`, `check-render.mjs`, `registry.mjs`, `shots.mjs`
and the Colab notebook are per-repo near-copies that have drifted (different in every content repo).
Uplifting them here, as the recorders were, is the next extraction.
