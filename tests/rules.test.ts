import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { canPlace, newGame, nightfall, place, resolveFish, score, totals, upgrade, yieldOf } from '../src/game/rules';

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('rules', () => {
  it('starts with a small island of three tiles', () => {
    const s = newGame(seq(0.1));
    expect(Object.keys(s.tiles)).toHaveLength(3);
    expect(totals(s).pop).toBe(2);
  });

  it('only allows placing next to land', () => {
    const s = newGame(seq(0.1));
    expect(canPlace(s, 0, 1, 'forest')).toBe(true);
    expect(canPlace(s, 3, 0, 'forest')).toBe(false);
    expect(canPlace(s, 0, 0, 'forest')).toBe(false);
  });

  it('gives a field a bonus for neighbouring houses', () => {
    const s = newGame(seq(0.1));
    expect(yieldOf(s, 1, 0, 'field', 1)).toEqual({ food: 2 });
  });

  it('upgrades a tile when you can pay', () => {
    const s = newGame(seq(0.1));
    s.res.wood = 3; s.res.stone = 2;
    expect(upgrade(s, '0,0')).toBe(true);
    expect(s.tiles['0,0'].l).toBe(2);
    expect(s.res.wood).toBe(0);
    expect(upgrade(s, '0,0')).toBe(false);
  });

  it('ends the day after the last turn and feeds residents', () => {
    const s = newGame(seq(0.1));
    s.turn = CONFIG.turnsPerDay - 1;
    const rep = place(s, 0, 0, 1, seq(0.1));
    expect(rep?.title).toBe('Night 1');
    expect(s.day).toBe(2);
  });

  it('hurts the island when a storm beats the defence', () => {
    const s = newGame(seq(0.1));
    s.day = 2; s.res.wood = 10;
    const rep = nightfall(s, seq(0));
    expect(rep.isStorm).toBe(true);
    expect(Object.values(s.tiles).some(t => t.t === 'ruin')).toBe(true);
  });

  it('ends the game after the last day', () => {
    const s = newGame(seq(0.1));
    s.day = CONFIG.days;
    expect(nightfall(s, seq(0.5)).gameOver).toBe(true);
    expect(s.over).toBe(true);
    expect(score(s)).toBeGreaterThan(0);
  });

  it('pays out a pearl for a perfect catch', () => {
    const s = newGame(seq(0.1));
    s.tiles['0,1'] = { t: 'dock', l: 1 };
    expect(resolveFish(s, 0.5).pearls).toBe(1);
    expect(s.fished).toBe(true);
  });
});
