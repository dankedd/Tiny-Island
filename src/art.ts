import type { BoatType, Building, BuildingType, PirateShip, Terrain } from './game/types';
import { distance, parse } from './game/hex';

/**
 * All pictures are SVG drawn in code. The island is drawn as one landmass
 * (terrain hexes without gaps), with paths, buildings and boats on top.
 * Building art uses local coordinates: (0, 0) is the centre of the hex, `S` is the hex size.
 */

export const S = 40;

export function hexPoints(cx: number, cy: number, s: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}

/** Stable pseudo-random numbers per cell, so trees don't jump around between renders. */
export function cellRand(k: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// ---------- small parts ----------

const shadow = (rx: number, ry = rx * 0.32, y = 0) => `<ellipse cx="0" cy="${y}" rx="${rx}" ry="${ry}" fill="rgba(20,40,20,.22)"/>`;

export const tree = (x: number, y: number, k = 1, tone = 0) => {
  const dark = ['#2f7a3d', '#2a6f45', '#3b7d34'][tone % 3];
  const light = ['#46a352', '#3f9a5c', '#58a845'][tone % 3];
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(2)})">
    ${shadow(8, 2.6, 6)}
    <rect x="-1.6" y="0" width="3.2" height="7" rx="1" fill="#7a5130"/>
    <path d="M0 -14 L9 2 L-9 2 Z" fill="${dark}"/>
    <path d="M0 -20 L7 -6 L-7 -6 Z" fill="${light}"/>
    <path d="M0 -20 L3 -13 L-1 -11 Z" fill="rgba(255,255,255,.22)"/>
  </g>`;
};

const roundTree = (x: number, y: number, k = 1) => `<g transform="translate(${x},${y}) scale(${k})">
  ${shadow(7, 2.4, 6)}<rect x="-1.4" y="0" width="2.8" height="6" fill="#7a5130"/>
  <circle cx="0" cy="-4" r="7" fill="#4a9e48"/><circle cx="-2.5" cy="-6" r="3.5" fill="#6cc160"/></g>`;

const boulder = (x: number, y: number, k = 1, c = '#9a9ca1') => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(2)})">
  ${shadow(9, 2.6, 4)}
  <path d="M-9 4 L-7 -4 L-1 -8 L6 -5 L9 4 Z" fill="${c}"/>
  <path d="M-1 -8 L6 -5 L9 4 L2 4 Z" fill="rgba(0,0,0,.16)"/>
  <path d="M-7 -4 L-1 -8 L-2 -2 Z" fill="rgba(255,255,255,.35)"/></g>`;

const win = (x: number, y: number, w = 3.6) => `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx=".5" fill="#ffd96b" stroke="#fff" stroke-width=".7"/><path d="M${x + w / 2} ${y} v${w} M${x} ${y + w / 2} h${w}" stroke="#c9a24a" stroke-width=".45"/>`;

/** Chimney smoke: three puffs that drift up and fade. */
export const smoke = (x: number, y: number) => `<g transform="translate(${x},${y})" class="smoke">${[0, 1, 2].map(i =>
  `<circle r="${1.8 + i * 0.5}" fill="#f4f4f4" style="animation-delay:-${i}s"/>`).join('')}</g>`;

const cottage = (x: number, y: number, k = 1, roof = '#d9534f', wall = '#fff4e2') => `
  <g transform="translate(${x},${y}) scale(${k})">
    ${shadow(11, 3, 8)}
    <rect x="-9" y="-5" width="18" height="13" rx="1" fill="${wall}"/>
    <rect x="-9" y="-5" width="18" height="2.5" fill="rgba(0,0,0,.06)"/>
    <rect x="-9" y="6.5" width="18" height="1.5" fill="#c9b08a"/>
    <path d="M-11.5 -4 L0 -15 L11.5 -4 Z" fill="${roof}"/>
    <path d="M-8.3 -7 L8.3 -7 M-5 -10 L5 -10 M-1.8 -13 L1.8 -13" stroke="rgba(0,0,0,.16)" stroke-width=".7"/>
    <path d="M0 -15 L11.5 -4 L6 -4 Z" fill="rgba(0,0,0,.14)"/>
    <path d="M-11.5 -4 L11.5 -4" stroke="rgba(0,0,0,.2)" stroke-width="1"/>
    <rect x="4.5" y="-15" width="3" height="6" fill="#9b6b49"/><rect x="4" y="-15.8" width="4" height="1.4" fill="#7a5130"/>
    ${smoke(6, -17)}
    <rect x="-2.3" y="1" width="4.6" height="7" rx="2" fill="#8a5a36"/><circle cx="1.1" cy="4.6" r=".5" fill="#ffd34d"/>
    ${win(-7, -1.5)}${win(3.4, -1.5)}
    <rect x="-7.4" y="2.3" width="4.4" height="1.4" rx=".6" fill="#7a5130"/>
    <circle cx="-6.6" cy="2" r=".9" fill="#ff7aa8"/><circle cx="-5.2" cy="1.8" r=".9" fill="#ffd34d"/><circle cx="-3.8" cy="2" r=".9" fill="#ff7aa8"/>
  </g>`;

/** A tiny villager. `walk` makes them stroll back and forth. */
export const person = (x: number, y: number, shirt = '#4f8fd0', walk = true, delay = 0) => `<g transform="translate(${x},${y})">
  <g${walk ? ` class="walk" style="animation-delay:-${delay}s"` : ''}>
    <ellipse cy=".6" rx="2.4" ry=".8" fill="rgba(0,0,0,.22)"/>
    <rect x="-1.3" y="-2" width="1.1" height="2.6" fill="#5a4a3a"/><rect x=".2" y="-2" width="1.1" height="2.6" fill="#5a4a3a"/>
    <rect x="-1.8" y="-6.2" width="3.6" height="4.6" rx="1.4" fill="${shirt}"/>
    <circle cy="-7.8" r="2" fill="#f2c49b"/><path d="M-2 -8.3 Q0 -10.6 2 -8.3 Z" fill="#6b4226"/>
  </g></g>`;

