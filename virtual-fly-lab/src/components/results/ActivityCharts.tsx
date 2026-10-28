import type { Data, Layout, Shape } from 'plotly.js';
import { useMemo } from 'react';
import { calculatePopulationMetrics, neuronSpikeTimes, voltageTrace } from '../../simulation/metrics';
import type { Network } from '../../types/network';
import type { ComparisonSummary, SimulationResult } from '../../types/simulation';
import { PlotlyChart } from '../common/PlotlyChart';
import { CONDITION_COLORS, stimAnnotation, stimShape } from './plotHelpers';

export interface Series {
  name: string;
  color: string;
  result: SimulationResult;
}

const BIN_MS = 10;

/** Spikes per time bin for each series, optionally restricted to one population. */
export function PopulationActivityChart({
  series,
  network,
  populationId,
  height = 240,
}: {
  series: Series[];
  network: Network;
  populationId: string | null;
  height?: number;
}) {
  const { data, layout } = useMemo(() => {
    const pop = populationId ? network.populations.find((p) => p.id === populationId) : null;
    const filter = pop ? new Set(pop.neuronIds.map((id) => network.indexById.get(id)!)) : undefined;
    const data: Data[] = series.map((s, k) => {
      const m = calculatePopulationMetrics(s.result, network, BIN_MS, filter);
      return {
        type: 'scatter',
        mode: 'lines',
        name: s.name,
        x: m.binStarts.map((t) => t + BIN_MS / 2),
        y: m.binnedCounts,
        line: { color: s.color, width: k === 0 && series.length > 1 ? 1.5 : 2, shape: 'hvh' },
        hovertemplate: `${s.name}<br>%{x:.0f} ms: %{y} spikes<extra></extra>`,
      };
    });
    const stim = series.find((s) => s.result.config.stimulus)?.result.config.stimulus;
    const layout: Partial<Layout> = {
      hovermode: 'x unified',
      xaxis: { title: { text: 'Time (ms)' }, range: [0, series[0].result.config.durationMs] },
      yaxis: { title: { text: `Spikes per ${BIN_MS} ms bin` }, rangemode: 'tozero' },
      shapes: stim ? [stimShape(stim.startMs, stim.startMs + stim.durationMs)] : [],
      annotations: stim ? stimAnnotation(stim.startMs, stim.startMs + stim.durationMs) : [],
      margin: { l: 56, r: 12, t: 30, b: 40 },
      legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.02, yanchor: 'bottom' },
    };
    return { data, layout };
  }, [series, network, populationId]);

  return <PlotlyChart data={data} layout={layout} height={height} ariaLabel="Population activity over time" />;
}

/** Membrane potential of one neuron in each series, with threshold and spike times. */
export function MembraneChart({ series, network, neuronId, height = 240 }: { series: Series[]; network: Network; neuronId: string; height?: number }) {
  const { data, layout, available } = useMemo(() => {
    const i = network.indexById.get(neuronId)!;
    const n = network.neurons[i];
    const data: Data[] = [];
    let available = true;
    const spikeY = n.params.vThreshold + 4;
    series.forEach((s, k) => {
      const trace = voltageTrace(s.result, i);
      if (!trace) {
        available = false;
        return;
      }
      data.push({
        type: 'scattergl',
        mode: 'lines',
        name: `${s.name} V`,
        x: trace.t,
        y: trace.v,
        line: { color: s.color, width: k === 0 && series.length > 1 ? 1 : 1.4 },
        opacity: k === 0 && series.length > 1 ? 0.8 : 1,
        hovertemplate: `${s.name}<br>%{x:.1f} ms: %{y:.1f} mV<extra></extra>`,
      });
      const spikes = neuronSpikeTimes(s.result, i);
      data.push({
        type: 'scatter',
        mode: 'markers',
        name: `${s.name} spikes (${spikes.length})`,
        x: spikes,
        y: spikes.map(() => spikeY + k * 2.5),
        marker: { symbol: 'line-ns-open', size: 8, color: s.color, line: { width: 1.5, color: s.color } },
        hovertemplate: `${s.name} spike at %{x:.1f} ms<extra></extra>`,
      });
    });
    const stim = series.find((s) => s.result.config.stimulus)?.result.config.stimulus;
    const shapes: Partial<Shape>[] = [
      { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: n.params.vThreshold, y1: n.params.vThreshold, line: { color: '#b4b7bc', width: 1, dash: 'dash' } },
    ];
    if (stim) shapes.push(stimShape(stim.startMs, stim.startMs + stim.durationMs));
    const layout: Partial<Layout> = {
      xaxis: { title: { text: 'Time (ms)' }, range: [0, series[0].result.config.durationMs] },
      yaxis: { title: { text: 'Membrane potential (mV)' }, range: [Math.min(n.params.vReset, n.params.vRest) - 6, spikeY + 2.5 * series.length + 1] },
      shapes,
      annotations: [
        { xref: 'paper', x: 1, xanchor: 'right', y: n.params.vThreshold, yanchor: 'bottom', text: `threshold ${n.params.vThreshold} mV`, showarrow: false, font: { size: 10, color: '#8a8e95' } },
      ],
      margin: { l: 56, r: 12, t: 30, b: 40 },
      legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.02, yanchor: 'bottom' },
    };
    return { data, layout, available };
  }, [series, network, neuronId]);

  if (!available) return <p className="py-6 text-center text-[12px] text-ink-500">Membrane potential was not recorded for this run.</p>;
  return <PlotlyChart data={data} layout={layout} height={height} ariaLabel={`Membrane potential of ${neuronId}`} />;
}

/** Grouped bars: spikes per population, baseline vs intervention. */
export function PopulationBarChart({ summary, height = 240 }: { summary: ComparisonSummary; height?: number }) {
  const { data, layout } = useMemo(() => {
    const labels = summary.populations.map((p) => p.label);
    const data: Data[] = [
      {
        type: 'bar',
        orientation: 'h',
        name: 'Baseline',
        y: labels,
        x: summary.populations.map((p) => p.baseline),
        marker: { color: CONDITION_COLORS.baseline },
        hovertemplate: 'Baseline · %{y}: %{x} spikes<extra></extra>',
      },
      {
        type: 'bar',
        orientation: 'h',
        name: 'Intervention',
        y: labels,
        x: summary.populations.map((p) => p.intervention),
        marker: { color: CONDITION_COLORS.intervention },
        customdata: summary.populations.map((p) => p.delta),
        hovertemplate: 'Intervention · %{y}: %{x} spikes (Δ %{customdata:+d})<extra></extra>',
      },
    ];
    const layout: Partial<Layout> = {
      barmode: 'group',
      bargap: 0.3,
      bargroupgap: 0.08,
      xaxis: { title: { text: 'Spike count (whole run)' }, rangemode: 'tozero' },
      yaxis: { autorange: 'reversed', automargin: true, ticks: '' },
      margin: { l: 150, r: 12, t: 26, b: 40 },
      legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.02, yanchor: 'bottom' },
    };
    return { data, layout };
  }, [summary]);
  return <PlotlyChart data={data} layout={layout} height={height} ariaLabel="Spike count per population" />;
}
