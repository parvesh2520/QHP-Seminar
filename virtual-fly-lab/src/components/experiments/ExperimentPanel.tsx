import { Loader2, Play, RotateCcw, Target } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { PARAM_LIMITS, validateExperimentConfig } from '../../simulation/experiment';
import { useLabStore } from '../../store/labStore';
import { TIME_STEP_OPTIONS, type ExperimentConfig, type TimeStep } from '../../types/simulation';
import { lookup } from '../../utils/networkLookup';
import { InfoHint } from '../common/InfoHint';
import { Section } from '../common/Section';

/** Right sidebar: experiment configuration bound to the real simulation engine. */
export function ExperimentPanel() {
  const network = useLabStore((s) => s.network);
  const config = useLabStore((s) => s.config);
  const update = useLabStore((s) => s.updateConfig);
  const resetConfig = useLabStore((s) => s.resetConfig);
  const runExperiment = useLabStore((s) => s.runExperiment);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const running = useLabStore((s) => s.experiments.some((e) => e.status === 'running'));
  const errors = useMemo(() => validateExperimentConfig(config, network), [config, network]);
  const valid = Object.keys(errors).length === 0;
  const { classById, neuronById } = lookup(network);
  const steps = Math.round(config.durationMs / config.dt);

  const numberProps = (key: keyof ExperimentConfig, label: string) => ({
    'aria-label': label,
    value: Number.isFinite(config[key] as number) ? (config[key] as number) : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => update({ [key]: e.target.valueAsNumber } as Partial<ExperimentConfig>),
    'aria-invalid': Boolean(errors[key]),
  });

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      aria-label="Experiment configuration"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !running) void runExperiment();
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Intervention">
          <Field label="Target neuron" hint="The neuron receiving the external current. Select from the list or use the neuron selected in the explorer." error={errors.targetNeuronId}>
            <div className="flex gap-1">
              <select aria-label="Target neuron" className="field-input font-mono" value={config.targetNeuronId} onChange={(e) => update({ targetNeuronId: e.target.value })}>
                {network.classes.map((c) => (
                  <optgroup key={c.id} label={`${c.id} · ${c.label}`}>
                    {network.neurons
                      .filter((n) => n.classId === c.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.id} · {n.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-default shrink-0 px-2"
                disabled={!selectedId || selectedId === config.targetNeuronId}
                onClick={() => selectedId && update({ targetNeuronId: selectedId })}
                title={selectedId ? `Use selected neuron ${selectedId}` : 'No neuron selected'}
                aria-label="Use selected neuron as target"
              >
                <Target size={13} aria-hidden />
              </button>
            </div>
            {neuronById.get(config.targetNeuronId) && (
              <div className="mt-1 text-[11px] text-ink-500">
                {classById.get(neuronById.get(config.targetNeuronId)!.classId)!.label}
              </div>
            )}
          </Field>

          <Field
            label="Mode"
            hint="Excite: depolarising external current of the given intensity. Suppress: hyperpolarising current of the same magnitude; the neuron can still fire if synaptic input overcomes it."
          >
            <div className="grid grid-cols-2 gap-1 rounded border border-ink-700 bg-ink-900 p-0.5" role="radiogroup" aria-label="Intervention mode">
              {(['excite', 'suppress'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={config.mode === m}
                  onClick={() => update({ mode: m })}
                  className={`h-6 rounded text-[12px] font-medium ${config.mode === m ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}
                >
                  {m === 'excite' ? 'Excite' : 'Suppress'}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Start (ms)" hint="Time at which the external current switches on." error={errors.stimStartMs}>
              <input type="number" className="field-input num" min={0} step={10} {...numberProps('stimStartMs', 'Stimulation start (ms)')} />
            </Field>
            <Field label="Duration (ms)" hint="How long the external current is applied." error={errors.stimDurationMs}>
              <input type="number" className="field-input num" min={1} step={10} {...numberProps('stimDurationMs', 'Stimulation duration (ms)')} />
            </Field>
          </div>

          <Field
            label="Intensity (mV)"
            hint={`Magnitude of the external drive, in voltage-equivalent units: a steady drive of D mV shifts the target's steady-state membrane potential by D mV. With default parameters about 15 mV is needed to reach threshold from rest. Range ${PARAM_LIMITS.intensity.min}–${PARAM_LIMITS.intensity.max}.`}
            error={errors.intensity}
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                className="flex-1 accent-[#3987e5]"
                min={PARAM_LIMITS.intensity.min}
                max={PARAM_LIMITS.intensity.max}
                step={1}
                value={Number.isFinite(config.intensity) ? config.intensity : 0}
                onChange={(e) => update({ intensity: e.target.valueAsNumber })}
                aria-label="Intensity slider"
              />
              <input type="number" className="field-input num w-16" step={1} {...numberProps('intensity', 'Intensity (mV)')} />
            </div>
          </Field>
        </Section>

        <Section title="Simulation">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Length (ms)" hint={`Total simulated time, ${PARAM_LIMITS.durationMs.min}–${PARAM_LIMITS.durationMs.max} ms.`} error={errors.durationMs}>
              <input type="number" className="field-input num" step={100} {...numberProps('durationMs', 'Simulation length (ms)')} />
            </Field>
            <Field label="Time step" hint="Forward-Euler integration step. Smaller steps are more accurate but slower. Baseline and intervention always share the same step." error={errors.dt}>
              <select aria-label="Time step" className="field-input num" value={config.dt} onChange={(e) => update({ dt: Number(e.target.value) as TimeStep })}>
                {TIME_STEP_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} ms
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Output population" hint="Group of neurons whose spike count is reported as the experiment's output measure." error={errors.outputPopulationId}>
            <select aria-label="Output population" className="field-input" value={config.outputPopulationId} onChange={(e) => update({ outputPopulationId: e.target.value })}>
              {network.populations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.neuronIds.length})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Random seed" hint="Seeds the background Poisson input and initial potentials. Identical settings and seed give identical results; baseline and intervention share the seed." error={errors.seed}>
            <input type="number" className="field-input num" min={0} step={1} {...numberProps('seed', 'Random seed')} />
          </Field>
          <p className="num text-[11px] text-ink-500">
            {Number.isFinite(steps) ? steps.toLocaleString() : '—'} steps × {network.neurons.length} neurons × 2 runs
          </p>
        </Section>

        <Section title="Mechanism" className="border-b-0">
          <p className="text-[11.5px] leading-relaxed text-ink-400">
            {config.mode === 'excite' ? 'A constant depolarising current' : 'A constant hyperpolarising current'} of{' '}
            <span className="num text-ink-200">{Number.isFinite(config.intensity) ? config.intensity : '—'} mV</span> is added to the target's membrane equation from{' '}
            <span className="num text-ink-200">{config.stimStartMs}</span> to{' '}
            <span className="num text-ink-200">{config.stimStartMs + config.stimDurationMs} ms</span>. A matched baseline without the current is run with the same seed. This is a simplified current injection, not a model of optogenetic opsin kinetics.
          </p>
        </Section>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-ink-800 bg-ink-900 p-3">
        <button type="button" className="btn btn-default" onClick={resetConfig}>
          <RotateCcw size={13} aria-hidden /> Reset parameters
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={!valid || running}>
          {running ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Play size={13} aria-hidden />}
          {running ? 'Running…' : 'Run experiment'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center gap-1 text-[11.5px] text-ink-300">
        {label}
        {hint && <InfoHint text={hint} label={`About ${label}`} />}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-[11px] text-[#e59a6a]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
