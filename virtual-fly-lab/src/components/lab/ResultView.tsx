import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ExperimentRecord, PopulationDelta } from '../../types/simulation';
import { pct, signed } from '../../utils/format';

const CONTROL = '#5b5f66';
const CHANGED = '#3987e5';

/** Plain-language result: one headline and a normal-vs-changed bar pair per brain region. */
export function ResultView({ record }: { record: ExperimentRecord | null }) {
  if (!record) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-400">
        Press <span className="text-ink-200">Run experiment</span>. We simulate the brain twice, once normally and once with your change, and show the difference
        here.
      </p>
    );
  }
  if (record.status === 'running') {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-300" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Simulating the normal brain and the changed brain…
      </p>
    );
  }
  if (record.status === 'error' || !record.summary) {
    return (
      <p className="flex items-start gap-2 text-[13px] text-[#e59a6a]" role="alert">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {record.error ?? 'The simulation did not return results.'}
      </p>
    );
  }

  const { populations } = record.summary;
  // Lead with the region that changed most, then name where the effect spread.
  const changed = populations.filter((p) => p.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top = changed[0];
  const spread = changed.slice(1).map((p) => p.label.toLowerCase());

  return (
    <div role="status" aria-live="polite">
      {top ? (
        <>
          <p className="text-[22px] font-semibold leading-tight tracking-tight text-ink-100">
            {top.label} fired {top.delta > 0 ? 'more' : 'less'}
          </p>
          <p className={`num mt-1 text-[15px] ${top.delta > 0 ? 'text-[#7fb2ef]' : 'text-[#e0a338]'}`}>
            {change(top)} <span className="font-sans text-ink-400">compared with the normal brain</span>
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
            {spread.length > 0 ? `The effect spread to: ${spread.join(', ')}.` : 'The effect stayed in this region and did not spread further.'}
          </p>
        </>
      ) : (
        <p className="text-[22px] font-semibold leading-tight tracking-tight text-ink-100">Nothing changed</p>
      )}

      <div className="mt-5 flex items-center gap-4 text-[12px] text-ink-400">
        <Legend color={CONTROL} label="Normal brain" />
        <Legend color={CHANGED} label="With your change" />
      </div>
      <ul className="mt-3 space-y-3">
        {populations.map((p) => {
          const max = Math.max(p.baseline, p.intervention, 1);
          return (
            <li key={p.populationId}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className={p === top ? 'font-medium text-ink-100' : 'text-ink-300'}>{p.label}</span>
                <span className={`num text-[12px] ${p.delta === 0 ? 'text-ink-500' : 'text-ink-200'}`}>{p.delta === 0 ? 'no change' : change(p)}</span>
              </div>
              <Bar value={p.baseline} max={max} color={CONTROL} />
              <Bar value={p.intervention} max={max} color={CHANGED} />
            </li>
          );
        })}
      </ul>
      <p className="mt-5 rounded-lg bg-ink-950/70 px-3 py-2 text-[12px] leading-relaxed text-ink-400">
        The brain on the left is replaying your experiment. Each flash is a neuron firing.
      </p>
    </div>
  );
}

/** Percent when there is a baseline to compare with, otherwise the raw spike difference. */
const change = (p: PopulationDelta) => (p.percentChange === null ? `${signed(p.delta)} spikes` : pct(p.percentChange));

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="mt-1 h-1.5 rounded-full bg-ink-800" title={`${value} spikes`}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> {label}
    </span>
  );
}
