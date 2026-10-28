import type { Layout, Shape } from 'plotly.js';

export const CONDITION_COLORS = {
  baseline: '#8a8e95',
  intervention: '#3987e5',
  compare: '#d95926',
} as const;

export const TARGET_COLOR = '#ffffff';

/** Shaded band marking the stimulation window. */
export function stimShape(startMs: number, endMs: number): Partial<Shape> {
  return {
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: startMs,
    x1: endMs,
    y0: 0,
    y1: 1,
    fillcolor: 'rgba(57,135,229,0.09)',
    line: { width: 0 },
    layer: 'below',
  };
}

export function stimAnnotation(startMs: number, endMs: number): Partial<Layout>['annotations'] {
  return [
    {
      x: (startMs + endMs) / 2,
      y: 1,
      xref: 'x',
      yref: 'paper',
      yanchor: 'bottom',
      text: 'stimulus window',
      showarrow: false,
      font: { size: 10, color: '#6f8fb8' },
    },
  ];
}
