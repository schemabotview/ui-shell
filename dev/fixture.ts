import type { Scene } from '@graphlearning/flow'
import type { Course } from '../src/types'

export const SCENES: Record<string, Scene> = {
  'fx-flow': {
    id: 'fx-flow',
    nodes: [
      { id: 'a', label: 'Source', sub: 'where it starts', pattern: 'storage' },
      { id: 'b', label: 'Transform', sub: 'the middle', pattern: 'service' },
      { id: 'c', label: 'Sink', sub: 'where it lands', pattern: 'storage' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  },
  'fx-code': {
    id: 'fx-code',
    nodes: [
      {
        id: 'src',
        kind: 'code',
        filename: 'fixture.py',
        label: [
          '# — the shell renders, the engine draws —',
          'rows = [r for r in read("in.csv") if r.ok]',
          'total = sum(r.amount for r in rows)',
          'print(f"{len(rows)} rows, {total:.2f}")',
        ].join('\n'),
      },
    ],
    edges: [],
  },
}

export const getScene = (id: string) => SCENES[id]

const slide = (title: string, body: string) => `## ${title}\n\n${body}`

export const COURSES: Record<string, Course> = {
  alpha: {
    id: 'alpha',
    title: 'Alpha — the first course',
    sections: [
      {
        id: 'diagram',
        title: 'A diagram scene',
        scene: 'fx-flow',
        slide: slide(
          'A diagram scene',
          'The scene is a **react-flow diagram**, laid out entirely by the engine.\n\n### What to check\n— The eyebrow reads `FIXTURE · ALPHA` in `--brand`\n— This `###` heading is in `--accent-2`\n— `inline code` sits on the slide surface\n\n### And the controls\n— `←` / `→` seek narration ±10s (no clip → walk sections), `Shift`+`←` / `→` always walk, `Space` toggles narration\n— The footer pager shows `1 / 3`',
        ),
        narration: 'A diagram scene, laid out by the engine.',
      },
      {
        id: 'code',
        title: 'A code scene',
        scene: 'fx-code',
        slide: slide(
          'A code scene',
          'The same composition with a **code card** on the left.\n\n### Token colours\nThese come from `@graphlearning/flow/styles.css`, not from this package — if the code above is flat grey, the engine stylesheet is missing.',
        ),
        narration: 'A code scene, rendered by the engine code node.',
      },
      {
        id: 'missing',
        title: 'A missing scene',
        scene: 'fx-does-not-exist',
        slide: slide('A missing scene', 'This section names a scene id that is not in the registry — the shell should render its `no scene:` fallback rather than crashing.'),
        narration: 'A deliberately missing scene.',
      },
    ],
  },
  beta: {
    id: 'beta',
    title: 'Beta — the second course',
    sections: [
      {
        id: 'rollover',
        title: 'Crossing a course boundary',
        scene: 'fx-flow',
        slide: slide(
          'Crossing a course boundary',
          'You reached this by pressing `→` on the **last section of Alpha**.\n\n### Why this fixture has two courses\nSection nav walks the whole catalog as one stream, so a course boundary is just another step. With one course that behaviour is invisible.',
        ),
        narration: 'Crossing a course boundary.',
      },
      {
        id: 'end',
        title: 'The end of the stream',
        scene: 'fx-code',
        slide: slide('The end of the stream', 'The last section of the last course. `→` here returns to the catalog — the only place it does.'),
        narration: 'The end of the stream.',
      },
    ],
  },
}
