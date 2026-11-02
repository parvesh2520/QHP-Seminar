import { AlertTriangle, FlaskConical, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLabStore } from '../../store/labStore';
import type { ExperimentRecord } from '../../types/simulation';
import { lookup } from '../../utils/networkLookup';
import { EmptyState } from '../common/EmptyState';
import { Card } from '../common/Section';
import { MembraneChart, PopulationActivityChart, PopulationBarChart, type Series } from './ActivityCharts';
import { Delta, ExperimentSummary } from './ExperimentSummary';
import { CONDITION_COLORS } from './plotHelpers';
import { RasterPlot } from './RasterPlot';

/** Full result view for one experiment record. */
export function ResultsWorkspace({ record }: { record: ExperimentRecord | null }) {
  if (!record) {
    return (
      <EmptyState icon={FlaskConical} title="No experiment yet">
        Set up an experiment in the panel on the right and press <span className="text-ink-200">Run experiment</span>. The brain is simulated twice, once
        untouched and once with your change, and the results show up here.
      </EmptyState>
    );
  }
  if (record.status === 'running') {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[14px] text-ink-300" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Simulating {record.id}: control run and run with your change…
      </div>
    );
  }
  if (record.status === 'error' || !record.summary || !record.baseline || !record.intervention) {
    return (
      <EmptyState icon={AlertTriangle} title={`${record.id} failed`}>
        {record.error ?? 'The simulation did not return results.'}
      </EmptyState>
    );
  }
  return <CompletedResults record={record as Required<ExperimentRecord>} />;
}

function CompletedResults({ record }: { record: Required<ExperimentRecord> }) {
  const network = useLabStore((s) => s.network);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const selectNeuron = useLabStore((s) => s.selectNeuron);
  const [popId, setPopId] = useState<string | null>(null);
  const { neuronById, classById } = lookup(network);
  const traceNeuronId = selectedId ?? record.config.targetNeuronId;

  const series: Series[] = useMemo(
    () => [
      { name: 'Control', color: CONDITION_COLORS.baseline, result: record.baseline },
      { name: 'With change', color: CONDITION_COLORS.intervention, result: record.intervention },
    ],
    [record],
  );
  const topChanges = record.summary.neuronDeltas.slice(0, 12);

  return (
    <div className="space-y-4">
      <ExperimentSummary record={record} />

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card
          title="Activity over time"
          subtitle="How many spikes happen at each moment. The shaded band is when the push is on."
          actions={
            <select aria-label="Population shown in activity chart" className="field-input w-48" value={popId ?? ''} onChange={(e) => setPopId(e.target.value || null)}>
              <option value="">Whole network</option>
              {network.populations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          }
        >
          <PopulationActivityChart series={series} network={network} populationId={popId} />
        </Card>
        <Card title="Spikes per brain region" subtitle="Total over the whole run">
          <PopulationBarChart summary={record.summary} />
        </Card>
      </div>

      <Card title="Every spike, neuron by neuron" subtitle="Each row is one neuron and each tick is one spike. The target neuron is drawn in white with a dotted line.">
        <div className="panel-title mb-2">Control · nothing changed</div>
        <RasterPlot result={record.baseline} network={network} targetId={record.config.targetNeuronId} title="Control" height={280} />
        <div className="panel-title mb-2 mt-4">With change · your experiment</div>
        <RasterPlot result={record.intervention} network={network} targetId={record.config.targetNeuronId} title="With change" height={280} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card
          title="Voltage of one neuron"
          subtitle={
            <>
              Voltage rises until it hits the threshold, then the neuron fires and resets. Sampled every <span className="num">{record.intervention.sampleIntervalMs.toFixed(2)} ms</span>.
            </>
          }
          actions={
            <select aria-label="Neuron shown in membrane trace" className="field-input w-48 font-mono" value={traceNeuronId} onChange={(e) => selectNeuron(e.target.value)}>
              {network.neurons.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                  {n.id === record.config.targetNeuronId ? ' (target)' : ''}
                </option>
              ))}
            </select>
          }
        >
          <MembraneChart series={series} network={network} neuronId={traceNeuronId} />
        </Card>
        <Card title="Neurons that changed most" subtitle="Spikes with change minus spikes in control">
          {topChanges.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-500">No neuron changed its spike count.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-700 text-left text-[12px] text-ink-500">
                  <th className="py-1 font-normal">Neuron</th>
                  <th className="py-1 text-right font-normal">Control</th>
                  <th className="py-1 text-right font-normal">Change</th>
                  <th className="py-1 text-right font-normal">Δ</th>
                </tr>
              </thead>
              <tbody>
                {topChanges.map((d) => {
                  const n = neuronById.get(d.neuronId)!;
                  return (
                    <tr key={d.neuronId} className="border-b border-ink-800">
                      <td className="py-1">
                        <button type="button" onClick={() => selectNeuron(n.id)} className="flex items-center gap-1.5 font-mono text-ink-200 hover:text-white hover:underline">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: classById.get(n.classId)!.color }} />
                          {n.label}
                          {n.id === record.config.targetNeuronId && <span className="text-[11px] text-ink-500">target</span>}
                        </button>
                      </td>
                      <td className="num py-1 text-right text-ink-400">{d.baseline}</td>
                      <td className="num py-1 text-right text-ink-200">{d.intervention}</td>
                      <td className="num py-1 text-right">
                        <Delta value={d.delta} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-1.5 text-[12px] text-ink-500">
            {record.summary.neuronDeltas.length} neurons changed in total. Click one to see its voltage.
          </p>
        </Card>
      </div>
    </div>
  );
}
