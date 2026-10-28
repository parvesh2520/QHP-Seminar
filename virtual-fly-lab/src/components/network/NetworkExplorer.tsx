import { Crosshair, Search, Target, X } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLabStore } from '../../store/labStore';
import type { Connection } from '../../types/network';
import { lookup } from '../../utils/networkLookup';
import { Section } from '../common/Section';

/** Left sidebar: searchable neuron list and selected-neuron details. */
export function NetworkExplorer() {
  const network = useLabStore((s) => s.network);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const selectNeuron = useLabStore((s) => s.selectNeuron);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { classById } = lookup(network);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return network.neurons.filter(
      (n) =>
        (!classFilter || n.classId === classFilter) &&
        (!q || n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || classById.get(n.classId)!.label.toLowerCase().includes(q)),
    );
  }, [network, query, classFilter, classById]);

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = filtered.findIndex((n) => n.id === selectedId);
    const next = filtered[Math.max(0, Math.min(filtered.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) {
      selectNeuron(next.id);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Section title="Network explorer" className="shrink-0">
        <label className="relative block">
          <span className="sr-only">Search neurons</span>
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            className="field-input pl-7"
            placeholder="Search ID, label or class"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Filter by class">
          <FilterChip active={classFilter === null} onClick={() => setClassFilter(null)}>All</FilterChip>
          {network.classes.map((c) => (
            <FilterChip key={c.id} active={classFilter === c.id} onClick={() => setClassFilter(classFilter === c.id ? null : c.id)} title={c.label}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
              {c.id}
            </FilterChip>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-ink-500">
          <span className="num">{filtered.length}</span> of <span className="num">{network.neurons.length}</span> neurons
        </div>
      </Section>

      <ul
        ref={listRef}
        className="min-h-[120px] flex-1 overflow-y-auto border-b border-ink-800 py-1"
        aria-label="Neurons"
        onKeyDown={onListKey}
      >
        {filtered.length === 0 && <li className="px-3 py-4 text-center text-[12px] text-ink-500">No neurons match this search.</li>}
        {filtered.map((n) => {
          const sel = n.id === selectedId;
          return (
            <li key={n.id}>
              <button
                type="button"
                data-id={n.id}
                aria-current={sel}
                onClick={() => selectNeuron(n.id)}
                className={`flex w-full items-center gap-2 px-3 py-[3px] text-left text-[12px] ${sel ? 'bg-ink-800 text-ink-100' : 'text-ink-300 hover:bg-ink-850'}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: classById.get(n.classId)!.color }} />
                <span className="font-mono text-[11.5px]">{n.id}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-400">{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <SelectedNeuronDetails />
    </div>
  );
}

function FilterChip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10.5px] ${
        active ? 'border-ink-500 bg-ink-700 text-ink-100' : 'border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200'
      }`}
    >
      {children}
    </button>
  );
}

function SelectedNeuronDetails() {
  const network = useLabStore((s) => s.network);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const selectNeuron = useLabStore((s) => s.selectNeuron);
  const focusSelected = useLabStore((s) => s.focusSelected);
  const targetId = useLabStore((s) => s.config.targetNeuronId);
  const updateConfig = useLabStore((s) => s.updateConfig);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const { neuronById, classById, populationsOf } = lookup(network);

  if (!selectedId) {
    return (
      <Section title="Selected neuron" className="shrink-0 border-b-0">
        <p className="text-[12px] text-ink-500">No neuron selected. Choose one from the list or click a node in the viewer.</p>
      </Section>
    );
  }
  const n = neuronById.get(selectedId)!;
  const i = network.indexById.get(n.id)!;
  const cls = classById.get(n.classId)!;
  const incoming = network.incoming[i].map((ci) => network.connections[ci]);
  const outgoing = network.outgoing[i].map((ci) => network.connections[ci]);
  const sumW = (cs: Connection[]) => cs.reduce((s, c) => s + (c.type === 'inhibitory' ? -c.weight : c.weight), 0);
  const list = (direction === 'in' ? incoming : outgoing).slice().sort((a, b) => b.weight - a.weight);

  return (
    <Section
      title="Selected neuron"
      className="max-h-[52%] shrink-0 overflow-y-auto border-b-0"
      actions={
        <button type="button" className="btn btn-ghost h-5 px-1" onClick={() => selectNeuron(null)} aria-label="Clear selection">
          <X size={12} />
        </button>
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[13px] font-semibold text-ink-100">{n.id}</span>
        <span className="font-mono text-[12px] text-ink-300">{n.label}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px]">
        <dt className="text-ink-500">Class</dt>
        <dd className="flex items-center gap-1.5 text-ink-200">
          <span className="h-2 w-2 rounded-full" style={{ background: cls.color }} />
          {cls.label} ({cls.transmitter})
        </dd>
        <dt className="text-ink-500">Hemisphere</dt>
        <dd className="text-ink-200">{n.hemisphere === 'L' ? 'Left' : 'Right'}</dd>
        <dt className="text-ink-500">Populations</dt>
        <dd className="text-ink-200">{(populationsOf.get(n.id) ?? []).map((p) => p.label).join(', ') || '—'}</dd>
        <dt className="text-ink-500">Threshold</dt>
        <dd className="num text-ink-200">{n.params.vThreshold} mV · τm {n.params.tauM} ms</dd>
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Incoming" value={incoming.length} sub={`net weight ${sumW(incoming).toFixed(1)}`} color="text-incoming" />
        <Stat label="Outgoing" value={outgoing.length} sub={`net weight ${sumW(outgoing).toFixed(1)}`} color="text-outgoing" />
      </div>

      <div className="mt-3 flex gap-1.5">
        <button type="button" className="btn btn-default flex-1" onClick={focusSelected}>
          <Crosshair size={13} aria-hidden /> Center in viewer
        </button>
        <button
          type="button"
          className="btn btn-default flex-1"
          onClick={() => updateConfig({ targetNeuronId: n.id })}
          disabled={targetId === n.id}
          title="Use this neuron as the stimulation target in the Experiment panel"
        >
          <Target size={13} aria-hidden /> {targetId === n.id ? 'Is target' : 'Set as target'}
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex gap-1" role="tablist" aria-label="Connection direction">
          {(['in', 'out'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={direction === d}
              onClick={() => setDirection(d)}
              className={`btn h-6 flex-1 ${direction === d ? 'btn-default text-ink-100' : 'btn-ghost'}`}
            >
              {d === 'in' ? `Presynaptic (${incoming.length})` : `Postsynaptic (${outgoing.length})`}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="py-2 text-[11.5px] text-ink-500">No {direction === 'in' ? 'incoming' : 'outgoing'} connections.</p>
        ) : (
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="py-1 font-normal">{direction === 'in' ? 'From' : 'To'}</th>
                <th className="py-1 font-normal">Type</th>
                <th className="py-1 text-right font-normal">Weight</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const otherId = direction === 'in' ? c.pre : c.post;
                const other = neuronById.get(otherId)!;
                return (
                  <tr key={`${c.pre}-${c.post}`} className="border-t border-ink-800">
                    <td className="py-0.5">
                      <button type="button" className="flex items-center gap-1.5 font-mono text-ink-200 hover:text-white hover:underline" onClick={() => selectNeuron(otherId)}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: classById.get(other.classId)!.color }} />
                        {other.label}
                      </button>
                    </td>
                    <td className={c.type === 'inhibitory' ? 'text-[#d39494]' : 'text-ink-400'}>{c.type === 'inhibitory' ? 'inh' : 'exc'}</td>
                    <td className="num text-right text-ink-200">{c.weight.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-1.5 text-[10.5px] text-ink-500">Weights are illustrative synaptic drive increments (mV), not measured synapse counts.</p>
      </div>
    </Section>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded border border-ink-800 bg-ink-900 px-2 py-1.5">
      <div className={`text-[10.5px] ${color}`}>{label}</div>
      <div className="num text-[16px] leading-tight text-ink-100">{value}</div>
      <div className="num text-[10.5px] text-ink-500">{sub}</div>
    </div>
  );
}
