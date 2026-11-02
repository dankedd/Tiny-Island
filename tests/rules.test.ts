import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { neighbours, key, parse } from '../src/game/hex';
import {
  build, buyBoat, boatProblem, economy, fleetText, isStormNight, makeIsland, network, newGame, nightfall, placeProblem,
  resolveFish, sleep, startGoal, stormPower, upgrade,
} from '../src/game/rules';
import { distance } from '../src/game/hex';
import type { GameState, Terrain } from '../src/game/types';

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
const nb = (k: string) => neighbours(...parse(k)).map(([a, b]) => key(a, b));

/** A hand-made flat island so tests don't depend on random terrain. */
function flat(): GameState {
  const s = newGame(1);
  for (const k of Object.keys(s.terrain)) s.terrain[k] = 'grass';
  s.res = { food: 50, wood: 50, stone: 50, pearls: 5 };
  s.step = 2;
  return s;
}

describe('island', () => {
  it('is the same for the same seed and has sea, beach, forest and rocks', () => {
    const a = makeIsland(42), b = makeIsland(42);
    expect(a).toEqual(b);
    const kinds = new Set<Terrain>(Object.values(a));
    for (const t of ['sea', 'beach', 'grass', 'forest', 'rocks'] as Terrain[]) expect(kinds.has(t)).toBe(true);
    expect(a['0,0']).toBe('grass');
  });

  it('always has a forest and rocks close to the town square', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const t = makeIsland(seed);
      const near = (kind: Terrain) => Object.keys(t).some(k => t[k] === kind && distance(...parse(k)) <= 3);
      expect(near('forest'), `seed ${seed}`).toBe(true);
      expect(near('rocks'), `seed ${seed}`).toBe(true);
    }
  });
});

describe('start', () => {
  it('makes you build a lumber camp first, then a quarry', () => {
    const s = flat();
    s.step = 0;
    s.terrain['2,0'] = 'forest'; s.terrain['-2,0'] = 'rocks';
    expect(startGoal(s)).toBe('lumber');
    expect(placeProblem(s, '0,1', 'house')).toMatch(/lumber camp/);
    expect(placeProblem(s, '1,-1', 'road')).toBeNull();
    build(s, '1,0', 'lumber');
    expect(startGoal(s)).toBe('quarry');
    expect(placeProblem(s, '0,1', 'house')).toMatch(/quarry/);
    build(s, '-1,0', 'quarry');
    expect(startGoal(s)).toBeNull();
    expect(placeProblem(s, '0,1', 'house')).toBeNull();
  });

  it('gives the first camps workers from the town square', () => {
    const s = flat();
    s.terrain['2,0'] = 'forest';
    build(s, '1,0', 'lumber');
    expect(economy(s).people).toBe(CONFIG.plazaPeople);
    expect(economy(s).perTile['1,0']).toEqual({ wood: 1 });
  });
});

describe('building', () => {
  it('needs a path to the town square', () => {
    const s = flat();
    expect(placeProblem(s, '1,0', 'house')).toBeNull();
    expect(placeProblem(s, '3,0', 'house')).toMatch(/path/);
    build(s, '1,0', 'road'); build(s, '2,0', 'road');
    expect(placeProblem(s, '3,0', 'house')).toBeNull();
    expect(network(s).has('2,0')).toBe(true);
  });

  it('costs resources and a building turn, but paths are free of turns', () => {
    const s = flat();
    build(s, '1,0', 'road');
    expect(s.actions).toBe(0);
    expect(s.res.stone).toBe(49);
    build(s, '0,1', 'house');
    expect(s.actions).toBe(1);
    expect(s.res.wood).toBe(47);
  });

  it('refuses when you cannot pay', () => {
    const s = flat();
    s.res.wood = 0;
    expect(placeProblem(s, '1,0', 'house')).toMatch(/need/);
  });

  it('puts docks only on the beach next to the sea, pointing at the water', () => {
    const s = flat();
    s.terrain['1,0'] = 'beach'; s.terrain['2,0'] = 'sea';
    expect(placeProblem(s, '0,1', 'dock')).toMatch(/beach/);
    build(s, '1,0', 'dock');
    expect(s.b['1,0'].dir).toBe(0);
  });

  it('puts lumber camps next to forests and quarries next to rocks', () => {
    const s = flat();
    s.terrain['2,0'] = 'forest';
    expect(placeProblem(s, '1,0', 'lumber')).toBeNull();
    expect(placeProblem(s, '-1,0', 'lumber')).toMatch(/forest/);
    expect(placeProblem(s, '1,0', 'quarry')).toMatch(/rocks/);
  });
});

