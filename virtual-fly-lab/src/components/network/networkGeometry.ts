import { Color } from 'three';
import type { Network } from '../../types/network';
import { lookup } from '../../utils/networkLookup';

export const VIEW_COLORS = {
  incoming: '#56b4d9',
  outgoing: '#e0a338',
  edgeExc: '#4a4e55',
  edgeInh: '#6b4248',
  background: '#0e0f10',
} as const;

export type Relation = 'none' | 'selected' | 'connected' | 'unrelated';

/** Relation of every neuron to the selected neuron. */
export function relations(network: Network, selectedIndex: number | null): Relation[] {
  const out: Relation[] = network.neurons.map(() => (selectedIndex === null ? 'none' : 'unrelated'));
  if (selectedIndex === null) return out;
  out[selectedIndex] = 'selected';
  for (const ci of network.incoming[selectedIndex]) out[network.indexById.get(network.connections[ci].pre)!] = 'connected';
  for (const ci of network.outgoing[selectedIndex]) out[network.indexById.get(network.connections[ci].post)!] = 'connected';
  return out;
}

/** Base (non-activity) colour per neuron given the current selection. */
export function baseNodeColors(network: Network, rel: Relation[]): Color[] {
  const { classById } = lookup(network);
  const bg = new Color(VIEW_COLORS.background);
  return network.neurons.map((n, i) => {
    const c = new Color(classById.get(n.classId)!.color);
    return rel[i] === 'unrelated' ? c.lerp(bg, 0.78) : c;
  });
}

/**
 * Line-segment buffers. Background edges: every connection, coloured by sign.
 * Highlight edges: the selected neuron's inputs and outputs, shaded dim at the
 * presynaptic end and bright at the postsynaptic end to show direction.
 */
export function edgeBuffers(network: Network, selectedIndex: number | null) {
  const pos = (id: string) => network.neurons[network.indexById.get(id)!].position;
  const bgPositions: number[] = [];
  const bgColors: number[] = [];
  const hiPositions: number[] = [];
  const hiColors: number[] = [];
  const exc = new Color(VIEW_COLORS.edgeExc);
  const inh = new Color(VIEW_COLORS.edgeInh);
  const incoming = new Color(VIEW_COLORS.incoming);
  const outgoing = new Color(VIEW_COLORS.outgoing);
  const selectedId = selectedIndex === null ? null : network.neurons[selectedIndex].id;

  for (const c of network.connections) {
    const a = pos(c.pre);
    const b = pos(c.post);
    const isIn = c.post === selectedId;
    const isOut = c.pre === selectedId;
    if (isIn || isOut) {
      const col = isIn ? incoming : outgoing;
      hiPositions.push(...a, ...b);
      hiColors.push(col.r * 0.3, col.g * 0.3, col.b * 0.3, col.r, col.g, col.b);
    } else {
      const col = c.type === 'inhibitory' ? inh : exc;
      bgPositions.push(...a, ...b);
      bgColors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
  }
  return {
    background: { positions: new Float32Array(bgPositions), colors: new Float32Array(bgColors) },
    highlight: { positions: new Float32Array(hiPositions), colors: new Float32Array(hiColors) },
  };
}

/** Centroid of each class (left hemisphere), used for region labels. */
export function classCentroids(network: Network): { id: string; position: [number, number, number] }[] {
  return network.classes.map((cls) => {
    const members = network.neurons.filter((n) => n.classId === cls.id && n.hemisphere === 'L');
    const sum = members.reduce<[number, number, number]>(
      (s, n) => [s[0] + n.position[0], s[1] + n.position[1], s[2] + n.position[2]],
      [0, 0, 0],
    );
    const k = Math.max(1, members.length);
    return { id: cls.id, position: [sum[0] / k, sum[1] / k + 0.35, sum[2] / k] };
  });
}
