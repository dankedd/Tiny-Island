import type { BoatType, Building, BuildingType, Terrain } from './game/types';

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

const cottage = (x: number, y: number, k = 1, roof = '#d9534f', wall = '#fff4e2') => `
  <g transform="translate(${x},${y}) scale(${k})">
    ${shadow(11, 3, 8)}
    <rect x="-9" y="-5" width="18" height="13" rx="1" fill="${wall}"/>
    <rect x="-9" y="-5" width="18" height="2.5" fill="rgba(0,0,0,.06)"/>
    <path d="M-11.5 -4 L0 -15 L11.5 -4 Z" fill="${roof}"/>
    <path d="M0 -15 L11.5 -4 L6 -4 Z" fill="rgba(0,0,0,.14)"/>
    <rect x="4.5" y="-15" width="3" height="6" fill="#9b6b49"/>
    <rect x="-2.3" y="1" width="4.6" height="7" rx="2" fill="#8a5a36"/>
    <rect x="-7" y="-1.5" width="3.6" height="3.6" rx=".6" fill="#ffd96b"/>
    <rect x="3.4" y="-1.5" width="3.6" height="3.6" rx=".6" fill="#ffd96b"/>
  </g>`;

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

export function terrainLayer(terrain: Record<string, Terrain>, toPixel: (k: string) => { x: number; y: number }): string {
  let cliffs = '', foam = '', ground = '', nature = '';
  const land = Object.entries(terrain).filter(([, t]) => t !== 'sea');
  for (const [k, t] of land) {
    const { x, y } = toPixel(k);
    foam += `<polygon points="${hexPoints(x, y + 3, S + 7)}" class="foam"/>`;
    cliffs += `<polygon points="${hexPoints(x, y + 7, S + 0.8)}" fill="#c9a66b"/>`;
    const rnd = cellRand(k);
    const fill = t === 'beach' ? '#f1d9a0' : t === 'rocks' ? '#b9b4a6' : GRASS[Math.floor(rnd() * 3)];
    ground += `<polygon points="${hexPoints(x, y, S + 0.8)}" fill="${fill}"/>`;
    if (t === 'grass' && rnd() < 0.6) {
      for (let i = 0; i < 3; i++) {
        const gx = x + (rnd() - 0.5) * S * 1.2, gy = y + (rnd() - 0.5) * S * 1.1;
        ground += `<path d="M${gx.toFixed(1)} ${gy.toFixed(1)} l-2 -4 M${gx.toFixed(1)} ${gy.toFixed(1)} l0 -5 M${gx.toFixed(1)} ${gy.toFixed(1)} l2 -4" stroke="#6aae57" stroke-width="1.2" stroke-linecap="round"/>`;
      }
    }
    if (t === 'beach' && rnd() < 0.4) ground += `<circle cx="${(x + (rnd() - 0.5) * S).toFixed(1)}" cy="${(y + (rnd() - 0.5) * S).toFixed(1)}" r="1.6" fill="#fff6e0"/>`;
    if (t === 'forest') {
      const n = 5 + Math.floor(rnd() * 3);
      const trees: [number, number, number, number][] = [];
      for (let i = 0; i < n; i++) trees.push([x + (rnd() - 0.5) * S * 1.3, y + (rnd() - 0.5) * S * 1.2 + 4, 1.05 + rnd() * 0.45, Math.floor(rnd() * 3)]);
      trees.sort((a, b) => a[1] - b[1]);
      nature += trees.map(([tx, ty, tk, tone]) => tree(tx, ty, tk, tone)).join('');
    }
    if (t === 'rocks') {
      const n = 3 + Math.floor(rnd() * 2);
      const rocks: [number, number, number][] = [];
      for (let i = 0; i < n; i++) rocks.push([x + (rnd() - 0.5) * S * 1.2, y + (rnd() - 0.5) * S * 1.1, 0.9 + rnd() * 0.7]);
      rocks.sort((a, b) => a[1] - b[1]);
      nature += rocks.map(([rx, ry, rk]) => boulder(rx, ry, rk)).join('');
    }
  }
  return `<g class="terrain"><g class="foamring">${foam}</g>${cliffs}${ground}</g><g class="nature">${nature}</g>`;
}

// ---------- paths ----------

