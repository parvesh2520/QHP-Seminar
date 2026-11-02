import { ChevronRight, Loader2, Play, RotateCcw, Target } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { PARAM_LIMITS, validateExperimentConfig } from '../../simulation/experiment';
import { useLabStore } from '../../store/labStore';
import { TIME_STEP_OPTIONS, type ExperimentConfig, type TimeStep } from '../../types/simulation';
import { lookup } from '../../utils/networkLookup';
import { InfoHint } from '../common/InfoHint';

const MODES = [
  { id: 'excite', label: 'Excite', sub: 'Make it fire more' },
  { id: 'suppress', label: 'Suppress', sub: 'Make it fire less' },
] as const;

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
  const target = neuronById.get(config.targetNeuronId);
  const targetClass = target ? classById.get(target.classId) : undefined;
  const output = network.populations.find((p) => p.id === config.outputPopulationId);
  const stimEnd = config.stimStartMs + config.stimDurationMs;

  const numberProps = (key: keyof ExperimentConfig, label: string) => ({
    'aria-label': label,
    value: Number.isFinite(config[key] as number) ? (config[key] as number) : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => update({ [key]: e.target.valueAsNumber } as Partial<ExperimentConfig>),
    'aria-invalid': Boolean(errors[key]),
  });

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      aria-label="Experiment setup"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !running) void runExperiment();
      }}
    >
      <div className="shrink-0 border-b border-ink-800 px-4 py-4">
        <h2 className="text-[16px] font-medium text-ink-100">Experiment setup</h2>
        <p className="mt-1 text-[13px] text-ink-400">Change one neuron and see how the rest of the brain reacts</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Block n={1} title="Pick the target neuron">
          <div className="flex gap-2">
            <select aria-label="Target neuron" className="field-input font-mono" value={config.targetNeuronId} onChange={(e) => update({ targetNeuronId: e.target.value })}>
              {network.classes.map((c) => (
                <optgroup key={c.id} label={`${c.id} · ${c.label}`}>
                  {network.neurons
                    .filter((n) => n.classId === c.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
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
              title={selectedId ? `Use the neuron selected in the map (${selectedId})` : 'No neuron selected in the map'}
              aria-label="Use the neuron selected in the map"
            >
              <Target size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
          {targetClass && (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-400">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: targetClass.color }} />
              <span>
                {targetClass.label}
                {targetClass.role && <span className="text-ink-500"> · {targetClass.role}</span>}
              </span>
            </p>
          )}
          {errors.targetNeuronId && <ErrorText>{errors.targetNeuronId}</ErrorText>}
        </Block>

        <Block n={2} title="Choose what to do to it">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Intervention mode">
            {MODES.map((m) => {
              const on = config.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ mode: m.id })}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    on ? 'border-accent bg-ink-800' : 'border-ink-700 hover:border-ink-600 hover:bg-ink-850'
                  }`}
                >
                  <div className={`text-[14px] font-medium ${on ? 'text-ink-100' : 'text-ink-300'}`}>{m.label}</div>
                  <div className="text-[12px] text-ink-400">{m.sub}</div>
                </button>
              );
            })}
          </div>

          <Field
            label="Strength"
            hint={`How hard the neuron is pushed, in millivolts. About 15 mV is enough to make a resting neuron fire. Range ${PARAM_LIMITS.intensity.min} to ${PARAM_LIMITS.intensity.max}.`}
            error={errors.intensity}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                className="flex-1 accent-[#3987e5]"
                min={PARAM_LIMITS.intensity.min}
                max={PARAM_LIMITS.intensity.max}
                step={1}
                value={Number.isFinite(config.intensity) ? config.intensity : 0}
                onChange={(e) => update({ intensity: e.target.valueAsNumber })}
                aria-label="Strength slider"
              />
              <div className="w-24">
                <Unit unit="mV">
                  <input type="number" className="field-input num pr-9" step={1} {...numberProps('intensity', 'Strength (mV)')} />
                </Unit>
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Start at" hint="When the push switches on, in milliseconds from the start of the run." error={errors.stimStartMs}>
              <Unit unit="ms">
                <input type="number" className="field-input num pr-9" min={0} step={10} {...numberProps('stimStartMs', 'Start (ms)')} />
              </Unit>
            </Field>
            <Field label="Keep it on for" hint="How long the push lasts." error={errors.stimDurationMs}>
              <Unit unit="ms">
                <input type="number" className="field-input num pr-9" min={1} step={10} {...numberProps('stimDurationMs', 'Duration (ms)')} />
              </Unit>
            </Field>
          </div>
        </Block>

        <Block n={3} title="Choose what to measure">
          <select aria-label="Output population" className="field-input" value={config.outputPopulationId} onChange={(e) => update({ outputPopulationId: e.target.value })}>
            {network.populations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.neuronIds.length} neurons)
              </option>
            ))}
          </select>
          <p className="mt-2 text-[13px] text-ink-400">We count how many times these neurons fire</p>
          {errors.outputPopulationId && <ErrorText>{errors.outputPopulationId}</ErrorText>}
        </Block>

        <details className="group border-b border-ink-800 px-4 py-3">
          <summary className="flex items-center gap-2 text-[13px] text-ink-400 hover:text-ink-200">
            <ChevronRight size={16} strokeWidth={1.5} className="transition-transform group-open:rotate-90" aria-hidden />
            Advanced settings
          </summary>
          <div className="pb-1">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Run length" hint={`Total simulated time, ${PARAM_LIMITS.durationMs.min} to ${PARAM_LIMITS.durationMs.max} ms.`} error={errors.durationMs}>
                <Unit unit="ms">
                  <input type="number" className="field-input num pr-9" step={100} {...numberProps('durationMs', 'Run length (ms)')} />
                </Unit>
              </Field>
              <Field label="Time step" hint="Smaller steps are more accurate but slower. Both runs always share the same step." error={errors.dt}>
                <select aria-label="Time step" className="field-input num" value={config.dt} onChange={(e) => update({ dt: Number(e.target.value) as TimeStep })}>
                  {TIME_STEP_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} ms
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Random seed" hint="Controls the random background noise. Same settings and seed always give the same result." error={errors.seed}>
              <input type="number" className="field-input num" min={0} step={1} {...numberProps('seed', 'Random seed')} />
            </Field>
            <p className="num mt-2 text-[12px] text-ink-500">
              {Number.isFinite(steps) ? steps.toLocaleString() : '—'} steps × {network.neurons.length} neurons × 2 runs
            </p>
          </div>
        </details>

        <div className="px-4 py-4">
          <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-3 text-[13px] leading-relaxed text-ink-300">
            <div className="mb-1 text-ink-500">In plain words</div>
            {config.mode === 'excite' ? 'Turn up' : 'Turn down'} <span className="font-mono text-ink-100">{target?.label ?? '—'}</span> by{' '}
            <span className="num text-ink-100">{Number.isFinite(config.intensity) ? config.intensity : '—'} mV</span> from{' '}
            <span className="num text-ink-100">{config.stimStartMs}</span> to <span className="num text-ink-100">{Number.isFinite(stimEnd) ? stimEnd : '—'} ms</span>, then count
            spikes in <span className="text-ink-100">{output?.label ?? '—'}</span>. A second run without the push is the control.
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-ink-800 bg-ink-900 p-4">
        <button type="button" className="btn btn-ghost h-10 px-3" onClick={resetConfig} title="Reset parameters to defaults" aria-label="Reset parameters to defaults">
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button type="submit" className="btn btn-primary h-10 flex-1 text-[14px]" disabled={!valid || running}>
          {running ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} strokeWidth={1.5} aria-hidden />}
          {running ? 'Running…' : 'Run experiment'}
        </button>
      </div>
    </form>
  );
}

function Block({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-800 px-4 py-4" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-[14px] font-medium text-ink-100">
        <span className="step">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Unit({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-500">{unit}</span>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center gap-1 text-[13px] text-ink-300">
        {label}
        {hint && <InfoHint text={hint} label={`About ${label}`} />}
      </div>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-[12px] text-[#e59a6a]" role="alert">
      {children}
    </p>
  );
}
