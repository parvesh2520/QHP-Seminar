import type { Network, NetworkDefinition } from '../types/network';

/**
 * Validate a plain network definition and build lookup indices.
 *
 * Every data source (the synthetic demo network today, a connectome subset
 * later) goes through this function, so the rest of the app can rely on the
 * invariants checked here.
 */
export function buildNetwork(def: NetworkDefinition): Network {
  const indexById = new Map<string, number>();
  def.neurons.forEach((n, i) => {
    if (indexById.has(n.id)) throw new Error(`Duplicate neuron id: ${n.id}`);
    const p = n.params;
    if (!(p.vThreshold > p.vReset) || !(p.tauM > 0) || !(p.refractoryMs >= 0)) {
      throw new Error(`Invalid LIF parameters for neuron ${n.id}`);
    }
    indexById.set(n.id, i);
  });

  const classIds = new Set(def.classes.map((c) => c.id));
  for (const n of def.neurons) {
    if (!classIds.has(n.classId)) throw new Error(`Neuron ${n.id} has unknown class ${n.classId}`);
  }

  const incoming: number[][] = def.neurons.map(() => []);
  const outgoing: number[][] = def.neurons.map(() => []);
  const seen = new Set<string>();
  def.connections.forEach((c, ci) => {
    const pre = indexById.get(c.pre);
    const post = indexById.get(c.post);
    if (pre === undefined || post === undefined) {
      throw new Error(`Connection ${c.pre} -> ${c.post} references an unknown neuron`);
    }
    if (pre === post) throw new Error(`Self-connection on ${c.pre}`);
    if (!(c.weight >= 0) || !Number.isFinite(c.weight)) {
      throw new Error(`Connection ${c.pre} -> ${c.post} must have a finite non-negative weight`);
    }
    const key = `${c.pre}>${c.post}`;
    if (seen.has(key)) throw new Error(`Duplicate connection ${key}`);
    seen.add(key);
    outgoing[pre].push(ci);
    incoming[post].push(ci);
  });

  for (const pop of def.populations) {
    for (const id of pop.neuronIds) {
      if (!indexById.has(id)) throw new Error(`Population ${pop.id} references unknown neuron ${id}`);
    }
  }

  return { ...def, indexById, incoming, outgoing };
}

/** Serialisable form of a network (drops Map / index arrays). */
export function toDefinition(network: Network): NetworkDefinition {
  const { metadata, classes, neurons, connections, populations, synapse } = network;
  return { metadata, classes, neurons, connections, populations, synapse };
}
