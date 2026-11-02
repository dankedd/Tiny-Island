import type { TileType } from './types';

export interface TileInfo {
  naam: string;
  icoon: string;
  kleur: string;
  uitleg: string;
}

export const TILES: Record<TileType, TileInfo> = {
  akker:   { naam: 'Akker',       icoon: '🌾', kleur: '#d9b54a', uitleg: '1 voedsel per nacht, +1 voor elk huis ernaast (max +2).' },
  bos:     { naam: 'Bos',         icoon: '🌲', kleur: '#3f8f4f', uitleg: '1 hout per nacht, +1 als er 2 of meer bossen naast liggen.' },
  huis:    { naam: 'Huis',        icoon: '🏠', kleur: '#e9967a', uitleg: '2 bewoners per niveau. Elke bewoner eet 1 voedsel per nacht.' },
  steen:   { naam: 'Steengroeve', icoon: '⛏️', kleur: '#8d8f94', uitleg: '1 steen per nacht.' },
  steiger: { naam: 'Steiger',     icoon: '⚓', kleur: '#6fa8c9', uitleg: '1 voedsel per zeevak ernaast (max 3). Hiermee kun je vissen.' },
  toren:   { naam: 'Wachttoren',  icoon: '🗼', kleur: '#8a78c0', uitleg: '3 verdediging per niveau tegen stormnachten.' },
  ruine:   { naam: 'Ruïne',       icoon: '🏚️', kleur: '#5d5a55', uitleg: 'Verlaten. Herbouw tot huis voor 2 hout.' },
};
