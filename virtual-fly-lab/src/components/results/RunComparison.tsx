import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { populationSpikeCount } from '../../simulation/metrics';
import { useLabStore } from '../../store/labStore';
import type { ExperimentRecord } from '../../types/simulation';
import { lookup } from '../../utils/networkLookup';
import { Card } from '../common/Section';
import { PopulationActivityChart, type Series } from './ActivityCharts';
import { Delta } from './ExperimentSummary';
import { CONDITION_COLORS } from './plotHelpers';

type Complete = Required<ExperimentRecord>;

/** Side-by-side comparison of the intervention runs of two saved experiments (A = inspected, B = compared). */
export function RunComparison({ a, b }: { a: Complete; b: Complete }) {
  const network = useLabStore((s) => s.network);
  const clear = useLabStore((s) => s.setCompareExperiment);
  const [popId, setPopId] = useState(a.config.outputPopulationId);
  const { neuronById } = lookup(network);

  const series: Series[] = useMemo(
    () => [
      { name: `${a.id} (A)`, color: CONDITION_COLORS.intervention, result: a.intervention },
      { name: `${b.id} (B)`, color: CONDITION_COLORS.compare, result: b.intervention },
    ],
    [a, b],
  );

  const sameSettings = a.config.durationMs === b.config.durationMs && a.config.dt === b.config.dt && a.config.seed === b.config.seed;
  const popLabel = network.populations.find((p) => p.id === popId)!.label;
  const rows = [
    { label: 'Total spikes (intervention)', a: a.intervention.spikeTimes.length, b: b.intervention.spikeTimes.length },
    { label: `${popLabel} spikes (intervention)`, a: populationSpikeCount(a.intervention, network, popId), b: populationSpikeCount(b.intervention, network, popId) },
    { label: `${popLabel} Δ vs own baseline`, a: populationSpikeCount(a.intervention, network, popId) - populationSpikeCount(a.baseline, network, popId), b: populationSpikeCount(b.intervention, network, popId) - populationSpikeCount(b.baseline, network, popId) },
    { label: 'Active neurons (intervention)', a: a.summary.activeNeurons.intervention, b: b.summary.activeNeurons.intervention },
  ];
  const describe = (r: Complete) =>
    `${neuronById.get(r.config.targetNeuronId)?.label} · ${r.config.mode} ${r.config.intensity} mV · ${r.config.stimStartMs}–${r.config.stimStartMs + r.config.stimDurationMs} ms`;

  return (
    <Card
      title={`Run comparison · ${a.id} (A) vs ${b.id} (B)`}
      subtitle={sameSettings ? 'Both runs share length, time step and seed, so differences reflect the interventions.' : 'Runs differ in length, time step or seed; differences may reflect simulation settings as well as the interventions.'}
      actions={
        <button type="button" className="btn btn-ghost h-6 px-1.5" onClick={() => clear(null)} aria-label="Close run comparison">
          <X size={13} />
        </button>
      }
    >
      <div className="grid gap-3 xl:grid-cols-[3fr_2fr]">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-ink-400">Intervention-run activity</span>
            <select aria-label="Population compared" className="field-input h-6 w-44 text-[11.5px]" value={popId} onChange={(e) => setPopId(e.target.value)}>
              {network.populations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <PopulationActivityChart series={series} network={network} populationId={popId} height={220} />
        </div>
        <div>
          <dl className="mb-2 space-y-1 text-[11.5px]">
            <div><dt className="inline text-[#9cc3f2]">A </dt><dd className="inline font-mono text-ink-300">{describe(a)}</dd></div>
            <div><dt className="inline text-[#e8a184]">B </dt><dd className="inline font-mono text-ink-300">{describe(b)}</dd></div>
          </dl>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[11px] text-ink-500">
                <th className="py-1 font-normal">Measure</th>
                <th className="py-1 text-right font-normal">A</th>
                <th className="py-1 text-right font-normal">B</th>
                <th className="py-1 text-right font-normal">B − A</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-ink-800">
                  <td className="py-1 text-ink-300">{r.label}</td>
                  <td className="num py-1 text-right text-ink-200">{r.a}</td>
                  <td className="num py-1 text-right text-ink-200">{r.b}</td>
                  <td className="num py-1 text-right"><Delta value={r.b - r.a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