const sheep = (x: number, y: number, flip = false) => `<g transform="translate(${x},${y})${flip ? ' scale(-1,1)' : ''}">
  <ellipse cy="1.5" rx="4.5" ry="1.2" fill="rgba(0,0,0,.18)"/>
  <rect x="-2.6" y="-1" width="1" height="2.6" fill="#333"/><rect x="1.4" y="-1" width="1" height="2.6" fill="#333"/>
  <circle cx="-2" cy="-2.5" r="2.4" fill="#fff"/><circle cx="1" cy="-3" r="2.6" fill="#fff"/><circle cx="2.4" cy="-1.8" r="2" fill="#fff"/>
  <ellipse cx="4.4" cy="-2.6" rx="1.5" ry="1.2" fill="#333"/></g>`;

const crate = (x: number, y: number, k = 1) => `<g transform="translate(${x},${y}) scale(${k})"><rect x="-3" y="-3" width="6" height="6" fill="#b5834f"/><path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="#8a5a36" stroke-width="1"/></g>`;

const logs = (x: number, y: number, k = 1) => `<g transform="translate(${x},${y}) scale(${k})">
  ${shadow(9, 2.4, 4)}
  ${[[-5, 2], [1, 2], [-2, -3]].map(([lx, ly]) => `<rect x="${lx - 5}" y="${ly - 2.5}" width="11" height="5" rx="2.5" fill="#a87447"/><circle cx="${lx + 5.5}" cy="${ly}" r="2.5" fill="#e0b27c"/><circle cx="${lx + 5.5}" cy="${ly}" r="1" fill="#b98550"/>`).join('')}</g>`;

const flag = (x: number, y: number, c = '#e0604f') => `<g transform="translate(${x},${y})"><rect x="-.6" y="-12" width="1.2" height="12" fill="#5a3a20"/><path class="flag" d="M.6 -12 L8 -9.5 L.6 -7 Z" fill="${c}"/></g>`;

// ---------- boats ----------

export function boatSvg(b: BoatType, k = 1): string {
  if (b === 'rowboat') return `<g class="bob" transform="scale(${k})">
    <path d="M-9 -1 Q0 6 9 -1 L7 -3 L-7 -3 Z" fill="#a0683b"/><path d="M-7 -3 L7 -3" stroke="#d9a46a" stroke-width="1.2"/>
    <path d="M-3 -4 L-10 2 M3 -4 L10 2" stroke="#7a5130" stroke-width="1"/></g>`;
  if (b === 'fishingboat') return `<g class="bob" transform="scale(${k})">
    <path d="M-13 -2 Q0 8 13 -2 L11 -5 L-11 -5 Z" fill="#3f7fbf"/><path d="M-11 -5 L11 -5" stroke="#fff" stroke-width="1.4"/>
    <rect x="-3" y="-12" width="8" height="7" rx="1" fill="#f4efe6"/><rect x="-1.5" y="-10.5" width="3" height="2.5" fill="#7fc7e8"/>
    <path d="M-8 -5 L-8 -16 L-14 -6" stroke="#5a3a20" stroke-width="1" fill="none"/></g>`;
  return `<g class="bob" transform="scale(${k})">
    <path d="M-15 -2 Q0 9 15 -2 L13 -5 L-13 -5 Z" fill="#f4efe6"/><path d="M-13 -5 L13 -5" stroke="#c9553f" stroke-width="1.6"/>
    <rect x="-.7" y="-30" width="1.4" height="25" fill="#5a3a20"/>
    <path d="M.7 -29 Q12 -17 .7 -7 Z" fill="#fff"/><path d="M-.7 -27 Q-9 -18 -.7 -9 Z" fill="#eef3f6"/>
    <path d="M.7 -31 L7 -29.5 L.7 -28 Z" fill="#e0604f"/></g>`;
}

// ---------- terrain ----------

const GRASS = ['#86c96f', '#81c46b', '#8acd73'];

const palm = (x: number, y: number, k = 1, flip = false) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${flip ? -k : k},${k})">
  ${shadow(9, 2.4, 3)}
  <path d="M0 2 Q2 -8 5 -17" stroke="#9b6b49" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M0 2 Q2 -8 5 -17" stroke="#7a5130" stroke-width="2.6" stroke-dasharray="1 2.2" fill="none"/>
  <g transform="translate(5,-17)">
    <path d="M0 0 Q-7 -5 -13 1 Q-7 -2 0 0Z" fill="#3f9a5c"/><path d="M0 0 Q7 -6 13 0 Q6 -2 0 0Z" fill="#46a352"/>
    <path d="M0 0 Q-3 -9 -9 -10 Q-3 -6 0 0Z" fill="#58a845"/><path d="M0 0 Q4 -9 10 -9 Q4 -5 0 0Z" fill="#3f9a5c"/>
    <circle cx="-1" cy="1" r="1.4" fill="#7a5130"/><circle cx="1.2" cy="1.4" r="1.4" fill="#6b4226"/>
  </g></g>`;

const bush = (x: number, y: number, k = 1) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(2)})">
  <ellipse cy="2" rx="6" ry="1.8" fill="rgba(20,40,20,.18)"/>
  <circle cx="-3" cy="-1" r="3.4" fill="#4a9e48"/><circle cx="2.5" cy="-1.2" r="3.6" fill="#4f9f4a"/><circle cx="0" cy="-3.4" r="3.4" fill="#5fb655"/>
  <circle cx="-1" cy="-4.4" r="1.2" fill="rgba(255,255,255,.25)"/></g>`;

