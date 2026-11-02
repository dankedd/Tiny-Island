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
  version: 3;
  seed: number;
  terrain: Record<string, Terrain>;
  /** Which cloud area each land cell is in. Area 0 is where you start. Sea cells are not listed. */
  region: Record<string, number>;
  /** Areas that are out of the clouds. */
  open: number[];
  /** Explorers sent so far into each cloud area. */
  explorers: Record<number, number>;
  /** Missions done so far (index of the current mission). */
  mission: number;
  /** Buildings you may build. More are unlocked by missions. */
  unlocked: BuildableType[];
  /** Counters for missions. */
  stats: { won: number; cleared: number };
  b: Record<string, Building>;
  res: Resources;
  day: number;
  actions: number;
  fished: boolean;
  over: boolean;
  storms: number;
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
