#!/usr/bin/env node
// capture-shots.mjs — [STEP 2, not yet wired] screenshot every slug's scene + record node coords.
//
//   node scripts/capture-shots.mjs [--only <slug[,slug]>]
//
// Plan (blueprint: ../../graphl-studio/aws-lab/scripts/capture-shots.mjs):
//   1. spawn `npm run dev`, open it headless at 4K (3840×2160) with ?capture=1.
//   2. read window.__scene.plan() → the list of slugs (scene + focus node).
//   3. for each slug: render its scene, wait for the painted frame, screenshot → images/<slug>.png
//      (full-frame background), and MEASURE node bounding boxes (react-flow node rects) → coords,
//      including the focus node's box. Coords are written to a sidecar so the compose step can float
//      the text panel clear of the narrating node.
//
// The full-frame PNG is the video background; the coords drive dynamic panel placement.

console.error('capture-shots.mjs is a step-2 stub — not wired yet. See the header for the plan.')
process.exit(1)
