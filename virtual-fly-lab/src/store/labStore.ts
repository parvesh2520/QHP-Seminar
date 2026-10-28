import { create } from 'zustand';
import { sampleNetwork } from '../data/sampleNetwork';
import { validateExperimentConfig } from '../simulation/experiment';
import { runExperimentAsync, screenCandidatesAsync } from '../simulation/worker/simulationClient';
import type { Network } from '../types/network';
import type { CandidateResult, ExperimentConfig, ExperimentRecord, ScreeningRequest } from '../types/simulation';

export type Tab = 'explore' | 'experiments' | 'candidates';
export type ViewToggle = 'showEdges' | 'showLabels' | 'showActivity';

/** Experiment history is in-memory only; the oldest runs are dropped past this size. */
export const MAX_HISTORY = 30;

const network = sampleNetwork;
const defaultTarget = network.neurons.find((n) => n.classId === 'CON')!.id;

export function defaultConfig(targetNeuronId = defaultTarget): ExperimentConfig {
  return {
    targetNeuronId,
    mode: 'excite',
    stimStartMs: 200,
    stimDurationMs: 300,
    intensity: 30,
    durationMs: 800,
    dt: 0.1,
    outputPopulationId: 'pop-descending',
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
  network,
  tab: 'explore',
  selectedNeuronId: defaultTarget,
  focusRequest: 0,
  cameraResetRequest: 0,
  view: { showEdges: true, showLabels: true, showActivity: true },
  config: defaultConfig(),
  experiments: [],
  activeExperimentId: null,
  compareExperimentId: null,
  experimentCounter: 0,
  screening: idleScreening,

  setTab: (tab) => set({ tab }),
  selectNeuron: (id) => set({ selectedNeuronId: id && network.indexById.has(id) ? id : null }),
  focusSelected: () => set((s) => ({ focusRequest: s.focusRequest + 1 })),
  resetCamera: () => set((s) => ({ cameraResetRequest: s.cameraResetRequest + 1 })),
  toggleView: (key) => set((s) => ({ view: { ...s.view, [key]: !s.view[key] } })),
  updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  resetConfig: () => set((s) => ({ config: defaultConfig(s.config.targetNeuronId) })),

  runExperiment: async (configArg) => {
    const config = { ...(configArg ?? get().config) };
    if (Object.keys(validateExperimentConfig(config, network)).length > 0) return;
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
      const outcome = await runExperimentAsync(config, network);
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
    set({ screening: { ...idleScreening, status: 'running', total: request.candidateIds.length, request } });
    try {
      const current = () => get().screening.request === request;
      const results = await screenCandidatesAsync(request, network, (done, total) => {
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
    set((s) => ({
      tab: 'explore',
      selectedNeuronId: defaultTarget,
      config: defaultConfig(),
      experiments: [],
      activeExperimentId: null,
      compareExperimentId: null,
      experimentCounter: 0,
      screening: idleScreening,
      view: { showEdges: true, showLabels: true, showActivity: true },
      cameraResetRequest: s.cameraResetRequest + 1,
    })),
}));

/** The experiment currently shown in the results workspace. */
export const selectActiveExperiment = (s: LabState) =>
  s.experiments.find((e) => e.id === s.activeExperimentId) ?? null;