const FLOWERS = ['#fff', '#ffd34d', '#ff8fb1', '#b7a6ff'];

/** The ground, forests and rocks. These never change during a game, so they are drawn once. */
export function terrainLayer(terrain: Record<string, Terrain>, toPixel: (k: string) => { x: number; y: number }): string {
  let shallow = '', cliffs = '', foam = '', ground = '', nature = '';
  const land = Object.entries(terrain).filter(([, t]) => t !== 'sea');
  for (const [k, t] of land) {
    const { x, y } = toPixel(k);
    shallow += `<polygon points="${hexPoints(x, y + 4, S + 24)}"/>`;
    foam += `<polygon points="${hexPoints(x, y + 3, S + 8)}" class="foam"/>`;
    cliffs += `<polygon points="${hexPoints(x, y + 7, S + 0.8)}" fill="#c9a66b"/>`;
    const rnd = cellRand(k);
    const fill = t === 'beach' ? '#f1d9a0' : t === 'rocks' ? '#b9b4a6' : t === 'forest' ? '#6fb35e' : GRASS[Math.floor(rnd() * 3)];
    ground += `<polygon points="${hexPoints(x, y, S + 0.8)}" fill="${fill}"/>`;
    if (t === 'forest') {
      const n = 6 + Math.floor(rnd() * 3);
      const trees: [number, number, number, number][] = [];
      for (let i = 0; i < n; i++) trees.push([x + (rnd() - 0.5) * S * 1.35, y + (rnd() - 0.5) * S * 1.2 + 4, 1.05 + rnd() * 0.45, Math.floor(rnd() * 4)]);
      trees.sort((a, b) => a[1] - b[1]);
      nature += trees.map(([tx, ty, tk, tone]) => tone === 3 ? roundTree(tx, ty, tk * 1.1) : tree(tx, ty, tk, tone)).join('');
      if (rnd() < 0.35) nature += `<g transform="translate(${(x + (rnd() - 0.5) * S).toFixed(1)},${(y + S * 0.45).toFixed(1)})"><rect x="-.8" y="-2" width="1.6" height="2.4" fill="#f4efe6"/><path d="M-2.6 -1.8 Q0 -5 2.6 -1.8 Z" fill="#e0604f"/><circle cx="-.8" cy="-3" r=".5" fill="#fff"/></g>`;
    }
    if (t === 'rocks') {
      for (let i = 0; i < 4; i++) ground += `<circle cx="${(x + (rnd() - 0.5) * S * 1.3).toFixed(1)}" cy="${(y + (rnd() - 0.5) * S * 1.2).toFixed(1)}" r="${(1 + rnd() * 1.4).toFixed(1)}" fill="#a29d90"/>`;
      ground += `<ellipse cx="${(x + (rnd() - 0.5) * S * 0.6).toFixed(1)}" cy="${(y + S * 0.35).toFixed(1)}" rx="9" ry="3" fill="#8fbf6a" opacity=".6"/>`;
      const n = 3 + Math.floor(rnd() * 2);
      const rocks: [number, number, number, string][] = [];
      for (let i = 0; i < n; i++) rocks.push([x + (rnd() - 0.5) * S * 1.2, y + (rnd() - 0.5) * S * 1.1, 0.9 + rnd() * 0.75, ['#9a9ca1', '#a7a39a', '#8e9196'][Math.floor(rnd() * 3)]]);
      rocks.sort((a, b) => a[1] - b[1]);
      nature += rocks.map(([rx, ry, rk, c]) => boulder(rx, ry, rk, c)).join('');
    }
  }
  return `<g class="terrain"><g class="shallow">${shallow}</g><g class="foamring">${foam}</g>${cliffs}${ground}</g><g class="nature">${nature}</g>`;
}

/** Small things on open grass and sand: tufts, flowers, bushes, palms and shells. Hidden under buildings. */
export function decorLayer(terrain: Record<string, Terrain>, built: Set<string>, toPixel: (k: string) => { x: number; y: number }): string {
  let flat = '', tall = '';
  for (const [k, t] of Object.entries(terrain)) {
    if ((t !== 'grass' && t !== 'beach') || built.has(k)) continue;
    const { x, y } = toPixel(k);
    const rnd = cellRand(k + '#');
    const at = (spread = 1.1) => [x + (rnd() - 0.5) * S * spread, y + (rnd() - 0.5) * S * spread] as const;
    if (t === 'grass') {
      for (let i = 0; i < 3; i++) {
        const [gx, gy] = at(1.2);
        flat += `<path d="M${gx.toFixed(1)} ${gy.toFixed(1)} l-2 -4 M${gx.toFixed(1)} ${gy.toFixed(1)} l0 -5 M${gx.toFixed(1)} ${gy.toFixed(1)} l2 -4" stroke="#6aae57" stroke-width="1.2" stroke-linecap="round"/>`;
      }
      if (rnd() < 0.55) {
        const c = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
        const [fx, fy] = at(1);
        for (let i = 0; i < 4; i++) flat += `<circle cx="${(fx + (rnd() - 0.5) * 12).toFixed(1)}" cy="${(fy + (rnd() - 0.5) * 8).toFixed(1)}" r="1.5" fill="${c}"/>`;
      }
      if (rnd() < 0.3) { const [bx, by] = at(1); tall += bush(bx, by, 0.9 + rnd() * 0.4); }
    } else {
      for (let i = 0; i < 2; i++) {
        const [rx, ry] = at(1);
        flat += `<path d="M${(rx - 6).toFixed(1)} ${ry.toFixed(1)} q3 -2 6 0 t6 0" stroke="#e2c487" stroke-width="1" fill="none"/>`;
      }
      if (rnd() < 0.5) { const [sx, sy] = at(1); flat += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} l-2.2 -3 q2.2 -2 4.4 0 Z" fill="#ffd6c9" stroke="#e8a998" stroke-width=".5"/>`; }
      if (rnd() < 0.3) { const [px, py] = at(0.8); tall += palm(px, py, 1 + rnd() * 0.3, rnd() < 0.5); }
    }
  }
  return `<g>${flat}</g><g>${tall}</g>`;
}

