import type { NetworkDefinition } from '../../types/network';
import type { CandidateResult, ExperimentConfig, ScreeningRequest } from '../../types/simulation';
import type { ExperimentOutcome } from '../experiment';

export type WorkerRequest =
  | { type: 'experiment'; requestId: number; network: NetworkDefinition; config: ExperimentConfig }
  | { type: 'screen'; requestId: number; network: NetworkDefinition; request: ScreeningRequest };

export type WorkerResponse =
  | { type: 'experiment-result'; requestId: number; outcome: ExperimentOutcome }
  | { type: 'screen-result'; requestId: number; results: CandidateResult[] }
  | { type: 'progress'; requestId: number; done: number; total: number }
  | { type: 'error'; requestId: number; message: string };
