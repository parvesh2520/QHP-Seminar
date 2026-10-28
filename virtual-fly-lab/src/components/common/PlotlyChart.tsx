import type { Config, Data, Layout } from 'plotly.js';
import { useEffect, useRef, useState } from 'react';

type PlotlyModule = typeof import('plotly.js-dist-min');
let plotlyPromise: Promise<PlotlyModule> | null = null;
/** Plotly is large, so it is loaded on first use. */
const loadPlotly = () => (plotlyPromise ??= import('plotly.js-dist-min').then((m) => (m.default ?? m) as PlotlyModule));

const BASE_LAYOUT: Partial<Layout> = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: 'Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif', size: 11, color: '#b4b7bc' },
  margin: { l: 56, r: 12, t: 8, b: 40 },
  hoverlabel: { bgcolor: '#1e2023', bordercolor: '#3a3d42', font: { color: '#eceded', size: 11 } },
  legend: { orientation: 'h', x: 0, y: 1.02, yanchor: 'bottom', font: { size: 11 }, bgcolor: 'rgba(0,0,0,0)' },
};

export const AXIS = {
  gridcolor: '#25272b',
  zerolinecolor: '#3a3d42',
  linecolor: '#3a3d42',
  tickcolor: '#3a3d42',
  ticks: 'outside' as const,
  ticklen: 3,
  tickfont: { family: 'ui-monospace, Cascadia Mono, Consolas, monospace', size: 10.5 },
  title: { font: { size: 11, color: '#8a8e95' } },
};

const CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
  toImageButtonOptions: { format: 'png', scale: 2 },
};

interface Props {
  data: Data[];
  layout: Partial<Layout>;
  height: number;
  ariaLabel: string;
}

/** Thin wrapper around Plotly.react with the workbench's dark theme. */
export function PlotlyChart({ data, layout, height, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    loadPlotly()
      .then((Plotly) => {
        if (cancelled || !ref.current) return;
        const merged: Partial<Layout> = {
          ...BASE_LAYOUT,
          ...layout,
          height,
          xaxis: { ...AXIS, ...layout.xaxis, title: { ...AXIS.title, ...(layout.xaxis?.title as object) } },
          yaxis: { ...AXIS, ...layout.yaxis, title: { ...AXIS.title, ...(layout.yaxis?.title as object) } },
        };
        return Plotly.react(ref.current, data, merged, CONFIG).then(() => !cancelled && setState('ready'));
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [data, layout, height]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el && plotlyPromise) void plotlyPromise.then((Plotly) => Plotly.purge(el));
    };
  }, []);

  return (
    <div className="relative" style={{ height }} role="img" aria-label={ariaLabel}>
      <div ref={ref} className="h-full w-full" />
      {state !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-ink-500">
          {state === 'loading' ? 'Rendering chart…' : 'Chart could not be rendered.'}
        </div>
      )}
    </div>
  );
}
