import { CONFIG } from './config';
import { DIRS, distance, gridCells, key, neighbours, parse } from './hex';
import type {
  BoatType, BuildableType, Building, BuildingType, Cost, GameState, NightReport, Resources, Rng, Terrain,
} from './types';
import { BUILDINGS } from './tiles';

const RES_KEYS = ['food', 'wood', 'stone', 'pearls'] as const;

// ---------- world generation ----------

/** Small, fast seeded random generator so the same seed always makes the same island. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeIsland(seed: number): Record<string, Terrain> {
  const rng = seeded(seed);
  const R = CONFIG.gridRadius;
  const waves = Array.from({ length: 3 }, () => ({ k: 1 + rng() * 2, p: rng() * Math.PI * 2, a: 0.4 + rng() * 0.5 }));
  const t: Record<string, Terrain> = {};
  for (const [q, r] of gridCells(R)) {
    const ang = Math.atan2(r * 1.5, Math.sqrt(3) * (q + r / 2));
    const wobble = waves.reduce((s, w) => s + Math.sin(ang * w.k + w.p) * w.a, 0);
    const land = CONFIG.islandRadius + wobble - distance(q, r);
    t[key(q, r)] = distance(q, r) >= R ? 'sea' : land > 0 ? 'grass' : 'sea';
  }
  // Coast: land touching the sea becomes beach.
  for (const [k, v] of Object.entries(t)) {
    if (v !== 'grass') continue;
    const [q, r] = parse(k);
    if (neighbours(q, r).some(([a, b]) => (t[key(a, b)] ?? 'sea') === 'sea')) t[k] = 'beach';
  }
  // Nature: clusters of forest and rocks, keeping the village centre free.
  const grass = () => Object.keys(t).filter(k => t[k] === 'grass' && distance(...parse(k)) >= 2);
  const grow = (kind: Terrain, clusters: number, size: [number, number]) => {
    for (let c = 0; c < clusters; c++) {
      const free = grass();
      if (!free.length) return;
      let cur = free[Math.floor(rng() * free.length)];
      const n = size[0] + Math.floor(rng() * (size[1] - size[0] + 1));
      for (let i = 0; i < n; i++) {
        t[cur] = kind;
        const next = neighbours(...parse(cur)).map(([a, b]) => key(a, b)).filter(k => t[k] === 'grass' && distance(...parse(k)) >= 2);
        if (!next.length) break;
        cur = next[Math.floor(rng() * next.length)];
      }
    }
  };
  const growFrom = (kind: Terrain, start: string, n: number) => {
    let cur = start;
    for (let i = 0; i < n; i++) {
      t[cur] = kind;
      const next = neighbours(...parse(cur)).map(([a, b]) => key(a, b)).filter(k => t[k] === 'grass' && distance(...parse(k)) >= 2);
      if (!next.length) break;
      cur = next[Math.floor(rng() * next.length)];
    }
  };
  // Always a small wood and a few rocks close to the town square, so the first camps fit.
  const ring = Object.keys(t).filter(k => t[k] === 'grass' && distance(...parse(k)) === 2);
  if (ring.length) {
    const f = ring[Math.floor(rng() * ring.length)];
    growFrom('forest', f, 3);
    const far = ring.filter(k => t[k] === 'grass').sort((a, b) => {
      const [fq, fr] = parse(f);
      const da = distance(parse(a)[0] - fq, parse(a)[1] - fr), db = distance(parse(b)[0] - fq, parse(b)[1] - fr);
      return db - da || (a < b ? -1 : 1);
    });
    if (far.length) growFrom('rocks', far[0], 2);
  }
  grow('forest', 3, [3, 6]);
  grow('rocks', 2, [2, 3]);
  return t;
}

export function newGame(seed = Math.floor(Math.random() * 1e9)): GameState {
  const terrain = makeIsland(seed);
  return {
    version: 2,
    seed,
    terrain,
    b: { '0,0': { t: 'plaza', l: 1 } },
    res: { ...CONFIG.start },
    day: 1,
    actions: 0,
    fished: false,
    over: false,
    storms: 0,
    step: 0,
  };
}

/** What the player must build first: a lumber camp, then a quarry. Null when building is free. */
export function startGoal(s: GameState): 'lumber' | 'quarry' | null {
  const step = s.step ?? 2;
  return step === 0 ? 'lumber' : step === 1 ? 'quarry' : null;
}

