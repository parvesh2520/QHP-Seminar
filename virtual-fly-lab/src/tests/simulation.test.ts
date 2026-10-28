import { describe, expect, it } from 'vitest';
import { buildNetwork } from '../data/networkLoader';
import { generateSampleNetworkDefinition, sampleNetwork as net } from '../data/sampleNetwork';
import { DEFAULT_LIF_PARAMS, DEFAULT_SYNAPSE_PARAMS } from '../simulation/lifModel';
import { createBaselineConfig, runSimulation } from '../simulation/runSimulation';
import type { NetworkDefinition } from '../types/network';
import type { SimulationConfig } from '../types/simulation';

const baseConfig: SimulationConfig = { durationMs: 500, dt: 0.1, seed: 7, stimulus: null, recordVoltage: true };

function singleNeuron(): ReturnType<typeof buildNetwork> {
  const def: NetworkDefinition = {
    metadata: { name: 'single', source: 'synthetic', description: '', version: 'test' },
    classes: [{ id: 'X', label: 'X', description: '', transmitter: 'excitatory', color: '#fff' }],
    neurons: [
      { id: 'a', label: 'a', classId: 'X', hemisphere: 'L', position: [0, 0, 0], params: { ...DEFAULT_LIF_PARAMS }, backgroundRateHz: 0 },
    ],
    connections: [],
    populations: [{ id: 'p', label: 'p', description: '', role: 'output', neuronIds: ['a'] }],
    synapse: { ...DEFAULT_SYNAPSE_PARAMS },
  };
  return buildNetwork(def);
}

describe('sample network', () => {
  it('is generated deterministically with stable ids', () => {
    const again = generateSampleNetworkDefinition();
    expect(again.neurons.map((n) => [n.id, n.position])).toEqual(net.neurons.map((n) => [n.id, n.position]));
    expect(again.connections).toEqual(net.connections);
    expect(net.neurons.length).toBeGreaterThanOrEqual(80);
    expect(net.neurons.length).toBeLessThanOrEqual(150);
  });

  it('contains excitatory and inhibitory connections', () => {
    const types = new Set(net.connections.map((c) => c.type));
    expect(types).toEqual(new Set(['excitatory', 'inhibitory']));
  });

  it('rejects invalid definitions', () => {
    const def = generateSampleNetworkDefinition();
    expect(() => buildNetwork({ ...def, connections: [...def.connections, { pre: 'nope', post: def.neurons[0].id, weight: 1, type: 'excitatory' }] })).toThrow(/unknown neuron/);
    expect(() => buildNetwork({ ...def, neurons: [...def.neurons, def.neurons[0]] })).toThrow(/Duplicate neuron/);
  });
});

