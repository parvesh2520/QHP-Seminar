import { BookOpen, RotateCcw } from 'lucide-react';
import { useRef } from 'react';
import { selectActiveExperiment, useLabStore, type DatasetChoice, type Tab } from '../../store/labStore';
import { ModelInfoDialog } from './ModelInfoDialog';

const TABS: { id: Tab; label: string; guide: string }[] = [
  {
    id: 'explore',
    label: 'Explore the circuit',
    guide: 'Each dot is one neuron. Click a dot or pick one from the list to see what it is wired to, then set it as the target on the right.',
  },
  {
    id: 'experiments',
    label: 'Run an experiment',
    guide: 'Every run simulates the brain twice: once untouched, once with your change. The difference between the two is the result.',
  },
  {
    id: 'candidates',
    label: 'Find key neurons',
    guide: 'Test every neuron one at a time and rank them by how much they change the output. The top of the list are the neurons that matter most.',
  },
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
  const current = TABS.find((t) => t.id === tab)!;
  const stepNo = TABS.indexOf(current) + 1;
  const showResultsLink = tab !== 'experiments' && active?.status === 'complete';

  const onReset = () => {
    if (hasHistory && !window.confirm('Reset the workspace? This clears the experiment history, screening results and parameters.')) return;
    resetWorkspace();
  };

  return (
    <header className="shrink-0 border-b border-ink-800 bg-ink-900">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Wordmark />
          <div className="leading-tight">
            <div className="text-[16px] font-medium text-ink-100">Virtual Fly Lab</div>
            <div className="text-[12px] text-ink-400">Switch fruit fly neurons on or off and watch what happens</div>
          </div>
        </div>

        <nav className="flex items-center gap-1" role="tablist" aria-label="Lab steps">
          {TABS.map((t, i) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls="main-view"
                onClick={() => setTab(t.id)}
                className={`flex h-9 items-center gap-2 rounded-md px-3 text-[14px] transition-colors ${
                  on ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
                }`}
              >
                <span className={`step ${on ? 'step-active' : ''}`}>{i + 1}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor="dataset-select" className="text-[13px] text-ink-400">
            Brain
          </label>
          <select
            id="dataset-select"
            className="field-input w-auto"
            value={activeDataset}
            title={network.metadata.description}
            onChange={(e) => setDataset(e.target.value as DatasetChoice)}
          >
            <option value="flywire">Real fruit fly brain (FlyWire)</option>
            <option value="synthetic">Simple demo network</option>
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.showModal()}>
            <BookOpen size={16} strokeWidth={1.5} aria-hidden /> How it works
          </button>
          <button type="button" className="btn btn-ghost" onClick={onReset} title="Clear history, screening results and parameters">
            <RotateCcw size={16} strokeWidth={1.5} aria-hidden /> Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-ink-800 bg-ink-950/60 px-4 py-2 text-[13px]">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-ink-300">
          <span className="step">{stepNo}</span>
          {current.guide}
        </p>
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
          <span className="text-ink-400">{status.text}</span>
          {showResultsLink && (
            <button type="button" className="text-ink-100 underline decoration-ink-600 underline-offset-4 hover:decoration-ink-300" onClick={() => setTab('experiments')}>
              See results
            </button>
          )}
        </div>
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
  if (screening.status === 'running') return { text: `Testing neurons ${screening.done} of ${screening.total}`, dot: 'bg-accent animate-pulse' };
  if (active?.status === 'error') return { text: `${active.id} failed`, dot: 'bg-[#e59a6a]' };
  if (active?.status === 'complete') {
    const wall = (active.baseline?.wallTimeMs ?? 0) + (active.intervention?.wallTimeMs ?? 0);
    return { text: `${active.id} done in ${wall.toFixed(0)} ms`, dot: 'bg-[#4caf7a]' };
  }
  return { text: 'Ready', dot: 'bg-ink-500' };
}

/** Mark: three connected neurons. */
function Wordmark() {
  return (
    <svg width="28" height="28" viewBox="0 0 22 22" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="21" height="21" rx="5" fill="#191a1d" stroke="#3a3d42" />
      <path d="M6 15 L11 6 L16 15" fill="none" stroke="#5b5f66" strokeWidth="1.2" />
      <circle cx="11" cy="6" r="2" fill="#eceded" />
      <circle cx="6" cy="15" r="2" fill="#3987e5" />
      <circle cx="16" cy="15" r="2" fill="#8a8e95" />
    </svg>
  );
}
