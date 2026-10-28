export function signed(n: number, digits = 0): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

export function pct(p: number | null): string {
  return p === null ? 'n/a' : `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
}

export function ms(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2)} ms`;
}