describe('runSimulation', () => {
  it('is reproducible for identical config', () => {
    const a = runSimulation(baseConfig, net);
    const b = runSimulation(baseConfig, net);
    expect(Array.from(a.spikeTimes)).toEqual(Array.from(b.spikeTimes));
    expect(Array.from(a.spikeNeurons)).toEqual(Array.from(b.spikeNeurons));
    expect(a.voltage).toEqual(b.voltage);
  });

  it('produces different activity for a different seed', () => {
    const a = runSimulation(baseConfig, net);
    const b = runSimulation({ ...baseConfig, seed: 8 }, net);
    expect(Array.from(a.spikeTimes)).not.toEqual(Array.from(b.spikeTimes));
  });

  it('has ongoing baseline activity and consistent spike bookkeeping', () => {
    const r = runSimulation(baseConfig, net);
    expect(r.spikeTimes.length).toBeGreaterThan(0);
    const counted = Array.from(r.spikeCounts).reduce((s, x) => s + x, 0);
    expect(counted).toBe(r.spikeTimes.length);
    for (let k = 1; k < r.spikeTimes.length; k++) expect(r.spikeTimes[k]).toBeGreaterThanOrEqual(r.spikeTimes[k - 1]);
    expect(r.spikeTimes[r.spikeTimes.length - 1]).toBeLessThan(baseConfig.durationMs);
  });

  it('respects refractory periods', () => {
    const r = runSimulation(baseConfig, net);
    const last = new Map<number, number>();
    for (let k = 0; k < r.spikeTimes.length; k++) {
      const i = r.spikeNeurons[k];
      const prev = last.get(i);
      if (prev !== undefined) {
        expect(r.spikeTimes[k] - prev).toBeGreaterThan(net.neurons[i].params.refractoryMs - 1e-9);
      }
      last.set(i, r.spikeTimes[k]);
    }
  });

  it('keeps membrane potential below threshold in recorded samples', () => {
    const r = runSimulation(baseConfig, net);
    const th = Math.max(...net.neurons.map((n) => n.params.vThreshold));
    expect(r.voltage!.reduce((m, v) => Math.max(m, v), -Infinity)).toBeLessThan(th);
  });

  it('matches the analytical LIF firing period for a constant current', () => {
    const single = singleNeuron();
    const intensity = 30;
    const r = runSimulation(
      { durationMs: 1000, dt: 0.05, seed: 1, recordVoltage: false, stimulus: { neuronId: 'a', mode: 'excite', startMs: 0, durationMs: 1000, intensity } },
      single,
    );
    const p = DEFAULT_LIF_PARAMS;
    const period = p.tauM * Math.log((intensity + p.vRest - p.vReset) / (intensity + p.vRest - p.vThreshold)) + p.refractoryMs;
    const isis = Array.from(r.spikeTimes).slice(1).map((t, k) => t - r.spikeTimes[k]);
    const meanIsi = isis.reduce((s, x) => s + x, 0) / isis.length;
    expect(meanIsi).toBeGreaterThan(period * 0.97);
    expect(meanIsi).toBeLessThan(period * 1.03);
  });

  it('does not fire a lone neuron below rheobase', () => {
    const single = singleNeuron();
    const r = runSimulation(
      { durationMs: 500, dt: 0.1, seed: 1, recordVoltage: false, stimulus: { neuronId: 'a', mode: 'excite', startMs: 0, durationMs: 500, intensity: 10 } },
      single,
    );
    expect(r.spikeTimes.length).toBe(0);
  });

  it('only applies the stimulus inside its window', () => {
    const single = singleNeuron();
    const r = runSimulation(
      { durationMs: 500, dt: 0.1, seed: 1, recordVoltage: false, stimulus: { neuronId: 'a', mode: 'excite', startMs: 100, durationMs: 200, intensity: 40 } },
      single,
    );
    expect(r.spikeTimes.length).toBeGreaterThan(0);
    expect(r.spikeTimes[0]).toBeGreaterThanOrEqual(100);
    expect(r.spikeTimes[r.spikeTimes.length - 1]).toBeLessThan(300);
  });

  it('excitation increases and suppression decreases target firing', () => {
    const target = net.neurons.find((n) => n.classId === 'PN')!;
    const ti = net.indexById.get(target.id)!;
    const stim = { neuronId: target.id, startMs: 100, durationMs: 300, intensity: 30 };
    const baseline = runSimulation(baseConfig, net);
    const excited = runSimulation({ ...baseConfig, stimulus: { ...stim, mode: 'excite' } }, net);
    const suppressed = runSimulation({ ...baseConfig, stimulus: { ...stim, mode: 'suppress' } }, net);
    expect(excited.spikeCounts[ti]).toBeGreaterThan(baseline.spikeCounts[ti]);
    expect(suppressed.spikeCounts[ti]).toBeLessThan(baseline.spikeCounts[ti]);
  });

  it('baseline config removes only the stimulus', () => {
    const cfg: SimulationConfig = { ...baseConfig, stimulus: { neuronId: net.neurons[0].id, mode: 'excite', startMs: 0, durationMs: 10, intensity: 5 } };
    expect(createBaselineConfig(cfg)).toEqual({ ...cfg, stimulus: null });
  });

  it('activity before the stimulus is identical to baseline', () => {
    const stim = { neuronId: net.neurons[5].id, mode: 'excite' as const, startMs: 200, durationMs: 100, intensity: 40 };
    const baseline = runSimulation(baseConfig, net);
    const intervention = runSimulation({ ...baseConfig, stimulus: stim }, net);
    const before = (r: typeof baseline) => Array.from(r.spikeTimes).filter((t) => t < stim.startMs);
    expect(before(intervention)).toEqual(before(baseline));
  });

  it('rejects invalid or excessively expensive configs', () => {
    expect(() => runSimulation({ ...baseConfig, durationMs: 0 }, net)).toThrow();
    expect(() => runSimulation({ ...baseConfig, dt: 0.3 as never }, net)).toThrow(/time step/);
    expect(() => runSimulation({ ...baseConfig, durationMs: 3000, dt: 0.05 }, net)).not.toThrow();
    expect(() => runSimulation({ ...baseConfig, durationMs: 5000 }, net)).toThrow();
    expect(() => runSimulation({ ...baseConfig, stimulus: { neuronId: 'missing', mode: 'excite', startMs: 0, durationMs: 1, intensity: 1 } }, net)).toThrow(/Unknown/);
  });
});
