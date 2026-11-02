import type { TileType } from './types';

export interface TileInfo {
  name: string;
  icon: string;
  color: string;
  info: string;
}

export const TILES: Record<TileType, TileInfo> = {
  field:  { name: 'Field',  icon: '🌾', color: '#d9b54a', info: 'Makes 1 food each night. +1 for each house next to it (up to +2).' },
  forest: { name: 'Forest', icon: '🌲', color: '#3f8f4f', info: 'Makes 1 wood each night. +1 when it touches 2 other forests.' },
  house:  { name: 'House',  icon: '🏠', color: '#e9967a', info: 'Home for 2 people per level. Each person eats 1 food each night.' },
  quarry: { name: 'Quarry', icon: '⛏️', color: '#8d8f94', info: 'Makes 1 stone each night.' },
  dock:   { name: 'Dock',   icon: '⚓', color: '#6fa8c9', info: 'Makes 1 food for each water spot next to it (up to 3). Lets you go fishing!' },
  tower:  { name: 'Tower', icon: '🗼', color: '#8a78c0', info: 'Gives 3 defence per level against the Fog Pirates.' },
  ruin:   { name: 'Ruin',   icon: '🏚️', color: '#5d5a55', info: 'Broken. Fix it into a house for 2 wood.' },
};
