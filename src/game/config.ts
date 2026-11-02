import type { BoatType, BuildableType, Cost, PirateShip } from './types';

/** All balance numbers in one place, so tuning never means hunting through code. */
export const CONFIG = {
  /** Size of the whole island, in tiles from its middle. You start near its coast. */
  islandRadius: 7.6,
  /** Tiles around the town square that are not in the clouds at the start. */
  startRadius: 3,
  /** How many cloud areas the rest of the island is split into. */
  cloudAreas: 8,
  actionsPerDay: 6,
  days: 15,
  /** The first pirate night, then every `stormEvery` nights after it. */
  firstPirateNight: 4,
  stormEvery: 2,
  /** People who already live at the town square, so the first camps have workers. */
  plazaPeople: 4,
  foodPerPerson: 1,
  peoplePerHouseLevel: 2,
  defencePerTowerLevel: 3,
  fieldsPerFarmLevel: 2,
  farmReach: 2,
  maxLevel: 3,
  start: { food: 12, wood: 12, stone: 8, pearls: 0 },
  cost: {
    road: { stone: 1 },
    house: { wood: 3, stone: 2 },
    field: { wood: 1 },
    farm: { wood: 4, stone: 1 },
    lumber: { wood: 2 },
    quarry: { wood: 3 },
    dock: { wood: 3 },
    tower: { wood: 2, stone: 3 },
  } satisfies Record<BuildableType, Cost>,
  /** Workers each building needs per level. */
  jobs: { farm: 2, lumber: 1, quarry: 1, dock: 1 } as Partial<Record<BuildableType, number>>,
  boats: {
    rowboat: { name: 'Rowboat', dock: 1, cost: { wood: 3 }, food: 2, pearls: 0 },
    fishingboat: { name: 'Fishing boat', dock: 2, cost: { wood: 5, stone: 2 }, food: 4, pearls: 0 },
    sailboat: { name: 'Sailboat', dock: 3, cost: { wood: 8, stone: 4, pearls: 1 }, food: 5, pearls: 1 },
  } satisfies Record<BoatType, { name: string; dock: number; cost: Cost; food: number; pearls: number }>,
  /** Pirate visits get harder: small rafts first, a big galleon at the end. */
  pirates: [
    { ships: ['raft', 'raft'], power: 3 },
    { ships: ['sloop', 'sloop'], power: 6 },
    { ships: ['brig', 'sloop', 'sloop'], power: 10 },
    { ships: ['galleon', 'brig', 'brig'], power: 14 },
    { ships: ['galleon', 'galleon', 'brig'], power: 18 },
    { ships: ['galleon', 'galleon', 'galleon'], power: 22 },
  ] as { ships: PirateShip[]; power: number }[],
  pirateNames: { raft: 'raft', sloop: 'sloop', brig: 'brig', galleon: 'galleon' } as Record<PirateShip, string>,
  /** Exploring a cloud area costs more each time. */
  explore: { base: { food: 2, wood: 3 }, step: { food: 1, wood: 2 } },
  /** Clearing a tile: what it costs and what you get back. */
  clear: {
    forest: { cost: { food: 1 }, gain: { wood: 2 } },
    rocks: { cost: { food: 2, wood: 1 }, gain: { stone: 2 } },
  },
  score: { perPerson: 10, perPearl: 15, perLevel: 3, perBoat: 5, perMission: 10, perArea: 8 },
  fishing: { zoneBase: 0.16, zonePerLevel: 0.05, zonePerBoat: 0.02, perfectFrom: 0.4, perfectTo: 0.6 },
} as const;
