import type { Network, Neuron, NeuronClass, Population } from '../types/network';

export interface NetworkLookup {
  neuronById: Map<string, Neuron>;
  classById: Map<string, NeuronClass>;
  /** Neuron id -> populations containing it. */
  populationsOf: Map<string, Population[]>;
}

const cache = new WeakMap<Network, NetworkLookup>();

/** Memoised id lookups for presentation code. */
export function lookup(network: Network): NetworkLookup {
  let l = cache.get(network);
  if (!l) {
    const populationsOf = new Map<string, Population[]>();
    for (const p of network.populations) {
      for (const id of p.neuronIds) populationsOf.set(id, [...(populationsOf.get(id) ?? []), p]);
    }
    l = {
      neuronById: new Map(network.neurons.map((n) => [n.id, n])),
      classById: new Map(network.classes.map((c) => [c.id, c])),
      populationsOf,
    };
    cache.set(network, l);
  }
  return l;
}

/** Neuron indices ordered by class (in class order), then hemisphere, then id. */
export function classOrderedIndices(network: Network): number[] {
  const rank = new Map(network.classes.map((c, i) => [c.id, i]));
  return network.neurons
    .map((n, i) => ({ n, i }))
    .sort((a, b) => rank.get(a.n.classId)! - rank.get(b.n.classId)! || a.n.id.localeCompare(b.n.id))
    .map((x) => x.i);
}
