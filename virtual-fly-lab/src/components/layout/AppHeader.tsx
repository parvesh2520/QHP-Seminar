import { BookOpen, RotateCcw } from 'lucide-react';
import { useRef } from 'react';
import { selectActiveExperiment, useLabStore, type DatasetChoice, type Tab } from '../../store/labStore';
import { ModelInfoDialog } from './ModelInfoDialog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'experiments', label: 'Experiments' },
  { id: 'candidates', label: 'Candidate Analysis' },
];

export function AppHeader() {
  const activeDataset = useLabStore((s) => s.activeDataset);
  const setDataset = useLabStore((s) => s.setDataset);
  const network = useLabStore((s) => s.network);
  const tab = useLabStore((s) => s.tab);
  const setTab = useLabStore((s) => s.setTab);
  const resetWorkspace = useLabStore((s) => s.resetWorkspace);
  const hasHistory = useLabStore((s) => s.experiments.length > 0);
  const active = useLabStore(selectActiveExperiment);
  const status = useStatus();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const onReset = () => {
    if (hasHistory && !window.confirm('Reset the workspace? This clears the experiment history, screening results and parameters.')) return;
    resetWorkspace();
  };

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-ink-800 bg-ink-900 px-4 py-2">
      <div className="flex items-center gap-2.5">
        <Wordmark />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-ink-100">Virtual Fly Lab</div>
          <div className="text-[10.5px] text-ink-400">Computational Neuroscience Workbench</div>
        </div>
      </div>

      <nav className="flex h-8 items-stretch gap-0.5 rounded border border-ink-700 bg-ink-950 p-0.5" role="tablist" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="main-view"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 text-[12px] font-medium ${tab === t.id ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 items-center gap-2 text-[11.5px]">
        <label htmlFor="dataset-select" className="text-ink-500">Brain Data:</label>
        <select
          id="dataset-select"
          aria-label="Active Connectome Dataset"
          className="field-input h-7 w-auto py-0 font-medium text-ink-100"
          value={activeDataset}
          onChange={(e) => setDataset(e.target.value as DatasetChoice)}
        >
          <option value="flywire">🧠 FlyWire Adult Fly Brain (v783 Real Biology)</option>
          <option value="synthetic">🔬 Synthetic Demo Network</option>
        </select>
        {active && (
          <>
            <span className="text-ink-600">/</span>
            <span className="font-mono text-ink-200">{active.id}</span>
          </>
        )}
        {network.metadata.source === 'connectome-subset' ? (
          <span className="rounded border border-[#199e70]/60 bg-[#199e70]/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#3cd094]" title={network.metadata.description}>
            ● Real FlyWire Connectome
          </span>
        ) : (
          <span className="rounded border border-[#c98500]/50 bg-[#c98500]/10 px-1.5 py-0.5 text-[10.5px] font-medium text-[#e3b65c]" title={network.metadata.description}>
            Synthetic demo network
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11.5px]" role="status" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
          <span className="text-ink-300">{status.text}</span>
        </div>
        <button type="button" className="btn btn-default" onClick={onReset} title="Clear history, screening results and parameters">
          <RotateCcw size={13} aria-hidden /> Reset experiment
        </button>
        <button type="button" className="btn btn-default" onClick={() => dialogRef.current?.showModal()}>
          <BookOpen size={13} aria-hidden /> Model info
        </button>
      </div>
      <ModelInfoDialog ref={dialogRef} />
    </header>
  );
}

function useStatus(): { text: string; dot: string } {
  const runningExperiment = useLabStore((s) => s.experiments.find((e) => e.status === 'running'));
  const screening = useLabStore((s) => s.screening);
  const active = useLabStore(selectActiveExperiment);
  if (runningExperiment) return { text: `Simulating ${runningExperiment.id}…`, dot: 'bg-accent animate-pulse' };
  if (screening.status === 'running') return { text: `Screening ${screening.done}/${screening.total}`, dot: 'bg-accent animate-pulse' };
  if (active?.status === 'error') return { text: `${active.id} failed`, dot: 'bg-[#e59a6a]' };
  if (active?.status === 'complete') {
    const wall = (active.baseline?.wallTimeMs ?? 0) + (active.intervention?.wallTimeMs ?? 0);
    return { text: `${active.id} complete · ${wall.toFixed(0)} ms compute`, dot: 'bg-[#4caf7a]' };
  }
  return { text: 'Idle · simulation engine ready', dot: 'bg-ink-500' };
}

/** Minimal mark: three connected nodes. */
function Wordmark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="21" height="21" rx="4" fill="#191a1d" stroke="#3a3d42" />
      <path d="M6 15 L11 6 L16 15 Z" fill="none" stroke="#5b5f66" strokeWidth="1.2" />
      <circle cx="11" cy="6" r="2" fill="#3987e5" />
      <circle cx="6" cy="15" r="2" fill="#c98500" />
      <circle cx="16" cy="15" r="2" fill="#9085e9" />
    </svg>
  );
}