// ---------- paths ----------

/**
 * Paths: path tiles join up with each other and the town square,
 * and every building gets one short path to the nearest path tile (or the square).
 */
export function pathLayer(
  b: Record<string, Building>, neighboursOf: (k: string) => string[], toPixel: (k: string) => { x: number; y: number }, net: Set<string>,
): string {
  let base = '', top = '';
  const seg = (a: { x: number; y: number }, c: { x: number; y: number }, part = 1) => {
    const ex = a.x + (c.x - a.x) * part, ey = a.y + (c.y - a.y) * part;
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`;
    base += `<path d="${d}"/>`;
    top += `<path d="${d}"/>`;
  };
  const home = (k: string) => distance(...parse(k));
  for (const [k, v] of Object.entries(b)) {
    if (v.t === 'road') {
      const p = toPixel(k);
      base += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8"/>`;
      top += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5"/>`;
      for (const n of neighboursOf(k)) {
        if (b[n]?.t === 'road' && k < n) seg(p, toPixel(n));
        if (b[n]?.t === 'plaza') seg(p, toPixel(n), 0.62);
      }
      continue;
    }
    if (v.t === 'plaza' || v.t === 'field') continue;
    // One path per building: to the connected path tile closest to the square.
    const options = neighboursOf(k).filter(n => b[n]?.t === 'road' || b[n]?.t === 'plaza');
    if (!options.length) continue;
    options.sort((x, y) => Number(net.has(y)) - Number(net.has(x)) || home(x) - home(y) || (x < y ? -1 : 1));
    const n = options[0];
    const from = toPixel(n), to = toPixel(k);
    if (b[n].t === 'plaza') {
      const st = { x: from.x + (to.x - from.x) * 0.36, y: from.y + (to.y - from.y) * 0.36 };
      seg(st, to, 0.55);
    } else seg(from, to, 0.62);
  }
  return `<g class="path-base">${base}</g><g class="path-top">${top}</g>`;
}

// ---------- buildings ----------

const DIR_ANGLE = [0, -60, -120, 180, 120, 60]; // degrees for the six hex neighbours (pointy-top axial)

const BIG: BuildingType[] = ['house', 'farm', 'lumber', 'quarry', 'tower', 'ruin'];

export interface ArtOpts {
  farmed?: boolean;
  /** Fields only: which of the six neighbours (hex.DIRS order) are fields too, so they join up. */
  joins?: boolean[];
  /** Show villagers walking around (off for menu icons and previews). */
  life?: boolean;
}

export function buildingSvg(v: Building, opts: ArtOpts = {}): string {
  const art = buildingArt(v, opts);
  return BIG.includes(v.t) ? `<g transform="scale(1.4)">${art}</g>` : art;
}

const SHIRTS = ['#4f8fd0', '#e0604f', '#f0a830', '#6fb37a', '#a77bd1'];

function fieldArt(farmed: boolean, joins: boolean[]): string {
  const soil = farmed ? '#9b7a4c' : '#b0946a';
  const leaf = farmed ? '#6fae55' : '#a39360';
  const crop = farmed ? '#e7c64f' : '#c2ab72';
  let g = `<polygon points="${hexPoints(0, 0, S + 0.8)}" fill="${soil}"/>`;
  // Rows line up with the rows of the fields next door, so joined fields look like one big field.
  const halfW = (y: number) => (Math.abs(y) <= S / 2 ? (S * Math.sqrt(3)) / 2 : (S - Math.abs(y)) * Math.sqrt(3));
  const sp = (S * Math.sqrt(3)) / 12;
  for (let i = -5; i <= 5; i++) {
    const y = i * 7.5;
    const w = halfW(y) - 0.5;
    if (w < 3) continue;
    g += `<path d="M${(-w).toFixed(1)} ${y} L${w.toFixed(1)} ${y}" stroke="${leaf}" stroke-width="4.4"/>`;
    for (let j = -6; j <= 6; j++) {
      const x = j * sp + (i % 2 ? sp / 2 : 0);
      if (Math.abs(x) < w - 1.5) g += `<circle cx="${x.toFixed(1)}" cy="${y - 1.6}" r="1.9" fill="${crop}"/>`;
    }
  }
  // A little fence on every side that does not touch another field.
  for (let i = 0; i < 6; i++) {
    const d = (6 - i) % 6;
    if (joins[d]) continue;
    const a1 = (Math.PI / 180) * (60 * i - 30), a2 = (Math.PI / 180) * (60 * i + 30);
    const r = S - 2;
    const x1 = r * Math.cos(a1), y1 = r * Math.sin(a1), x2 = r * Math.cos(a2), y2 = r * Math.sin(a2);
    g += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#8a5a36" stroke-width="1.4"/>`;
    for (let t = 0; t <= 4; t++) {
      const px = x1 + ((x2 - x1) * t) / 4, py = y1 + ((y2 - y1) * t) / 4;
      g += `<rect x="${(px - 0.9).toFixed(1)}" y="${(py - 3.2).toFixed(1)}" width="1.8" height="3.8" fill="#7a5130"/>`;
    }
  }
  if (!farmed) g += `<g transform="translate(0,-4)"><circle r="9" fill="#fff" stroke="#e0604f" stroke-width="2"/><text y="4" text-anchor="middle" font-size="12" font-weight="800" fill="#e0604f">!</text></g>`;
  return g;
}

