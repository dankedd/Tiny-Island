import { CONFIG } from './config';
import type { BuildableType, Cost, GameState } from './types';

export interface Mission {
  /** What to do, shown in the banner. */
  text: string;
  /** Extra line shown when the mission is done. */
  done?: string;
  check: (s: GameState) => boolean;
  /** Shows how far along you are, like "1/2". */
  progress?: (s: GameState) => string;
  reward: Cost;
  unlock?: BuildableType[];
  /** The building this mission is about, highlighted in the build menu. */
  focus?: BuildableType;
}

const count = (s: GameState, t: string) => Object.values(s.b).filter(v => v.t === t).length;
const people = (s: GameState) => Object.values(s.b).reduce<number>((n, v) => n + (v.t === "house" ? CONFIG.peoplePerHouseLevel * v.l : 0), CONFIG.plazaPeople);
const isSea = (s: GameState, k: string) => !(k in s.terrain) || s.terrain[k] === 'sea';
const nb = (k: string) => {
  const [q, r] = k.split(',').map(Number);
  return [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([a, b]) => `${q + a},${r + b}`);
};

/** The missions, in order. Each one gives a reward and can unlock new buildings. */
export const MISSIONS: Mission[] = [
  {
    text: 'Build a lumber camp next to a forest',
    focus: 'lumber',
    done: 'You can now build a quarry.',
    check: s => count(s, 'lumber') >= 1,
    reward: {},
    unlock: ['quarry'],
  },
  {
    text: 'Build a quarry next to rocks',
    focus: 'quarry',
    done: 'Houses, farms and fields are unlocked!',
    check: s => count(s, 'quarry') >= 1,
    reward: { food: 2 },
    unlock: ['house', 'farm', 'field'],
  },
  {
    text: 'Build a farm and 2 fields',
    focus: 'farm',
    check: s => count(s, 'farm') >= 1 && count(s, 'field') >= 2,
    progress: s => `${Math.min(1, count(s, 'farm')) + Math.min(2, count(s, 'field'))}/3`,
    reward: { wood: 4 },
  },
  {
    text: 'Build 2 houses',
    focus: 'house',
    done: 'Towers are unlocked. They keep the pirates away!',
    check: s => count(s, 'house') >= 2,
    progress: s => `${Math.min(2, count(s, 'house'))}/2`,
    reward: { stone: 3 },
    unlock: ['tower'],
  },
  {
    text: 'Build a tower before the pirates come',
    focus: 'tower',
    check: s => count(s, 'tower') >= 1,
    reward: { stone: 2 },
  },
  {
    text: 'Make a path all the way to the sea',
    focus: 'road',
    done: 'Docks are unlocked!',
    check: s => Object.entries(s.b).some(([k, v]) => v.t === 'road' && (s.terrain[k] === 'beach' || nb(k).some(n => isSea(s, n)))),
    reward: { food: 2 },
    unlock: ['dock'],
  },
  {
    text: 'Build a dock',
    focus: 'dock',
    check: s => count(s, 'dock') >= 1,
    reward: { wood: 3 },
  },
  {
    text: 'Explore land in the clouds',
    check: s => s.open.length >= 2,
    reward: { pearls: 1 },
  },
  {
    text: 'Have 10 people on your island',
    check: s => people(s) >= 10,
    progress: s => `${Math.min(10, people(s))}/10`,
    reward: { food: 5 },
  },
  {
    text: 'Chop down trees or break rocks to make room',
    check: s => s.stats.cleared >= 1,
    reward: { wood: 2, stone: 2 },
  },
  {
    text: 'Buy a boat at your dock',
    check: s => Object.values(s.b).some(v => (v.boats?.length ?? 0) > 0),
    reward: { wood: 3 },
  },
  {
    text: 'Chase the pirates away',
    check: s => s.stats.won >= 1,
    reward: { pearls: 1 },
  },
  {
    text: 'Explore 3 cloud areas',
    check: s => s.open.length >= 4,
    progress: s => `${Math.min(3, s.open.length - 1)}/3`,
    reward: { wood: 5, stone: 5 },
  },
  {
    text: 'Upgrade something to level 3',
    check: s => Object.values(s.b).some(v => v.t !== 'plaza' && v.l >= 3),
    reward: { pearls: 2 },
  },
  {
    text: 'Clear the clouds from the whole island',
    check: s => s.open.length >= new Set(Object.values(s.region)).size,
    reward: { pearls: 3 },
  },
];

export const currentMission = (s: GameState): Mission | null => MISSIONS[s.mission] ?? null;

/** Finishes every mission that is done now (they can chain). Returns the finished ones. */
export function checkMissions(s: GameState): Mission[] {
  const done: Mission[] = [];
  let m = currentMission(s);
  while (m && m.check(s)) {
    for (const [k, n] of Object.entries(m.reward) as [keyof GameState['res'], number][]) s.res[k] += n;
    for (const t of m.unlock ?? []) if (!s.unlocked.includes(t)) s.unlocked.push(t);
    done.push(m);
    s.mission++;
    m = currentMission(s);
  }
  return done;
}