/** Path segments: from each path tile to its neighbours that are paths, the square or buildings. */
export function pathLayer(
  b: Record<string, Building>, neighboursOf: (k: string) => string[], toPixel: (k: string) => { x: number; y: number },
): string {
  let base = '', top = '';
  const seg = (a: { x: number; y: number }, c: { x: number; y: number }, half: boolean) => {
    const ex = half ? (a.x + c.x) / 2 : c.x, ey = half ? (a.y + c.y) / 2 : c.y;
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`;
    base += `<path d="${d}"/>`;
    top += `<path d="${d}"/>`;
  };
  for (const [k, v] of Object.entries(b)) {
    if (v.t === 'plaza') {
      // Short paths from the town square to buildings right next to it.
      const p = toPixel(k);
      for (const n of neighboursOf(k)) if (b[n] && b[n].t !== 'road') seg(p, toPixel(n), true);
      continue;
    }
    if (v.t !== 'road') continue;
    const p = toPixel(k);
    base += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8"/>`;
    top += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5"/>`;
    for (const n of neighboursOf(k)) {
      const nv = b[n];
      if (!nv) continue;
      if (nv.t === 'road') { if (k < n) seg(p, toPixel(n), false); }
      else seg(p, toPixel(n), nv.t !== 'plaza');
    }
  }
  return `<g class="path-base">${base}</g><g class="path-top">${top}</g>`;
}

// ---------- buildings ----------

const DIR_ANGLE = [0, -60, -120, 180, 120, 60]; // degrees for the six hex neighbours (pointy-top axial)

const BIG: BuildingType[] = ['house', 'farm', 'lumber', 'quarry', 'tower', 'ruin'];

export function buildingSvg(v: Building, opts: { farmed?: boolean; idle?: boolean } = {}): string {
  const art = buildingArt(v, opts);
  return BIG.includes(v.t) ? `<g transform="scale(1.4)">${art}</g>` : art;
}

