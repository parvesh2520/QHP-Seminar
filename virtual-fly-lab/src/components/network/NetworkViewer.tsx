import { Canvas } from '@react-three/fiber';
import { ChevronDown, MousePointerClick, Pause, Play, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLabStore } from '../../store/labStore';
import { lookup } from '../../utils/networkLookup';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { DEFAULT_CAMERA, NetworkScene } from './NetworkScene';
import { VIEW_COLORS } from './networkGeometry';

/** Interactive 3D view of the brain circuit, with replay of the latest experiment. */
export function NetworkViewer() {
  const network = useLabStore((s) => s.network);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const resetCamera = useLabStore((s) => s.resetCamera);
  const experiment = useLabStore((s) => s.experiment);
  const [playing, setPlaying] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const timeRef = useRef<HTMLSpanElement>(null);

  const { neuronById, classById } = lookup(network);
  const selected = selectedId ? neuronById.get(selectedId) : undefined;
  const selectedClass = selected ? classById.get(selected.classId) : undefined;
  const idx = selected ? network.indexById.get(selected.id)! : -1;
  const playback = experiment?.status === 'complete' ? (experiment.intervention ?? null) : null;

  // Each new experiment starts paused at t = 0 until the user presses play.
  const [shownPlayback, setShownPlayback] = useState(playback);
  if (playback !== shownPlayback) {
    setShownPlayback(playback);
    setPlaying(false);
  }

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

      <div className="pointer-events-none absolute left-5 top-5 z-20 flex max-w-[70%] flex-col gap-3">
        <div className="text-[13px] text-ink-400">
          <span className="text-ink-100">{network.neurons.length} real neurons</span> from the FlyWire fruit fly brain map · drag to rotate, scroll to zoom
        </div>
        {selected && selectedClass ? (
          <div className="pointer-events-auto w-72 rounded-xl border border-ink-700 bg-ink-900/90 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[14px] font-medium text-ink-100">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selectedClass.color }} />
              {selectedClass.role ?? selectedClass.label}
            </div>
            <div className="mt-1 text-[12px] text-ink-400">
              {selectedClass.label} · <span className="font-mono">{selected.label}</span>
            </div>
            <div className="mt-2 flex gap-4 border-t border-ink-800 pt-2 text-[13px]">
              <span>
                <span className="text-incoming">Listens to</span> <span className="num text-ink-100">{network.incoming[idx].length}</span>
              </span>
              <span>
                <span className="text-outgoing">Talks to</span> <span className="num text-ink-100">{network.outgoing[idx].length}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex w-72 items-start gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/80 px-4 py-3 text-[13px] text-ink-400">
            <MousePointerClick size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
            Click any dot to pick that neuron
          </div>
        )}
      </div>

      <details className="group absolute bottom-5 left-5 z-20 hidden w-72 rounded-xl border border-ink-700 bg-ink-900/95 text-[13px] md:block">
        <summary className="flex items-center justify-between px-4 py-2.5 text-ink-200 hover:text-white">
          What the colours mean
          <ChevronDown size={16} strokeWidth={1.5} className="text-ink-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ol className="space-y-1.5 px-4 pb-3">
          {network.classes.map((c) => (
            <li key={c.id} className="flex items-baseline gap-2 text-ink-300">
              <span className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-full" style={{ background: c.color }} />
              {c.role ?? c.label}
            </li>
          ))}
        </ol>
      </details>

      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        {playback && <div className="pointer-events-none text-[12px] text-ink-400">Replaying your experiment, slowed down 10×</div>}
        <div className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/90 p-1">
          {playback && (
            <>
              <span ref={timeRef} className="num w-[86px] whitespace-pre px-1 text-[12px] text-ink-300" />
              <button type="button" className="btn btn-ghost h-7 px-1.5" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause replay' : 'Resume replay'}>
                {playing ? <Pause size={16} strokeWidth={1.5} aria-hidden /> : <Play size={16} strokeWidth={1.5} aria-hidden />}
              </button>
              <button type="button" className="btn btn-ghost h-7 px-1.5" onClick={() => setRestartToken((t) => t + 1)} aria-label="Restart replay">
                <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
              </button>
              <span className="mx-0.5 h-4 w-px bg-ink-700" />
            </>
          )}
          <button type="button" className="btn btn-ghost h-7 px-2" onClick={resetCamera}>
            Reset view
          </button>
        </div>
      </div>
    </div>
  );
}
