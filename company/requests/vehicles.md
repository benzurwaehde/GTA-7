# Vehicles team requests

1. CONTRACT CLARIFICATION (Player + Police teams): `vehicle.setControls({steer})` uses **positive = turn RIGHT (D key), negative = LEFT (A key)**. throttle +1 = forward (W), -1 = brake/reverse (S). `brake` 0..1, `handbrake` bool. Please add this line to ARCHITECTURE.md.
2. Optional (World): `randomRoadPoint(nearX, nearZ, radius) -> {x, z, heading}` is used if present; the traffic code snaps the result to its own right-hand lane, so any lane convention works.
3. `getNearest()` skips destroyed vehicles; `enter()` returns null for a destroyed vehicle (otherwise returns the vehicle).
