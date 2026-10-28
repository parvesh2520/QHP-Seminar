export type InterventionMode = 'excite' | 'suppress';

export const TIME_STEP_OPTIONS = [0.05, 0.1, 0.25, 0.5] as const;
export type TimeStep = (typeof TIME_STEP_OPTIONS)[number];

/** External current applied to one neuron during a time window. */
export interface Stimulus {
  neuronId: string;
  mode: InterventionMode;
  startMs: number;
  durationMs: number;
  /** Magnitude of the external drive (mV). Sign is set by `mode`. */
  intensity: number;
}

/** Engine-level configuration of a single simulation run. */
export interface SimulationConfig {
  durationMs: number;
  dt: TimeStep;
  seed: number;
  stimulus: Stimulus | null;
  /** Record membrane potential of every neuron (downsampled). */
  recordVoltage: boolean;
}

export interface SimulationResult {
  config: SimulationConfig;
  neuronIds: string[];
  /** Spike times in ms, ordered by time. */
  spikeTimes: Float64Array;
  /** Neuron index for each entry of `spikeTimes`. */
  spikeNeurons: Int32Array;
  /** Spike count per neuron index. */
  spikeCounts: Int32Array;
  /** Neuron-major voltage traces: voltage[i * sampleCount + k]; null when not recorded. */
  voltage: Float32Array | null;
  sampleCount: number;
  /** Interval between voltage samples (ms). */
  sampleIntervalMs: number;
  wallTimeMs: number;
}

/** User-facing experiment configuration (form state). */
export interface ExperimentConfig {
  targetNeuronId: string;
  mode: InterventionMode;
  stimStartMs: number;
  stimDurationMs: number;
  intensity: number;
  durationMs: number;
  dt: TimeStep;
  outputPopulationId: string;
  seed: number;
}

export interface PopulationMetrics {
  totalSpikes: number;
  activeNeurons: number;
  meanRateHz: number;
  populationSpikes: Record<string, number>;
  binWidthMs: number;
  binStarts: number[];
  binnedCounts: number[];
}

export interface PopulationDelta {
  populationId: string;
  label: string;
  baseline: number;
  intervention: number;
  delta: number;
  percentChange: number | null;
}

export interface NeuronDelta {
  neuronId: string;
  baseline: number;
  intervention: number;
  delta: number;
}

export interface ComparisonSummary {
  baseline: PopulationMetrics;
  intervention: PopulationMetrics;
  totalSpikes: { baseline: number; intervention: number; delta: number; percentChange: number | null };
  activeNeurons: { baseline: number; intervention: number; delta: number };
  output: PopulationDelta;
  populations: PopulationDelta[];
  /** Neurons whose spike count changed, sorted by |delta| descending. */
  neuronDeltas: NeuronDelta[];
  /** Plain-language statements of what increased / decreased. */
  statements: string[];
}

export type RunStatus = 'running' | 'complete' | 'error';

export interface ExperimentRecord {
  id: string;
  createdAt: number;
  config: ExperimentConfig;
  status: RunStatus;
  error?: string;
  baseline?: SimulationResult;
  intervention?: SimulationResult;
  summary?: ComparisonSummary;
}

export interface CandidateResult {
  neuronId: string;
  baselineOutput: number;
  interventionOutput: number;
  delta: number;
  absDelta: number;
  percentChange: number | null;
  totalDelta: number;
}

export interface ScreeningRequest {
  candidateIds: string[];
  outputPopulationId: string;
  mode: InterventionMode;
  stimStartMs: number;
  stimDurationMs: number;
  intensity: number;
  durationMs: number;
  dt: TimeStep;
  seed: number;
}
