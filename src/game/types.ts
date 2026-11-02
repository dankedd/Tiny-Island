export type TileType = 'field' | 'forest' | 'house' | 'quarry' | 'dock' | 'tower' | 'ruin';
export type PlaceableType = Exclude<TileType, 'ruin'>;
export type ResourceKey = 'food' | 'wood' | 'stone' | 'pearls';
export type Resources = Record<ResourceKey, number>;
export type Cost = Partial<Resources>;

export interface Tile {
  t: TileType;
  l: number;
}

export interface GameState {
  version: 1;
  tiles: Record<string, Tile>;
  res: Resources;
  turn: number;
  day: number;
  offers: PlaceableType[];
  fished: boolean;
  over: boolean;
  storms: number;
}

export interface NightReport {
  title: string;
  lines: string[];
  isStorm: boolean;
  /** Only set on storm nights: did the defence hold? */
  stormWon?: boolean;
  /** What each tile produced this night, for the floating numbers on the board. */
  yields: { k: string; y: Partial<Resources> }[];
  gameOver: boolean;
}

export type Rng = () => number;
