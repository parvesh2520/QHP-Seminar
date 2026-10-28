/**
 * Synthetic demo network.
 *
 * A small, bilaterally organised network loosely inspired by the general
 * layout of insect sensory -> integrative -> descending pathways. Every
 * neuron, position, connection and weight is SYNTHETIC: generated
 * deterministically from the rules below with a fixed seed. Nothing here
 * corresponds to a reconstructed FlyWire neuron.
 */
import type {
  Connection,
  ConnectionType,
  Hemisphere,
  LIFParams,
  Network,
  NetworkDefinition,
  Neuron,
  NeuronClass,
  Population,
} from '../types/network';
import { DEFAULT_LIF_PARAMS, DEFAULT_SYNAPSE_PARAMS } from '../simulation/lifModel';
import { createRng, gaussian } from '../utils/random';
import { buildNetwork } from './networkLoader';

const NETWORK_SEED = 20240611;

interface ClassSpec extends NeuronClass {
  /** Neurons per hemisphere. */
  perSide: number;
  /** Layout centre for the left hemisphere; x is mirrored for the right. */
  center: [number, number, number];
  spread: [number, number, number];
  params: Partial<LIFParams>;
  backgroundRateHz: number;
}

// Colours: categorical palette (dark-surface steps), fixed class order.
const CLASS_SPECS: ClassSpec[] = [
  {
    id: 'SEN', label: 'Sensory afferent', transmitter: 'excitatory', color: '#3987e5',
    description: 'Input neurons receiving tonic background drive; entry point of the network.',
    perSide: 12, center: [-2.3, -1.2, 1.4], spread: [0.45, 0.35, 0.35],
    params: { tauM: 10 }, backgroundRateHz: 450,
  },
  {
    id: 'PN', label: 'Projection neuron', transmitter: 'excitatory', color: '#d95926',
    description: 'Relay sensory activity to integrative and convergence layers.',
    perSide: 8, center: [-1.7, -0.5, 0.7], spread: [0.3, 0.3, 0.3],
    params: {}, backgroundRateHz: 280,
  },
  {
    id: 'LN', label: 'Local interneuron', transmitter: 'inhibitory', color: '#199e70',
    description: 'Inhibitory interneurons providing lateral inhibition onto projection neurons.',
    perSide: 6, center: [-2.0, -0.9, 0.2], spread: [0.3, 0.25, 0.3],
    params: { tauM: 12 }, backgroundRateHz: 250,
  },
  {
    id: 'INT', label: 'Integrative interneuron', transmitter: 'excitatory', color: '#c98500',
    description: 'Sparse, convergent layer that pools projection-neuron input.',
    perSide: 16, center: [-1.3, 0.9, -0.2], spread: [0.5, 0.35, 0.45],
    params: { tauM: 18, vThreshold: -48 }, backgroundRateHz: 280,
  },
  {
    id: 'FBI', label: 'Feedback inhibitory', transmitter: 'inhibitory', color: '#d55181',
    description: 'Pools integrative activity and feeds inhibition back onto it (gain control).',
    perSide: 2, center: [-0.7, 1.4, 0.3], spread: [0.15, 0.15, 0.15],
    params: { tauM: 12 }, backgroundRateHz: 250,
  },
  {
    id: 'CON', label: 'Convergence neuron', transmitter: 'excitatory', color: '#008300',
    description: 'Read out integrative-layer activity and drive descending pathways.',
    perSide: 4, center: [-0.8, 0.2, -0.8], spread: [0.2, 0.25, 0.2],
    params: {}, backgroundRateHz: 330,
  },
  {
    id: 'DN', label: 'Descending neuron', transmitter: 'excitatory', color: '#9085e9',
    description: 'Output population: carries activity toward (simulated) motor circuits.',
    perSide: 5, center: [-0.35, -0.9, -1.1], spread: [0.15, 0.3, 0.2],
    params: {}, backgroundRateHz: 330,
  },
  {
    id: 'PMN', label: 'Premotor neuron', transmitter: 'excitatory', color: '#e66767',
    description: 'Output population downstream of descending neurons.',
    perSide: 6, center: [-0.6, -2.3, -1.4], spread: [0.25, 0.2, 0.25],
    params: { tauM: 12 }, backgroundRateHz: 300,
  },
];

interface ConnectionRule {
  pre: string;
  post: string;
  pIpsi: number;
  pContra: number;
  weight: number;
}

