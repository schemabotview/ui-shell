import type { SceneModel } from '@graphlearning/graphl-flow'
import type { Course } from '../src/types'

export const SCENES: Record<string, SceneModel> = {
  'fx-flow': {
    nodes: [
      { type: 'item', id: 'a', icon: 'database', title: 'Source', sub: 'where it starts', tone: 'store' },
      { type: 'item', id: 'b', icon: 'workflow', title: 'Transform', sub: 'the middle', tone: 'infra' },
      { type: 'item', id: 'c', icon: 'database', title: 'Sink', sub: 'where it lands', tone: 'store' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  },
  'fx-full': {
    dir: 'row',
    nodes: [
      { type: 'item', id: 'in', icon: 'table', title: 'Orders', sub: 'one row per order line', tone: 'store' },
      {
        type: 'table',
        id: 'rows',
        title: 'order_lines',
        columns: ['order', 'sku', 'qty', 'price'],
        rows: [
          ['A-1001', 'TEA-01', 3, '4.50'],
          ['A-1001', 'MUG-02', 1, '8.00'],
          ['A-1002', 'TEA-01', 2, '4.50'],
        ],
      },
      {
        type: 'item',
        id: 'facts',
        icon: 'file',
        tone: 'infra',
        title: 'The frame carries the facts',
        bullets: ['The data the narration names is in the frame', 'No panel competes with the diagram', 'Narration carries the title'],
      },
    ],
    edges: [
      { from: 'in', to: 'rows' },
      { from: 'rows', to: 'facts' },
    ],
  },
  'fx-code': {
    nodes: [
      {
        type: 'code',
        id: 'src',
        filename: 'fixture.py',
        lang: 'python',
        code: [
          '# — the shell renders, the engine draws —',
          'rows = [r for r in read("in.csv") if r.ok]',
          'total = sum(r.amount for r in rows)',
          'print(f"{len(rows)} rows, {total:.2f}")',
        ].join('\n'),
      },
    ],
  },
}

export const getScene = (id: string) => SCENES[id]

export const COURSES: Record<string, Course> = {
  alpha: {
    id: 'alpha',
    title: 'Alpha — the first course',
    sections: [
      {
        id: 'diagram',
        title: 'A diagram scene',
        scene: 'fx-flow',
        focus: 'b',
        narration: 'A diagram scene, laid out by the engine.',
      },
      {
        id: 'code',
        title: 'A code scene',
        scene: 'fx-code',
        narration: 'A code scene, rendered by the engine code node.',
      },
      {
        id: 'missing',
        title: 'A missing scene',
        scene: 'fx-does-not-exist',
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
        narration: 'Crossing a course boundary.',
      },
      {
        id: 'full',
        title: 'A data-dense scene',
        scene: 'fx-full',
        narration: 'Table, flow and facts in one frame.',
      },
      {
        id: 'end',
        title: 'The end of the stream',
        scene: 'fx-code',
        narration: 'The end of the stream.',
      },
    ],
  },
}