function buildingArt(v: Building, opts: { farmed?: boolean; idle?: boolean }): string {
  const l = v.l;
  switch (v.t) {
    case 'plaza':
      return `<circle r="${S * 0.62}" fill="#d9c9a3"/><circle r="${S * 0.62}" fill="none" stroke="#bfae86" stroke-width="2"/>
        ${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<circle cx="${(Math.cos(a) * S * 0.42).toFixed(1)}" cy="${(Math.sin(a) * S * 0.42).toFixed(1)}" r="2.2" fill="#c8b68e"/>`; }).join('')}
        ${shadow(10, 3.5, 5)}<circle r="9" fill="#9aa3ad"/><circle r="6.5" fill="#6fb7d6"/><circle cx="-2" cy="-2" r="2" fill="#bfe6f5"/>
        ${flag(14, -6, '#ffd34d')}`;
    case 'road':
      return '';
    case 'house':
      if (l === 1) return cottage(0, 2, 1.45);
      if (l === 2) return cottage(-10, -2, 1.15) + cottage(9, 7, 1.15, '#4f8fd0');
      return `<g transform="translate(-4,4) scale(1.3)">${shadow(13, 3.5, 9)}
        <rect x="-10" y="-17" width="20" height="26" rx="1" fill="#fff4e2"/>
        <path d="M-12.5 -16 L0 -27 L12.5 -16 Z" fill="#d9534f"/><path d="M0 -27 L12.5 -16 L7 -16 Z" fill="rgba(0,0,0,.14)"/>
        ${[-12, -4, 4].map(yy => `<rect x="-7" y="${yy}" width="4" height="4" fill="#ffd96b"/><rect x="3" y="${yy}" width="4" height="4" fill="#ffd96b"/>`).join('')}
        <rect x="-2.5" y="2" width="5" height="7" rx="2" fill="#8a5a36"/></g>${roundTree(16, 10, 1.1)}`;
    case 'farm': {
      let g = `<g transform="translate(-4,2) scale(1.3)">${shadow(14, 3.5, 9)}
        <rect x="-11" y="-6" width="22" height="15" fill="#c9553f"/>
        <path d="M-13 -5 L0 -17 L13 -5 Z" fill="#8a3a2c"/>
        <rect x="-4" y="1" width="8" height="8" fill="#f4e3c8"/><path d="M-4 1 L4 9 M4 1 L-4 9" stroke="#c9553f" stroke-width="1.2"/>
        <rect x="-9" y="-3" width="4" height="3" fill="#f4e3c8"/></g>`;
      if (l >= 2) g += `<g transform="translate(17,0) scale(1.2)">${shadow(5, 2, 9)}<rect x="-4" y="-14" width="8" height="23" rx="4" fill="#d8dde3"/><path d="M-4 -12 Q0 -19 4 -12" fill="#9aa3ad"/><rect x="-4" y="-4" width="8" height="1.5" fill="#b5bcc4"/></g>`;
      if (l >= 3) g += `<g transform="translate(-20,-8)"><rect x="-3" y="-6" width="6" height="16" fill="#f4e3c8"/><path d="M-4 -6 L0 -11 L4 -6 Z" fill="#8a3a2c"/><g transform="translate(0,-7)"><g class="spin"><rect x="-1.2" y="-13" width="2.4" height="26" fill="#7a5130"/><rect x="-13" y="-1.2" width="26" height="2.4" fill="#7a5130"/></g></g><circle cx="0" cy="-7" r="2" fill="#5a3a20"/></g>`;
      g += `<g transform="translate(10,14)"><ellipse rx="5" ry="3" fill="#fff"/><circle cx="4" cy="-1" r="2.2" fill="#fff"/><circle cx="-2" cy="-1" r="1.4" fill="#333"/></g>`;
      return g;
    }
    case 'field': {
      const crop = opts.farmed === false ? '#b59a5a' : '#e7c64f';
      const leaf = opts.farmed === false ? '#9c8a5e' : '#7bb661';
      let g = `<polygon points="${hexPoints(0, 0, S * 0.86)}" fill="${opts.farmed === false ? '#a98b5c' : '#9b7a4c'}"/>`;
      for (let i = -3; i <= 3; i++) {
        const y = i * 8;
        const w = Math.sqrt(Math.max(0, (S * 0.78) ** 2 - y * y)) * 0.95;
        g += `<path d="M${-w} ${y} L${w} ${y}" stroke="${leaf}" stroke-width="4" stroke-linecap="round"/>`;
        for (let x = -w + 3; x <= w - 3; x += 6) g += `<circle cx="${x.toFixed(1)}" cy="${y - 1.5}" r="2" fill="${crop}"/>`;
      }
      if (opts.farmed === false) g += `<g transform="translate(0,-4)"><circle r="9" fill="#fff" stroke="#e0604f" stroke-width="2"/><text y="4" text-anchor="middle" font-size="12" font-weight="800" fill="#e0604f">!</text></g>`;
      return g;
    }
    case 'lumber': {
      let g = `<g transform="translate(-6,0) scale(1.25)">${shadow(12, 3, 8)}
        <rect x="-10" y="-5" width="20" height="13" fill="#9b6b49"/>
        ${[-3, 0, 3, 6].map(yy => `<rect x="-10" y="${yy - 2}" width="20" height="1" fill="#7a5130"/>`).join('')}
        <path d="M-12 -4 L0 -14 L12 -4 Z" fill="#5d7a3a"/><rect x="-2.5" y="1" width="5" height="7" fill="#5a3a20"/></g>`;
      g += logs(14, 10, 1.05);
      if (l >= 2) g += logs(-16, 14, 0.9);
      if (l >= 3) g += `<g transform="translate(16,-12)"><rect x="-6" y="-2" width="12" height="4" fill="#a87447"/><circle r="5" cy="-5" fill="none" stroke="#9aa3ad" stroke-width="1.6"/></g>`;
      g += `<g transform="translate(4,16)"><ellipse rx="4" ry="2" fill="#c49a62"/><path d="M-1 -1 L5 -8" stroke="#5a3a20" stroke-width="1.4"/><path d="M4 -9 L8 -7 L6 -5 Z" fill="#9aa3ad"/></g>`;
      return g;
    }
    case 'quarry': {
      let g = `<ellipse cx="0" cy="4" rx="${S * 0.62}" ry="${S * 0.42}" fill="#8f8a80"/><ellipse cx="0" cy="6" rx="${S * 0.45}" ry="${S * 0.28}" fill="#6f6a62"/>`;
      g += [[-10, -2], [-3, -4], [4, -3]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="5" fill="#c9ccd1" stroke="#9a9ca1" stroke-width=".8"/>`).join('');
      g += boulder(14, 12, 0.8, '#a3a6ab');
      if (l >= 2) g += `<g transform="translate(-14,14)"><rect x="-7" y="-5" width="14" height="7" fill="#8a5a36"/><rect x="-5" y="-8" width="4" height="3" fill="#c9ccd1"/><rect x="0" y="-8" width="4" height="3" fill="#c9ccd1"/><circle cx="-4" cy="3" r="2.2" fill="#333"/><circle cx="4" cy="3" r="2.2" fill="#333"/></g>`;
      if (l >= 3) g += `<g transform="translate(12,-12)" class="shine"><path d="M0 -9 L5 -2 L0 5 L-5 -2 Z" fill="#c9a8ff"/><path d="M0 -9 L5 -2 L0 -1 Z" fill="#efe2ff"/></g>`;
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

export const pirateShip = `
  <g class="ship-shape">
    <path d="M-16 0 L16 0 L11 9 L-11 9 Z" fill="#3a2a2a"/>
    <path d="M-16 0 L16 0 L15 2 L-15 2 Z" fill="#5b4040"/>
    <rect x="-1" y="-24" width="2" height="24" fill="#2a1d1d"/>
    <path d="M1 -22 Q12 -14 1 -4 Z" fill="#d8dde3"/>
    <path d="M-1 -22 Q-11 -14 -1 -4 Z" fill="#c4cad1"/>
    <path d="M1 -26 L9 -24 L1 -22 Z" fill="#222"/>
    <circle cx="0" cy="-14" r="2.4" fill="#222" opacity=".8"/>
  </g>`;

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
