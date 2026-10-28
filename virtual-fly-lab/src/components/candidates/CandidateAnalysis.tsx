import type { Data, Layout } from 'plotly.js';
import { ArrowDown, ArrowUp, Loader2, ListOrdered, Play, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { validateExperimentConfig } from '../../simulation/experiment';
import { MAX_CANDIDATES } from '../../simulation/screening';
import { useLabStore } from '../../store/labStore';
import type { CandidateResult, ScreeningRequest } from '../../types/simulation';
import { pct } from '../../utils/format';
import { lookup } from '../../utils/networkLookup';
import { EmptyState } from '../common/EmptyState';
import { PlotlyChart } from '../common/PlotlyChart';
import { Card } from '../common/Section';
import { Delta } from '../results/ExperimentSummary';

type SortKey = 'absDelta' | 'delta' | 'percentChange' | 'totalDelta' | 'neuronId';
const ALL_OUTSIDE = '__outside__';
const CHART_TOP = 20;

/** Brute-force perturbation screen ranking neurons by their effect on an output population. */
export function CandidateAnalysis() {
  const network = useLabStore((s) => s.network);
  const config = useLabStore((s) => s.config);
  const screening = useLabStore((s) => s.screening);
  const runScreening = useLabStore((s) => s.runScreening);
  const updateConfig = useLabStore((s) => s.updateConfig);
  const selectNeuron = useLabStore((s) => s.selectNeuron);
  const setTab = useLabStore((s) => s.setTab);
  const [outputId, setOutputId] = useState(config.outputPopulationId);
  const [candidateSet, setCandidateSet] = useState(ALL_OUTSIDE);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'absDelta', desc: true });
  const { neuronById, classById } = lookup(network);

  const output = network.populations.find((p) => p.id === outputId)!;
  const candidateIds = useMemo(() => {
    const outside = new Set(output.neuronIds);
    return network.neurons
      .filter((n) => !outside.has(n.id) && (candidateSet === ALL_OUTSIDE || n.classId === candidateSet))
      .map((n) => n.id)
      .slice(0, MAX_CANDIDATES);
  }, [network, output, candidateSet]);

  const configErrors = Object.entries(validateExperimentConfig(config, network)).filter(([k]) => k !== 'targetNeuronId' && k !== 'outputPopulationId');
  const running = screening.status === 'running';
  const request: ScreeningRequest = {
    candidateIds,
    outputPopulationId: outputId,
    mode: config.mode,
    stimStartMs: config.stimStartMs,
    stimDurationMs: config.stimDurationMs,
    intensity: config.intensity,
    durationMs: config.durationMs,
    dt: config.dt,
    seed: config.seed,
  };
  const last = screening.request;
  const stale =
    last !== null &&
    screening.status === 'complete' &&
    (['mode', 'stimStartMs', 'stimDurationMs', 'intensity', 'durationMs', 'dt', 'seed'] as const).some((k) => last[k] !== config[k]);

  const sorted = useMemo(() => {
    const val = (r: CandidateResult) => (sort.key === 'neuronId' ? 0 : (r[sort.key] ?? -Infinity));
    return screening.results.slice().sort((x, y) => {
      if (sort.key === 'neuronId') return sort.desc ? y.neuronId.localeCompare(x.neuronId) : x.neuronId.localeCompare(y.neuronId);
      return sort.desc ? val(y) - val(x) : val(x) - val(y);
    });
  }, [screening.results, sort]);

  const chart = useMemo(() => {
    const top = screening.results.slice(0, CHART_TOP);
    const data: Data[] = [
      {
        type: 'bar',
        orientation: 'h',
        y: top.map((r) => neuronById.get(r.neuronId)!.label),
        x: top.map((r) => r.delta),
        marker: { color: top.map((r) => (r.delta >= 0 ? '#3987e5' : '#d95926')) },
        customdata: top.map((r) => r.neuronId),
        hovertemplate: '%{y} (%{customdata})<br>Δ output spikes: %{x:+d}<extra></extra>',
      },
    ];
    const layout: Partial<Layout> = {
      showlegend: false,
      xaxis: { title: { text: 'Δ output spikes (intervention − baseline)' }, zeroline: true, zerolinecolor: '#5b5f66' },
      yaxis: { autorange: 'reversed', automargin: true, tickfont: { family: 'ui-monospace, Consolas, monospace', size: 10.5 } },
      margin: { l: 80, r: 12, t: 8, b: 40 },
      bargap: 0.3,
    };
    return { data, layout };
  }, [screening.results, neuronById]);

  const load = (r: CandidateResult) => {
    const req = screening.request!;
    updateConfig({
      targetNeuronId: r.neuronId,
      outputPopulationId: req.outputPopulationId,
      mode: req.mode,
      stimStartMs: req.stimStartMs,
      stimDurationMs: req.stimDurationMs,
      intensity: req.intensity,
      durationMs: req.durationMs,
      dt: req.dt,
      seed: req.seed,
    });
    selectNeuron(r.neuronId);
    setTab('experiments');
  };

  const header = (key: SortKey, label: string, right = true) => (
    <th className={`py-1 font-normal ${right ? 'text-right' : ''}`} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        className={`inline-flex items-center gap-0.5 hover:text-ink-200 ${sort.key === key ? 'text-ink-200' : ''}`}
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'neuronId' }))}
      >
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={11} aria-hidden /> : <ArrowUp size={11} aria-hidden />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <Card title="Candidate screening" subtitle="Rank neurons by how strongly perturbing them changes the activity of an output population in this toy model.">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr]">
          <label className="block text-[11.5px] text-ink-300">
            Output population
            <select className="field-input mt-1" value={outputId} onChange={(e) => setOutputId(e.target.value)}>
              {network.populations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.neuronIds.length})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11.5px] text-ink-300">
            Candidate neurons
            <select className="field-input mt-1" value={candidateSet} onChange={(e) => setCandidateSet(e.target.value)}>
              <option value={ALL_OUTSIDE}>All neurons outside the output population</option>
              {network.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Class {c.id} · {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-[11.5px] text-ink-300">
            Intervention (from the Experiment panel)
            <p className="num mt-1 rounded border border-ink-800 bg-ink-950/60 px-2 py-1 text-[11.5px] text-ink-200">
              {config.mode === 'excite' ? 'Excite' : 'Suppress'} {config.intensity} mV · {config.stimStartMs}–{config.stimStartMs + config.stimDurationMs} ms · run {config.durationMs} ms · dt {config.dt} · seed {config.seed}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={running || candidateIds.length === 0 || configErrors.length > 0}
            onClick={() => void runScreening(request)}
          >
            {running ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Play size={13} aria-hidden />}
            {running ? 'Screening…' : `Screen ${candidateIds.length} candidates`}
          </button>
          <span className="num text-[11px] text-ink-500">
            {candidateIds.length + 1} simulations ({candidateIds.length} interventions + 1 shared baseline)
          </span>
          {configErrors.length > 0 && (
            <span className="text-[11px] text-[#e59a6a]" role="alert">
              Fix the Experiment panel first: {configErrors[0][1]}
            </span>
          )}
        </div>

        {running && (
          <div className="mt-3" role="status" aria-live="polite">
            <div className="mb-1 flex justify-between text-[11px] text-ink-400">
              <span>Running candidate simulations in a background worker…</span>
              <span className="num">
                {screening.done} / {screening.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-ink-800">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${screening.total ? (screening.done / screening.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        {screening.status === 'error' && (
          <p className="mt-3 text-[12px] text-[#e59a6a]" role="alert">
            Screening failed: {screening.error}
          </p>
        )}
      </Card>

      {screening.status === 'complete' && screening.request ? (
        <>
          {stale && (
            <p className="rounded border border-ink-700 bg-ink-900 px-3 py-2 text-[11.5px] text-ink-300">
              Intervention settings have changed since this screen ran. The ranking below reflects the earlier settings; loading a candidate restores them.
            </p>
          )}
          <div className="grid gap-3 xl:grid-cols-[2fr_3fr]">
            <Card
              title={`Top ${Math.min(CHART_TOP, screening.results.length)} by |Δ output|`}
              subtitle={`Output: ${network.populations.find((p) => p.id === screening.request!.outputPopulationId)!.label}. Baseline output: ${screening.results[0]?.baselineOutput ?? 0} spikes.`}
            >
              <PlotlyChart data={chart.data} layout={chart.layout} height={Math.max(220, Math.min(CHART_TOP, screening.results.length) * 20 + 60)} ariaLabel="Candidate ranking chart" />
              <p className="mt-1 text-[10.5px] text-ink-500">Blue: output increased. Orange: output decreased.</p>
            </Card>
            <Card title="Ranking table" subtitle="Click a column to sort. Load a candidate to inspect it as a full experiment.">
              <div className="max-h-[440px] overflow-auto">
                <table className="w-full min-w-[560px] text-[12px]">
                  <thead className="sticky top-0 bg-ink-900">
                    <tr className="border-b border-ink-700 text-left text-[11px] text-ink-500">
                      <th className="py-1 font-normal">#</th>
                      {header('neuronId', 'Neuron', false)}
                      {header('delta', 'Δ output')}
                      {header('absDelta', '|Δ|')}
                      {header('percentChange', '% change')}
                      {header('totalDelta', 'Δ network')}
                      <th className="py-1 text-right font-normal">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => {
                      const n = neuronById.get(r.neuronId)!;
                      const rank = screening.results.indexOf(r) + 1;
                      return (
                        <tr key={r.neuronId} className="border-b border-ink-800 hover:bg-ink-850">
                          <td className="num py-1 text-ink-500">{rank}</td>
                          <td className="py-1">
                            <button type="button" onClick={() => selectNeuron(n.id)} className="flex items-center gap-1.5 font-mono text-ink-200 hover:text-white hover:underline">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: classById.get(n.classId)!.color }} />
                              {n.label}
                              <span className="text-[10.5px] text-ink-500">{n.id}</span>
                            </button>
                          </td>
                          <td className="num py-1 text-right"><Delta value={r.delta} /></td>
                          <td className="num py-1 text-right text-ink-200">{r.absDelta}</td>
                          <td className="num py-1 text-right text-ink-400">{pct(r.percentChange)}</td>
                          <td className="num py-1 text-right text-ink-400">{r.totalDelta > 0 ? '+' : ''}{r.totalDelta}</td>
                          <td className="py-1 text-right">
                            <button type="button" className="btn btn-ghost h-6 px-1.5 text-[11px]" onClick={() => load(r)} aria-label={`Load ${n.label} into experiment configuration`}>
                              <Upload size={12} aria-hidden /> Load
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      ) : (
        !running && (
          <Card title="Ranking">
            <EmptyState icon={ListOrdered} title="No screen has been run">
              Choose an output population and a candidate set, then run the screen. Each candidate receives the intervention configured in the Experiment panel.
            </EmptyState>
          </Card>
        )
      )}

      <Card title="Method and limitations">
        <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-ink-300">
          <li>One baseline run (no intervention) is simulated with the current seed, length and time step.</li>
          <li>For each candidate, the same intervention is applied to that neuron alone, with identical background input (same seed).</li>
          <li>
            Response metric: <span className="font-mono text-ink-100">Δ = output spikes(intervention) − output spikes(baseline)</span>, summed over the
            whole run. Candidates are ranked by <span className="font-mono text-ink-100">|Δ|</span>.
          </li>
        </ol>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-ink-400">
          <li>This is an exhaustive single-neuron perturbation screen, not machine learning or optimisation. Combinations of neurons are not tested.</li>
          <li>Each value comes from one deterministic simulation; with a different seed the ranking may change. No statistical test is applied, so differences are not described as significant.</li>
          <li>Rankings depend on the toy LIF parameters and the synthetic, illustrative connectivity. They are model predictions, not evidence of biological causality.</li>
          <li>Output-population neurons are excluded from the candidate set so direct stimulation of the readout is not counted as an effect.</li>
        </ul>
      </Card>
    </div>
  );
}
