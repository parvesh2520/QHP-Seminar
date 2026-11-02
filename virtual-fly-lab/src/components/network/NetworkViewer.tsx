import { Canvas } from '@react-three/fiber';
import { Activity, ChevronDown, Crosshair, MousePointerClick, Pause, Play, RotateCcw, Tag, Waypoints } from 'lucide-react';
import { useRef, useState } from 'react';
import { selectActiveExperiment, useLabStore, type ViewToggle } from '../../store/labStore';
import { lookup } from '../../utils/networkLookup';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { DEFAULT_CAMERA, NetworkScene } from './NetworkScene';
import { VIEW_COLORS } from './networkGeometry';

const TOGGLES: { key: ViewToggle; label: string; icon: typeof Activity }[] = [
  { key: 'showEdges', label: 'Connections', icon: Waypoints },
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
    <div className="relative h-full min-h-[360px] w-full overflow-hidden bg-ink-950" aria-label="Brain circuit map">
      <ErrorBoundary
        fallback={(err) => (
          <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-ink-400">
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
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex max-w-[60%] flex-col gap-2">
        <div className="text-[13px] text-ink-300">
          {network.metadata.source === 'connectome-subset' ? (
            <>
              <span className="text-ink-100">Real fruit fly brain</span> <span className="text-ink-500">· {network.neurons.length} neurons from FlyWire, at their true positions</span>
            </>
          ) : (
            <>
              <span className="text-ink-100">Simple demo network</span> <span className="text-ink-500">· {network.neurons.length} neurons, arranged for clarity</span>
            </>
          )}
        </div>
        {selected ? (
          <div className="pointer-events-auto w-72 rounded-lg border border-ink-700 bg-ink-900/90 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[14px] font-medium text-ink-100">{selected.label}</span>
              <span className="truncate font-mono text-[12px] text-ink-500">{selected.id}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: classById.get(selected.classId)!.color }} />
              {classById.get(selected.classId)!.label}
            </div>
            {classById.get(selected.classId)!.role && <p className="mt-1 text-[13px] text-ink-400">{classById.get(selected.classId)!.role}</p>}
            <div className="mt-2 flex gap-4 border-t border-ink-800 pt-2 text-[13px]">
              <span>
                <span className="text-incoming">Receives from</span> <span className="num text-ink-100">{network.incoming[idx].length}</span>
              </span>
              <span>
                <span className="text-outgoing">Sends to</span> <span className="num text-ink-100">{network.outgoing[idx].length}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex w-72 items-start gap-2 rounded-lg border border-dashed border-ink-700 bg-ink-900/80 px-4 py-3 text-[13px] text-ink-400">
            <MousePointerClick size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
            Click any dot to see what that neuron does and what it is connected to
          </div>
        )}
      </div>

      {/* View toggles */}
      <div className="absolute right-4 top-4 z-20 flex gap-1 rounded-lg border border-ink-700 bg-ink-900/90 p-1" role="toolbar" aria-label="View options">
        {TOGGLES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view[key]}
            onClick={() => toggleView(key)}
            className={`btn h-7 border-transparent px-2 ${view[key] ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {/* Signal path legend: classes in the order signals travel */}
      <details open className="group absolute bottom-4 left-4 z-20 hidden w-80 rounded-lg border border-ink-700 bg-ink-900/95 text-[13px] md:block">
        <summary className="flex items-center justify-between px-4 py-2 text-ink-100 hover:text-white">
          How signals flow
          <ChevronDown size={16} strokeWidth={1.5} className="text-ink-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="px-4 pb-3">
        <ol className="space-y-1">
          {network.classes.map((c) => (
            <li key={c.id} className="grid grid-cols-[12px_44px_1fr] items-baseline gap-2">
              <span className="h-2.5 w-2.5 translate-y-px rounded-full" style={{ background: c.color }} />
              <span className="font-mono text-[12px] text-ink-300">{c.id}</span>
              <span className="text-ink-400">
                {c.role ?? c.label}
                {c.transmitter === 'inhibitory' && <span className="text-[#d39494]"> · calms</span>}
                              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-ink-800 pt-2 text-[12px] text-ink-400">
          <LegendLine color={VIEW_COLORS.incoming} label="Input to selected" />
          <LegendLine color={VIEW_COLORS.outgoing} label="Output of selected" />
          <LegendLine color={VIEW_COLORS.edgeExc} label="Excites" />
          <LegendLine color={VIEW_COLORS.edgeInh} label="Inhibits" />
        </div>
        </div>
      </details>

      {/* Camera + playback controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        {view.showActivity && playback && active && (
          <div className="pointer-events-none text-[12px] text-ink-400">Replaying {active.id} at 1/10 speed · flashes are spikes</div>
        )}
        {view.showActivity && !playback && <div className="pointer-events-none text-[12px] text-ink-500">Run an experiment to replay its activity here</div>}
        <div className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/90 p-1">
          {view.showActivity && playback && (
            <>
              <span ref={timeRef} className="num w-[86px] whitespace-pre px-1 text-[12px] text-ink-300" />
              <button type="button" className="btn btn-ghost h-7 px-1.5" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause activity playback' : 'Resume activity playback'}>
                {playing ? <Pause size={16} strokeWidth={1.5} aria-hidden /> : <Play size={16} strokeWidth={1.5} aria-hidden />}
              </button>
              <button type="button" className="btn btn-ghost h-7 px-1.5" onClick={() => setRestartToken((t) => t + 1)} aria-label="Restart activity playback">
                <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
              </button>
              <span className="mx-0.5 h-4 w-px bg-ink-700" />
            </>
          )}
          <button type="button" className="btn btn-ghost h-7 px-2" onClick={focusSelected} disabled={!selected}>
            <Crosshair size={16} strokeWidth={1.5} aria-hidden /> Center
          </button>
          <button type="button" className="btn btn-ghost h-7 px-2" onClick={resetCamera}>
            <RotateCcw size={16} strokeWidth={1.5} aria-hidden /> Reset camera
          </button>
        </div>
      </div>

    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 shrink-0" style={{ background: color }} />
      {label}
    </div>
  );
}
