import type { TileType } from './game/types';

/**
 * Hand-drawn tile art as SVG strings. Every tile is a little 3D hex block
 * (earth side + coloured top) with its own decoration that grows with its level.
 * Coordinates are local: (0, 0) is the centre of the top face, `s` is the hex size.
 */

const TOP: Record<TileType, string> = {
  field: '#e9cf6a',
  forest: '#6fbf5e',
  house: '#8fd07a',
  quarry: '#c4bcae',
  dock: '#f3dca4',
  tower: '#86c873',
  ruin: '#b3a892',
};
const EDGE: Record<TileType, string> = {
  field: '#d4b54c',
  forest: '#58a84a',
  house: '#74b862',
  quarry: '#a9a093',
  dock: '#e2c483',
  tower: '#6db35c',
  ruin: '#9a8f78',
};

export function hexPoints(cx: number, cy: number, s: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}

const tree = (x: number, y: number, k = 1) => `
  <g transform="translate(${x},${y}) scale(${k})">
    <ellipse cx="0" cy="7" rx="6" ry="2" fill="rgba(0,0,0,.18)"/>
    <rect x="-1.4" y="2" width="2.8" height="5" rx="1" fill="#7a5130"/>
    <path d="M0 -12 L7 0 L-7 0 Z" fill="#2f7a3d"/>
    <path d="M0 -16 L5.5 -6 L-5.5 -6 Z" fill="#3f9a4c"/>
    <path d="M0 -16 L2.5 -11 L-1 -9 Z" fill="#6cc46f" opacity=".7"/>
  </g>`;

const house = (x: number, y: number, k = 1, roof = '#e0604f') => `
  <g transform="translate(${x},${y}) scale(${k})">
    <ellipse cx="0" cy="7" rx="9" ry="2.5" fill="rgba(0,0,0,.18)"/>
    <rect x="-7" y="-4" width="14" height="11" rx="1" fill="#fff4e2"/>
    <rect x="-7" y="-4" width="14" height="2" fill="#f0dcc0"/>
    <path d="M-9 -3 L0 -12 L9 -3 Z" fill="${roof}"/>
    <path d="M0 -12 L9 -3 L5 -3 Z" fill="rgba(0,0,0,.12)"/>
    <rect x="3.5" y="-12" width="2.6" height="5" fill="#9b6b49"/>
    <rect x="-2" y="1" width="4" height="6" rx="1.5" fill="#9b6b49"/>
    <rect x="-5.6" y="-1" width="3" height="3" rx=".5" fill="#ffd96b"/>
    <rect x="2.6" y="-1" width="3" height="3" rx=".5" fill="#ffd96b"/>
  </g>`;

const rock = (x: number, y: number, k = 1, c = '#8e9196') => `
  <g transform="translate(${x},${y}) scale(${k})">
    <ellipse cx="0" cy="4" rx="7" ry="2" fill="rgba(0,0,0,.18)"/>
    <path d="M-7 4 L-5 -3 L0 -6 L5 -3 L7 4 Z" fill="${c}"/>
    <path d="M0 -6 L5 -3 L7 4 L2 4 Z" fill="rgba(0,0,0,.15)"/>
    <path d="M-5 -3 L0 -6 L-1 -1 Z" fill="rgba(255,255,255,.35)"/>
  </g>`;

