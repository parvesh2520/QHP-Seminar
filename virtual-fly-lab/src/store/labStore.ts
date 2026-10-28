import { create } from 'zustand';
import { flywireNetwork } from '../data/flywireNetwork';
import { sampleNetwork } from '../data/sampleNetwork';
import { validateExperimentConfig } from '../simulation/experiment';
import { runExperimentAsync, screenCandidatesAsync } from '../simulation/worker/simulationClient';
import type { Network } from '../types/network';
import type { CandidateResult, ExperimentConfig, ExperimentRecord, ScreeningRequest } from '../types/simulation';

export type Tab = 'explore' | 'experiments' | 'candidates';
export type ViewToggle = 'showEdges' | 'showLabels' | 'showActivity';
export type DatasetChoice = 'flywire' | 'synthetic';

/** Experiment history is in-memory only; the oldest runs are dropped past this size. */
export const MAX_HISTORY = 30;

export const NETWORKS: Record<DatasetChoice, Network> = {
  flywire: flywireNetwork,
  synthetic: sampleNetwork,
};

export function defaultConfig(targetNeuronId?: string, net: Network = flywireNetwork): ExperimentConfig {
  const target = targetNeuronId && net.indexById.has(targetNeuronId)
    ? targetNeuronId
    : (net.neurons.find((n) => n.classId === 'PN' || n.classId === 'CON')?.id ?? net.neurons[0].id);
  const outPop = net.populations.find((p) => p.role === 'output')?.id ?? net.populations[0].id;
  return {
    targetNeuronId: target,
    mode: 'excite',
    stimStartMs: 200,
    stimDurationMs: 300,
    intensity: 30,
    durationMs: 800,
    dt: 0.1,
    outputPopulationId: outPop,
    seed: 1,
  };
}

export interface ScreeningState {
  status: 'idle' | 'running' | 'complete' | 'error';
  done: number;
  total: number;
  request: ScreeningRequest | null;
  results: CandidateResult[];
  error: string | null;
}

const idleScreening: ScreeningState = { status: 'idle', done: 0, total: 0, request: null, results: [], error: null };

interface LabState {
  activeDataset: DatasetChoice;
  network: Network;
  tab: Tab;
  selectedNeuronId: string | null;
  focusRequest: number;
  cameraResetRequest: number;
  view: Record<ViewToggle, boolean>;
  config: ExperimentConfig;
  experiments: ExperimentRecord[];
  activeExperimentId: string | null;
  compareExperimentId: string | null;
  experimentCounter: number;
  screening: ScreeningState;

  setDataset: (choice: DatasetChoice) => void;
  setTab: (tab: Tab) => void;
  selectNeuron: (id: string | null) => void;
  focusSelected: () => void;
  resetCamera: () => void;
  toggleView: (key: ViewToggle) => void;
  updateConfig: (patch: Partial<ExperimentConfig>) => void;
  resetConfig: () => void;
  runExperiment: (config?: ExperimentConfig) => Promise<void>;
  rerunExperiment: (id: string) => Promise<void>;
  selectExperiment: (id: string | null) => void;
  setCompareExperiment: (id: string | null) => void;
  deleteExperiment: (id: string) => void;
  runScreening: (request: ScreeningRequest) => Promise<void>;
  resetWorkspace: () => void;
}