describe('economy', () => {
  it('fields only grow food with a farm, and a farm handles 2 fields per level', () => {
    const s = flat();
    build(s, '0,1', 'house'); build(s, '1,0', 'field'); build(s, '-1,0', 'field');
    expect(economy(s).farmed.size).toBe(0);
    build(s, '1,-1', 'road'); build(s, '0,-1', 'farm'); build(s, '-1,1', 'field');
    const e = economy(s);
    expect(e.farmed.size).toBe(2);
    s.actions = 0;
    upgrade(s, '0,-1');
    expect(economy(s).farmed.size).toBe(3);
  });

  it('lets fields near a farm work without a path of their own', () => {
    const s = flat();
    build(s, '1,0', 'farm');
    expect(placeProblem(s, '3,0', 'field')).toBeNull();
    expect(placeProblem(s, '4,0', 'field')).toMatch(/farm/);
    build(s, '3,0', 'field');
    expect(economy(s).farmed.has('3,0')).toBe(true);
  });

  it('makes less when there are fewer people than jobs', () => {
    const s = flat();
    s.terrain['2,0'] = 'forest'; s.terrain['2,-1'] = 'forest';
    build(s, '1,0', 'lumber');
    build(s, '0,1', 'farm'); build(s, '-1,1', 'farm'); build(s, '-1,0', 'farm');
    expect(economy(s).work).toBeCloseTo(4 / 7);
    expect(economy(s).perTile['1,0']).toEqual({ wood: 1 });
    build(s, '0,-1', 'house');
    const e = economy(s);
    expect(e.work).toBeCloseTo(6 / 7);
    expect(e.perTile['1,0']).toEqual({ wood: 2 });
  });

  it('ends the day after the last building turn', () => {
    const s = flat();
    const spots = nb('0,0');
    let rep = null;
    for (let i = 0; i < CONFIG.actionsPerDay; i++) rep = build(s, spots[i], 'house', seq(0.5));
    expect(rep?.title).toBe('Night 1');
    expect(s.day).toBe(2);
    expect(s.actions).toBe(0);
  });

  it('lets you sleep early', () => {
    const s = flat();
    expect(sleep(s).title).toBe('Night 1');
    expect(s.day).toBe(2);
  });

  it('turns a coastal building into a ruin when pirates win, and fixing costs half', () => {
    const s = flat();
    s.terrain['2,0'] = 'beach';
    build(s, '1,0', 'house');
    s.day = CONFIG.firstPirateNight;
    const rep = nightfall(s, seq(0));
    expect(rep.isStorm && rep.stormWon === false).toBe(true);
    expect(s.b['1,0'].t).toBe('ruin');
    s.res = { food: 50, wood: 50, stone: 50, pearls: 0 };
    upgrade(s, '1,0');
    expect(s.b['1,0'].t).toBe('house');
    expect(s.res.wood).toBe(48);
  });
});

describe('pirates', () => {
  it('only come after a few days, with easy boats first', () => {
    expect([1, 2, 3].some(isStormNight)).toBe(false);
    expect(isStormNight(CONFIG.firstPirateNight)).toBe(true);
    const s = flat();
    expect(stormPower(s)).toBe(3);
    s.day = CONFIG.firstPirateNight;
    const rep = nightfall(s, seq(0));
    expect(rep.ships).toEqual(['raft', 'raft']);
    expect(rep.lines.join(' ')).toMatch(/2 rafts/);
    expect(stormPower(s)).toBeGreaterThan(3);
    expect(fleetText(['brig', 'sloop', 'sloop'])).toBe('1 brig and 2 sloops');
  });
});

describe('boats', () => {
  it('need a good enough dock and room', () => {
    const s = flat();
    s.terrain['1,0'] = 'beach'; s.terrain['2,0'] = 'sea';
    build(s, '1,0', 'dock');
    expect(boatProblem(s, '1,0', 'fishingboat')).toMatch(/level 2/);
    buyBoat(s, '1,0', 'rowboat');
    expect(boatProblem(s, '1,0', 'rowboat')).toMatch(/room/);
    build(s, '0,1', 'house');
    expect(economy(s).perTile['1,0']).toEqual({ food: 3 });
  });
});

describe('fishing', () => {
  it('pays out a pearl for a perfect catch', () => {
    const s = flat();
    s.terrain['1,0'] = 'beach'; s.terrain['2,0'] = 'sea';
    build(s, '1,0', 'dock');
    expect(resolveFish(s, 0.5).pearls).toBe(1);
    expect(s.fished).toBe(true);
  });
});
