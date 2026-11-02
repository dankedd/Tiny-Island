export type Terrain = 'sea' | 'beach' | 'grass' | 'forest' | 'rocks';
export type BuildingType = 'plaza' | 'road' | 'house' | 'farm' | 'field' | 'lumber' | 'quarry' | 'dock' | 'tower' | 'ruin';
export type BuildableType = Exclude<BuildingType, 'plaza' | 'ruin'>;
export type ResourceKey = 'food' | 'wood' | 'stone' | 'pearls';
export type Resources = Record<ResourceKey, number>;
export type Cost = Partial<Resources>;
export type BoatType = 'rowboat' | 'fishingboat' | 'sailboat';
export type PirateShip = 'raft' | 'sloop' | 'brig' | 'galleon';

export interface Building {
  t: BuildingType;
  l: number;
  /** Docks only: which neighbour direction (0-5) the pier points to. */
  dir?: number;
  /** Docks only: boats moored here. */
  boats?: BoatType[];
  /** Ruins only: what stood here before the pirates came. */
  was?: BuildableType;
}

export interface GameState {
  version: 2;
  seed: number;
  terrain: Record<string, Terrain>;
  b: Record<string, Building>;
  res: Resources;
  day: number;
  actions: number;
  fished: boolean;
  over: boolean;
  storms: number;
  /** Start steps: 0 = build a lumber camp, 1 = build a quarry, 2 (or missing) = free building. */
  step?: number;
}

export interface NightReport {
  title: string;
  lines: string[];
  isStorm: boolean;
  stormWon?: boolean;
  ships?: PirateShip[];
  yields: { k: string; y: Partial<Resources> }[];
  gameOver: boolean;
}

export type Rng = () => number;
