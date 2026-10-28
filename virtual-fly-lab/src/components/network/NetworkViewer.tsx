import { Canvas } from '@react-three/fiber';
import { Activity, Crosshair, MousePointerClick, Pause, Play, RotateCcw, Tag, Waypoints } from 'lucide-react';
import { useRef, useState } from 'react';
import { selectActiveExperiment, useLabStore, type ViewToggle } from '../../store/labStore';
import { lookup } from '../../utils/networkLookup';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { DEFAULT_CAMERA, NetworkScene } from './NetworkScene';
import { VIEW_COLORS } from './networkGeometry';

const TOGGLES: { key: ViewToggle; label: string; icon: typeof Activity }[] = [
  { key: 'showEdges', label: 'Edges', icon: Waypoints },
  { key: 'showLabels', label: 'Labels', icon: Tag },
  { key: 'showActivity', label: 'Activity', icon: Activity },
];

/** Interactive 3D view of the sample network with overlays and controls. */
export function NetworkViewer() {
  const network = useLabStore((s) => s.network);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const view = useLabStore((s) => s.view);
  const toggleView = useLabStore((s) => s.toggleView);
  const resetCamera = useLabStore((s) => s.resetCamera);
  const focusSelected = useLabStore((s) => s.focusSelected);
  const active = useLabStore(selectActiveExperiment);
  const [playing, setPlaying] = useState(true);
  const [restartToken, setRestartToken] = useState(0);
  const timeRef = useRef<HTMLSpanElement>(null);

  const { neuronById, classById } = lookup(network);
  const selected = selectedId ? neuronById.get(selectedId) : undefined;
  const idx = selected ? network.indexById.get(selected.id)! : -1;
  const playback = active?.status === 'complete' ? (active.intervention ?? null) : null;

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden bg-ink-950" aria-label="Sample neural network visualization">
      <ErrorBoundary
        fallback={(err) => (
          <div className="flex h-full items-center justify-center p-6 text-center text-[12px] text-ink-400">
            3D view unavailable: {err.message}. WebGL may be disabled in this browser.
          </div>
        )}
      >
        <Canvas camera={{ position: DEFAULT_CAMERA, fov: 45, near: 0.1, far: 100 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <color attach="background" args={[VIEW_COLORS.background]} />
          <NetworkScene playback={playback} playing={playing} restartToken={restartToken} timeReadoutRef={timeRef} />
        </Canvas>
      </ErrorBoundary>

      {/* Title + selection overlay */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[60%] flex-col gap-2">
        <div className="text-[11px] text-ink-300">
          {network.metadata.source === 'connectome-subset' ? (
            <span>
              🧠 <strong className="text-white">FlyWire Adult Drosophila Brain Connectome</strong>{' '}
              <span className="text-[#3cd094]">· FAFB/JRC2018 biological coordinates</span>
            </span>
          ) : (
            <span>
              Sample neural network visualization <span className="text-ink-500">· layout coordinates, not anatomy</span>
            </span>
          )}
        </div>
        {selected ? (
          <div className="w-60 rounded border border-ink-700 bg-ink-900/90 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] font-semibold text-ink-100">{selected.id}</span>
              <span className="font-mono text-[11px] text-ink-400">{selected.label}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-300">
              <span className="h-2 w-2 rounded-full" style={{ background: classById.get(selected.classId)!.color }} />
              {classById.get(selected.classId)!.label}
            </div>
            <div className="mt-1.5 flex gap-4 text-[11.5px]">
              <span>
                <span className="text-incoming">Incoming</span> <span className="num text-ink-100">{network.incoming[idx].length}</span>
              </span>
              <span>
                <span className="text-outgoing">Outgoing</span> <span className="num text-ink-100">{network.outgoing[idx].length}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex w-60 items-start gap-2 rounded border border-dashed border-ink-700 bg-ink-900/80 px-3 py-2 text-[11.5px] text-ink-400">
            <MousePointerClick size={14} className="mt-0.5 shrink-0" aria-hidden />
            No neuron selected. Click a node or choose one in the Network explorer.
          </div>
        )}
      </div>

      {/* View toggles */}
      <div className="absolute right-3 top-3 flex gap-1 rounded border border-ink-700 bg-ink-900/90 p-1" role="toolbar" aria-label="View options">
        {TOGGLES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view[key]}
            onClick={() => toggleView(key)}
            className={`btn h-6 border-transparent px-2 ${view[key] ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}
          >
            <Icon size={12} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 hidden rounded border border-ink-700 bg-ink-900/90 px-3 py-2 text-[11px] sm:block">
        <div className="panel-title mb-1.5">Legend</div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {network.classes.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 text-ink-300">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="font-mono">{c.id}</span>
              <span className="text-ink-500">{c.transmitter === 'inhibitory' ? 'inh.' : ''}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1 border-t border-ink-800 pt-1.5 text-ink-400">
          <LegendLine color={VIEW_COLORS.incoming} label="Input to selected" />
          <LegendLine color={VIEW_COLORS.outgoing} label="Output of selected" />
          <LegendLine color={VIEW_COLORS.edgeExc} label="Excitatory edge" />
          <LegendLine color={VIEW_COLORS.edgeInh} label="Inhibitory edge" />
          <div className="max-w-[210px] text-[10.5px] leading-snug text-ink-500">
            Highlighted edges brighten toward the postsynaptic neuron. Unrelated neurons are dimmed.
          </div>
        </div>
      </div>

      {/* Camera + playback controls */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
        {view.showActivity && playback && active && (
          <div className="pointer-events-none text-[10.5px] text-ink-500">Playback: {active.id} intervention run, slowed 10×</div>
        )}
        <div className="flex items-center gap-1 rounded border border-ink-700 bg-ink-900/90 p-1">
          {view.showActivity && playback && (
            <>
              <span ref={timeRef} className="num w-[86px] whitespace-pre px-1 text-[11px] text-ink-300" />
              <button type="button" className="btn btn-ghost h-6 px-1.5" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause activity playback' : 'Resume activity playback'}>
                {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
              </button>
              <button type="button" className="btn btn-ghost h-6 px-1.5" onClick={() => setRestartToken((t) => t + 1)} aria-label="Restart activity playback">
                <RotateCcw size={13} aria-hidden />
              </button>
              <span className="mx-0.5 h-4 w-px bg-ink-700" />
            </>
          )}
          <button type="button" className="btn btn-ghost h-6 px-2" onClick={focusSelected} disabled={!selected}>
            <Crosshair size={13} aria-hidden /> Center
          </button>
          <button type="button" className="btn btn-ghost h-6 px-2" onClick={resetCamera}>
            <RotateCcw size={13} aria-hidden /> Reset camera
          </button>
        </div>
      </div>

      {view.showActivity && !playback && (
        <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 rounded border border-ink-800 bg-ink-900/80 px-2.5 py-1 text-[11px] text-ink-500">
          Activity playback appears after an experiment has run.
        </div>
      )}
    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-0.5 w-4" style={{ background: color }} />
      {label}
    </div>
  );
}
