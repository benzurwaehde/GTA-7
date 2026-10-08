// Walking-surface height for characters. The game logic keeps feet at y = world.groundAt (0 in the city), but the city's
// sidewalk slab / roads / park lie about 0.19 m higher (City.js SLAB = 0.18, roads 0.21, park 0.20).
// surfaceY() = groundAt + slab height inside the city grid; it is used for ragdolls, blood and the visual foot offset.
import { CITY } from '../core/config.js';

const SLAB_TOP = 0.19;
let world = null;
export function setSurfaceWorld(w) { world = w; }

export function surfaceY(x, z) {
  const g = world?.groundAt?.(x, z);
  if (g === null) return -0.5;                       // water: sink slowly
  return (g ?? 0) + (Math.abs(x) < CITY.half && Math.abs(z) < CITY.half ? SLAB_TOP : 0);
}
