/// <reference lib="webworker" />
import { buildNetwork } from '../../data/networkLoader';
import { runExperiment } from '../experiment';
import { screenCandidates } from '../screening';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerResponse) => ctx.postMessage(msg);

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    const network = buildNetwork(msg.network);
    if (msg.type === 'experiment') {
      post({ type: 'experiment-result', requestId: msg.requestId, outcome: runExperiment(msg.config, network) });
    } else {
      let lastReport = 0;
      const results = screenCandidates(msg.request, network, (done, total) => {
        const now = performance.now();
        if (done === total || now - lastReport > 60) {
          lastReport = now;
          post({ type: 'progress', requestId: msg.requestId, done, total });
        }
      });
      post({ type: 'screen-result', requestId: msg.requestId, results });
    }
  } catch (err) {
    post({ type: 'error', requestId: msg.requestId, message: err instanceof Error ? err.message : String(err) });
  }
};
