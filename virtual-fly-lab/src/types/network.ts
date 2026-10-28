/** Core data model for a directed, weighted neural network. */

export type ConnectionType = 'excitatory' | 'inhibitory';
export type Hemisphere = 'L' | 'R';

/** Leaky integrate-and-fire parameters for one neuron (toy values, see lifModel.ts). */
export interface LIFParams {
  /** Resting potential (mV). */
  vRest: number;
  /** Spike threshold (mV). */
  vThreshold: number;
  /** Post-spike reset potential (mV). */
  vReset: number;
  /** Membrane time constant (ms). */
  tauM: number;
  /** Absolute refractory period (ms). */
  refractoryMs: number;
}

export interface NeuronClass {
  id: string;
  label: string;
  description: string;
  /** Sign of this class's outgoing synapses. */
  transmitter: ConnectionType;
  color: string;
}

export interface Neuron {
  /** Stable identifier, unique within a network. */
  id: string;
  /** Short human-readable label. */
  label: string;
  classId: string;
  hemisphere: Hemisphere;
  /** Position in arbitrary layout units (not anatomical micrometres). */
  position: [number, number, number];
  params: LIFParams;
  /** Rate of background (Poisson) synaptic input events, Hz. */
  backgroundRateHz: number;
}

export interface Connection {
  pre: string;
  post: string;
  /** Increment of synaptic drive per presynaptic spike (mV, positive magnitude). */
  weight: number;
  type: ConnectionType;
}

export interface Population {
  id: string;
  label: string;
  description: string;
  role: 'input' | 'internal' | 'output';
  neuronIds: string[];
}

/** Network-wide synapse and background-input parameters. */
export interface SynapseParams {
  tauSynExcMs: number;
  tauSynInhMs: number;
  delayMs: number;
  /** Synaptic drive added per background event (mV). */
  backgroundWeight: number;
}

export interface NetworkMetadata {
  name: string;
  source: 'synthetic' | 'connectome-subset';
  description: string;
  version: string;
}

/** Validated network with precomputed lookup indices. */
export interface Network {
  metadata: NetworkMetadata;
  classes: NeuronClass[];
  neurons: Neuron[];
  connections: Connection[];
  populations: Population[];
  synapse: SynapseParams;
  /** neuron id -> array index */
  indexById: Map<string, number>;
  /** Per-neuron indices into `connections`. */
  incoming: number[][];
  outgoing: number[][];
}

/** Plain (serialisable) network definition, as loaded from a data source. */
export type NetworkDefinition = Omit<Network, 'indexById' | 'incoming' | 'outgoing'>;
