/**
 * Typed client for the Virtual Fly Lab FastAPI Python backend.
 */
import type { NetworkDefinition } from '../types/network';
import type { CandidateResult, ExperimentConfig, ExperimentRecord, ScreeningRequest } from '../types/simulation';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export interface DatasetItem {
  id: string;
  name: string;
  source: string;
  description: string;
  version: string;
  isSynthetic: boolean;
  neuronCount: number;
  connectionCount: number;
}

export const backendApi = {
  getHealth: () => request<{ status: string; version: string }>('/health'),
  getDatasets: () => request<DatasetItem[]>('/datasets'),
  getNetworkSummary: (networkId: string) => request<any>(`/networks/${networkId}/summary`),
  getNetworkDefinition: (networkId: string) => request<NetworkDefinition>(`/networks/${networkId}/definition`),
  getSubgraph: (networkId: string, neuronIds: string[], depth = 1) =>
    request<any>(`/networks/${networkId}/subgraph?${neuronIds.map((id) => `neuron_ids=${id}`).join('&')}&depth=${depth}`),
  getNeurons: (networkId: string, params?: { query?: string; classId?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.query) q.set('query', params.query);
    if (params?.classId) q.set('class_id', params.classId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('page_size', String(params.pageSize));
    return request<any>(`/networks/${networkId}/neurons?${q.toString()}`);
  },
  getNeuronDetail: (networkId: string, neuronId: string) =>
    request<any>(`/networks/${networkId}/neurons/${neuronId}`),
  createExperiment: (config: ExperimentConfig, runNow = true) =>
    request<ExperimentRecord>(`/experiments?run_now=${runNow}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  runExperiment: (experimentId: string) =>
    request<ExperimentRecord>(`/experiments/${experimentId}/run`, { method: 'POST' }),
  getExperimentResults: (experimentId: string) =>
    request<ExperimentRecord>(`/experiments/${experimentId}/results`),
  getExperiments: (networkId?: string) =>
    request<{ total: number; items: ExperimentRecord[] }>(`/experiments${networkId ? `?network_id=${networkId}` : ''}`),
  deleteExperiment: (experimentId: string) =>
    request<void>(`/experiments/${experimentId}`, { method: 'DELETE' }),
  screenCandidates: (req: ScreeningRequest & { networkId?: string }) =>
    request<{ results: CandidateResult[]; totalCandidates: number; wallTimeMs: number }>('/analysis/candidates', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
};
