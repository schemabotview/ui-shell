# DECISIONS — ui-shell

The WHY behind `CLAUDE.md`'s invariants: history, measurements, rejected alternatives. Rules live
in `CLAUDE.md`; this file explains them. Each section is the invariant's full original text.

## 1. ConceptApp and SiteHeader are the only exports

**`ConceptApp` and `SiteHeader` are the only exports.** `SectionView`, `CourseIndex` and
`useNarration` are deliberately withheld. The route contract
(`#/<slug>`, `?capture=1`, `window.__scene.plan()`) is what every repo's recorder drives, and it
only holds if every repo composes the pieces identically. Exporting the parts would ship a
supported way to diverge again — which is the thing this package exists to end. Same reasoning as
the engine withholding its layout internals. `SiteHeader` is the one exception and it proves the rule:
it has no route surface, renders on the catalog page only, and python-lab needs it without
`ConceptApp` — there is nothing in it to compose differently.

## 2. No build-time magic

**No build-time magic.** `import.meta.env` cannot be read here (see README, contract 3). Anything
that depends on the consuming app's vite config arrives as a prop.

## 3. The engine is a peer

**The engine is a peer.** Never a dependency — one engine copy per app, pinned by the app. The
vite `external` list is load-bearing for the same reason: bundling `@graphlearning/graphl-flow` would
put a second engine inside this package. The range is `>=0.2.0 <1`, ONE range, not a list of
carets: on 0.x a caret pins the minor, so `^0.2.0 || … || ^0.4.0` made every engine minor a shell
patch release that only widened the range (1.0.2, 1.0.3, 1.0.4 — and a content repo that upgraded
the engine first could not install at all). `>=` keeps 0.2.0 itself (python-ct pins `^0.2.0`), and
`<1` is the gate that matters: the engine declares a breaking layout change by going MAJOR, and
that is the one a shell release should have to vouch for. What proves an engine upgrade is the
content repo's own frame check, not this range.

## 4. theme is the DECK's declared look; the READER may override it, and capture ignores the reader

**`theme` is the DECK's declared look; the READER may override it, and capture ignores the reader.**
`ConceptApp` takes `theme?: 'dark' | 'light'` and forwards it to every `<Scene>`. One value,
because a light scene inside dark chrome is a white rectangle on a dark page. A reader can
override it from a toggle in TWO places, both of which are suppressed at capture: `SiteHeader` (the
catalog page — SiteHeader never renders on a section) and the section's own footer control bar,
which already exists as an interactive-only cluster behind `!capture` alongside Home, narration and
the pager. So the control can never appear in a captured frame from either route. The two render
differently on purpose: the bar uses a text glyph because it is a character-for-character port of
ui-graphl, the footer uses lucide because every sibling in that cluster is lucide. `?capture=1`
pins to the declared prop and ignores stored choice entirely; without that pin a 4K capture would
depend on whoever last used the browser. Consequence of a repo going light: it must ALSO re-pick
`--brand` — a brand tuned to glow on slate can fall under 3:1 on
off-white, and the shell cannot repick it without taking ownership of the one surface it
deliberately leaves to the repo.

## 5. The reader's choice IS the platform's

**The reader's choice IS the platform's.** Key `graphl:theme`, values `light`/`dark`/absent,
switch `data-theme` on `<html>` — the same four things ui-graphl/theme.js owns, because every
GraphL app is same-origin under graphl.in and a reader who picks light on the catalog should walk
into a concept app already light. Cross-tab `storage` sync and the one-frame `.theme-swap` are
ported too. TWO DELIBERATE DIVERGENCES, both from the same fact — a deck is authored and a catalog
is not:
1. The catalog CYCLES through three states (system → light → dark); this TOGGLES between two. The
   neutral step would have to be labelled "Deck theme", which means nothing to a reader and costs
   them a press to get where they were going.
