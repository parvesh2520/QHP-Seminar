import type { Network } from '../types/network';
import type { PopulationMetrics, SimulationResult } from '../types/simulation';

export const DEFAULT_BIN_MS = 10;

/** Total spikes emitted by the neurons of one population. */
export function populationSpikeCount(result: SimulationResult, network: Network, populationId: string): number {
  const pop = network.populations.find((p) => p.id === populationId);
  if (!pop) throw new Error(`Unknown population ${populationId}`);
  let total = 0;
  for (const id of pop.neuronIds) total += result.spikeCounts[network.indexById.get(id)!];
  return total;
}

/**
 * Network-level activity measures. `neuronFilter` restricts the binned
 * histogram to a subset of neuron indices (e.g. an output population).
 */
export function calculatePopulationMetrics(
  result: SimulationResult,
  network: Network,
  binWidthMs = DEFAULT_BIN_MS,
  neuronFilter?: Set<number>,
): PopulationMetrics {
  const N = result.spikeCounts.length;
  let totalSpikes = 0;
  let activeNeurons = 0;
  for (let i = 0; i < N; i++) {
    totalSpikes += result.spikeCounts[i];
    if (result.spikeCounts[i] > 0) activeNeurons++;
  }

  const populationSpikes: Record<string, number> = {};
  for (const p of network.populations) populationSpikes[p.id] = populationSpikeCount(result, network, p.id);

  const duration = result.config.durationMs;
  const binCount = Math.ceil(duration / binWidthMs);
  const binnedCounts = new Array<number>(binCount).fill(0);
  for (let k = 0; k < result.spikeTimes.length; k++) {
    if (neuronFilter && !neuronFilter.has(result.spikeNeurons[k])) continue;
    const b = Math.min(binCount - 1, Math.floor(result.spikeTimes[k] / binWidthMs));
    binnedCounts[b]++;
  }
  const binStarts = Array.from({ length: binCount }, (_, b) => b * binWidthMs);

  return {
    totalSpikes,
    activeNeurons,
    meanRateHz: N > 0 ? totalSpikes / N / (duration / 1000) : 0,
    populationSpikes,
    binWidthMs,
    binStarts,
    binnedCounts,
  };
}

/** Spike times (ms) of one neuron. */
export function neuronSpikeTimes(result: SimulationResult, neuronIndex: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < result.spikeTimes.length; k++) {
    if (result.spikeNeurons[k] === neuronIndex) out.push(result.spikeTimes[k]);
  }
  return out;
}

/** Downsampled membrane trace of one neuron, or null if voltage was not recorded. */
export function voltageTrace(result: SimulationResult, neuronIndex: number): { t: number[]; v: number[] } | null {
  if (!result.voltage) return null;
  const n = result.sampleCount;
  const t = new Array<number>(n);
  const v = new Array<number>(n);
  for (let k = 0; k < n; k++) {
    t[k] = k * result.sampleIntervalMs;
    v[k] = result.voltage[neuronIndex * n + k];
  }
  return { t, v };
}

export function percentChange(baseline: number, intervention: number): number | null {
  return baseline === 0 ? null : ((intervention - baseline) / baseline) * 100;
}
