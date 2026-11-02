import { create } from 'zustand';
import { flywireNetwork } from '../data/flywireNetwork';
import { validateExperimentConfig } from '../simulation/experiment';
import { runExperimentAsync } from '../simulation/worker/simulationClient';
import type { Network } from '../types/network';
import type { ExperimentConfig, ExperimentRecord, InterventionMode } from '../types/simulation';

export type ViewToggle = 'showEdges' | 'showLabels' | 'showActivity';

const network = flywireNetwork;
const firstOf = (classId: string) => network.neurons.find((n) => n.classId === classId)?.id ?? network.neurons[0].id;
const DEFAULT_TARGET = firstOf('PN');

export function defaultConfig(targetNeuronId: string = DEFAULT_TARGET, net: Network = network): ExperimentConfig {
  return {
    targetNeuronId,
    mode: 'excite',
    stimStartMs: 200,
    stimDurationMs: 300,
    intensity: 30,
    durationMs: 800,
    dt: 0.1,
    outputPopulationId: net.populations.find((p) => p.role === 'output')?.id ?? net.populations[0].id,
    seed: 1,
  };
}

interface LabState {
  network: Network;
  selectedNeuronId: string | null;
  focusRequest: number;
  cameraResetRequest: number;
  view: Record<ViewToggle, boolean>;
  config: ExperimentConfig;
  /** The latest experiment; only one is kept so the screen stays simple. */
  experiment: ExperimentRecord | null;

  /** Select a neuron in the map; it also becomes the experiment target. */
  selectNeuron: (id: string | null) => void;
  /** Target the first neuron of a cell group and fly the camera to it. */
  pickGroup: (classId: string) => void;
  setMode: (mode: InterventionMode) => void;
  resetCamera: () => void;
  runExperiment: () => Promise<void>;
}

export const useLabStore = create<LabState>((set, get) => ({
  network,
  selectedNeuronId: DEFAULT_TARGET,
  focusRequest: 0,
  cameraResetRequest: 0,
  view: { showEdges: true, showLabels: true, showActivity: true },
  config: defaultConfig(),
  experiment: null,

  selectNeuron: (id) =>
    set((s) => {
      if (!id || !s.network.indexById.has(id)) return { selectedNeuronId: null };
      return { selectedNeuronId: id, config: { ...s.config, targetNeuronId: id } };
    }),
  pickGroup: (classId) => {
    get().selectNeuron(firstOf(classId));
    set((s) => ({ focusRequest: s.focusRequest + 1 }));
  },
  setMode: (mode) => set((s) => ({ config: { ...s.config, mode } })),
  resetCamera: () => set((s) => ({ cameraResetRequest: s.cameraResetRequest + 1 })),

  runExperiment: async () => {
    const { config, network: net, experiment } = get();
    if (experiment?.status === 'running' || Object.keys(validateExperimentConfig(config, net)).length > 0) return;
    const record: ExperimentRecord = { id: 'EXP', createdAt: Date.now(), config: { ...config }, status: 'running' };
    set({ experiment: record });
    // Ignore the result if a newer run replaced this one meanwhile.
    const finish = (p: Partial<ExperimentRecord>) => set((s) => (s.experiment === record ? { experiment: { ...record, ...p } } : {}));
    try {
      finish({ status: 'complete', ...(await runExperimentAsync(record.config, net)) });
    } catch (err) {
      finish({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
