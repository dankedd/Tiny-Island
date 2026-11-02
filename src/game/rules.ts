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

/** Turns hex-unit coordinates into the nearest hex. */
function roundHex(qf: number, rf: number): [number, number] {
  let q = Math.round(qf), r = Math.round(rf);
  const sf = -qf - rf, s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}

/**
 * Makes the island. The town square (0,0) is always close to the coast,
 * and the island's middle lies further inland, so there is lots to explore.
 */
export function makeIsland(seed: number): Record<string, Terrain> {
  const rng = seeded(seed);
  const R = CONFIG.islandRadius;
  for (let attempt = 0; attempt < 40; attempt++) {
    const waves = Array.from({ length: 3 }, () => ({ k: 1 + Math.floor(rng() * 3), p: rng() * Math.PI * 2, a: 0.25 + rng() * 0.45 }));
    const wob = (ang: number) => waves.reduce((sum, w) => sum + Math.sin(ang * w.k + w.p) * w.a, 0);
    // Direction from the island's middle to the town square.
    const th = rng() * Math.PI * 2;
    const d = R + wob(th) - CONFIG.coastFromStart;
    const cx = -Math.cos(th) * d, cy = -Math.sin(th) * d; // in hex units, x right, y down
    const [cq, cr] = roundHex(cx - cy / Math.sqrt(3), (2 / Math.sqrt(3)) * cy);
    const t: Record<string, Terrain> = {};
    const reach = Math.ceil(R + 3);
    for (const [dq, dr] of gridCells(reach)) {
      const q = cq + dq, r = cr + dr;
      const ang = Math.atan2(dr * 1.5, Math.sqrt(3) * (dq + dr / 2));
      const land = R + wob(ang) - distance(dq, dr);
      t[key(q, r)] = distance(dq, dr) >= reach - 1 ? 'sea' : land > 0 ? 'grass' : 'sea';
    }
    // The town square and the tiles around it must be land, and the sea must be close.
    const around = [[0, 0] as const, ...neighbours(0, 0)];
    if (around.some(([q, r]) => t[key(q, r)] !== 'grass')) continue;
    if (!Object.keys(t).some(k => t[k] === 'sea' && distance(...parse(k)) <= 4)) continue;
    finishIsland(t, rng);
    return t;
  }
  throw new Error('Could not make an island');
}

function finishIsland(t: Record<string, Terrain>, rng: Rng): void {
  // Coast: land touching the sea becomes beach.
  for (const [k, v] of Object.entries(t)) {
    if (v !== 'grass') continue;
    const [q, r] = parse(k);
    if (neighbours(q, r).some(([a, b]) => (t[key(a, b)] ?? 'sea') === 'sea')) t[k] = 'beach';
  }
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
  const ring = Object.keys(t).filter(k => t[k] === 'grass' && distance(...parse(k)) === 2).sort();
  if (ring.length) {
    const f = ring[Math.floor(rng() * ring.length)];
    growFrom('forest', f, 3);
    const [fq, fr] = parse(f);
    const far = ring.filter(k => t[k] === 'grass')
      .sort((a, b) => distance(parse(b)[0] - fq, parse(b)[1] - fr) - distance(parse(a)[0] - fq, parse(a)[1] - fr) || (a < b ? -1 : 1));
    if (far.length) growFrom('rocks', far[0], 2);
  }
  // Nature further away: clusters of forest and rocks.
  const grass = () => Object.keys(t).filter(k => t[k] === 'grass' && distance(...parse(k)) >= 3).sort();
  const grow = (kind: Terrain, clusters: number, size: [number, number]) => {
    for (let c = 0; c < clusters; c++) {
      const free = grass();
      if (!free.length) return;
      growFrom(kind, free[Math.floor(rng() * free.length)], size[0] + Math.floor(rng() * (size[1] - size[0] + 1)));
    }
  };
  grow('forest', 16, [3, 7]);
  grow('rocks', 11, [2, 4]);
}

/** Splits the land into cloud areas: area 0 around the town square, the rest in chunks. */
export function makeRegions(terrain: Record<string, Terrain>, seed: number): Record<string, number> {
  const rng = seeded(seed ^ 0x5bd1e995);
  const land = Object.keys(terrain).filter(k => terrain[k] !== 'sea').sort();
  const region: Record<string, number> = {};
  const rest: string[] = [];
  for (const k of land) {
    if (distance(...parse(k)) <= CONFIG.startRadius) region[k] = 0; else rest.push(k);
  }
  if (!rest.length) return region;
  // Spread the area centres out: each new one is as far as possible from the others.
  const centres: [number, number][] = [[0, 0]];
  const seeds: [number, number][] = [];
  const far = (k: string) => Math.min(...centres.map(([q, r]) => distance(parse(k)[0] - q, parse(k)[1] - r)));
  for (let i = 0; i < CONFIG.cloudAreas && i < rest.length; i++) {
    let best = rest[0], bestD = -1;
    for (const k of rest) {
      const dd = far(k) + rng() * 0.5;
      if (dd > bestD) { bestD = dd; best = k; }
    }
    seeds.push(parse(best) as [number, number]);
    centres.push(parse(best) as [number, number]);
  }
  for (const k of rest) {
    const [q, r] = parse(k);
    let bi = 0, bd = Infinity;
    seeds.forEach(([sq, sr], i) => {
      const dd = distance(q - sq, r - sr);
      if (dd < bd) { bd = dd; bi = i; }
    });
    region[k] = bi + 1;
  }
  return region;
}

