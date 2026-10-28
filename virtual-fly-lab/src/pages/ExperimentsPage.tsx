import { ExperimentHistory } from '../components/experiments/ExperimentHistory';
import { ResultsWorkspace } from '../components/results/ResultsWorkspace';
import { RunComparison } from '../components/results/RunComparison';
import { selectActiveExperiment, useLabStore } from '../store/labStore';
import type { ExperimentRecord } from '../types/simulation';

const isComplete = (e: ExperimentRecord | null | undefined): e is Required<ExperimentRecord> =>
  !!e && e.status === 'complete' && !!e.summary && !!e.baseline && !!e.intervention;

export function ExperimentsPage() {
  const active = useLabStore(selectActiveExperiment);
  const compare = useLabStore((s) => s.experiments.find((e) => e.id === s.compareExperimentId));

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mx-auto max-w-[1400px] space-y-3">
        <ExperimentHistory />
        {isComplete(active) && isComplete(compare) && <RunComparison a={active} b={compare} />}
        <ResultsWorkspace record={active} />
      </div>
    </div>
  );
}
