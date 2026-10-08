import { CITY } from '../core/config.js';

// Shared coast profile. The island is a square: d = max(|x|,|z|). Flat ground (y=0) up to FLAT, then a
// beach slope that drops below the sea level (SEA) at about SHORE. The invisible boundary walls sit at WALL.
// The water shader uses the same numbers to find the shore (foam, shallow colour).
const H = CITY.half;
export const COAST = {
  H,
  sea: -0.7,
  flat: H + 27,
  slopeEnd: H + 36,   // depth at slopeEnd = slopeDepth
  slopeDepth: -1.6,
  deepRate: 0.05,     // extra m of depth per m beyond slopeEnd
  shore: H + 30.9,    // where the sand meets the water (ground height == sea)
  wall: H + 31.5,     // walkable limit (shallow water)
};

export function groundHeight(d) {
  const c = COAST;
  if (d <= c.flat) return 0;
  if (d >= c.slopeEnd) return c.slopeDepth - (d - c.slopeEnd) * c.deepRate;
  return c.slopeDepth * (d - c.flat) / (c.slopeEnd - c.flat);
}