// ---------- lookups ----------

export const terrainAt = (s: GameState, k: string): Terrain => s.terrain[k] ?? 'sea';
const nbKeys = (k: string) => neighbours(...parse(k)).map(([a, b]) => key(a, b));
const countNb = (s: GameState, k: string, t: Terrain) => nbKeys(k).filter(n => terrainAt(s, n) === t).length;

/** Roads and the town square that are joined up to the town square. */
export function network(s: GameState): Set<string> {
  const seen = new Set<string>(['0,0']);
  const todo = ['0,0'];
  while (todo.length) {
    const k = todo.pop()!;
    for (const n of nbKeys(k)) {
      if (!seen.has(n) && s.b[n]?.t === 'road') { seen.add(n); todo.push(n); }
    }
  }
  return seen;
}
export const touchesNetwork = (k: string, net: Set<string>) => net.has(k) || nbKeys(k).some(n => net.has(n));

// ---------- costs ----------

export function buildCost(t: BuildableType): Cost { return { ...CONFIG.cost[t] }; }

export function upgradeCost(v: Building): Cost | null {
  if (v.t === 'ruin') {
    const base = CONFIG.cost[v.was ?? 'house'];
    return Object.fromEntries(Object.entries(base).map(([k, n]) => [k, Math.ceil(n / 2)])) as Cost;
  }
  if (v.t === 'plaza' || v.t === 'road' || v.t === 'field' || v.l >= CONFIG.maxLevel) return null;
  const base = CONFIG.cost[v.t];
  const next = v.l + 1;
  const c: Cost = Object.fromEntries(Object.entries(base).map(([k, n]) => [k, n * next])) as Cost;
  if (next === 3) c.pearls = (c.pearls ?? 0) + 1;
  return c;
}

export const canPay = (s: GameState, c: Cost): boolean =>
  (Object.entries(c) as [keyof Resources, number][]).every(([k, n]) => s.res[k] >= n);
const pay = (s: GameState, c: Cost) => { for (const [k, n] of Object.entries(c) as [keyof Resources, number][]) s.res[k] -= n; };
export const costText = (c: Cost): string =>
  RES_KEYS.filter(k => c[k]).map(k => `${c[k]} ${k}`).join(', ') || 'free';

// ---------- placing ----------

/** Why a building cannot go here, or null when it can. */
export function placeProblem(s: GameState, k: string, t: BuildableType): string | null {
  if (s.over) return 'The game is over.';
  const ter = terrainAt(s, k);
  if (s.b[k]) return 'Something is already built here.';
  if (ter === 'sea') return 'You cannot build on the sea.';
  if (ter === 'forest' || ter === 'rocks') return `You cannot build on ${ter}. Build next to it.`;
  const goal = startGoal(s);
  if (goal && t !== goal && t !== 'road') {
    return goal === 'lumber'
      ? 'First build a lumber camp next to a forest, so you get wood.'
      : 'Now build a quarry next to rocks, so you get stone.';
  }
  const net = network(s);
  const nearFarm = t === 'field' && farmsInReach(s, k, net) > 0;
  if (!touchesNetwork(k, net) && !nearFarm) {
    return t === 'field' ? 'Put a field close to a farm, or next to a path.' : 'Build next to a path that leads to your town square.';
  }
  switch (t) {
    case 'dock': if (ter !== 'beach' || countNb(s, k, 'sea') < 1) return 'A dock must be on the beach, next to the water.'; break;
    case 'lumber': if (countNb(s, k, 'forest') < 1) return 'A lumber camp must be next to a forest.'; break;
    case 'quarry': if (countNb(s, k, 'rocks') < 1) return 'A quarry must be next to rocks.'; break;
    case 'road': case 'tower': break;
    default: if (ter !== 'grass') return `A ${BUILDINGS[t].name.toLowerCase()} needs grass, not sand.`;
  }
  if (t !== 'road' && s.actions >= CONFIG.actionsPerDay) return 'No more building today. Sleep to start a new day.';
  if (!canPay(s, buildCost(t))) return `You need ${costText(buildCost(t))}.`;
  return null;
}

