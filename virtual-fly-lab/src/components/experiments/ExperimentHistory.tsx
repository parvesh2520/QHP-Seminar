import { GitCompareArrows, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { MAX_HISTORY, useLabStore } from '../../store/labStore';
import { lookup } from '../../utils/networkLookup';
import { Card } from '../common/Section';
import { Delta } from '../results/ExperimentSummary';

/** In-memory list of experiment runs for this browser session. */
export function ExperimentHistory() {
  const network = useLabStore((s) => s.network);
  const experiments = useLabStore((s) => s.experiments);
  const activeId = useLabStore((s) => s.activeExperimentId);
  const compareId = useLabStore((s) => s.compareExperimentId);
  const select = useLabStore((s) => s.selectExperiment);
  const setCompare = useLabStore((s) => s.setCompareExperiment);
  const rerun = useLabStore((s) => s.rerunExperiment);
  const remove = useLabStore((s) => s.deleteExperiment);
  const anyRunning = experiments.some((e) => e.status === 'running');
  const { neuronById } = lookup(network);

  return (
    <Card
      title="Experiment history"
      subtitle={`Stored in memory for this session only (up to ${MAX_HISTORY} runs; cleared on reload). Click a row to inspect it.`}
    >
      {experiments.length === 0 ? (
        <p className="py-2 text-[12px] text-ink-500">No runs yet.</p>
      ) : (
        <div className="max-h-56 overflow-auto">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="border-b border-ink-700 text-left text-[11px] text-ink-500">
                <th className="py-1 pr-2 font-normal">ID</th>
                <th className="py-1 pr-2 font-normal">Target</th>
                <th className="py-1 pr-2 font-normal">Mode</th>
                <th className="py-1 pr-2 font-normal">Window · intensity</th>
                <th className="py-1 pr-2 font-normal">Output population</th>
                <th className="py-1 pr-2 text-right font-normal">Δ output</th>
                <th className="py-1 pr-2 text-right font-normal">Δ total</th>
                <th className="py-1 pr-2 font-normal">Status</th>
                <th className="py-1 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((e) => {
                const isActive = e.id === activeId;
                const isCompare = e.id === compareId;
                const pop = network.populations.find((p) => p.id === e.config.outputPopulationId);
                return (
                  <tr
                    key={`${e.id}-${e.createdAt}`}
                    className={`cursor-pointer border-b border-ink-800 ${isActive ? 'bg-ink-800' : 'hover:bg-ink-850'}`}
                    onClick={() => select(e.id)}
                    aria-selected={isActive}
                  >
                    <td className="py-1 pr-2">
                      <button
                        type="button"
                        className="font-mono text-ink-100 hover:underline"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          select(e.id);
                        }}
                        aria-label={`Inspect ${e.id}`}
                      >
                        {e.id}
                      </button>
                      {isCompare && <span className="ml-1.5 rounded border border-[#d95926]/60 px-1 text-[10px] text-[#e8a184]">B</span>}
                      {isActive && compareId && <span className="ml-1.5 rounded border border-accent/60 px-1 text-[10px] text-[#9cc3f2]">A</span>}
                    </td>
                    <td className="py-1 pr-2 font-mono text-ink-300">{neuronById.get(e.config.targetNeuronId)?.label}</td>
                    <td className="py-1 pr-2 text-ink-300">{e.config.mode === 'excite' ? 'Excite' : 'Suppress'}</td>
                    <td className="num py-1 pr-2 text-ink-300">
                      {e.config.stimStartMs}–{e.config.stimStartMs + e.config.stimDurationMs} ms · {e.config.intensity} mV
                    </td>
                    <td className="py-1 pr-2 text-ink-400">{pop?.label}</td>
                    <td className="num py-1 pr-2 text-right">{e.summary ? <Delta value={e.summary.output.delta} /> : '—'}</td>
                    <td className="num py-1 pr-2 text-right">{e.summary ? <Delta value={e.summary.totalSpikes.delta} /> : '—'}</td>
                    <td className="py-1 pr-2">
                      {e.status === 'running' ? (
                        <span className="inline-flex items-center gap-1 text-ink-300">
                          <Loader2 size={11} className="animate-spin" aria-hidden /> running
                        </span>
                      ) : e.status === 'error' ? (
                        <span className="text-[#e59a6a]" title={e.error}>error</span>
                      ) : (
                        <span className="text-ink-400">complete</span>
                      )}
                    </td>
                    <td className="py-1 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="inline-flex gap-0.5">
                        <IconButton
                          label={isCompare ? `Stop comparing ${e.id}` : `Compare ${e.id} with the inspected run`}
                          onClick={() => setCompare(isCompare ? null : e.id)}
                          disabled={isActive || e.status !== 'complete'}
                          pressed={isCompare}
                        >
                          <GitCompareArrows size={13} />
                        </IconButton>
                        <IconButton label={`Rerun ${e.id} as a new experiment`} onClick={() => void rerun(e.id)} disabled={anyRunning}>
                          <RotateCw size={13} />
                        </IconButton>
                        <IconButton label={`Delete ${e.id}`} onClick={() => remove(e.id)} disabled={e.status === 'running'}>
                          <Trash2 size={13} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function IconButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost h-6 px-1.5 ${pressed ? 'bg-ink-700 text-ink-100' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
    >
      {children}
    </button>
  );
}
