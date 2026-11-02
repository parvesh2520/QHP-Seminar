import { Loader2, Minus, Play, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLabStore } from '../../store/labStore';
import { lookup } from '../../utils/networkLookup';
import { ResultView } from './ResultView';

const MODES = [
  { id: 'excite', label: 'Turn up', sub: 'Excite: fire more', icon: Plus },
  { id: 'suppress', label: 'Turn down', sub: 'Suppress: fire less', icon: Minus },
] as const;

/** The whole experiment in one column: pick a neuron, choose up or down, run, read the result. */
export function LabPanel() {
  const network = useLabStore((s) => s.network);
  const config = useLabStore((s) => s.config);
  const pickGroup = useLabStore((s) => s.pickGroup);
  const setMode = useLabStore((s) => s.setMode);
  const runExperiment = useLabStore((s) => s.runExperiment);
  const experiment = useLabStore((s) => s.experiment);
  const running = experiment?.status === 'running';
  const { neuronById } = lookup(network);
  const target = neuronById.get(config.targetNeuronId);

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <Step n={1} title="Pick a neuron" hint="Choose a group, or click any dot in the brain">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Neuron group">
          {network.classes.map((c) => {
            const on = target?.classId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickGroup(c.id)}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  on ? 'border-accent bg-ink-800' : 'border-ink-700 hover:border-ink-600 hover:bg-ink-850'
                }`}
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                <span className={`text-[13px] leading-snug ${on ? 'text-ink-100' : 'text-ink-300'}`}>{c.role ?? c.label}</span>
              </button>
            );
          })}
        </div>
        {target && (
          <p className="mt-3 text-[13px] text-ink-400">
            Selected: <span className="font-mono text-ink-100">{target.label}</span>
          </p>
        )}
      </Step>

      <Step n={2} title="Turn it up or down">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Change">
          {MODES.map(({ id, label, sub, icon: Icon }) => {
            const on = config.mode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMode(id)}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  on ? 'border-accent bg-ink-800' : 'border-ink-700 hover:border-ink-600 hover:bg-ink-850'
                }`}
              >
                <div className={`flex items-center gap-1.5 text-[15px] font-medium ${on ? 'text-ink-100' : 'text-ink-300'}`}>
                  <Icon size={16} strokeWidth={2} aria-hidden /> {label}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-400">{sub}</div>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary mt-4 h-11 w-full text-[15px]" disabled={running || !target} onClick={() => void runExperiment()}>
          {running ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Play size={18} strokeWidth={1.5} aria-hidden />}
          {running ? 'Simulating…' : 'Run experiment'}
        </button>
      </Step>

      <Step n={3} title="See what changed">
        <ResultView record={experiment} />
      </Step>
    </div>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-800 px-5 py-5 last:border-b-0" aria-label={title}>
      <h2 className="flex items-center gap-2.5 text-[15px] font-medium text-ink-100">
        <span className="step">{n}</span>
        {title}
      </h2>
      {hint && <p className="ml-[30px] mt-0.5 text-[13px] text-ink-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
