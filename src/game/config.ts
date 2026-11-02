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
  startResources: { voedsel: 4, hout: 2, steen: 1, parels: 0 },
  offerWeights: { akker: 24, bos: 22, huis: 20, steen: 14, steiger: 10, toren: 10 },
  upgradeCost: {
    2: { hout: 3, steen: 2 },
    3: { hout: 5, steen: 4, parels: 1 },
  },
  rebuildCost: { hout: 2 },
  score: { perResident: 10, perPearl: 15, perTileLevel: 3 },
  fishing: { zoneBase: 0.16, zonePerLevel: 0.06, perfectFrom: 0.4, perfectTo: 0.6 },
} as const;
