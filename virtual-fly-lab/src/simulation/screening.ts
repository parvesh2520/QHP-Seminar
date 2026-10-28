/**
 * Candidate screening: a transparent, brute-force perturbation screen.
 *
 * For each candidate neuron, the same intervention is applied and the change
 * in output-population spike count relative to a single shared baseline run is
 * measured. Candidates are ranked by |Δ output spikes|.
 *
 * Any search strategy that maps a ScreeningRequest to CandidateResult[] (e.g.
 * an optimiser) can replace `screenCandidates` without touching the UI.
 */
import type { Network } from '../types/network';
import type { CandidateResult, ScreeningRequest, SimulationConfig } from '../types/simulation';
import { percentChange, populationSpikeCount } from './metrics';
import { assertValidSimulationConfig, runSimulation } from './runSimulation';

export const MAX_CANDIDATES = 150;

export function screenCandidates(
  request: ScreeningRequest,
  network: Network,
  onProgress?: (done: number, total: number) => void,
): CandidateResult[] {
  if (request.candidateIds.length === 0) throw new Error('No candidate neurons selected');
  if (request.candidateIds.length > MAX_CANDIDATES) throw new Error(`At most ${MAX_CANDIDATES} candidates per screen`);
  if (request.stimStartMs + request.stimDurationMs > request.durationMs) {
    throw new Error('Stimulation window must end within the simulation');
  }

  const base: SimulationConfig = {
    durationMs: request.durationMs,
    dt: request.dt,
    seed: request.seed,
    recordVoltage: false,
    stimulus: null,
  };
  assertValidSimulationConfig(base, network);
  const baselineRun = runSimulation(base, network);
  const baselineOutput = populationSpikeCount(baselineRun, network, request.outputPopulationId);
  const baselineTotal = baselineRun.spikeTimes.length;

  const results: CandidateResult[] = [];
  request.candidateIds.forEach((neuronId, k) => {
    const run = runSimulation(
      {
        ...base,
        stimulus: {
          neuronId,
          mode: request.mode,
          startMs: request.stimStartMs,
          durationMs: request.stimDurationMs,
          intensity: request.intensity,
        },
      },
      network,
    );
    const interventionOutput = populationSpikeCount(run, network, request.outputPopulationId);
    const delta = interventionOutput - baselineOutput;
    results.push({
      neuronId,
      baselineOutput,
      interventionOutput,
      delta,
      absDelta: Math.abs(delta),
      percentChange: percentChange(baselineOutput, interventionOutput),
      totalDelta: run.spikeTimes.length - baselineTotal,
    });
    onProgress?.(k + 1, request.candidateIds.length);
  });

  return results.sort((a, b) => b.absDelta - a.absDelta || a.neuronId.localeCompare(b.neuronId));
}
