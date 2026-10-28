import type { Network } from '../types/network';
import type { SimulationConfig, SimulationResult } from '../types/simulation';
import { TIME_STEP_OPTIONS } from '../types/simulation';
import { createRng } from '../utils/random';

/** Upper bound on integration steps per run (protects the UI from runaway cost). */
export const MAX_STEPS = 60_000;
export const MAX_DURATION_MS = 3000;
/** Maximum number of voltage samples stored per neuron. */
const MAX_VOLTAGE_SAMPLES = 2000;

/** Throws if the engine config is invalid or too expensive. */
export function assertValidSimulationConfig(config: SimulationConfig, network: Network): void {
  if (!TIME_STEP_OPTIONS.includes(config.dt)) throw new Error(`Unsupported time step ${config.dt} ms`);
  if (!(config.durationMs > 0) || config.durationMs > MAX_DURATION_MS) {
    throw new Error(`Duration must be in (0, ${MAX_DURATION_MS}] ms`);
  }
  if (Math.round(config.durationMs / config.dt) > MAX_STEPS) {
    throw new Error(`Run exceeds ${MAX_STEPS} integration steps; increase dt or shorten the run`);
  }
  if (!Number.isInteger(config.seed)) throw new Error('Seed must be an integer');
  const s = config.stimulus;
  if (s) {
    if (!network.indexById.has(s.neuronId)) throw new Error(`Unknown stimulus target ${s.neuronId}`);
    if (!(s.intensity >= 0) || !Number.isFinite(s.intensity)) throw new Error('Intensity must be >= 0');
    if (s.startMs < 0 || s.durationMs <= 0) throw new Error('Invalid stimulus window');
  }
}

/**
 * Simulate the network as a current-based LIF network (see lifModel.ts for the equations).
 *
 * Determinism: the PRNG is consumed in a fixed order (initial potentials, then
 * one draw per neuron per step for background input) independent of network
 * state, so baseline and intervention runs with the same seed and dt receive
 * identical background input and differ only through the intervention.
 */
export function runSimulation(config: SimulationConfig, network: Network): SimulationResult {
  assertValidSimulationConfig(config, network);
  const wallStart = performance.now();

  const N = network.neurons.length;
  const dt = config.dt;
  const steps = Math.round(config.durationMs / dt);
  const syn = network.synapse;
  const decayExc = Math.exp(-dt / syn.tauSynExcMs);
  const decayInh = Math.exp(-dt / syn.tauSynInhMs);
  const delaySteps = Math.max(1, Math.round(syn.delayMs / dt));
  const ringSize = delaySteps + 1;

  // Per-neuron parameters as typed arrays for a tight inner loop.
  const vRest = new Float64Array(N);
  const vTh = new Float64Array(N);
  const vReset = new Float64Array(N);
  const dtOverTau = new Float64Array(N);
  const refSteps = new Int32Array(N);
  const bgProb = new Float64Array(N);
  network.neurons.forEach((n, i) => {
    vRest[i] = n.params.vRest;
    vTh[i] = n.params.vThreshold;
    vReset[i] = n.params.vReset;
    dtOverTau[i] = dt / n.params.tauM;
    refSteps[i] = Math.round(n.params.refractoryMs / dt);
    bgProb[i] = Math.min(1, (n.backgroundRateHz * dt) / 1000);
  });

  // Outgoing synapses in CSR layout.
  const outOffset = new Int32Array(N + 1);
  network.outgoing.forEach((list, i) => (outOffset[i + 1] = outOffset[i] + list.length));
  const outTarget = new Int32Array(outOffset[N]);
  const outWeight = new Float64Array(outOffset[N]);
  const outInhibitory = new Uint8Array(outOffset[N]);
  network.outgoing.forEach((list, i) => {
    list.forEach((ci, k) => {
      const c = network.connections[ci];
      const j = outOffset[i] + k;
      outTarget[j] = network.indexById.get(c.post)!;
      outWeight[j] = c.weight;
      outInhibitory[j] = c.type === 'inhibitory' ? 1 : 0;
    });
  });

  // Stimulus.
  const stim = config.stimulus;
  const stimIndex = stim ? network.indexById.get(stim.neuronId)! : -1;
  const stimStart = stim ? Math.round(stim.startMs / dt) : 0;
  const stimEnd = stim ? Math.round((stim.startMs + stim.durationMs) / dt) : 0;
  const stimCurrent = stim ? (stim.mode === 'excite' ? stim.intensity : -stim.intensity) : 0;

  // State.
  const rng = createRng(config.seed);
  const V = new Float64Array(N);
  for (let i = 0; i < N; i++) V[i] = vReset[i] + rng() * (vTh[i] - vReset[i]) * 0.8;
  const Iexc = new Float64Array(N);
  const Iinh = new Float64Array(N);
  const refUntil = new Int32Array(N);
  const excBuf = new Float64Array(ringSize * N);
  const inhBuf = new Float64Array(ringSize * N);
  const bgWeight = syn.backgroundWeight;

  // Recording.
  const recordEvery = Math.max(1, Math.ceil(steps / MAX_VOLTAGE_SAMPLES));
  const sampleCount = Math.ceil(steps / recordEvery);
  const voltage = config.recordVoltage ? new Float32Array(N * sampleCount) : null;
  const spikeTimes: number[] = [];
  const spikeNeurons: number[] = [];
  const spikeCounts = new Int32Array(N);

  for (let t = 0; t < steps; t++) {
    const slot = (t % ringSize) * N;
    const deliverSlot = ((t + delaySteps) % ringSize) * N;
    const stimOn = t >= stimStart && t < stimEnd;
    const record = voltage !== null && t % recordEvery === 0;
    const sample = t / recordEvery;

    for (let i = 0; i < N; i++) {
      // Background input: always draw, so the random stream is state-independent.
      const bg = rng() < bgProb[i] ? bgWeight : 0;
      Iexc[i] = Iexc[i] * decayExc + excBuf[slot + i] + bg;
      Iinh[i] = Iinh[i] * decayInh + inhBuf[slot + i];
      excBuf[slot + i] = 0;
      inhBuf[slot + i] = 0;

      if (t < refUntil[i]) {
        V[i] = vReset[i];
      } else {
        const iext = stimOn && i === stimIndex ? stimCurrent : 0;
        V[i] += dtOverTau[i] * (vRest[i] - V[i] + Iexc[i] - Iinh[i] + iext);
        if (V[i] >= vTh[i]) {
          spikeTimes.push(t * dt);
          spikeNeurons.push(i);
          spikeCounts[i]++;
          V[i] = vReset[i];
          refUntil[i] = t + 1 + refSteps[i];
          for (let j = outOffset[i]; j < outOffset[i + 1]; j++) {
            if (outInhibitory[j]) inhBuf[deliverSlot + outTarget[j]] += outWeight[j];
            else excBuf[deliverSlot + outTarget[j]] += outWeight[j];
          }
        }
      }
      if (record) voltage![i * sampleCount + sample] = V[i];
    }
  }

  return {
    config,
    neuronIds: network.neurons.map((n) => n.id),
    spikeTimes: Float64Array.from(spikeTimes),
    spikeNeurons: Int32Array.from(spikeNeurons),
    spikeCounts,
    voltage,
    sampleCount,
    sampleIntervalMs: recordEvery * dt,
    wallTimeMs: performance.now() - wallStart,
  };
}

/** Same run without the intervention: the matched control for an experiment. */
export function createBaselineConfig(config: SimulationConfig): SimulationConfig {
  return { ...config, stimulus: null };
}