function decoration(t: TileType, l: number): string {
  switch (t) {
    case 'forest': {
      const spots: [number, number, number][][] = [
        [[-8, 2, 1], [7, 0, 1.05], [0, 10, .9]],
        [[-10, 0, 1], [8, -2, 1.05], [-2, 10, .95], [11, 10, .85]],
        [[-11, 0, 1], [0, -6, 1.15], [11, 0, 1], [-5, 11, .95], [7, 12, .9]],
      ];
      return spots[l - 1].map(([x, y, k]) => tree(x, y, k)).join('');
    }
    case 'field': {
      let g = '';
      for (let i = -1; i <= 1; i++) {
        const y = i * 7 + 2;
        g += `<path d="M-15 ${y + 3} Q0 ${y - 3} 15 ${y + 3}" stroke="#c9a227" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        for (let x = -11; x <= 11; x += 5.5) g += `<circle cx="${x}" cy="${y - 0.5 + Math.abs(x) / 8}" r="1.5" fill="#f7e08a"/>`;
      }
      if (l >= 2) g += `<g transform="translate(13,-8)"><rect x="-5" y="-3" width="10" height="8" fill="#c9553f"/><path d="M-6 -3 L0 -8 L6 -3 Z" fill="#8a3a2c"/><rect x="-1.5" y="1" width="3" height="4" fill="#f4e3c8"/></g>`;
      if (l >= 3) g += `<g transform="translate(-12,-6)"><rect x="-2.5" y="-4" width="5" height="12" fill="#f4e3c8"/><path d="M-3 -4 L0 -8 L3 -4 Z" fill="#8a3a2c"/><g class="spin" transform="translate(0,-5)"><rect x="-1" y="-10" width="2" height="20" fill="#7a5130"/><rect x="-10" y="-1" width="20" height="2" fill="#7a5130"/></g><circle cx="0" cy="-5" r="1.6" fill="#5a3a20"/></g>`;
      return g;
    }
    case 'house':
      if (l === 1) return house(0, 1, 1.1);
      if (l === 2) return house(-7, -1, .95) + house(7, 5, .95, '#4f8fd0');
      return `<g transform="translate(0,2)">
        <ellipse cx="0" cy="9" rx="11" ry="2.5" fill="rgba(0,0,0,.18)"/>
        <rect x="-8" y="-12" width="16" height="21" rx="1" fill="#fff4e2"/>
        <path d="M-10 -11 L0 -20 L10 -11 Z" fill="#e0604f"/>
        <rect x="-5.5" y="-8" width="3.5" height="3.5" fill="#ffd96b"/><rect x="2" y="-8" width="3.5" height="3.5" fill="#ffd96b"/>
        <rect x="-5.5" y="-1" width="3.5" height="3.5" fill="#ffd96b"/><rect x="2" y="-1" width="3.5" height="3.5" fill="#ffd96b"/>
        <rect x="-2" y="4" width="4" height="5" rx="1.5" fill="#9b6b49"/></g>` + tree(13, 8, .7);
    case 'quarry': {
      let g = rock(-7, 2, 1.1) + rock(7, -2, 1) + rock(2, 9, .8, '#a3a6ab');
      if (l >= 2) g += `<g transform="translate(-12,-8)"><rect x="-4" y="-3" width="8" height="5" fill="#8a5a36"/><circle cx="-2.5" cy="2.5" r="1.6" fill="#333"/><circle cx="2.5" cy="2.5" r="1.6" fill="#333"/></g>`;
      if (l >= 3) g += `<g transform="translate(11,8)" class="shine"><path d="M0 -8 L4 -2 L0 4 L-4 -2 Z" fill="#c9a8ff"/><path d="M0 -8 L4 -2 L0 -1 Z" fill="#efe2ff"/></g>`;
      return g;
    }
    case 'dock': {
      let g = `<path d="M-14 -4 Q0 -10 14 -4 L14 4 Q0 10 -14 4 Z" fill="#9fd4e8" opacity=".45"/>`;
      g += `<g><rect x="-3" y="-14" width="6" height="26" fill="#a87447"/>`;
      for (let y = -12; y <= 10; y += 4) g += `<rect x="-3.5" y="${y}" width="7" height="1" fill="#7a5130"/>`;
      g += `<rect x="-5" y="10" width="2" height="4" fill="#5a3a20"/><rect x="3" y="10" width="2" height="4" fill="#5a3a20"/></g>`;
      if (l >= 2) g += `<g class="bob" transform="translate(11,2)"><path d="M-6 0 L6 0 L4 4 L-4 4 Z" fill="#c9553f"/><rect x="-.5" y="-9" width="1" height="9" fill="#5a3a20"/><path d="M.5 -9 L6 -2 L.5 -2 Z" fill="#fff"/></g>`;
      if (l >= 3) g += `<g class="bob" transform="translate(-11,6)"><path d="M-5 0 L5 0 L3 3 L-3 3 Z" fill="#4f8fd0"/></g>`;
      return g;
    }
    case 'tower':
      if (l < 3) {
        const h = l === 1 ? 20 : 26;
        return `<g transform="translate(0,6)">
          <ellipse cx="0" cy="3" rx="9" ry="2.5" fill="rgba(0,0,0,.2)"/>
          <rect x="-6" y="${-h}" width="12" height="${h + 2}" fill="${l === 1 ? '#b88b5a' : '#a9a9b0'}"/>
          <rect x="-6" y="${-h}" width="4" height="${h + 2}" fill="rgba(255,255,255,.18)"/>
          <path d="M-8 ${-h} h4 v-3 h3 v3 h2 v-3 h3 v3 h4 v-2 h-16 Z" fill="${l === 1 ? '#9a6f45' : '#8e8e96'}"/>
          <rect x="-2" y="${-h + 6}" width="4" height="5" rx="2" fill="#3a2a45"/>
          <rect x="-.5" y="${-h - 13}" width="1.2" height="12" fill="#5a3a20"/>
          <path class="flag" d="M.7 ${-h - 13} L9 ${-h - 10} L.7 ${-h - 7} Z" fill="#e0604f"/></g>`;
      }
      return `<g transform="translate(0,7)">
        <ellipse cx="0" cy="3" rx="9" ry="2.5" fill="rgba(0,0,0,.2)"/>
        <path d="M-6 2 L-4 -26 L4 -26 L6 2 Z" fill="#fff"/>
        <path d="M-5.6 -4 L5.6 -4 L5.2 -10 L-5.2 -10 Z" fill="#e0604f"/>
        <path d="M-4.8 -16 L4.8 -16 L4.5 -21 L-4.5 -21 Z" fill="#e0604f"/>
        <rect x="-4" y="-32" width="8" height="6" fill="#ffe27a" class="glow"/>
        <path d="M-6 -32 L0 -37 L6 -32 Z" fill="#3a3f55"/></g>`;
    case 'ruin':
      return `<g transform="translate(0,4)">
        <path d="M-10 4 L-10 -8 L-6 -10 L-4 -4 L-2 -6 L-2 4 Z" fill="#8f8a80"/>
        <path d="M3 4 L3 -4 L6 -7 L9 -2 L9 4 Z" fill="#8f8a80"/>
        ${rock(-1, 8, .5, '#7d786f')}${rock(10, 9, .4, '#7d786f')}</g>`;
  }
}

/** A complete tile: earth side, top face, decoration and level stars. */
export function tileSvg(t: TileType, l: number, s: number, extraClass = ''): string {
  const depth = s * 0.28;
  const stars = t === 'ruin' ? '' : Array.from({ length: l }, (_, i) =>
    `<path transform="translate(${(i - (l - 1) / 2) * 9},${s * 0.66}) scale(.55)" d="M0 -7 L2 -2 L7 -2 L3 1.5 L4.5 7 L0 4 L-4.5 7 L-3 1.5 L-7 -2 L-2 -2 Z" fill="#ffd34d" stroke="#7a5a10" stroke-width="1.2"/>`).join('');
  return `<g class="tile ${extraClass}">
    <polygon points="${hexPoints(0, depth, s - 1)}" fill="#a07a48"/>
    <polygon points="${hexPoints(0, depth * 0.55, s - 1)}" fill="#c49a62"/>
    <polygon points="${hexPoints(0, 0, s - 1)}" fill="${TOP[t]}" stroke="${EDGE[t]}" stroke-width="2"/>
    <polygon points="${hexPoints(0, -1, s - 6)}" fill="rgba(255,255,255,.10)"/>
    <g transform="translate(0,-2) scale(${(s / 30) * 1.3})">${decoration(t, l)}</g>
    ${stars}
  </g>`;
}

/** Small tile picture for the cards in your hand. */
export function cardSvg(t: TileType): string {
  return `<svg viewBox="-34 -34 68 72" aria-hidden="true">${tileSvg(t, 1, 30)}</svg>`;
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
  <g transform="translate(-40,18) scale(1.4)">${tree(0, 0)}</g>
  <g transform="translate(-58,26) scale(1.1)">${tree(0, 0)}</g>
  <g transform="translate(5,18) scale(1.6)">${house(0, 0)}</g>
  <g transform="translate(52,22) scale(1.3)">${house(0, 0, 1, '#4f8fd0')}</g>
  <g transform="translate(30,30) scale(1)">${tree(0, 0)}</g>
  <g transform="translate(74,12) scale(1)"><path d="M-6 2 L-4 -26 L4 -26 L6 2 Z" fill="#fff"/><path d="M-5.6 -4 L5.6 -4 L5.2 -10 L-5.2 -10 Z" fill="#e0604f"/><path d="M-4.8 -16 L4.8 -16 L4.5 -21 L-4.5 -21 Z" fill="#e0604f"/><rect x="-4" y="-32" width="8" height="6" fill="#ffe27a" class="glow"/><path d="M-6 -32 L0 -37 L6 -32 Z" fill="#3a3f55"/></g>
  <g class="bob" transform="translate(-88,44)"><path d="M-9 0 L9 0 L6 5 L-6 5 Z" fill="#c9553f"/><rect x="-.6" y="-13" width="1.2" height="13" fill="#5a3a20"/><path d="M.6 -13 L8 -3 L.6 -3 Z" fill="#fff"/></g>
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
