/** All balance numbers in one place, so tuning never means hunting through code. */
export const CONFIG = {
  gridRadius: 4,
  turnsPerDay: 8,
  days: 6,
  stormEvery: 2,
  stormBase: 4,
  stormStep: 3,
  popPerHouseLevel: 2,
  defencePerTowerLevel: 3,
  foodPerResident: 1,
  maxHandDuplicates: 2,
  startResources: { food: 4, wood: 2, stone: 1, pearls: 0 },
  offerWeights: { field: 24, forest: 22, house: 20, quarry: 14, dock: 10, tower: 10 },
  upgradeCost: {
    2: { wood: 3, stone: 2 },
    3: { wood: 5, stone: 4, pearls: 1 },
  },
  rebuildCost: { wood: 2 },
  score: { perResident: 10, perPearl: 15, perTileLevel: 3 },
  fishing: { zoneBase: 0.16, zonePerLevel: 0.06, perfectFrom: 0.4, perfectTo: 0.6 },
} as const;
