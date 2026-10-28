import { describe, expect, it } from 'vitest';
import { sampleNetwork as net } from '../data/sampleNetwork';
import { compareResults } from '../simulation/comparison';
import { runExperiment, validateExperimentConfig } from '../simulation/experiment';
import { calculatePopulationMetrics, percentChange, populationSpikeCount } from '../simulation/metrics';
import { runSimulation } from '../simulation/runSimulation';
import { screenCandidates } from '../simulation/screening';
import type { ExperimentConfig } from '../types/simulation';

const config: ExperimentConfig = {
  targetNeuronId: net.neurons.find((n) => n.classId === 'CON')!.id,
  mode: 'excite',
  stimStartMs: 100,
  stimDurationMs: 200,
  intensity: 30,
  durationMs: 400,
  dt: 0.1,
  outputPopulationId: 'pop-descending',
  seed: 3,
};

describe('calculatePopulationMetrics', () => {
  const r = runSimulation({ durationMs: 400, dt: 0.1, seed: 3, stimulus: null, recordVoltage: false }, net);
  const m = calculatePopulationMetrics(r, net, 10);

  it('is internally consistent with the raw result', () => {
    expect(m.totalSpikes).toBe(r.spikeTimes.length);
    expect(m.binnedCounts.reduce((s, x) => s + x, 0)).toBe(m.totalSpikes);
    expect(m.binnedCounts.length).toBe(40);
    expect(m.activeNeurons).toBe(Array.from(r.spikeCounts).filter((c) => c > 0).length);
    expect(m.meanRateHz).toBeCloseTo(m.totalSpikes / net.neurons.length / 0.4, 10);
  });

  it('counts population spikes from member neurons', () => {
    for (const p of net.populations) {
      const expected = p.neuronIds.reduce((s, id) => s + r.spikeCounts[net.indexById.get(id)!], 0);
      expect(m.populationSpikes[p.id]).toBe(expected);
      expect(populationSpikeCount(r, net, p.id)).toBe(expected);
    }
  });

  it('restricts the histogram to a neuron filter', () => {
    const filter = new Set(net.populations.find((p) => p.id === 'pop-descending')!.neuronIds.map((id) => net.indexById.get(id)!));
    const f = calculatePopulationMetrics(r, net, 10, filter);
    expect(f.binnedCounts.reduce((s, x) => s + x, 0)).toBe(m.populationSpikes['pop-descending']);
  });
});

describe('compareResults / runExperiment', () => {
  it('reports deltas that match the underlying runs', () => {
    const { baseline, intervention, summary } = runExperiment(config, net);
    expect(summary.totalSpikes.baseline).toBe(baseline.spikeTimes.length);
    expect(summary.totalSpikes.intervention).toBe(intervention.spikeTimes.length);
    expect(summary.totalSpikes.delta).toBe(intervention.spikeTimes.length - baseline.spikeTimes.length);
    expect(summary.output.delta).toBe(
      populationSpikeCount(intervention, net, config.outputPopulationId) - populationSpikeCount(baseline, net, config.outputPopulationId),
    );
    const neuronSum = summary.neuronDeltas.reduce((s, d) => s + d.delta, 0);
    expect(neuronSum).toBe(summary.totalSpikes.delta);
    expect(summary.statements.length).toBeGreaterThan(0);
  });

  it('shows zero difference when comparing a run with itself', () => {
    const r = runSimulation({ durationMs: 200, dt: 0.1, seed: 1, stimulus: null, recordVoltage: false }, net);
    const s = compareResults(r, r, net, 'pop-descending');
    expect(s.totalSpikes.delta).toBe(0);
    expect(s.neuronDeltas).toHaveLength(0);
  });

  it('percentChange handles a zero baseline', () => {
    expect(percentChange(0, 5)).toBeNull();
    expect(percentChange(10, 15)).toBe(50);
  });
});

describe('validateExperimentConfig', () => {
  it('accepts a valid config', () => {
    expect(validateExperimentConfig(config, net)).toEqual({});
  });

  it('flags invalid fields', () => {
    const e = validateExperimentConfig(
      { ...config, targetNeuronId: 'x', stimStartMs: 350, stimDurationMs: 100, intensity: 500, durationMs: 400, seed: -1 },
      net,
    );
    expect(Object.keys(e).sort()).toEqual(['intensity', 'seed', 'stimDurationMs', 'targetNeuronId']);
    expect(validateExperimentConfig({ ...config, durationMs: 3000, dt: 0.05 }, net)).toEqual({});
    expect(validateExperimentConfig({ ...config, durationMs: Number.NaN }, net).durationMs).toBeDefined();
  });
});

describe('screenCandidates', () => {
  it('ranks candidates by absolute change in output spikes', () => {
    const candidateIds = net.neurons.filter((n) => n.classId === 'CON' || n.classId === 'SEN').slice(0, 10).map((n) => n.id);
    let progress = 0;
    const results = screenCandidates(
      { ...config, candidateIds },
      net,
      (done) => (progress = done),
    );
    expect(progress).toBe(candidateIds.length);
    expect(results).toHaveLength(candidateIds.length);
    for (let k = 1; k < results.length; k++) expect(results[k - 1].absDelta).toBeGreaterThanOrEqual(results[k].absDelta);
    // Each screened value matches a full experiment run with the same settings.
    const top = results[0];
    const check = runExperiment({ ...config, targetNeuronId: top.neuronId }, net);
    expect(top.delta).toBe(check.summary.output.delta);
  });
});