export function newGame(seed = Math.floor(Math.random() * 1e9)): GameState {
  const terrain = makeIsland(seed);
  return {
    version: 3,
    seed,
    terrain,
    region: makeRegions(terrain, seed),
    open: [0],
    explorers: {},
    mission: 0,
    unlocked: ['road', 'lumber'],
    stats: { won: 0, cleared: 0 },
    b: { '0,0': { t: 'plaza', l: 1 } },
    res: { ...CONFIG.start },
    day: 1,
    actions: 0,
    fished: false,
    over: false,
    storms: 0,
  };
}

// ---------- lookups ----------

export const terrainAt = (s: GameState, k: string): Terrain => s.terrain[k] ?? 'sea';
/** True when this tile is out of the clouds (the sea is always clear). */
export const isOpen = (s: GameState, k: string): boolean => !(k in s.region) || s.open.includes(s.region[k]);
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
  if (!s.unlocked.includes(t)) return 'Finish missions to unlock this.';
  if (s.b[k]) return 'Something is already built here.';
  if (ter === 'sea') return 'You cannot build on the sea.';
  if (!isOpen(s, k)) return 'This land is still in the clouds. Explore it first.';
  if (ter === 'forest' || ter === 'rocks') return `You cannot build on ${ter}. Build next to it, or clear it first.`;
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

// ---------- clouds and clearing ----------

/** How many explorers the next cloud area needs. */
export function exploreNeed(s: GameState): number {
  return CONFIG.explore.base + CONFIG.explore.step * (s.open.length - 1);
}
/** People who have no job right now. Only they can go exploring. */
export function freePeople(s: GameState): number {
  const e = economy(s);
  return Math.max(0, e.people - e.jobs);
}
/** How many explorers would go on the next trip into the area under `k`. */
export function explorersToSend(s: GameState, k: string): number {
  const left = exploreNeed(s) - (s.explorers[s.region[k]] ?? 0);
  return Math.max(0, Math.min(freePeople(s), left, Math.floor(s.res.food / CONFIG.explore.foodPerExplorer)));
}

/** Why the cloud area under `k` cannot be explored now, or null when it can. */
export function exploreProblem(s: GameState, k: string): string | null {
  if (s.over) return 'The game is over.';
  if (!(k in s.region) || isOpen(s, k)) return 'There are no clouds here.';
  const id = s.region[k];
  const touches = Object.keys(s.region).some(c => s.region[c] === id && nbKeys(c).some(n => n in s.region && isOpen(s, n)));
  if (!touches) return 'Explore the land next to it first.';
  if (s.actions >= CONFIG.actionsPerDay) return 'No more building today.';
  if (freePeople(s) === 0) return 'Everyone is busy working. Build more houses so people are free to explore.';
  if (s.res.food < CONFIG.explore.foodPerExplorer) return 'Explorers need food for the trip.';
  return null;
}

/**
 * Sends your free people into the clouds. Each explorer takes some food.
 * When enough explorers have gone, the whole area opens up.
 */
export function explore(s: GameState, k: string, rng: Rng = Math.random): NightReport | null {
  const p = exploreProblem(s, k);
  if (p) throw new Error(p);
  const id = s.region[k];
  const n = explorersToSend(s, k);
  s.res.food -= n * CONFIG.explore.foodPerExplorer;
  s.explorers[id] = (s.explorers[id] ?? 0) + n;
  if (s.explorers[id] >= exploreNeed(s)) s.open.push(id);
  return useAction(s, rng);
}

export function clearProblem(s: GameState, k: string): string | null {
  if (s.over) return 'The game is over.';
  const ter = terrainAt(s, k);
  if (ter !== 'forest' && ter !== 'rocks') return 'There is nothing to clear here.';
  if (!isOpen(s, k)) return 'This land is still in the clouds.';
  const need = ter === 'forest' ? 'lumber' : 'quarry';
  if (!Object.values(s.b).some(v => v.t === need)) return ter === 'forest' ? 'Build a lumber camp first, then your woodcutters can chop here.' : 'Build a quarry first, then your diggers can break rocks.';
  if (!touchesNetwork(k, network(s))) return 'Build a path next to it first.';
  if (s.actions >= CONFIG.actionsPerDay) return 'No more building today.';
  const c = CONFIG.clear[ter].cost;
  if (!canPay(s, c)) return `You need ${costText(c)}.`;
  return null;
}

/** Chops a forest or breaks rocks: the tile becomes grass and you keep the wood or stone. */
export function clearTile(s: GameState, k: string, rng: Rng = Math.random): NightReport | null {
  const p = clearProblem(s, k);
  if (p) throw new Error(p);
  const c = CONFIG.clear[terrainAt(s, k) as 'forest' | 'rocks'];
  pay(s, c.cost);
  for (const [n, a] of Object.entries(c.gain) as [keyof Resources, number][]) s.res[n] += a;
  s.terrain[k] = 'grass';
  s.stats.cleared++;
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
  return e.people * c.perPerson + s.res.pearls * c.perPearl + levels * c.perLevel + boats * c.perBoat
    + s.mission * c.perMission + (s.open.length - 1) * c.perArea;
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
      s.stats.won++;
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
