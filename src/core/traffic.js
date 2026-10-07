// Deterministic traffic-signal timing shared by World (draws lights) and Vehicles/Peds (obey them).
// Intersection (i, j) sits at x = ROAD_LINES[i], z = ROAD_LINES[j].
// axis 'x' = traffic moving along the x axis (E-W road), axis 'z' = moving along z (N-S road).
export const SIGNAL = { green: 9, yellow: 2.5, allRed: 1 };
SIGNAL.cycle = 2 * (SIGNAL.green + SIGNAL.yellow + SIGNAL.allRed);

export function signalState(time, i, j, axis) {
  const offset = ((i * 7 + j * 13) % 5) * 3.1; // de-synchronise neighbouring intersections
  let t = (time + offset) % SIGNAL.cycle;
  const phase = SIGNAL.green + SIGNAL.yellow + SIGNAL.allRed;
  const zFirst = axis === 'z';
  if (!zFirst) t = (t + phase) % SIGNAL.cycle;
  if (t < SIGNAL.green) return 'green';
  if (t < SIGNAL.green + SIGNAL.yellow) return 'yellow';
  return 'red';
}