2. At the catalog an absent value means "follow the OS"; here it means "follow the DECK". Letting
   an OS setting silently repaint scenes and narration that were built and reviewed in one
   look is not the same decision as letting it repaint a directory page.
The stored VALUES stay identical (`light`/`dark`/absent), so the two apps never disagree about an
explicit choice — only the absence is read differently, and this one never writes it back.

## 6. The attribute goes on <html>, not a wrapper

**The attribute goes on `<html>`, not a wrapper.** `ConceptApp` renders a fragment; adding a
wrapping element would change the section view's box model, which is burned into every recorded
video. An attribute costs no layout.

## 7. The narration SCRUB BAR is landscape-only, and it takes the <audio> ELEMENT, not state

**The narration SCRUB BAR is landscape-only, and it takes the `<audio>` ELEMENT, not state.**
`NarrationBar` sits between the two footer clusters (inside the same `!capture` footer, so a
recording can never show it). Three things fixed its shape:
1. `timeupdate` fires ~4x a second. Lifting position into `ConceptApp` would re-render `<Scene>`
   four times a second for a 4px bar, so `useNarration` hands out the
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

## 8. The reader's bell is a SECOND implementation of the recorder's, and it must never become the recording's

**The reader's bell is a SECOND implementation of the recorder's, and it must never become the
recording's.** Starting a section rings a bell and holds `STING_MS` (2.8s) before the clip, so a
reader hears the lead a viewer hears. Four things make that safe:
1. **`sting: !capture`.** The recorders build the bell in ffmpeg (`prepareBell` → `concatAudio`)
   and map audio from that wav (`-map 1:a:0`); `page.screencast` carries video only and
   `makeLoopClip` passes `-an`. So page audio cannot reach a segment — but under `?capture=1`
   the lead is switched off anyway, so a capture window holds no live AudioContext and there is
   nothing to reason about. Do not "simplify" that gate away on the grounds that it is redundant;
   it is the thing that makes the no-double-bell claim hold without reading ffmpeg flags.
