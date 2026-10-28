/**
 * Promise-based facade over the simulation Web Worker. Numerical work never
 * runs on the UI thread unless Workers are unavailable.
 */
import { toDefinition } from '../../data/networkLoader';
import type { Network } from '../../types/network';
import type { CandidateResult, ExperimentConfig, ScreeningRequest } from '../../types/simulation';
import { runExperiment, type ExperimentOutcome } from '../experiment';
import { screenCandidates } from '../screening';
import type { WorkerRequest, WorkerResponse } from './protocol';

interface Pending {
  resolve: (value: never) => void;
  reject: (reason: Error) => void;
  onProgress?: (done: number, total: number) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.requestId);
      if (!p) return;
      if (msg.type === 'progress') {
        p.onProgress?.(msg.done, msg.total);
        return;
      }
      pending.delete(msg.requestId);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else if (msg.type === 'experiment-result') p.resolve(msg.outcome as never);
      else p.resolve(msg.results as never);
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Simulation worker failed');
      pending.forEach((p) => p.reject(error));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function send<T>(build: (requestId: number) => WorkerRequest, onProgress?: Pending['onProgress']): Promise<T> {
  const w = getWorker()!;
  const requestId = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(requestId, { resolve: resolve as Pending['resolve'], reject, onProgress });
    w.postMessage(build(requestId));
  });
}

export function runExperimentAsync(config: ExperimentConfig, network: Network): Promise<ExperimentOutcome> {
  if (!getWorker()) return Promise.resolve().then(() => runExperiment(config, network));
  const def = toDefinition(network);
  return send((requestId) => ({ type: 'experiment', requestId, network: def, config }));
}

export function screenCandidatesAsync(
  request: ScreeningRequest,
  network: Network,
  onProgress?: (done: number, total: number) => void,
): Promise<CandidateResult[]> {
  if (!getWorker()) return Promise.resolve().then(() => screenCandidates(request, network, onProgress));
  const def = toDefinition(network);
  return send((requestId) => ({ type: 'screen', requestId, network: def, request }), onProgress);
}
