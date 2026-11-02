import { CONFIG } from './config';
import { inGrid, key, neighbours, parse } from './hex';
import type { Cost, GameState, NightReport, PlaceableType, Resources, Rng, Tile, TileType } from './types';
import { TILES } from './tiles';

const RES_KEYS = ['voedsel', 'hout', 'steen', 'parels'] as const;

export function newGame(rng: Rng = Math.random): GameState {
  return {
    version: 1,
    tiles: { '0,0': { t: 'huis', l: 1 }, '1,0': { t: 'akker', l: 1 }, '-1,1': { t: 'bos', l: 1 } },
    res: { ...CONFIG.startResources },
    turn: 0,
    day: 1,
    offers: drawOffers(rng),
    fished: false,
    over: false,
    storms: 0,
  };
}

export function drawOffers(rng: Rng): PlaceableType[] {
  const pool = Object.entries(CONFIG.offerWeights) as [PlaceableType, number][];
  const total = pool.reduce((a, [, w]) => a + w, 0);
  const out: PlaceableType[] = [];
  while (out.length < 3) {
    let x = rng() * total;
    let pick = pool[0][0];
    for (const [t, w] of pool) {
      if ((x -= w) < 0) { pick = t; break; }
    }
    // Too many of this type already: take the next type in the pool instead, so a run of bad luck cannot loop forever.
    let idx = pool.findIndex(([t]) => t === pick);
    while (out.filter(o => o === pool[idx][0]).length >= CONFIG.maxHandDuplicates) idx = (idx + 1) % pool.length;
    out.push(pool[idx][0]);
  }
  return out;
}

export const tileAt = (s: GameState, q: number, r: number): Tile | undefined => s.tiles[key(q, r)];
export const seaCount = (s: GameState, q: number, r: number): number =>
  neighbours(q, r).filter(([a, b]) => !tileAt(s, a, b)).length;
export const neighboursOfType = (s: GameState, q: number, r: number, t: TileType): number =>
  neighbours(q, r).filter(([a, b]) => tileAt(s, a, b)?.t === t).length;

export function yieldOf(s: GameState, q: number, r: number, t: TileType, l: number): Partial<Resources> {
  switch (t) {
    case 'akker': return { voedsel: (1 + Math.min(2, neighboursOfType(s, q, r, 'huis'))) * l };
    case 'bos': return { hout: (1 + (neighboursOfType(s, q, r, 'bos') >= 2 ? 1 : 0)) * l };
    case 'steen': return { steen: l };
    case 'steiger': return { voedsel: Math.min(3, seaCount(s, q, r)) * l };
    default: return {};
  }
}

export function totals(s: GameState): { pop: number; def: number } {
  let pop = 0, def = 0;
  for (const v of Object.values(s.tiles)) {
    if (v.t === 'huis') pop += CONFIG.popPerHouseLevel * v.l;
    if (v.t === 'toren') def += CONFIG.defencePerTowerLevel * v.l;
  }
  return { pop, def };
}

export function score(s: GameState): number {
  const { pop } = totals(s);
  const levels = Object.values(s.tiles).reduce((a, v) => a + (v.t === 'ruine' ? 0 : v.l), 0);
  const c = CONFIG.score;
  return pop * c.perResident + s.res.parels * c.perPearl + levels * c.perTileLevel;
}

export const isStormNight = (day: number): boolean => day % CONFIG.stormEvery === 0;
export const stormPower = (s: GameState): number => CONFIG.stormBase + CONFIG.stormStep * s.storms;

export function canPlace(s: GameState, q: number, r: number, t: PlaceableType): boolean {
  if (s.over || !inGrid(q, r, CONFIG.gridRadius) || tileAt(s, q, r)) return false;
  if (!neighbours(q, r).some(([a, b]) => tileAt(s, a, b))) return false;
  if (t === 'steiger' && seaCount(s, q, r) < 1) return false;
  return true;
}

export function upgradeCost(v: Tile): Cost | null {
  if (v.t === 'ruine') return { ...CONFIG.rebuildCost };
  if (v.l === 1) return { ...CONFIG.upgradeCost[2] };
  if (v.l === 2) return { ...CONFIG.upgradeCost[3] };
  return null;
}
export const canPay = (s: GameState, c: Cost): boolean =>
  (Object.entries(c) as [keyof Resources, number][]).every(([k, n]) => s.res[k] >= n);

/** Places the offer at index `i` on (q, r). Returns a night report when this turn ended the day. */
export function place(s: GameState, i: number, q: number, r: number, rng: Rng = Math.random): NightReport | null {
  const t = s.offers[i];
  if (!t || !canPlace(s, q, r, t)) throw new Error('Ongeldige zet');
  s.tiles[key(q, r)] = { t, l: 1 };
  s.turn++;
  s.offers = drawOffers(rng);
  return s.turn % CONFIG.turnsPerDay === 0 ? nightfall(s, rng) : null;
}

