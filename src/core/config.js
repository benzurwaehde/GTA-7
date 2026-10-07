// Shared world constants. Every team builds on these — change only via the CEO.
export const CITY = {
  blocks: 8,          // blocks per side (city is blocks x blocks)
  blockSize: 60,      // edge length of one building block (m)
  roadWidth: 14,      // full road width incl. both lanes (m)
  sidewalk: 3,        // sidewalk width inside each block edge (m)
};
CITY.cell = CITY.blockSize + CITY.roadWidth;
CITY.size = CITY.blocks * CITY.cell + CITY.roadWidth; // total extent (m)
CITY.half = CITY.size / 2;

// Road centerlines (x for N-S roads, z for E-W roads). There are blocks+1 roads per axis.
export const ROAD_LINES = Array.from({ length: CITY.blocks + 1 }, (_, i) =>
  -CITY.half + CITY.roadWidth / 2 + i * CITY.cell);

// Block (i,j) occupies [minX,maxX] x [minZ,maxZ].
export function blockBounds(i, j) {
  const minX = ROAD_LINES[i] + CITY.roadWidth / 2;
  const minZ = ROAD_LINES[j] + CITY.roadWidth / 2;
  return { minX, maxX: minX + CITY.blockSize, minZ, maxZ: minZ + CITY.blockSize };
}

export function isOnRoad(x, z) {
  const hw = CITY.roadWidth / 2;
  if (Math.abs(x) > CITY.half || Math.abs(z) > CITY.half) return false;
  return ROAD_LINES.some(r => Math.abs(x - r) <= hw) || ROAD_LINES.some(r => Math.abs(z - r) <= hw);
}

export function nearestRoadLine(v) {
  let best = ROAD_LINES[0];
  for (const r of ROAD_LINES) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}
