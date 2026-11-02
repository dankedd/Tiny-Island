import { Preferences } from '@capacitor/preferences';
import type { GameState } from './game/types';

const SAVE = 'eilandrijk-save';
const BEST = 'eilandrijk-best';

export async function loadGame(): Promise<GameState | null> {
  try {
    const { value } = await Preferences.get({ key: SAVE });
    if (!value) return null;
    const s = JSON.parse(value) as GameState;
    return s && s.version === 1 && s.tiles && s.res ? s : null;
  } catch {
    return null;
  }
}
export async function saveGame(s: GameState): Promise<void> {
  try { await Preferences.set({ key: SAVE, value: JSON.stringify(s) }); } catch { /* opslaan is een gemak, geen vereiste */ }
}
export async function loadBest(): Promise<number> {
  try { return Number((await Preferences.get({ key: BEST })).value ?? 0) || 0; } catch { return 0; }
}
export async function saveBest(n: number): Promise<void> {
  try { await Preferences.set({ key: BEST, value: String(n) }); } catch { /* idem */ }
}
