import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useLabStore } from '../../store/labStore';
import type { ExperimentRecord } from '../../types/simulation';
import { ms, pct, signed } from '../../utils/format';
import { lookup } from '../../utils/networkLookup';
import { Card } from '../common/Section';
import { CONDITION_COLORS } from './plotHelpers';

/** Headline result, configuration and metric table for a completed experiment. */
export function ExperimentSummary({ record }: { record: ExperimentRecord }) {
  const network = useLabStore((s) => s.network);
  const { neuronById, classById } = lookup(network);
  const { config, summary, baseline, intervention } = record;
  if (!summary || !baseline || !intervention) return null;
  const target = neuronById.get(config.targetNeuronId)!;
  const targetClass = classById.get(target.classId)!;
  const durationS = config.durationMs / 1000;
  const N = network.neurons.length;
  const out = summary.output;
  const verb = config.mode === 'excite' ? 'Exciting' : 'Suppressing';
  const headline =
    out.delta === 0
      ? `${out.label} did not change`
      : `${out.label} fired ${Math.abs(out.delta)} ${out.delta > 0 ? 'more' : 'fewer'} times`;

  const rows: { label: string; b: number; v: number; digits?: number; unit?: string; pctChange?: number | null }[] = [
    { label: 'Spikes in the whole brain', b: summary.totalSpikes.baseline, v: summary.totalSpikes.intervention, pctChange: summary.totalSpikes.percentChange },
    { label: 'Neurons that fired at least once', b: summary.activeNeurons.baseline, v: summary.activeNeurons.intervention, unit: `/ ${N}` },
    { label: 'Average firing rate', b: summary.baseline.meanRateHz, v: summary.intervention.meanRateHz, digits: 2, unit: 'Hz' },
    { label: `Spikes in ${out.label}`, b: out.baseline, v: out.intervention, pctChange: out.percentChange },
  ];

  return (
    <Card
      title={`Result · ${record.id}`}
      subtitle={
        network.metadata.source === 'connectome-subset'
          ? 'Simulated on the real FlyWire fruit fly wiring. One run each, so no statistics are applied.'
          : 'Simulated on the simple demo network. One run each, so no statistics are applied.'
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div>
          <p className="text-[13px] text-ink-400">
            {verb} <span className="font-mono text-ink-200">{target.label}</span>
            <span className="text-ink-500"> ({targetClass.label.toLowerCase()})</span> with {config.intensity} mV from {config.stimStartMs} to{' '}
            {config.stimStartMs + config.stimDurationMs} ms
          </p>
          <p className="mt-2 text-[24px] font-medium leading-tight text-ink-100">{headline}</p>
          <p className="mt-1 text-[14px] text-ink-400">
            compared with the control run {out.percentChange !== null && out.delta !== 0 && <span className="num">({pct(out.percentChange)})</span>}
          </p>
          {summary.statements.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-ink-800 pt-3 text-[13px] text-ink-300">
              {summary.statements.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-500" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <ComparisonBars label={`Spikes in ${out.label}`} control={out.baseline} changed={out.intervention} />
      </div>

      <h4 className="mt-6 text-[13px] font-medium text-ink-300">All measures</h4>
      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr className="border-b border-ink-700 text-left text-[12px] text-ink-500">
            <th className="py-2 font-normal">Measure</th>
            <th className="py-2 text-right font-normal">Control</th>
            <th className="py-2 text-right font-normal">With change</th>
            <th className="py-2 text-right font-normal">Difference</th>
            <th className="py-2 text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.v - r.b;
            return (
              <tr key={r.label} className="border-b border-ink-800">
                <td className="py-2 text-ink-300">{r.label}</td>
                <td className="num py-2 text-right text-ink-300">{r.b.toFixed(r.digits ?? 0)} {r.unit && <span className="text-ink-500">{r.unit}</span>}</td>
                <td className="num py-2 text-right text-ink-100">{r.v.toFixed(r.digits ?? 0)} {r.unit && <span className="text-ink-500">{r.unit}</span>}</td>
                <td className="num py-2 text-right">
                  <Delta value={d} digits={r.digits ?? 0} />
                </td>
                <td className="num py-2 text-right text-ink-400">{r.pctChange === undefined ? '' : pct(r.pctChange)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-ink-500">
        Counted over the full {durationS} s run · {ms(config.durationMs)}, step {config.dt} ms, seed {config.seed}. Average rate = all spikes / {N} neurons / {durationS} s.
      </p>
    </Card>
  );
}

/** Two bars on one scale: the control run and the run with the change. */
function ComparisonBars({ label, control, changed }: { label: string; control: number; changed: number }) {
  const max = Math.max(control, changed, 1);
  const bars = [
    { name: 'Control', sub: 'nothing changed', value: control, color: CONDITION_COLORS.baseline },
    { name: 'With change', sub: 'your experiment', value: changed, color: CONDITION_COLORS.intervention },
  ];
  return (
    <figure className="rounded-lg border border-ink-800 bg-ink-950/60 p-4" aria-label={`${label}: control ${control}, with change ${changed}`}>
      <figcaption className="text-[13px] text-ink-400">{label}</figcaption>
      <div className="mt-4 space-y-4">
        {bars.map((b) => (
          <div key={b.name}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink-200">
                {b.name} <span className="text-ink-500">· {b.sub}</span>
              </span>
              <span className="num text-[20px] text-ink-100">{b.value}</span>
            </div>
            <div className="mt-1 h-3 rounded-sm bg-ink-800">
              <div className="h-full rounded-sm" style={{ width: `${(b.value / max) * 100}%`, background: b.color }} />
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function Delta({ value, digits = 0 }: { value: number; digits?: number }) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 ${value === 0 ? 'text-ink-500' : 'text-ink-100'}`}>
      <Icon size={14} strokeWidth={1.5} aria-hidden className={value > 0 ? 'text-[#7fb2ef]' : value < 0 ? 'text-[#e0a338]' : ''} />
      {signed(value, digits)}
    </span>
  );
}
