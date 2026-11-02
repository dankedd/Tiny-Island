import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { neighbours, key, parse } from '../src/game/hex';
import {
  build, buyBoat, boatProblem, economy, makeIsland, network, newGame, nightfall, placeProblem, resolveFish, sleep, upgrade,
} from '../src/game/rules';
import type { GameState, Terrain } from '../src/game/types';

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
const nb = (k: string) => neighbours(...parse(k)).map(([a, b]) => key(a, b));

/** A hand-made flat island so tests don't depend on random terrain. */
function flat(): GameState {
  const s = newGame(1);
  for (const k of Object.keys(s.terrain)) s.terrain[k] = 'grass';
  s.res = { food: 50, wood: 50, stone: 50, pearls: 5 };
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

  it('makes less when there are fewer people than jobs', () => {
    const s = flat();
    s.terrain['2,0'] = 'forest'; s.terrain['2,-1'] = 'forest';
    build(s, '1,0', 'lumber');
    expect(economy(s).work).toBe(0);
    build(s, '0,1', 'house');
    const e = economy(s);
    expect(e.work).toBe(1);
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
    s.day = 2;
    const rep = nightfall(s, seq(0));
    expect(rep.isStorm && rep.stormWon === false).toBe(true);
    expect(s.b['1,0'].t).toBe('ruin');
    s.res = { food: 50, wood: 50, stone: 50, pearls: 0 };
    upgrade(s, '1,0');
    expect(s.b['1,0'].t).toBe('house');
    expect(s.res.wood).toBe(48);
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