function buildingArt(v: Building, opts: ArtOpts): string {
  const l = v.l;
  const life = opts.life ?? false;
  switch (v.t) {
    case 'plaza':
      return `<circle r="${S * 0.62}" fill="#d9c9a3"/><circle r="${S * 0.62}" fill="none" stroke="#bfae86" stroke-width="2"/>
        ${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<circle cx="${(Math.cos(a) * S * 0.42).toFixed(1)}" cy="${(Math.sin(a) * S * 0.42).toFixed(1)}" r="2.2" fill="#c8b68e"/>`; }).join('')}
        ${shadow(10, 3.5, 5)}<circle r="9" fill="#9aa3ad"/><circle r="6.5" fill="#6fb7d6"/><circle cx="-2" cy="-2" r="2" fill="#bfe6f5"/>
        <circle r="1.6" fill="#fff" class="fountain"/>
        <g transform="translate(-15,-12)">${shadow(8, 2, 6)}<rect x="-7" y="-2" width="14" height="8" fill="#c9a66b"/><path d="M-8 -2 L8 -2 L7 -7 L-7 -7 Z" fill="#e0604f"/><path d="M-4.5 -7 L-4 -2 M0 -7 L0 -2 M4.5 -7 L4 -2" stroke="#fff" stroke-width="2.2"/><circle cx="-3" cy="-3.4" r="1.4" fill="#ff9f43"/><circle cx="2" cy="-3.4" r="1.4" fill="#7bd36b"/></g>
        <g transform="translate(-14,14)"><rect x="-5" y="-1" width="10" height="2" fill="#8a5a36"/><rect x="-4" y="1" width="1" height="2" fill="#5a3a20"/><rect x="3" y="1" width="1" height="2" fill="#5a3a20"/></g>
        ${flag(14, -6, '#ffd34d')}
        ${life ? person(12, 14, SHIRTS[1], true, 1) + person(-4, 18, SHIRTS[2], true, 2.5) + person(-18, -3, SHIRTS[3], false) : ''}`;
    case 'road':
      return '';
    case 'house':
      if (l === 1) return cottage(0, 2, 1.45) + (life ? person(11, 13, SHIRTS[0], true) : '') + bush(-14, 12, 0.7);
      if (l === 2) return cottage(-10, -2, 1.15) + cottage(9, 7, 1.15, '#4f8fd0') + (life ? person(-6, 14, SHIRTS[4], true, 1.5) : '');
      return `<g transform="translate(-4,4) scale(1.3)">${shadow(13, 3.5, 9)}
        <rect x="-10" y="-17" width="20" height="26" rx="1" fill="#fff4e2"/>
        <path d="M-12.5 -16 L0 -27 L12.5 -16 Z" fill="#d9534f"/><path d="M0 -27 L12.5 -16 L7 -16 Z" fill="rgba(0,0,0,.14)"/>
        ${[-12, -4, 4].map(yy => `<rect x="-7" y="${yy}" width="4" height="4" fill="#ffd96b"/><rect x="3" y="${yy}" width="4" height="4" fill="#ffd96b"/>`).join('')}
        <rect x="-2.5" y="2" width="5" height="7" rx="2" fill="#8a5a36"/>${smoke(5, -28)}</g>${roundTree(16, 10, 1.1)}${life ? person(-14, 16, SHIRTS[2], true, 0.7) + person(4, 18, SHIRTS[0], true, 2) : ''}`;
    case 'farm': {
      let g = `<g transform="translate(-4,2) scale(1.3)">${shadow(14, 3.5, 9)}
        <rect x="-11" y="-6" width="22" height="15" fill="#c9553f"/>
        <path d="M-13 -5 L0 -17 L13 -5 Z" fill="#8a3a2c"/>
        <rect x="-4" y="1" width="8" height="8" fill="#f4e3c8"/><path d="M-4 1 L4 9 M4 1 L-4 9" stroke="#c9553f" stroke-width="1.2"/>
        <rect x="-9" y="-3" width="4" height="3" fill="#f4e3c8"/></g>`;
      if (l >= 2) g += `<g transform="translate(17,0) scale(1.2)">${shadow(5, 2, 9)}<rect x="-4" y="-14" width="8" height="23" rx="4" fill="#d8dde3"/><path d="M-4 -12 Q0 -19 4 -12" fill="#9aa3ad"/><rect x="-4" y="-4" width="8" height="1.5" fill="#b5bcc4"/></g>`;
      if (l >= 3) g += `<g transform="translate(-20,-8)"><rect x="-3" y="-6" width="6" height="16" fill="#f4e3c8"/><path d="M-4 -6 L0 -11 L4 -6 Z" fill="#8a3a2c"/><g transform="translate(0,-7)"><g class="spin"><rect x="-1.2" y="-13" width="2.4" height="26" fill="#7a5130"/><rect x="-13" y="-1.2" width="26" height="2.4" fill="#7a5130"/></g></g><circle cx="0" cy="-7" r="2" fill="#5a3a20"/></g>`;
      g += `<g transform="translate(10,14)"><ellipse cy="2.6" rx="6" ry="1.4" fill="rgba(0,0,0,.18)"/><rect x="-3.5" y="0" width="1.2" height="3" fill="#333"/><rect x="2.3" y="0" width="1.2" height="3" fill="#333"/><ellipse rx="5" ry="3" fill="#fff"/><circle cx="4.6" cy="-1.4" r="2.2" fill="#fff"/><circle cx="-2" cy="-1" r="1.4" fill="#333"/><circle cx="1.5" cy="1" r="1.1" fill="#333"/><circle cx="5.4" cy="-1.8" r=".5" fill="#333"/></g>`;
      g += `<g transform="translate(-16,12)"><rect x="-4" y="-3" width="8" height="5" fill="#e7c64f"/><path d="M-4 -1 h8 M-4 1 h8" stroke="#c9a33a" stroke-width=".6"/></g>`;
      if (l >= 2) g += sheep(-3, 22) + sheep(-12, 21, true);
      if (life) g += person(18, 14, SHIRTS[3], true, 0.4);
      return g;
    }
    case 'field':
      return fieldArt(opts.farmed !== false, opts.joins ?? []);
    case 'lumber': {
      let g = `<g transform="translate(-6,0) scale(1.25)">${shadow(12, 3, 8)}
        <rect x="-10" y="-5" width="20" height="13" fill="#9b6b49"/>
        ${[-3, 0, 3, 6].map(yy => `<rect x="-10" y="${yy - 2}" width="20" height="1" fill="#7a5130"/>`).join('')}
        <path d="M-12 -4 L0 -14 L12 -4 Z" fill="#5d7a3a"/><rect x="-2.5" y="1" width="5" height="7" fill="#5a3a20"/></g>`;
      g += logs(14, 10, 1.05);
      if (l >= 2) g += logs(-16, 14, 0.9);
      if (l >= 3) g += `<g transform="translate(16,-12)"><rect x="-6" y="-2" width="12" height="4" fill="#a87447"/><circle r="5" cy="-5" fill="none" stroke="#9aa3ad" stroke-width="1.6"/></g>`;
      g += `<g transform="translate(4,16)"><ellipse rx="4" ry="2" fill="#c49a62"/><ellipse rx="2.6" ry="1.2" fill="#e0b27c"/><path d="M-1 -1 L5 -8" stroke="#5a3a20" stroke-width="1.4"/><path d="M4 -9 L8 -7 L6 -5 Z" fill="#9aa3ad"/></g>`;
      if (life) g += person(-6, 18, '#c9553f', true, 1.2);
      return g;
    }
    case 'quarry': {
      let g = `<ellipse cx="0" cy="4" rx="${S * 0.62}" ry="${S * 0.42}" fill="#8f8a80"/><ellipse cx="0" cy="6" rx="${S * 0.45}" ry="${S * 0.28}" fill="#6f6a62"/>`;
      g += [[-10, -2], [-3, -4], [4, -3]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="5" fill="#c9ccd1" stroke="#9a9ca1" stroke-width=".8"/>`).join('');
      g += boulder(14, 12, 0.8, '#a3a6ab');
      if (l >= 2) g += `<g transform="translate(-14,14)"><rect x="-7" y="-5" width="14" height="7" fill="#8a5a36"/><rect x="-5" y="-8" width="4" height="3" fill="#c9ccd1"/><rect x="0" y="-8" width="4" height="3" fill="#c9ccd1"/><circle cx="-4" cy="3" r="2.2" fill="#333"/><circle cx="4" cy="3" r="2.2" fill="#333"/></g>`;
      if (l >= 3) g += `<g transform="translate(12,-12)" class="shine"><path d="M0 -9 L5 -2 L0 5 L-5 -2 Z" fill="#c9a8ff"/><path d="M0 -9 L5 -2 L0 -1 Z" fill="#efe2ff"/></g>`;
      g += `<path d="M-14 -10 L-9 -16 L-4 -10" stroke="#7a5130" stroke-width="1.4" fill="none"/>`;
      if (life) g += person(2, 14, '#f0a830', true, 0.8);
      return g;
    }
    case 'dock': {
      const a = DIR_ANGLE[v.dir ?? 0];
      const len = S * 1.55;
      let pier = `<rect x="0" y="-6" width="${len}" height="12" fill="#a87447"/>`;
      for (let x = 3; x < len; x += 5) pier += `<rect x="${x}" y="-6" width="1" height="12" fill="#7a5130"/>`;
      pier += `<rect x="${len - 3}" y="-8" width="3" height="3" fill="#5a3a20"/><rect x="${len - 3}" y="5" width="3" height="3" fill="#5a3a20"/>`;
      const boats = (v.boats ?? []).map((b, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const along = len * (0.55 + 0.25 * Math.floor(i / 2));
        return `<g transform="translate(${along},${side * 15}) rotate(${-a})">${boatSvg(b, 1.15)}</g>`;
      }).join('');
      const hut = `<g transform="translate(-6,-2)">${shadow(10, 3, 7)}<rect x="-8" y="-4" width="16" height="11" fill="#d8c3a0"/><path d="M-10 -3 L0 -12 L10 -3 Z" fill="#4f8fd0"/><rect x="-2" y="1" width="4" height="6" fill="#8a5a36"/></g>`;
      return `<g transform="rotate(${a})">${pier}${boats}</g>${hut}${l >= 2 ? crate(10, 10) + crate(14, 6, .8) : ''}${l >= 3 ? `<g transform="translate(-16,10)">${flag(0, 0, '#4f8fd0')}</g>` : ''}`;
    }
    case 'tower':
      if (l === 1) return `<g transform="translate(0,8) scale(1.25)">${shadow(9, 2.6, 2)}
        <path d="M-7 2 L-5 -20 M7 2 L5 -20 M-6 -6 L6 -6 M-6.5 -1 L6.5 -12" stroke="#8a5a36" stroke-width="2"/>
        <rect x="-8" y="-26" width="16" height="7" fill="#a87447"/><path d="M-9 -26 L0 -33 L9 -26 Z" fill="#7a5130"/>${flag(0, -33)}</g>`;
      if (l === 2) return `<g transform="translate(0,8) scale(1.25)">${shadow(10, 3, 2)}
        <rect x="-7" y="-26" width="14" height="28" fill="#a9a9b0"/><rect x="-7" y="-26" width="4" height="28" fill="rgba(255,255,255,.2)"/>
        <path d="M-9 -26 h4 v-3 h3 v3 h4 v-3 h3 v3 h4 v-2 h-18 Z" fill="#8e8e96"/>
        <rect x="-2" y="-18" width="4" height="6" rx="2" fill="#3a2a45"/>${flag(0, -29)}</g>`;
      return `<g transform="translate(0,10) scale(1.3)">${shadow(10, 3, 2)}
        <path d="M-7 2 L-5 -30 L5 -30 L7 2 Z" fill="#fff"/>
        <path d="M-6.6 -5 L6.6 -5 L6.2 -12 L-6.2 -12 Z" fill="#e0604f"/><path d="M-5.6 -19 L5.6 -19 L5.3 -25 L-5.3 -25 Z" fill="#e0604f"/>
        <rect x="-4.5" y="-37" width="9" height="7" fill="#ffe27a" class="glow"/><path d="M-7 -37 L0 -43 L7 -37 Z" fill="#3a3f55"/></g>`;
    case 'ruin':
      return `<g transform="translate(0,6) scale(1.3)">
        <path d="M-12 4 L-12 -9 L-7 -12 L-5 -5 L-3 -7 L-3 4 Z" fill="#8f8a80"/>
        <path d="M3 4 L3 -5 L7 -8 L11 -3 L11 4 Z" fill="#8f8a80"/>
        ${boulder(-1, 9, .5, '#7d786f')}${boulder(12, 10, .4, '#7d786f')}</g>`;
  }
}

