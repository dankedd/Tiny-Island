import type { BuildableType, BuildingType, Terrain } from './types';

export interface BuildingInfo {
  name: string;
  info: string;
}

export const BUILDINGS: Record<BuildingType, BuildingInfo> = {
  plaza:  { name: 'Town square', info: 'The heart of your village. Every path starts here.' },
  road:   { name: 'Path',        info: 'Connects buildings to the town square. Buildings only work when a path leads to them. Paths do not use a building turn.' },
  house:  { name: 'House',       info: 'Home for 2 people per level. People work in your buildings and each person eats 1 food a night.' },
  farm:   { name: 'Farm',        info: 'Farmers look after 2 fields per level, up to 2 steps away. Needs 2 workers per level.' },
  field:  { name: 'Field',       info: 'Grows 2 food a night, but only when a farm nearby looks after it.' },
  lumber: { name: 'Lumber camp', info: 'Chops 1 wood a night for each forest next to it (up to 3). Needs 1 worker per level.' },
  quarry: { name: 'Quarry',      info: 'Digs 1 stone a night for each rock next to it (up to 2). Needs 1 worker per level.' },
  dock:   { name: 'Dock',        info: 'Built on the beach with its pier in the water. Catches 1 food a night per level, and you can buy boats here.' },
  tower:  { name: 'Tower',       info: 'Gives 3 defence per level against the Fog Pirates.' },
  ruin:   { name: 'Ruin',        info: 'Broken by pirates or left empty. Fix it for half the price.' },
};

/** Order of the build menu. */
export const BUILD_MENU: BuildableType[] = ['road', 'house', 'field', 'farm', 'lumber', 'quarry', 'dock', 'tower'];

export const TERRAIN_INFO: Record<Terrain, { name: string; info: string }> = {
  sea:    { name: 'Sea',    info: 'Deep water. Docks reach into it.' },
  beach:  { name: 'Beach',  info: 'Sand. Good for paths, docks and towers.' },
  grass:  { name: 'Grass',  info: 'Good land to build on.' },
  forest: { name: 'Forest', info: 'Trees. Build a lumber camp next to it to get wood.' },
  rocks:  { name: 'Rocks',  info: 'Big stones. Build a quarry next to it to get stone.' },
};