2. **The bell is WebAudio, never an `<audio>` element.** `ended` on the narration element IS the
   auto-advance (`ConceptApp`'s `onEnded` sets `location.hash`). A bell that was an element — or
   the same element with the bell as its src — would page the app forward on its own, and under
   capture that lands the NEXT scene inside this section's screencast window with a green exit
   and a valid sidecar. Only the clip reaching its end may navigate.
3. **No DOM, no per-frame state.** Oscillators and one `setTimeout`; nothing renders, nothing
   re-renders, `<Scene>`'s keyed fit and `data-fit="ready"` are untouched. Same reason the scrub
   bar takes the element rather than lifting position into `ConceptApp`.
4. **`STING_MS` and the three tones duplicate values `record-course.mjs` owns** (same trap class
   as `PULSE_S` duplicating the engine's period — and here the two live in different languages,
   so nothing but these notes couples them). Change the recorder's `STING_MS` default or its
   filtergraph and the app and the video disagree about the lead, with a green build. `NO_STING=1`
   is not the way to retire the recorder's bell either: `sting` is in the segment fingerprint, so
   it re-records every segment of every course.
A clip that 404s (a repo with no narration yet) cancels the bell on the element's `error` rather
than ringing out over silence, and a scrub during the lead cuts it short and starts the clip.

## 9. ← / → belong to the NARRATION, not the pager — when there is a clip

**← / → belong to the NARRATION, not the pager — when there is a clip.** A section with a loaded
clip seeks ∓10s; everything else (the catalog, a bare scene view, a section whose wav 404s, a repo
with no narration yet) still pages, and `Shift`+arrow always pages. The gate is the clip's
duration, which is the same gate `NarrationBar` renders on — so the rule is *visible*: the arrows
scrub exactly when the bar is on screen, never a hidden mode. What made the trade payable is that
the pager already had two other controls (the footer `‹` `›`, and `Esc` out) while a listener had
none; `SEEK_S` lives in `NarrationBar` and is shared, so the focused-track arrows and the
window-level ones cannot drift to different step sizes. The track's own handler still
`stopPropagation`s — with both handlers live on the same clip it would otherwise step TWICE.
The footer pager's labels say `Shift+←` / `Shift+→` because that is the binding that always works.

## 10. Section nav walks the GLOBAL stream, the header counter does not

**Section nav walks the GLOBAL stream, the header counter does not.** `globalSections` (every
course flattened in `COURSES` insertion order) drives `go()` and the narration's auto-advance, so
→ past a course's last section enters the next course's first and narration flows chapter to
chapter. The per-course `sections` still drives the capture plan and the §n/N header, which stay
chapter-relative. Only the two ends of the whole catalog fall back to the catalog page.

## 11. A bare course id in the hash redirects, except under capture

**A bare course id in the hash redirects, except under capture.** The GraphL catalog links each
course to `<slug>/#/<courseId>`, so a human landing there is `replaceState`d into the course's
first section — but the recorder deliberately lands on `#/<course>` to read
`window.__scene.plan()`, so the redirect is guarded by `!capture`. Breaking that guard breaks
every recorder.

## 12. A section frame is the SCENE ALONE

**A section frame is the SCENE ALONE** (1.0): no header, no eyebrow, no slide panel. The title
and course are in the video's own title and the narration; the facts a slide carried belong in
the scene (tables, notes, bullets). `.scene-area` fills the frame — landscape `inset: 0`, portrait
keeps `bottom: 7.5vh` for the one-row control footer. So the scene area is exactly 16:9 at 4K
(`SCENE_ASPECT`), and the footer, which floats over it in landscape, exists only off `?capture=1`.
Re-adding any chrome over a section re-frames every recorded video — a major.

## 13. <Scene> is KEYED by its scene id

**`<Scene>` is KEYED by its scene id** (1.0.1) — `section.scene` in `SectionView`, the route id in
the bare scene view. Navigation is a hash change, so an unkeyed `<Scene>` was one instance for the
whole visit: the next scene was measured under the previous one's fit (edge routes off their
faces by ~0.14px) and its `data-fit` read `ready` on the first frame after navigation, before it had
settled — the very signal the recorders wait on (`gotoSection`'s 700ms sleep masked it). Keyed, the
first frame reads `pending` and the drift is 0. Consecutive sections that reuse one scene with a
different `focus` keep the instance — same scene, same measurements, nothing moves.

## 14. --idx-accent does not exist on a section

**`--idx-accent` does not exist on a section.** It is declared on `.idx` — the catalog column — so
every `var(--idx-accent)` in the `.reel-foot*` rules resolved to nothing and the control hover
colour and focus ring were silently dead. Those now use `--brand`, which is what `.idx` aliases it
to.

## 15. --ink-rgb is why light was additive

**`--ink-rgb` is why light was additive.** ~20 `rgba(255,255,255,a)` literals in `styles.css` were
all "ink at some alpha", so parameterising the CHANNELS converts every one by substitution and
leaves dark byte-identical — one token instead of eleven alpha tokens. `--line`, `--header-bg`,
`--hover` and `--idx-line` are alpha over it and so flip for free. `--scrim` is the exception and
must stay its own token: it follows `--bg`, not the ink, or a light button comes out near-black.

## 16. The toggle is a FOURTH thing that must land in all three site bars

**The toggle is a FOURTH thing that must land in all three site bars.** `ThemeToggle` +
`.site__icon` + `.theme-swap` exist here and at ui-graphl; python-lab's hand-port does NOT have it
yet, so the bar currently differs across the three. See the site-bar invariant below.

## 17. The site bar exists THREE times on purpose

**The site bar exists THREE times on purpose**, and they only stay one design if every change
lands in all three:
1. `ui-graphl/index.html` + `styles.css` — the original. Buildless vanilla, so it can never
   import a React component.
2. **here** — `SiteHeader` + the `.site*` rules, a port of it class for class. Deliberate
   differences: `--site-h` (the bar's 60px row is a literal over there; `.idx` has to subtract
   it here) and an explicit `box-sizing` on `.site__inner`, because ui-graphl has a global
   `* { box-sizing: border-box }` and this stylesheet does NOT — adding one here would move the
   section view, which is burned into video.
3. `python-lab/src/components/SiteHeader.tsx` + the `.site*` block in its `App.css` — a
   hand-port. It cannot consume this package: the peer `@graphlearning/graphl-flow` would drag the
   render engine into an app with no scenes, and this stylesheet re-declares `.idx`,
   `.idx-card`, `.idx-card__num`, `.idx-card__title`, `.idx__grid`, `.idx__head` and
   `.idx__subject` — names that repo already owns with different markup. Deliberate differences:
   `kind` defaults to `"labs"`, and the bar's colour tokens are scoped to `.site` rather than
   `:root`, because that repo's `--accent` is One Dark's `#61afef` (the editor surface, matching
   `@codemirror/theme-one-dark`) while the bar's must stay platform blue.

A fourth `chrome.css` export — the tokens and `.site*` rules without the catalog — would let a
consumer take the bar without the collisions, and would retire copy 3. Considered and deferred
on 2026-09-20; the hand-port was the call.

## 18. record-all.mjs

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

## 19. Loop capture (both recorders)

A section is screencast for ONE short window — `LEAD_S` of
discarded ramp-up + `LOOP_CYCLES × PULSE_S` (one 2.4s period by default) + a guard — which is
normalized to an exact CFR clip and repeated over the narration's length by `-stream_loop -1`,
bounded by `-t total`. It rests on the engine: the edge pulse (graphl-flow `Edges.tsx`,
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
  frame-to-frame differences looks like a dropped-frame detector and is not one. The engine's label
  pill is opaque by design (it *interrupts* the line rather than crossing it) and renders as HTML
  above the edge SVG — so a pulse is invisible while it crosses its path midpoint.
  In a scene where every edge carries a label and the pulses are in phase, all of them vanish
  together for ~0.3s in the middle of each period, and the frame genuinely does not change. Measured
  on `models/graph-shape`: 12.3% "duplicate" frames under the old full-length screencast, 9.0% under
  the looped window, and **11.7% under a deterministic frame-stepped capture that cannot stall** —
  which is what proves it is the scene. Before believing such a metric, step the SMIL clock
  (`pauseAnimations` + `setCurrentTime`) to the static window and look at the frame.
- **`PULSE_S` duplicates a value the engine owns** (`PULSE_S` in graphl-flow's `Edges.tsx`). Change
  the engine's period and every recorded video gets that jump back, with a green build. Noted as an
  invariant in `graphl-flow/CLAUDE.md` too.
- **The recorders wait for `.gf-scene[data-fit="ready"]`** (fonts loaded, edges routed, label gaps
  settled, fit applied) — the engine's own signal, not a node selector.

The segment's timing is unchanged by any of this — `total` is still bell + wav + tail, still driven by
ffprobe — so a loop-captured segment concatenates with an old one. Only the capture is shorter.
`NO_LOOP=1` restores the previous hold-for-the-whole-wav capture. The intermediate clip is encoded
ultrafast/crf 14 (near-lossless) because the segment's own encode is what sets final quality and
carries the gradfun deband; that is a second generation, which flat dark UI tolerates and photographic
content would not.

## 20. The extraction's three traps

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

## 21. History

Extracted from the seven content repos on 2026-09-19, the same way the render engine was
extracted into `ui-flow`. Since 1.0.0 it renders with `@graphlearning/graphl-flow` (the `graphl-flow`
repo). 0.13.0 shipped the 0.12 stylesheet because it was published from a checkout whose `dist/`
predated the change — `npm publish` packs `dist/` as it finds it; 0.13.1 is the same source, built.
Port 5174 was the old `ui-flow`.