/** Little picture for the build menu. */
export function menuIcon(t: BuildingType): string {
  const v: Building = { t, l: 1, dir: 0, boats: [] };
  const ground = t === 'dock' ? '#f1d9a0' : '#86c96f';
  return `<svg viewBox="-34 -34 68 68" aria-hidden="true"><polygon points="${hexPoints(0, 2, 30)}" fill="${ground}"/>
    ${t === 'road' ? '<path d="M-26 12 L26 -8" stroke="#c9a66b" stroke-width="14" stroke-linecap="round"/><path d="M-26 12 L26 -8" stroke="#e3cc9c" stroke-width="9" stroke-linecap="round"/>' : ''}
    <g transform="scale(.8)">${buildingSvg(v)}</g></svg>`;
}

const jolly = (x: number, y: number, k = 1) => `<g transform="translate(${x},${y}) scale(${k})"><path class="flag" d="M0 0 L9 1.5 L8 4.5 L9 7 L0 6 Z" fill="#1d1d22"/><circle cx="4" cy="2.8" r="1.5" fill="#fff"/><path d="M2.4 5 L5.6 3.8 M2.4 3.8 L5.6 5" stroke="#fff" stroke-width=".6"/></g>`;
const mast = (x: number, top: number, bottom: number) => `<rect x="${x - 0.9}" y="${top}" width="1.8" height="${bottom - top}" fill="#2a1d1d"/>`;
const squareSail = (x: number, y: number, w: number, h: number, c: string) =>
  `<path d="M${x - w / 2} ${y} Q${x} ${y + 2} ${x + w / 2} ${y} L${x + w / 2 + 1} ${y + h} Q${x} ${y + h + 3} ${x - w / 2 - 1} ${y + h} Z" fill="${c}"/><path d="M${x - w / 2} ${y} L${x + w / 2} ${y}" stroke="#2a1d1d" stroke-width="1"/>`;

