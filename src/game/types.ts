export type TileType = 'akker' | 'bos' | 'huis' | 'steen' | 'steiger' | 'toren' | 'ruine';
export type PlaceableType = Exclude<TileType, 'ruine'>;
export type ResourceKey = 'voedsel' | 'hout' | 'steen' | 'parels';
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
  gameOver: boolean;
}

export type Rng = () => number;