/** Farms with a path that are close enough to look after a field at `k`. */
function farmsInReach(s: GameState, k: string, net: Set<string>): number {
  const [q, r] = parse(k);
  return Object.keys(s.b).filter(f => {
    if (s.b[f].t !== 'farm' || !touchesNetwork(f, net)) return false;
    const [fq, fr] = parse(f);
    return distance(q - fq, r - fr) <= CONFIG.farmReach;
  }).length;
}

/** Points the dock towards the open sea. */
export function dockDirection(s: GameState, k: string): number {
  const [q, r] = parse(k);
  let best = 0, bestScore = -1;
  DIRS.forEach(([dq, dr], i) => {
    const n = key(q + dq, r + dr);
    if (terrainAt(s, n) !== 'sea') return;
    const score = countNb(s, n, 'sea') + distance(q + dq, r + dr) * 0.1;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Builds `t` at `k`. Returns a night report when this used the last action of the day. */
export function build(s: GameState, k: string, t: BuildableType, rng: Rng = Math.random): NightReport | null {
  const problem = placeProblem(s, k, t);
  if (problem) throw new Error(problem);
  pay(s, buildCost(t));
  s.b[k] = { t, l: 1 };
  if (t === 'dock') { s.b[k].dir = dockDirection(s, k); s.b[k].boats = []; }
  const goal = startGoal(s);
  if (goal && t === goal) s.step = (s.step ?? 0) + 1;
  if (t === 'road') return null;
  return useAction(s, rng);
}

export function upgradeProblem(s: GameState, k: string): string | null {
  const v = s.b[k];
  if (!v) return 'Nothing here.';
  const c = upgradeCost(v);
  if (!c) return v.t === 'road' || v.t === 'plaza' || v.t === 'field' ? 'This cannot be upgraded.' : 'Max level!';
  if (s.actions >= CONFIG.actionsPerDay) return 'No more building today.';
  if (!canPay(s, c)) return `You need ${costText(c)}.`;
  return null;
}

export function upgrade(s: GameState, k: string, rng: Rng = Math.random): NightReport | null {
  const p = upgradeProblem(s, k);
  if (p) throw new Error(p);
  const v = s.b[k];
  pay(s, upgradeCost(v)!);
  if (v.t === 'ruin') {
    v.t = v.was ?? 'house'; v.l = 1; delete v.was;
    if (v.t === 'dock') v.boats = [];
  } else v.l++;
  return useAction(s, rng);
}

export function boatProblem(s: GameState, k: string, boat: BoatType): string | null {
  const v = s.b[k];
  if (!v || v.t !== 'dock') return 'Boats need a dock.';
  const info = CONFIG.boats[boat];
  if (v.l < info.dock) return `Upgrade the dock to level ${info.dock} first.`;
  if ((v.boats?.length ?? 0) >= v.l) return `This dock has room for ${v.l} ${v.l === 1 ? 'boat' : 'boats'}. Upgrade it for more.`;
  if (s.actions >= CONFIG.actionsPerDay) return 'No more building today.';
  if (!canPay(s, info.cost)) return `You need ${costText(info.cost)}.`;
  return null;
}

export function buyBoat(s: GameState, k: string, boat: BoatType, rng: Rng = Math.random): NightReport | null {
  const p = boatProblem(s, k, boat);
  if (p) throw new Error(p);
  pay(s, CONFIG.boats[boat].cost);
  (s.b[k].boats ??= []).push(boat);
  return useAction(s, rng);
}

function useAction(s: GameState, rng: Rng): NightReport | null {
  s.actions++;
  return s.actions >= CONFIG.actionsPerDay ? nightfall(s, rng) : null;
}

// ---------- economy ----------

export interface Economy {
  people: number;
  jobs: number;
  /** 0..1: how much of the work gets done (fewer people than jobs means less). */
  work: number;
  defence: number;
  connected: Set<string>;
  /** Fields that have a farm to work them. */
  farmed: Set<string>;
  perTile: Record<string, Partial<Resources>>;
}

export function economy(s: GameState): Economy {
  const net = network(s);
  // Fields are worked from their farm, so they need no path of their own.
  const connected = new Set(Object.keys(s.b).filter(k => !['road', 'field'].includes(s.b[k].t) && touchesNetwork(k, net)));
  let people = CONFIG.plazaPeople, jobs = 0, defence = 0;
  for (const k of connected) {
    const v = s.b[k];
    if (v.t === 'house') people += CONFIG.peoplePerHouseLevel * v.l;
    if (v.t === 'tower') defence += CONFIG.defencePerTowerLevel * v.l;
    jobs += (CONFIG.jobs[v.t as BuildableType] ?? 0) * v.l;
  }
  const work = jobs === 0 ? 1 : Math.min(1, people / jobs);

  // Each farm looks after a few fields close by.
  const farmed = new Set<string>();
  const farms = [...connected].filter(k => s.b[k].t === 'farm');
  const fields = Object.keys(s.b).filter(k => s.b[k].t === 'field').sort();
  for (const f of farms) {
    let room = CONFIG.fieldsPerFarmLevel * s.b[f].l;
    const [fq, fr] = parse(f);
    for (const fl of fields) {
      if (room === 0) break;
      if (farmed.has(fl)) continue;
      const [q, r] = parse(fl);
      if (distance(q - fq, r - fr) <= CONFIG.farmReach) { farmed.add(fl); room--; }
    }
  }
  for (const fl of farmed) connected.add(fl);

  const perTile: Record<string, Partial<Resources>> = {};
  for (const k of connected) {
    const v = s.b[k];
    let y: Partial<Resources> = {};
    if (v.t === 'field' && farmed.has(k)) y = { food: 2 };
    if (v.t === 'lumber') y = { wood: Math.min(3, countNb(s, k, 'forest')) * v.l };
    if (v.t === 'quarry') y = { stone: Math.min(2, countNb(s, k, 'rocks')) * v.l };
    if (v.t === 'dock') {
      y = { food: v.l };
      for (const b of v.boats ?? []) { y.food! += CONFIG.boats[b].food; if (CONFIG.boats[b].pearls) y.pearls = (y.pearls ?? 0) + CONFIG.boats[b].pearls; }
    }
    // Fewer workers than jobs: everything makes a bit less.
    for (const n of RES_KEYS) if (y[n]) y[n] = Math.round(y[n]! * work);
    if (Object.values(y).some(n => n)) perTile[k] = y;
  }
  return { people, jobs, work, defence, connected, farmed, perTile };
}

export function score(s: GameState): number {
  const e = economy(s);
  const c = CONFIG.score;
  let levels = 0, boats = 0;
  for (const v of Object.values(s.b)) {
    if (v.t !== 'road' && v.t !== 'plaza' && v.t !== 'ruin') levels += v.l;
    boats += v.boats?.length ?? 0;
  }
  return e.people * c.perPerson + s.res.pearls * c.perPearl + levels * c.perLevel + boats * c.perBoat;
}

export const isStormNight = (day: number): boolean =>
  day >= CONFIG.firstPirateNight && (day - CONFIG.firstPirateNight) % CONFIG.stormEvery === 0;
/** The pirate fleet for the next pirate night: easy boats first. */
export const pirateFleet = (s: GameState) => CONFIG.pirates[Math.min(s.storms, CONFIG.pirates.length - 1)];
export const stormPower = (s: GameState): number => pirateFleet(s).power;
/** "2 rafts" or "1 brig and 2 sloops". */
export function fleetText(ships: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const sh of ships) counts.set(sh, (counts.get(sh) ?? 0) + 1);
  const parts = [...counts].map(([n, c]) => `${c} ${CONFIG.pirateNames[n as keyof typeof CONFIG.pirateNames]}${c > 1 ? 's' : ''}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? '';
}
/** The next night with pirates, from today on. */
export function nextPirateNight(day: number): number | null {
  for (let d = day; d <= CONFIG.days; d++) if (isStormNight(d)) return d;
  return null;
}

export const formatYield = (y: Partial<Resources>): string =>
  RES_KEYS.filter(k => y[k]).map(k => `+${y[k]} ${k}`).join(', ') || 'nothing';

// ---------- night ----------

export function nightfall(s: GameState, rng: Rng = Math.random): NightReport {
  const lines: string[] = [];
  const e = economy(s);
  const total: Partial<Resources> = {};
  const yields = Object.entries(e.perTile).map(([k, y]) => {
    for (const n of RES_KEYS) { s.res[n] += y[n] ?? 0; total[n] = (total[n] ?? 0) + (y[n] ?? 0); }
    return { k, y };
  });
  lines.push(`Your island made ${formatYield(total)}.`);
  if (e.work < 1) lines.push(`Not enough workers: only ${e.people} people for ${e.jobs} jobs, so work went slower. Build more houses!`);

  const need = e.people * CONFIG.foodPerPerson;
  const ate = Math.min(need, s.res.food);
  s.res.food -= ate;
  lines.push(`Your ${e.people} people ate ${ate} food.`);
  const short = need - ate;
  if (short > 0) {
    const houses = Object.values(s.b).filter(v => v.t === 'house');
    const leave = Math.ceil(short / 2);
    for (let i = 0; i < leave && houses.length; i++) {
      const v = houses.splice(Math.floor(rng() * houses.length), 1)[0];
      if (v.l > 1) v.l--; else { v.t = 'ruin'; v.was = 'house'; v.l = 1; }
    }
    lines.push(`Not enough food! ${short} people were hungry, so ${leave} ${leave === 1 ? 'family' : 'families'} moved away.`);
  }

  const storm = isStormNight(s.day);
  let stormWon: boolean | undefined;
  let ships: NightReport['ships'];
  if (storm) {
    const fleet = pirateFleet(s);
    const p = fleet.power;
    ships = [...fleet.ships];
    const who = `The Fog Pirates came with ${fleetText(fleet.ships)}`;
    s.storms++;
    stormWon = e.defence >= p;
    if (stormWon) {
      s.res.pearls += 1; s.res.stone += 3;
      lines.push(`${who} (strength ${p}), but your towers (${e.defence}) chased them away! You found 1 pearl and 3 stone.`);
    } else {
      const loss = p - e.defence;
      const lw = Math.min(s.res.wood, loss);
      const ls = Math.min(s.res.stone, Math.ceil(loss / 2));
      s.res.wood -= lw; s.res.stone -= ls;
      const coast = Object.entries(s.b).filter(([k, v]) =>
        !['road', 'plaza', 'ruin', 'tower'].includes(v.t) && nbKeys(k).some(n => ['sea', 'beach'].includes(terrainAt(s, n)) || terrainAt(s, k) === 'beach'));
      let hit = '';
      if (coast.length) {
        const v = coast[Math.floor(rng() * coast.length)][1];
        hit = ` They also broke your ${BUILDINGS[v.t].name.toLowerCase()}. You can fix it.`;
        v.was = v.t as BuildableType; v.t = 'ruin'; v.l = 1; delete v.boats;
      }
      lines.push(`${who} (strength ${p}). That was too strong for your towers (${e.defence}). They took ${lw} wood and ${ls} stone.${hit}`);
    }
  }

  const title = `${storm ? 'Pirate night' : 'Night'} ${s.day}`;
  s.fished = false;
  s.actions = 0;
  if (s.day >= CONFIG.days) {
    s.over = true;
    return { title, lines, isStorm: storm, stormWon, ships, yields, gameOver: true };
  }
  s.day++;
  return { title, lines, isStorm: storm, stormWon, ships, yields, gameOver: false };
}

/** Go to sleep early, skipping the rest of today's building. */
export function sleep(s: GameState, rng: Rng = Math.random): NightReport {
  return nightfall(s, rng);
}

// ---------- fishing ----------

export type FishResult = { kind: 'perfect' | 'good' | 'miss'; food: number; pearls: number };

export function bestDock(s: GameState): Building | null {
  const docks = Object.values(s.b).filter(v => v.t === 'dock');
  return docks.sort((a, b) => b.l - a.l)[0] ?? null;
}
export const canFish = (s: GameState): boolean => !s.over && !s.fished && bestDock(s) !== null;
export function fishZone(s: GameState): number {
  const d = bestDock(s);
  if (!d) return 0;
  const f = CONFIG.fishing;
  const boats = Object.values(s.b).reduce((n, v) => n + (v.boats?.filter(b => b !== 'rowboat').length ?? 0), 0);
  return Math.min(0.45, f.zoneBase + f.zonePerLevel * (d.l - 1) + f.zonePerBoat * boats);
}

export function resolveFish(s: GameState, rel: number): FishResult {
  const lvl = bestDock(s)?.l ?? 1;
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

export type { BuildingType };
