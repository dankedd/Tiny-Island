import { CONFIG } from './config';
import { inGrid, key, neighbours, parse } from './hex';
import type { Cost, GameState, NightReport, PlaceableType, Resources, Rng, Tile, TileType } from './types';
import { TILES } from './tiles';

const RES_KEYS = ['food', 'wood', 'stone', 'pearls'] as const;

export function newGame(rng: Rng = Math.random): GameState {
  return {
    version: 1,
    tiles: { '0,0': { t: 'house', l: 1 }, '1,0': { t: 'field', l: 1 }, '-1,1': { t: 'forest', l: 1 } },
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
    case 'field': return { food: (1 + Math.min(2, neighboursOfType(s, q, r, 'house'))) * l };
    case 'forest': return { wood: (1 + (neighboursOfType(s, q, r, 'forest') >= 2 ? 1 : 0)) * l };
    case 'quarry': return { stone: l };
    case 'dock': return { food: Math.min(3, seaCount(s, q, r)) * l };
    default: return {};
  }
}

export function totals(s: GameState): { pop: number; def: number } {
  let pop = 0, def = 0;
  for (const v of Object.values(s.tiles)) {
    if (v.t === 'house') pop += CONFIG.popPerHouseLevel * v.l;
    if (v.t === 'tower') def += CONFIG.defencePerTowerLevel * v.l;
  }
  return { pop, def };
}

export function score(s: GameState): number {
  const { pop } = totals(s);
  const levels = Object.values(s.tiles).reduce((a, v) => a + (v.t === 'ruin' ? 0 : v.l), 0);
  const c = CONFIG.score;
  return pop * c.perResident + s.res.pearls * c.perPearl + levels * c.perTileLevel;
}

export const isStormNight = (day: number): boolean => day % CONFIG.stormEvery === 0;
export const stormPower = (s: GameState): number => CONFIG.stormBase + CONFIG.stormStep * s.storms;

export function canPlace(s: GameState, q: number, r: number, t: PlaceableType): boolean {
  if (s.over || !inGrid(q, r, CONFIG.gridRadius) || tileAt(s, q, r)) return false;
  if (!neighbours(q, r).some(([a, b]) => tileAt(s, a, b))) return false;
  if (t === 'dock' && seaCount(s, q, r) < 1) return false;
  return true;
}

export function upgradeCost(v: Tile): Cost | null {
  if (v.t === 'ruin') return { ...CONFIG.rebuildCost };
  if (v.l === 1) return { ...CONFIG.upgradeCost[2] };
  if (v.l === 2) return { ...CONFIG.upgradeCost[3] };
  return null;
}
export const canPay = (s: GameState, c: Cost): boolean =>
  (Object.entries(c) as [keyof Resources, number][]).every(([k, n]) => s.res[k] >= n);

/** Places the offer at index `i` on (q, r). Returns a night report when this turn ended the day. */
export function place(s: GameState, i: number, q: number, r: number, rng: Rng = Math.random): NightReport | null {
  const t = s.offers[i];
  if (!t || !canPlace(s, q, r, t)) throw new Error('Invalid move');
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
  if (v.t === 'ruin') { v.t = 'house'; v.l = 1; } else v.l++;
  return true;
}

export const formatYield = (y: Partial<Resources>): string =>
  RES_KEYS.filter(k => y[k]).map(k => `+${y[k]} ${k}`).join(', ') || 'nothing';

export function nightfall(s: GameState, rng: Rng = Math.random): NightReport {
  const lines: string[] = [];
  const before = { ...s.res };
  const yields: NightReport['yields'] = [];
  for (const [k, v] of Object.entries(s.tiles)) {
    const [a, b] = parse(k);
    const y = yieldOf(s, a, b, v.t, v.l);
    if (Object.values(y).some(n => n)) yields.push({ k, y });
    for (const n of RES_KEYS) s.res[n] += y[n] ?? 0;
  }
  lines.push(`Your island made ${formatYield({ food: s.res.food - before.food, wood: s.res.wood - before.wood, stone: s.res.stone - before.stone })}.`);

  const { pop, def } = totals(s);
  const need = pop * CONFIG.foodPerResident;
  const ate = Math.min(need, s.res.food);
  s.res.food -= ate;
  lines.push(`Your ${pop} people ate ${ate} food.`);
  const short = need - ate;
  if (short > 0) {
    const houses = Object.values(s.tiles).filter(v => v.t === 'house');
    const leave = Math.ceil(short / 2);
    for (let i = 0; i < leave && houses.length; i++) {
      const v = houses.splice(Math.floor(rng() * houses.length), 1)[0];
      if (v.l > 1) v.l--; else { v.t = 'ruin'; v.l = 1; }
    }
    lines.push(`Not enough food! ${short} people were hungry, so ${leave} ${leave === 1 ? 'family' : 'families'} moved away.`);
  }

  const storm = isStormNight(s.day);
  let stormWon: boolean | undefined;
  if (storm) {
    const p = stormPower(s);
    s.storms++;
    stormWon = def >= p;
    if (stormWon) {
      s.res.pearls += 1; s.res.stone += 3;
      lines.push(`The Fog Pirates came (strength ${p}), but your towers (${def}) chased them away! You found 1 pearl and 3 stone.`);
    } else {
      const loss = p - def;
      const lh = Math.min(s.res.wood, loss);
      const ls = Math.min(s.res.stone, Math.ceil(loss / 2));
      s.res.wood -= lh; s.res.stone -= ls;
      const coast = Object.entries(s.tiles).filter(([k, v]) => {
        const [a, b] = parse(k);
        return v.t !== 'tower' && v.t !== 'ruin' && seaCount(s, a, b) > 0;
      });
      let hit = '';
      if (coast.length) {
        const v = coast[Math.floor(rng() * coast.length)][1];
        hit = ` They also broke your ${TILES[v.t].name.toLowerCase()}. You can rebuild it.`;
        v.t = 'ruin'; v.l = 1;
      }
      lines.push(`The Fog Pirates (strength ${p}) were too strong for your towers (${def}). They took ${lh} wood and ${ls} stone.${hit}`);
    }
  }

  const title = `${storm ? 'Pirate night' : 'Night'} ${s.day}`;
  s.fished = false;
  if (s.day >= CONFIG.days) {
    s.over = true;
    return { title, lines, isStorm: storm, stormWon, yields, gameOver: true };
  }
  s.day++;
  return { title, lines, isStorm: storm, stormWon, yields, gameOver: false };
}

export type FishResult = { kind: 'perfect' | 'good' | 'miss'; food: number; pearls: number };

export function bestDockLevel(s: GameState): number {
  return Math.max(0, ...Object.values(s.tiles).filter(v => v.t === 'dock').map(v => v.l));
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
  s.res.food += res.food;
  s.res.pearls += res.pearls;
  s.fished = true;
  return res;
}