/** Pirate boats, from a wobbly raft to a big galleon. They face right; flip them for the other way. */
export function pirateShip(kind: PirateShip): string {
  if (kind === 'raft') return `<g class="ship-shape">
    ${[-9, -4.5, 0, 4.5, 9].map(x => `<rect x="${x - 2.3}" y="-1" width="4.6" height="7" rx="2.3" fill="#7a5130" stroke="#5a3a20" stroke-width=".6"/>`).join('')}
    <path d="M-12 2 L12 2" stroke="#c9a66b" stroke-width="1"/>
    ${mast(0, -20, 0)}
    <path d="M1 -18 L10 -16 L9 -4 L1 -5 Z" fill="#d8c8a8"/><rect x="4" y="-12" width="3" height="3" fill="#b5a07c"/>
    ${jolly(-0.5, -27, 0.8)}
    ${person(-6, 0, '#8a2b2b', false)}</g>`;
  if (kind === 'sloop') return `<g class="ship-shape">
    <path d="M-16 0 L17 0 L12 9 L-12 9 Z" fill="#3a2a2a"/>
    <path d="M-16 0 L17 0 L16 2 L-15 2 Z" fill="#5b4040"/>
    ${mast(0, -26, 0)}
    <path d="M1.5 -24 Q13 -14 1.5 -3 Z" fill="#d8dde3"/>
    <path d="M-1.5 -24 Q-12 -14 -1.5 -3 Z" fill="#c4cad1"/>
    ${jolly(0, -33)}</g>`;
  if (kind === 'brig') return `<g class="ship-shape">
    <path d="M-22 -2 L24 -2 L17 10 L-17 10 Z" fill="#2f2222"/>
    <path d="M-22 -2 L24 -2 L23 1 L-21 1 Z" fill="#6a4a3a"/>
    ${[-12, -6, 0, 6, 12].map(x => `<rect x="${x - 1.5}" y="3" width="3" height="2.6" fill="#111"/>`).join('')}
    ${mast(-8, -30, -2)}${mast(8, -34, -2)}
    ${squareSail(-8, -27, 12, 9, '#e3ddd0')}${squareSail(-8, -15, 14, 9, '#d8d0c0')}
    ${squareSail(8, -31, 12, 10, '#e3ddd0')}${squareSail(8, -18, 15, 11, '#d8d0c0')}
    <path d="M24 -2 L32 -8" stroke="#2a1d1d" stroke-width="1.2"/>
    ${jolly(8, -42)}</g>`;
  return `<g class="ship-shape">
    <path d="M-30 -8 L-20 -8 L-18 -2 L28 -2 L34 -6 L24 12 L-22 12 Z" fill="#3b2420"/>
    <path d="M-30 -14 L-18 -14 L-18 -2 L-30 -6 Z" fill="#4a2e26"/>
    <path d="M-30 -8 L-20 -8 L-18 -2 L28 -2 L34 -6" stroke="#d9a73f" stroke-width="1.4" fill="none"/>
    ${[-14, -7, 0, 7, 14, 21].map(x => `<rect x="${x - 1.5}" y="3" width="3" height="2.8" fill="#111"/><rect x="${x - 1.5}" y="7" width="3" height="2.4" fill="#111"/>`).join('')}
    <rect x="-28" y="-12" width="3" height="3" fill="#ffd96b" class="glow"/>
    ${mast(-12, -36, -2)}${mast(4, -42, -2)}${mast(19, -32, -2)}
    ${squareSail(-12, -33, 13, 10, '#8a2b2b')}${squareSail(-12, -20, 15, 11, '#7a2424')}
    ${squareSail(4, -39, 14, 11, '#8a2b2b')}${squareSail(4, -25, 17, 13, '#7a2424')}
    ${squareSail(19, -29, 11, 9, '#8a2b2b')}${squareSail(19, -17, 13, 10, '#7a2424')}
    <circle cx="4" cy="-20" r="3.2" fill="#1d1d22"/><circle cx="4" cy="-20.5" r="1.5" fill="#e9e3d6"/>
    <path d="M34 -6 L44 -12" stroke="#2a1d1d" stroke-width="1.4"/>
    ${jolly(4, -51, 1.2)}</g>`;
}

