import type { Data, Layout, Shape } from 'plotly.js';
import { useMemo } from 'react';
import type { Network } from '../../types/network';
import type { SimulationResult } from '../../types/simulation';
import { classOrderedIndices } from '../../utils/networkLookup';
import { PlotlyChart } from '../common/PlotlyChart';
import { TARGET_COLOR, stimShape } from './plotHelpers';

interface Props {
  result: SimulationResult;
  network: Network;
  targetId: string | null;
  title: string;
  height?: number;
}

/** Spike raster: one row per neuron, grouped by class; the stimulated neuron is drawn in white. */
export function RasterPlot({ result, network, targetId, title, height = 300 }: Props) {
  const { data, layout } = useMemo(() => {
    const order = classOrderedIndices(network);
    const row = new Int32Array(order.length);
    order.forEach((neuronIndex, r) => (row[neuronIndex] = r));
    const targetIndex = targetId ? (network.indexById.get(targetId) ?? -1) : -1;

    const perClass = new Map<string, { x: number[]; y: number[]; text: string[] }>();
    network.classes.forEach((c) => perClass.set(c.id, { x: [], y: [], text: [] }));
    const target = { x: [] as number[], y: [] as number[], text: [] as string[] };
    for (let k = 0; k < result.spikeTimes.length; k++) {
      const i = result.spikeNeurons[k];
      const n = network.neurons[i];
      const bucket = i === targetIndex ? target : perClass.get(n.classId)!;
      bucket.x.push(result.spikeTimes[k]);
      bucket.y.push(row[i]);
      bucket.text.push(`${n.label} · ${n.id}`);
    }

    const traces: Data[] = network.classes.map((c) => {
      const b = perClass.get(c.id)!;
      return {
        type: 'scattergl',
        mode: 'markers',
        name: c.id,
        x: b.x,
        y: b.y,
        text: b.text,
        hovertemplate: '%{text}<br>t = %{x:.1f} ms<extra></extra>',
        marker: { symbol: 'line-ns-open', size: 5, color: c.color, line: { width: 1.4, color: c.color } },
      } as Data;
    });
    if (targetIndex >= 0) {
      traces.push({
        type: 'scattergl',
        mode: 'markers',
        name: 'Target',
        x: target.x,
        y: target.y,
        text: target.text,
        hovertemplate: '%{text} (target)<br>t = %{x:.1f} ms<extra></extra>',
        marker: { symbol: 'line-ns-open', size: 9, color: TARGET_COLOR, line: { width: 2, color: TARGET_COLOR } },
      } as Data);
    }

    // Class blocks: separators and centred tick labels.
    const tickvals: number[] = [];
    const ticktext: string[] = [];
    const shapes: Partial<Shape>[] = [];
    let start = 0;
    for (const c of network.classes) {
      const count = network.neurons.filter((n) => n.classId === c.id).length;
      tickvals.push(start + (count - 1) / 2);
      ticktext.push(c.id);
      if (start > 0) {
        shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: start - 0.5, y1: start - 0.5, line: { color: '#2a2c30', width: 1 } });
      }
      start += count;
    }
    const s = result.config.stimulus;
    if (s) {
      shapes.push(stimShape(s.startMs, s.startMs + s.durationMs));
      if (targetIndex >= 0) {
        shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: row[targetIndex], y1: row[targetIndex], line: { color: 'rgba(255,255,255,0.18)', width: 1, dash: 'dot' }, layer: 'below' });
      }
    }

    const layout: Partial<Layout> = {
      showlegend: true,
      xaxis: { title: { text: 'Time (ms)' }, range: [0, result.config.durationMs], showgrid: false },
      yaxis: {
        title: { text: 'Neuron (grouped by class)' },
        range: [network.neurons.length - 0.5, -0.5],
        tickvals,
        ticktext,
        showgrid: false,
        zeroline: false,
      },
      shapes,
      margin: { l: 64, r: 12, t: 26, b: 40 },
    };
    return { data: traces, layout };
  }, [result, network, targetId]);

  return <PlotlyChart data={data} layout={layout} height={height} ariaLabel={`${title}: spike raster`} />;
}