export function upgrade(s: GameState, k: string): boolean {
  const v = s.tiles[k];
  if (!v) return false;
  const c = upgradeCost(v);
  if (!c || !canPay(s, c)) return false;
  for (const [n, amount] of Object.entries(c) as [keyof Resources, number][]) s.res[n] -= amount;
  if (v.t === 'ruine') { v.t = 'huis'; v.l = 1; } else v.l++;
  return true;
}

export const formatYield = (y: Partial<Resources>): string =>
  RES_KEYS.filter(k => y[k]).map(k => `+${y[k]} ${k}`).join(', ') || 'geen opbrengst';

export function nightfall(s: GameState, rng: Rng = Math.random): NightReport {
  const lines: string[] = [];
  const before = { ...s.res };
  for (const [k, v] of Object.entries(s.tiles)) {
    const [a, b] = parse(k);
    const y = yieldOf(s, a, b, v.t, v.l);
    for (const n of RES_KEYS) s.res[n] += y[n] ?? 0;
  }
  lines.push(`Je eiland leverde ${formatYield({ voedsel: s.res.voedsel - before.voedsel, hout: s.res.hout - before.hout, steen: s.res.steen - before.steen })} op.`);

  const { pop, def } = totals(s);
  const need = pop * CONFIG.foodPerResident;
  const ate = Math.min(need, s.res.voedsel);
  s.res.voedsel -= ate;
  lines.push(`Je ${pop} bewoners aten ${ate} voedsel.`);
  const short = need - ate;
  if (short > 0) {
    const houses = Object.values(s.tiles).filter(v => v.t === 'huis');
    const leave = Math.ceil(short / 2);
    for (let i = 0; i < leave && houses.length; i++) {
      const v = houses.splice(Math.floor(rng() * houses.length), 1)[0];
      if (v.l > 1) v.l--; else { v.t = 'ruine'; v.l = 1; }
    }
    lines.push(`Er was ${short} voedsel te weinig. ${leave} ${leave === 1 ? 'huis raakte' : 'huizen raakten'} bewoners kwijt.`);
  }

  const storm = isStormNight(s.day);
  if (storm) {
    const p = stormPower(s);
    s.storms++;
    if (def >= p) {
      s.res.parels += 1; s.res.steen += 3;
      lines.push(`De Nevelrovers (kracht ${p}) botsten op je verdediging (${def}). Buit: 1 parel en 3 steen.`);
    } else {
      const loss = p - def;
      const lh = Math.min(s.res.hout, loss);
      const ls = Math.min(s.res.steen, Math.ceil(loss / 2));
      s.res.hout -= lh; s.res.steen -= ls;
      const coast = Object.entries(s.tiles).filter(([k, v]) => {
        const [a, b] = parse(k);
        return v.t !== 'toren' && v.t !== 'ruine' && seaCount(s, a, b) > 0;
      });
      let hit = '';
      if (coast.length) {
        const v = coast[Math.floor(rng() * coast.length)][1];
        hit = ` Ze plunderden ook je ${TILES[v.t].naam.toLowerCase()}, nu een ruïne.`;
        v.t = 'ruine'; v.l = 1;
      }
      lines.push(`De Nevelrovers (kracht ${p}) waren sterker dan je verdediging (${def}). Ze namen ${lh} hout en ${ls} steen mee.${hit}`);
    }
  }

  const title = `${storm ? 'Stormnacht' : 'Nacht'} ${s.day}`;
  s.fished = false;
  if (s.day >= CONFIG.days) {
    s.over = true;
    return { title, lines, isStorm: storm, gameOver: true };
  }
  s.day++;
  return { title, lines, isStorm: storm, gameOver: false };
}

export type FishResult = { kind: 'perfect' | 'good' | 'miss'; food: number; pearls: number };

export function bestDockLevel(s: GameState): number {
  return Math.max(0, ...Object.values(s.tiles).filter(v => v.t === 'steiger').map(v => v.l));
}
export const canFish = (s: GameState): boolean => !s.over && !s.fished && bestDockLevel(s) > 0;

/** `rel` = marker position relative to the green zone (0..1 means inside). */
export function resolveFish(s: GameState, rel: number): FishResult {
  const lvl = bestDockLevel(s);
  const f = CONFIG.fishing;
  let res: FishResult;
  if (rel >= f.perfectFrom && rel <= f.perfectTo) res = { kind: 'perfect', food: 4 + 2 * lvl, pearls: 1 };
  else if (rel >= 0 && rel <= 1) res = { kind: 'good', food: 3 + 2 * lvl, pearls: 0 };
  else res = { kind: 'miss', food: 1, pearls: 0 };
  s.res.voedsel += res.food;
  s.res.parels += res.pearls;
  s.fished = true;
  return res;
}
