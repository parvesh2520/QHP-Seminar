import { Html, OrbitControls } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Object3D, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useLabStore } from '../../store/labStore';
import type { SimulationResult } from '../../types/simulation';
import { lookup } from '../../utils/networkLookup';
import { baseNodeColors, classCentroids, edgeBuffers, relations } from './networkGeometry';

export const DEFAULT_CAMERA: [number, number, number] = [0, 0.6, 7.2];
const NODE_RADIUS = 0.065;
/** Simulated milliseconds shown per real second during activity playback. */
const PLAYBACK_MS_PER_SECOND = 100;
const ACTIVITY_DECAY_MS = 15;
const MAX_NEIGHBOUR_LABELS = 24;

interface SceneProps {
  playback: SimulationResult | null;
  playing: boolean;
  restartToken: number;
  timeReadoutRef: RefObject<HTMLSpanElement>;
}

export function NetworkScene({ playback, playing, restartToken, timeReadoutRef }: SceneProps) {
  const network = useLabStore((s) => s.network);
  const selectedId = useLabStore((s) => s.selectedNeuronId);
  const selectNeuron = useLabStore((s) => s.selectNeuron);
  const view = useLabStore((s) => s.view);
  const focusRequest = useLabStore((s) => s.focusRequest);
  const cameraResetRequest = useLabStore((s) => s.cameraResetRequest);

  const N = network.neurons.length;
  const selectedIndex = selectedId ? (network.indexById.get(selectedId) ?? null) : null;
  const rel = useMemo(() => relations(network, selectedIndex), [network, selectedIndex]);
  const baseColors = useMemo(() => baseNodeColors(network, rel), [network, rel]);
  const edges = useMemo(() => edgeBuffers(network, selectedIndex), [network, selectedIndex]);
  const centroids = useMemo(() => classCentroids(network), [network]);
  const [hovered, setHovered] = useState<number | null>(null);

  const meshRef = useRef<InstancedMesh>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();

  // --- Static node transforms and colours -----------------------------------------------
  const dummy = useMemo(() => new Object3D(), []);
  const scratch = useMemo(() => new Color(), []);
  const white = useMemo(() => new Color('#ffffff'), []);

  const applyNodes = (activity: Float32Array | null) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < N; i++) {
      const a = activity ? activity[i] : 0;
      const base = rel[i] === 'selected' ? 1.9 : rel[i] === 'connected' ? 1.25 : 1;
      dummy.position.set(...network.neurons[i].position);
      dummy.scale.setScalar(base * (1 + a * 0.7) * (hovered === i ? 1.3 : 1));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      scratch.copy(baseColors[i]).lerp(white, a * 0.75);
      mesh.setColorAt(i, scratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const activityOn = view.showActivity && playback !== null;
  useLayoutEffect(() => {
    if (!activityOn) applyNodes(null);
  });

  // --- Activity playback (driven per frame, no React re-renders) ------------------------
  const play = useRef({ t: 0, cursor: 0, lastSpike: new Float64Array(N).fill(-1e9), activity: new Float32Array(N) });
  useEffect(() => {
    play.current.t = 0;
    play.current.cursor = 0;
    play.current.lastSpike.fill(-1e9);
  }, [playback, restartToken]);

  // --- Camera animation ------------------------------------------------------------------
  const camAnim = useRef<{ target: Vector3; position: Vector3 } | null>(null);
  useEffect(() => {
    if (focusRequest === 0 || selectedIndex === null) return;
    const target = new Vector3(...network.neurons[selectedIndex].position);
    const dir = camera.position.clone().sub(controlsRef.current?.target ?? new Vector3()).normalize();
    camAnim.current = { target, position: target.clone().add(dir.multiplyScalar(3.2)) };
  }, [focusRequest]);
  useEffect(() => {
    camAnim.current = { target: new Vector3(0, -0.3, 0), position: new Vector3(...DEFAULT_CAMERA) };
  }, [cameraResetRequest]);

  useFrame((_, delta) => {
    const anim = camAnim.current;
    const controls = controlsRef.current;
    if (anim && controls) {
      const k = 1 - Math.exp(-delta * 7);
      controls.target.lerp(anim.target, k);
      camera.position.lerp(anim.position, k);
      controls.update();
      if (camera.position.distanceTo(anim.position) < 0.01) camAnim.current = null;
    }

    if (!activityOn || !playback) {
      if (timeReadoutRef.current) timeReadoutRef.current.textContent = '';
      return;
    }
    const p = play.current;
    const duration = playback.config.durationMs;
    if (playing) {
      p.t += Math.min(delta, 0.1) * PLAYBACK_MS_PER_SECOND;
      if (p.t >= duration) {
        p.t = 0;
        p.cursor = 0;
        p.lastSpike.fill(-1e9);
      }
    }
    while (p.cursor < playback.spikeTimes.length && playback.spikeTimes[p.cursor] <= p.t) {
      p.lastSpike[playback.spikeNeurons[p.cursor]] = playback.spikeTimes[p.cursor];
      p.cursor++;
    }
    for (let i = 0; i < N; i++) p.activity[i] = Math.exp(-Math.max(0, p.t - p.lastSpike[i]) / ACTIVITY_DECAY_MS);
    applyNodes(p.activity);
    if (timeReadoutRef.current) timeReadoutRef.current.textContent = `t = ${p.t.toFixed(0).padStart(4, ' ')} ms`;
  });

  useEffect(() => {
    gl.domElement.style.cursor = hovered !== null ? 'pointer' : 'grab';
  }, [hovered, gl]);

  // --- Labels ----------------------------------------------------------------------------
  const labelIndices = useMemo(() => {
    if (selectedIndex === null) return [];
    const neighbours = rel
      .map((r, i) => (r === 'connected' ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, MAX_NEIGHBOUR_LABELS);
    return [selectedIndex, ...neighbours];
  }, [rel, selectedIndex]);
  const { classById } = lookup(network);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) selectNeuron(network.neurons[e.instanceId].id);
  };

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      <directionalLight position={[-5, -2, -4]} intensity={0.3} />
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.12} minDistance={1.5} maxDistance={18} target={[0, -0.3, 0]} />
      <gridHelper args={[9, 18, '#232528', '#1a1b1e']} position={[0, -3.2, 0]} />

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, N]}
        onClick={onClick}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && e.instanceId !== hovered) setHovered(e.instanceId);
        }}
        onPointerOut={() => setHovered(null)}
      >
        <sphereGeometry args={[NODE_RADIUS, 16, 12]} />
        <meshLambertMaterial />
      </instancedMesh>

      {selectedIndex !== null && (
        <mesh position={network.neurons[selectedIndex].position}>
          <sphereGeometry args={[NODE_RADIUS * 3.2, 20, 14]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.22} />
        </mesh>
      )}

      {view.showEdges && (
        <>
          <Segments positions={edges.background.positions} colors={edges.background.colors} opacity={selectedIndex === null ? 0.35 : 0.12} />
          <Segments positions={edges.highlight.positions} colors={edges.highlight.colors} opacity={0.95} />
        </>
      )}

      {view.showLabels &&
        labelIndices.map((i) => {
          const n = network.neurons[i];
          return (
            <Html key={n.id} position={n.position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <span
                className={`relative -top-3.5 whitespace-nowrap font-mono text-[10px] ${i === selectedIndex ? 'font-semibold text-white' : 'text-ink-300'}`}
              >
                {n.label}
              </span>
            </Html>
          );
        })}
      {view.showLabels &&
        selectedIndex === null &&
        centroids.map((c) => (
          <Html key={c.id} position={c.position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <span className="whitespace-nowrap font-mono text-[10px] font-semibold" style={{ color: classById.get(c.id)!.color }}>
              {c.id}
            </span>
          </Html>
        ))}
      {hovered !== null && hovered !== selectedIndex && (
        <Html position={network.neurons[hovered].position} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span className="relative -top-4 whitespace-nowrap rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-100">
            {network.neurons[hovered].label} · {network.neurons[hovered].id}
          </span>
        </Html>
      )}
      <Html position={[-3.4, -3.1, 0]} center style={{ pointerEvents: 'none' }}>
        <span className="font-mono text-[10px] text-ink-500">L</span>
      </Html>
      <Html position={[3.4, -3.1, 0]} center style={{ pointerEvents: 'none' }}>
        <span className="font-mono text-[10px] text-ink-500">R</span>
      </Html>
    </>
  );
}

function Segments({ positions, colors, opacity }: { positions: Float32Array; colors: Float32Array; opacity: number }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (positions.length === 0) return null;
  return (
    <lineSegments geometry={geometry} raycast={() => null}>
      <lineBasicMaterial vertexColors transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}
