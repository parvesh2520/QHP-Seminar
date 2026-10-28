import type { Network } from '../types/network';
import type { ComparisonSummary, PopulationDelta, SimulationResult } from '../types/simulation';
import { calculatePopulationMetrics, percentChange } from './metrics';

function describe(label: string, baseline: number, intervention: number): string {
  const delta = intervention - baseline;
  if (delta === 0) return `${label}: unchanged (${baseline} spikes).`;
  const pct = percentChange(baseline, intervention);
  const pctText = pct === null ? 'from zero' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  return `${label} ${delta > 0 ? 'increased' : 'decreased'} from ${baseline} to ${intervention} spikes (${delta > 0 ? '+' : ''}${delta}, ${pctText}).`;
}

/**
 * Compare a baseline run with an intervention run of the same network,
 * seed and time step. All quantities are raw spike counts over the full run.
 */
export function compareResults(
  baseline: SimulationResult,
  intervention: SimulationResult,
  network: Network,
  outputPopulationId: string,
): ComparisonSummary {
  if (baseline.spikeCounts.length !== intervention.spikeCounts.length) {
    throw new Error('Results come from networks of different size');
  }
  const b = calculatePopulationMetrics(baseline, network);
  const v = calculatePopulationMetrics(intervention, network);

  const populations: PopulationDelta[] = network.populations.map((p) => ({
    populationId: p.id,
    label: p.label,
    baseline: b.populationSpikes[p.id],
    intervention: v.populationSpikes[p.id],
    delta: v.populationSpikes[p.id] - b.populationSpikes[p.id],
    percentChange: percentChange(b.populationSpikes[p.id], v.populationSpikes[p.id]),
  }));
  const output = populations.find((p) => p.populationId === outputPopulationId);
  if (!output) throw new Error(`Unknown output population ${outputPopulationId}`);

  const neuronDeltas = network.neurons
    .map((n, i) => ({
      neuronId: n.id,
      baseline: baseline.spikeCounts[i],
      intervention: intervention.spikeCounts[i],
      delta: intervention.spikeCounts[i] - baseline.spikeCounts[i],
    }))
    .filter((d) => d.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.neuronId.localeCompare(y.neuronId));

  const statements = [
    describe('Total network activity', b.totalSpikes, v.totalSpikes),
    describe(`Output population (${output.label})`, output.baseline, output.intervention),
  ];
  const activeDelta = v.activeNeurons - b.activeNeurons;
  statements.push(
    activeDelta === 0
      ? `Number of active neurons unchanged (${b.activeNeurons}).`
      : `Number of active neurons ${activeDelta > 0 ? 'increased' : 'decreased'} from ${b.activeNeurons} to ${v.activeNeurons}.`,
  );
  const up = neuronDeltas.filter((d) => d.delta > 0).length;
  const down = neuronDeltas.filter((d) => d.delta < 0).length;
  statements.push(`${up} neuron(s) fired more and ${down} fired less than in the baseline run.`);

  return {
    baseline: b,
    intervention: v,
    totalSpikes: {
      baseline: b.totalSpikes,
      intervention: v.totalSpikes,
      delta: v.totalSpikes - b.totalSpikes,
      percentChange: percentChange(b.totalSpikes, v.totalSpikes),
    },
    activeNeurons: { baseline: b.activeNeurons, intervention: v.activeNeurons, delta: activeDelta },
    output,
    populations,
    neuronDeltas,
    statements,
  };
}