export const useLabStore = create<LabState>((set, get) => ({
  activeDataset: 'flywire',
  network: flywireNetwork,
  tab: 'explore',
  selectedNeuronId: flywireNetwork.neurons.find((n) => n.classId === 'PN')?.id ?? flywireNetwork.neurons[0].id,
  focusRequest: 0,
  cameraResetRequest: 0,
  view: { showEdges: true, showLabels: true, showActivity: true },
  config: defaultConfig(undefined, flywireNetwork),
  experiments: [],
  activeExperimentId: null,
  compareExperimentId: null,
  experimentCounter: 0,
  screening: idleScreening,

  setDataset: (choice) => {
    const nextNet = NETWORKS[choice];
    const nextTarget = nextNet.neurons.find((n) => n.classId === 'PN' || n.classId === 'CON')?.id ?? nextNet.neurons[0].id;
    set((s) => ({
      activeDataset: choice,
      network: nextNet,
      selectedNeuronId: nextTarget,
      config: defaultConfig(nextTarget, nextNet),
      experiments: [],
      activeExperimentId: null,
      compareExperimentId: null,
      screening: idleScreening,
      cameraResetRequest: s.cameraResetRequest + 1,
    }));
  },

  setTab: (tab) => set({ tab }),
  selectNeuron: (id) => set((s) => ({ selectedNeuronId: id && s.network.indexById.has(id) ? id : null })),
  focusSelected: () => set((s) => ({ focusRequest: s.focusRequest + 1 })),
  resetCamera: () => set((s) => ({ cameraResetRequest: s.cameraResetRequest + 1 })),
  toggleView: (key) => set((s) => ({ view: { ...s.view, [key]: !s.view[key] } })),
  updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  resetConfig: () => set((s) => ({ config: defaultConfig(s.config.targetNeuronId, s.network) })),

  runExperiment: async (configArg) => {
    const net = get().network;
    const config = { ...(configArg ?? get().config) };
    if (Object.keys(validateExperimentConfig(config, net)).length > 0) return;
    const n = get().experimentCounter + 1;
    const id = `EXP-${String(n).padStart(3, '0')}`;
    const record: ExperimentRecord = { id, createdAt: Date.now(), config, status: 'running' };
    set((s) => ({
      experimentCounter: n,
      experiments: [record, ...s.experiments].slice(0, MAX_HISTORY),
      activeExperimentId: id,
      tab: s.tab === 'candidates' ? 'experiments' : s.tab,
    }));
    // Match on the record object so a workspace reset during the run cannot be overwritten.
    const patch = (p: Partial<ExperimentRecord>) =>
      set((s) => ({ experiments: s.experiments.map((e) => (e === record || (e.id === id && e.createdAt === record.createdAt) ? { ...e, ...p } : e)) }));
    try {
      const outcome = await runExperimentAsync(config, net);
      patch({ status: 'complete', ...outcome });
    } catch (err) {
      patch({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  rerunExperiment: async (id) => {
    const record = get().experiments.find((e) => e.id === id);
    if (!record) return;
    set({ config: { ...record.config } });
    await get().runExperiment(record.config);
  },

  selectExperiment: (id) =>
    set((s) => ({
      activeExperimentId: id,
      compareExperimentId: s.compareExperimentId === id ? null : s.compareExperimentId,
    })),
  setCompareExperiment: (id) => set({ compareExperimentId: id }),
  deleteExperiment: (id) =>
    set((s) => {
      const experiments = s.experiments.filter((e) => e.id !== id);
      return {
        experiments,
        activeExperimentId: s.activeExperimentId === id ? (experiments[0]?.id ?? null) : s.activeExperimentId,
        compareExperimentId: s.compareExperimentId === id ? null : s.compareExperimentId,
      };
    }),

  runScreening: async (request) => {
    if (get().screening.status === 'running') return;
    const net = get().network;
    set({ screening: { ...idleScreening, status: 'running', total: request.candidateIds.length, request } });
    try {
      const current = () => get().screening.request === request;
      const results = await screenCandidatesAsync(request, net, (done, total) => {
        if (current()) set((s) => ({ screening: { ...s.screening, done, total } }));
      });
      if (current()) set((s) => ({ screening: { ...s.screening, status: 'complete', results, done: s.screening.total } }));
    } catch (err) {
      if (get().screening.request === request) {
        set((s) => ({ screening: { ...s.screening, status: 'error', error: err instanceof Error ? err.message : String(err) } }));
      }
    }
  },

  resetWorkspace: () =>
    set((s) => {
      const defaultTarget = s.network.neurons.find((n) => n.classId === 'PN' || n.classId === 'CON')?.id ?? s.network.neurons[0].id;
      return {
        tab: 'explore',
        selectedNeuronId: defaultTarget,
        config: defaultConfig(defaultTarget, s.network),
        experiments: [],
        activeExperimentId: null,
        compareExperimentId: null,
        experimentCounter: 0,
        screening: idleScreening,
        view: { showEdges: true, showLabels: true, showActivity: true },
        cameraResetRequest: s.cameraResetRequest + 1,
      };
    }),
}));

/** The experiment currently shown in the results workspace. */
export const selectActiveExperiment = (s: LabState) =>
  s.experiments.find((e) => e.id === s.activeExperimentId) ?? null;
