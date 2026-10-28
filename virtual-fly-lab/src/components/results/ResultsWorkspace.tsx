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
      <EmptyState icon={FlaskConical} title="No experiment selected">
        Configure an intervention in the Experiment panel and choose <span className="text-ink-200">Run experiment</span>. Each run simulates a
        matched baseline and the intervention, then compares them.
      </EmptyState>
    );
  }
  if (record.status === 'running') {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[12.5px] text-ink-300" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Simulating baseline and intervention for {record.id}…
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
      { name: 'Baseline', color: CONDITION_COLORS.baseline, result: record.baseline },
      { name: 'Intervention', color: CONDITION_COLORS.intervention, result: record.intervention },
    ],
    [record],
  );
  const topChanges = record.summary.neuronDeltas.slice(0, 12);

  return (
    <div className="space-y-3">
      <ExperimentSummary record={record} />

      <div className="grid gap-3 xl:grid-cols-[3fr_2fr]">
        <Card
          title="Population activity"
          subtitle="Baseline vs intervention, same axes."
          actions={
            <select aria-label="Population shown in activity chart" className="field-input h-6 w-44 text-[11.5px]" value={popId ?? ''} onChange={(e) => setPopId(e.target.value || null)}>
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
        <Card title="Spikes per population" subtitle="Whole-run spike counts.">
          <PopulationBarChart summary={record.summary} />
        </Card>
      </div>

      <Card title="Spike raster" subtitle="Each tick is one spike. Rows grouped by class; the stimulated neuron is drawn in white and marked with a dotted row line.">
        <div className="panel-title mb-1">Baseline</div>
        <RasterPlot result={record.baseline} network={network} targetId={record.config.targetNeuronId} title="Baseline" height={280} />
        <div className="panel-title mb-1 mt-3">Intervention</div>
        <RasterPlot result={record.intervention} network={network} targetId={record.config.targetNeuronId} title="Intervention" height={280} />
      </Card>

      <div className="grid gap-3 xl:grid-cols-[3fr_2fr]">
        <Card
          title="Selected neuron activity"
          subtitle={
            <>
              Membrane potential (sampled every <span className="num">{record.intervention.sampleIntervalMs.toFixed(2)} ms</span>); ticks above the threshold mark spike times.
            </>
          }
          actions={
            <select aria-label="Neuron shown in membrane trace" className="field-input h-6 w-44 font-mono text-[11.5px]" value={traceNeuronId} onChange={(e) => selectNeuron(e.target.value)}>
              {network.neurons.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id} · {n.label}
                  {n.id === record.config.targetNeuronId ? ' (target)' : ''}
                </option>
              ))}
            </select>
          }
        >
          <MembraneChart series={series} network={network} neuronId={traceNeuronId} />
        </Card>
        <Card title="Largest per-neuron changes" subtitle="Intervention minus baseline spike count.">
          {topChanges.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-ink-500">No neuron changed its spike count.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ink-700 text-left text-[11px] text-ink-500">
                  <th className="py-1 font-normal">Neuron</th>
                  <th className="py-1 text-right font-normal">Base</th>
                  <th className="py-1 text-right font-normal">Interv.</th>
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
                          {n.id === record.config.targetNeuronId && <span className="text-[10px] text-ink-500">target</span>}
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
          <p className="mt-1.5 text-[10.5px] text-ink-500">
            {record.summary.neuronDeltas.length} neuron(s) changed in total. Click a neuron to inspect its trace.
          </p>
        </Card>
      </div>
    </div>
  );
}