/** Class-level wiring rules: connection probability and mean weight (mV). */
const CONNECTION_RULES: ConnectionRule[] = [
  { pre: 'SEN', post: 'PN', pIpsi: 0.3, pContra: 0, weight: 16 },
  { pre: 'SEN', post: 'LN', pIpsi: 0.3, pContra: 0, weight: 12 },
  { pre: 'LN', post: 'PN', pIpsi: 0.5, pContra: 0, weight: 14 },
  { pre: 'LN', post: 'LN', pIpsi: 0.2, pContra: 0, weight: 8 },
  { pre: 'PN', post: 'LN', pIpsi: 0.2, pContra: 0, weight: 8 },
  { pre: 'PN', post: 'INT', pIpsi: 0.3, pContra: 0.04, weight: 18 },
  { pre: 'PN', post: 'CON', pIpsi: 0.12, pContra: 0, weight: 10 },
  { pre: 'INT', post: 'FBI', pIpsi: 0.6, pContra: 0.1, weight: 10 },
  { pre: 'FBI', post: 'INT', pIpsi: 0.6, pContra: 0.2, weight: 12 },
  { pre: 'INT', post: 'CON', pIpsi: 0.35, pContra: 0.05, weight: 16 },
  { pre: 'CON', post: 'DN', pIpsi: 0.45, pContra: 0.15, weight: 18 },
  { pre: 'CON', post: 'PMN', pIpsi: 0.2, pContra: 0, weight: 10 },
  { pre: 'DN', post: 'PMN', pIpsi: 0.5, pContra: 0.1, weight: 18 },
  { pre: 'DN', post: 'DN', pIpsi: 0, pContra: 0.2, weight: 8 },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function generateSampleNetworkDefinition(seed = NETWORK_SEED): NetworkDefinition {
  const rng = createRng(seed);
  const neurons: Neuron[] = [];
  const byClassSide = new Map<string, Neuron[]>();
  let serial = 1;

  for (const spec of CLASS_SPECS) {
    for (const side of ['L', 'R'] as Hemisphere[]) {
      const list: Neuron[] = [];
      for (let k = 0; k < spec.perSide; k++) {
        const sx = side === 'L' ? 1 : -1;
        const position: [number, number, number] = [
          round(sx * spec.center[0] + gaussian(rng) * spec.spread[0]),
          round(spec.center[1] + gaussian(rng) * spec.spread[1]),
          round(spec.center[2] + gaussian(rng) * spec.spread[2]),
        ];
        const neuron: Neuron = {
          id: `VFL-${String(serial++).padStart(4, '0')}`,
          label: `${spec.id}-${side}${pad(k + 1)}`,
          classId: spec.id,
          hemisphere: side,
          position,
          params: { ...DEFAULT_LIF_PARAMS, ...spec.params },
          backgroundRateHz: spec.backgroundRateHz,
        };
        list.push(neuron);
        neurons.push(neuron);
      }
      byClassSide.set(`${spec.id}:${side}`, list);
    }
  }

  const transmitter = new Map<string, ConnectionType>(CLASS_SPECS.map((c) => [c.id, c.transmitter]));
  const connections: Connection[] = [];
  for (const rule of CONNECTION_RULES) {
    for (const preSide of ['L', 'R'] as Hemisphere[]) {
      for (const postSide of ['L', 'R'] as Hemisphere[]) {
        const p = preSide === postSide ? rule.pIpsi : rule.pContra;
        if (p <= 0) continue;
        const pres = byClassSide.get(`${rule.pre}:${preSide}`) ?? [];
        const posts = byClassSide.get(`${rule.post}:${postSide}`) ?? [];
        for (const pre of pres) {
          for (const post of posts) {
            if (pre.id === post.id || rng() >= p) continue;
            // Log-normal-ish weight jitter around the rule mean.
            const weight = round(rule.weight * Math.exp(0.25 * gaussian(rng)));
            connections.push({ pre: pre.id, post: post.id, weight, type: transmitter.get(rule.pre)! });
          }
        }
      }
    }
  }

  const idsOf = (classIds: string[]) =>
    neurons.filter((n) => classIds.includes(n.classId)).map((n) => n.id);

  const populations: Population[] = [
    { id: 'pop-sensory', label: 'Sensory input', role: 'input', description: 'All sensory afferents (SEN).', neuronIds: idsOf(['SEN']) },
    { id: 'pop-relay', label: 'Relay layer', role: 'internal', description: 'Projection neurons and local interneurons (PN, LN).', neuronIds: idsOf(['PN', 'LN']) },
    { id: 'pop-integrative', label: 'Integrative layer', role: 'internal', description: 'Integrative and feedback-inhibitory neurons (INT, FBI).', neuronIds: idsOf(['INT', 'FBI']) },
    { id: 'pop-convergence', label: 'Convergence layer', role: 'internal', description: 'Convergence neurons (CON).', neuronIds: idsOf(['CON']) },
    { id: 'pop-descending', label: 'Descending output', role: 'output', description: 'Descending neurons (DN).', neuronIds: idsOf(['DN']) },
    { id: 'pop-premotor', label: 'Premotor output', role: 'output', description: 'Premotor neurons (PMN).', neuronIds: idsOf(['PMN']) },
    {
      id: 'pop-descending-left', label: 'Descending output (left)', role: 'output',
      description: 'Left-hemisphere descending neurons only.',
      neuronIds: neurons.filter((n) => n.classId === 'DN' && n.hemisphere === 'L').map((n) => n.id),
    },
  ];

  return {
    metadata: {
      name: 'Synthetic demo network',
      source: 'synthetic',
      version: '1.0.0',
      description:
        'Rule-generated, bilaterally organised toy network (8 classes). Positions are layout coordinates in arbitrary units; weights are illustrative.',
    },
    classes: CLASS_SPECS.map(({ id, label, description, transmitter: t, color }) => ({
      id, label, description, transmitter: t, color,
    })),
    neurons,
    connections,
    populations,
    synapse: { ...DEFAULT_SYNAPSE_PARAMS },
  };
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export const sampleNetwork: Network = buildNetwork(generateSampleNetworkDefinition());
