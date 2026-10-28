import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useLabStore } from '../../store/labStore';
import type { ExperimentRecord } from '../../types/simulation';
import { ms, pct, signed } from '../../utils/format';
import { lookup } from '../../utils/networkLookup';
import { Card } from '../common/Section';

/** Configuration and metric table for a completed experiment. */
export function ExperimentSummary({ record }: { record: ExperimentRecord }) {
  const network = useLabStore((s) => s.network);
  const { neuronById } = lookup(network);
  const { config, summary, baseline, intervention } = record;
  if (!summary || !baseline || !intervention) return null;
  const target = neuronById.get(config.targetNeuronId)!;
  const durationS = config.durationMs / 1000;
  const N = network.neurons.length;

  const rows: { label: string; b: number; v: number; digits?: number; unit?: string; pctChange?: number | null }[] = [
    { label: 'Total network spikes', b: summary.totalSpikes.baseline, v: summary.totalSpikes.intervention, pctChange: summary.totalSpikes.percentChange },
    { label: 'Active neurons (≥1 spike)', b: summary.activeNeurons.baseline, v: summary.activeNeurons.intervention, unit: `/ ${N}` },
    { label: 'Mean firing rate', b: summary.baseline.meanRateHz, v: summary.intervention.meanRateHz, digits: 2, unit: 'Hz' },
    { label: `Output: ${summary.output.label}`, b: summary.output.baseline, v: summary.output.intervention, pctChange: summary.output.percentChange },
  ];

  return (
    <Card
      title={`Experiment summary · ${record.id}`}
      subtitle="Model-generated prediction from a synthetic toy network (single deterministic run; no statistical test applied)."
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px] sm:grid-cols-4">
        <Item label="Target neuron" value={<span className="font-mono">{target.id} · {target.label}</span>} />
        <Item label="Intervention" value={config.mode === 'excite' ? `Excite, ${config.intensity} mV` : `Suppress, ${config.intensity} mV`} />
        <Item label="Stimulation interval" value={<span className="num">{config.stimStartMs}–{config.stimStartMs + config.stimDurationMs} ms</span>} />
        <Item label="Simulation" value={<span className="num">{ms(config.durationMs)} · dt {config.dt} ms · seed {config.seed}</span>} />
      </dl>

      <table className="mt-3 w-full text-[12px]">
        <thead>
          <tr className="border-b border-ink-700 text-left text-[11px] text-ink-500">
            <th className="py-1.5 font-normal">Measure</th>
            <th className="py-1.5 text-right font-normal">Baseline</th>
            <th className="py-1.5 text-right font-normal">Intervention</th>
            <th className="py-1.5 text-right font-normal">Difference</th>
            <th className="py-1.5 text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.v - r.b;
            return (
              <tr key={r.label} className="border-b border-ink-800">
                <td className="py-1.5 text-ink-300">{r.label}</td>
                <td className="num py-1.5 text-right text-ink-300">{r.b.toFixed(r.digits ?? 0)} {r.unit && <span className="text-ink-500">{r.unit}</span>}</td>
                <td className="num py-1.5 text-right text-ink-100">{r.v.toFixed(r.digits ?? 0)} {r.unit && <span className="text-ink-500">{r.unit}</span>}</td>
                <td className="num py-1.5 text-right">
                  <Delta value={d} digits={r.digits ?? 0} />
                </td>
                <td className="num py-1.5 text-right text-ink-400">{r.pctChange === undefined ? '' : pct(r.pctChange)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10.5px] text-ink-500">
        Spike counts over the full {durationS} s run. Mean rate = total spikes / {N} neurons / {durationS} s. Change is relative to baseline (n/a when baseline is zero).
      </p>

      <div className="mt-3 rounded border border-ink-800 bg-ink-950/60 px-3 py-2">
        <div className="panel-title mb-1">What changed</div>
        <ul className="space-y-0.5 text-[12px] text-ink-300">
          {summary.statements.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-100">{value}</dd>
    </div>
  );
}

export function Delta({ value, digits = 0 }: { value: number; digits?: number }) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 ${value === 0 ? 'text-ink-500' : 'text-ink-100'}`}>
      <Icon size={12} aria-hidden className={value > 0 ? 'text-[#7fb2ef]' : value < 0 ? 'text-[#e0a338]' : ''} />
      {signed(value, digits)}
    </span>
  );
}
