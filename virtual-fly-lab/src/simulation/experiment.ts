import type { Network } from '../types/network';
import type { ComparisonSummary, ExperimentConfig, SimulationConfig, SimulationResult } from '../types/simulation';
import { TIME_STEP_OPTIONS } from '../types/simulation';
import { compareResults } from './comparison';
import { MAX_DURATION_MS, MAX_STEPS, createBaselineConfig, runSimulation } from './runSimulation';

export const PARAM_LIMITS = {
  durationMs: { min: 100, max: MAX_DURATION_MS },
  intensity: { min: 0, max: 80 },
  stimDurationMs: { min: 1 },
  seed: { min: 0, max: 2 ** 31 - 1 },
} as const;

export type ConfigErrors = Partial<Record<keyof ExperimentConfig, string>>;

/** Field-level validation of a user experiment configuration. Empty object = valid. */
export function validateExperimentConfig(c: ExperimentConfig, network: Network): ConfigErrors {
  const e: ConfigErrors = {};
  const num = (v: number) => typeof v === 'number' && Number.isFinite(v);

  if (!network.indexById.has(c.targetNeuronId)) e.targetNeuronId = 'Select a target neuron.';
  if (!network.populations.some((p) => p.id === c.outputPopulationId)) e.outputPopulationId = 'Select an output population.';
  if (!TIME_STEP_OPTIONS.includes(c.dt)) e.dt = 'Choose one of the listed time steps.';

  if (!num(c.durationMs) || c.durationMs < PARAM_LIMITS.durationMs.min || c.durationMs > PARAM_LIMITS.durationMs.max) {
    e.durationMs = `Must be ${PARAM_LIMITS.durationMs.min}–${PARAM_LIMITS.durationMs.max} ms.`;
  } else if (!e.dt && Math.round(c.durationMs / c.dt) > MAX_STEPS) {
    e.durationMs = `Too many steps (${Math.round(c.durationMs / c.dt).toLocaleString()} > ${MAX_STEPS.toLocaleString()}). Use a larger time step.`;
  }

  if (!num(c.stimStartMs) || c.stimStartMs < 0) e.stimStartMs = 'Must be ≥ 0 ms.';
  else if (num(c.durationMs) && c.stimStartMs >= c.durationMs) e.stimStartMs = 'Must start before the end of the simulation.';

  if (!num(c.stimDurationMs) || c.stimDurationMs < PARAM_LIMITS.stimDurationMs.min) {
    e.stimDurationMs = `Must be ≥ ${PARAM_LIMITS.stimDurationMs.min} ms.`;
  } else if (!e.stimStartMs && num(c.durationMs) && c.stimStartMs + c.stimDurationMs > c.durationMs) {
    e.stimDurationMs = `Window ends at ${c.stimStartMs + c.stimDurationMs} ms, after the simulation ends (${c.durationMs} ms).`;
  }

  if (!num(c.intensity) || c.intensity < PARAM_LIMITS.intensity.min || c.intensity > PARAM_LIMITS.intensity.max) {
    e.intensity = `Must be ${PARAM_LIMITS.intensity.min}–${PARAM_LIMITS.intensity.max} mV.`;
  }
  if (!Number.isInteger(c.seed) || c.seed < PARAM_LIMITS.seed.min || c.seed > PARAM_LIMITS.seed.max) {
    e.seed = 'Must be a non-negative integer.';
  }
  return e;
}

export function toSimulationConfig(c: ExperimentConfig, recordVoltage = true): SimulationConfig {
  return {
    durationMs: c.durationMs,
    dt: c.dt,
    seed: c.seed,
    recordVoltage,
    stimulus: {
      neuronId: c.targetNeuronId,
      mode: c.mode,
      startMs: c.stimStartMs,
      durationMs: c.stimDurationMs,
      intensity: c.intensity,
    },
  };
}

export interface ExperimentOutcome {
  baseline: SimulationResult;
  intervention: SimulationResult;
  summary: ComparisonSummary;
}

/** Run the matched baseline and the intervention, then compare them. */
export function runExperiment(config: ExperimentConfig, network: Network): ExperimentOutcome {
  const errors = validateExperimentConfig(config, network);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);
  const simConfig = toSimulationConfig(config);
  const baseline = runSimulation(createBaselineConfig(simConfig), network);
  const intervention = runSimulation(simConfig, network);
  return { baseline, intervention, summary: compareResults(baseline, intervention, network, config.outputPopulationId) };
}
