/** Axial hex coordinates (pointy-top). */
export type Hex = readonly [q: number, r: number];

export const DIRS: readonly Hex[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export const key = (q: number, r: number): string => `${q},${r}`;
export const parse = (k: string): Hex => {
  const [q, r] = k.split(',').map(Number);
  return [q, r];
};
export const distance = (q: number, r: number): number => Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
export const inGrid = (q: number, r: number, radius: number): boolean => distance(q, r) <= radius;
export const neighbours = (q: number, r: number): Hex[] => DIRS.map(([dq, dr]) => [q + dq, r + dr] as const);

export function gridCells(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++)
    for (let r = -radius; r <= radius; r++) if (inGrid(q, r, radius)) out.push([q, r]);
  return out;
}

/** Pixel centre of a hex for a given size (distance centre to corner). */
export function toPixel(q: number, r: number, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}