/** Start-screen island picture. */
export const heroIsland = `
<svg viewBox="-120 -80 240 150" class="hero" aria-hidden="true">
  <g class="waves">
    <path d="M-120 40 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="rgba(233,244,242,.35)" stroke-width="2" fill="none"/>
    <path d="M-135 55 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="rgba(233,244,242,.2)" stroke-width="2" fill="none"/>
  </g>
  <ellipse cx="0" cy="34" rx="92" ry="20" fill="#f1d9a0"/>
  <ellipse cx="0" cy="28" rx="84" ry="18" fill="#7cc36b"/>
  <g transform="translate(-40,18) scale(1.2)">${tree(0, 0)}</g>
  <g transform="translate(-58,26) scale(1)">${tree(0, 0)}</g>
  <g transform="translate(5,18) scale(1.3)">${cottage(0, 0)}</g>
  <g transform="translate(52,22) scale(1.05)">${cottage(0, 0, 1, '#4f8fd0')}</g>
  <g transform="translate(30,30) scale(.9)">${tree(0, 0)}</g>
  <g transform="translate(74,12) scale(1)"><path d="M-6 2 L-4 -26 L4 -26 L6 2 Z" fill="#fff"/><path d="M-5.6 -4 L5.6 -4 L5.2 -10 L-5.2 -10 Z" fill="#e0604f"/><path d="M-4.8 -16 L4.8 -16 L4.5 -21 L-4.5 -21 Z" fill="#e0604f"/><rect x="-4" y="-32" width="8" height="6" fill="#ffe27a" class="glow"/><path d="M-6 -32 L0 -37 L6 -32 Z" fill="#3a3f55"/></g>
  <g transform="translate(-88,44)">${boatSvg('sailboat', 0.7)}</g>
  <circle cx="-80" cy="-50" r="10" fill="#ffd34d" opacity=".9"/>
</svg>`;

/** Small icons for the resource bar. */
export const ICONS: Record<string, string> = {
  food: `<svg viewBox="-12 -12 24 24"><path d="M-9 0 Q-3 -7 5 0 Q-3 7 -9 0 Z" fill="#6fb7d6"/><path d="M5 0 L10 -5 L10 5 Z" fill="#4f9cc0"/><circle cx="-4" cy="-1" r="1.3" fill="#123"/></svg>`,
  wood: `<svg viewBox="-12 -12 24 24"><rect x="-9" y="-5" width="18" height="10" rx="5" fill="#a87447"/><ellipse cx="7" cy="0" rx="3" ry="5" fill="#e0b27c"/><ellipse cx="7" cy="0" rx="1.4" ry="2.4" fill="#c48d55"/></svg>`,
  stone: `<svg viewBox="-12 -12 24 24"><path d="M-9 6 L-7 -3 L0 -8 L7 -3 L9 6 Z" fill="#a3a6ab"/><path d="M0 -8 L7 -3 L9 6 L2 6 Z" fill="#7f8389"/></svg>`,
  pearls: `<svg viewBox="-12 -12 24 24"><circle r="7" fill="#f4eefc"/><circle cx="-2.5" cy="-2.5" r="2.5" fill="#fff"/><circle r="7" fill="none" stroke="#c9b8e8" stroke-width="1.2"/></svg>`,
  pop: `<svg viewBox="-12 -12 24 24"><circle cx="-4" cy="-4" r="3.5" fill="#ffd9b0"/><path d="M-10 8 Q-4 -2 2 8 Z" fill="#e0604f"/><circle cx="5" cy="-2" r="3" fill="#ffd9b0"/><path d="M0 9 Q5 1 10 9 Z" fill="#4f8fd0"/></svg>`,
  def: `<svg viewBox="-12 -12 24 24"><path d="M0 -10 L8 -6 Q8 5 0 10 Q-8 5 -8 -6 Z" fill="#8a78c0"/><path d="M0 -10 L8 -6 Q8 5 0 10 Z" fill="#6f5fa6"/><path d="M-3 0 L-1 3 L4 -3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
};
