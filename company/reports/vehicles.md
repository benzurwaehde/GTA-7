# Vehicles team report (Sprint 1)

## Built (src/vehicles/)
- `VehicleManager.js` - full contract: `list, spawn, getNearest, remove, enter, exit, damage, update`, plus `explode`, `registerImpact`.
- `Vehicle.js` - arcade physics (XZ), two-circle wall collisions via `resolveCircleVsBoxes`, yaw kicks on impacts, handbrake drift (low lateral grip), speed-dependent steering, body roll/pitch, wheel spin + front wheel steer, brake/siren lights.
- `models.js` - procedural merged low-poly models per type (sedan, sports with spoiler, pickup truck, taxi with roof sign, police with flashing red/blue bar). Shared geometry per type + shared paint materials. 5 draw calls per car (7 for police). Random paints.
- `effects.js` - instanced smoke + additive fire particle pools, explosion flash.
- `traffic.js` - lane maths from `ROAD_LINES`, right-hand traffic, turn choice at intersections, pure-pursuit steering, car/ped avoidance, intersection yielding, honking, stuck recovery.

## API notes
- **Steering: `setControls({steer})` positive = RIGHT**, negative = LEFT. throttle -1 = brake then reverse.
- Heading forward = (sin h, 0, cos h). `position === mesh.position`. `radius` ~1.7 (sedan).
- Crash: `vehicle:crash {vehicle, impact, other}` (other = vehicle or null for walls), emitted per involved car, 0.25 s cooldown each, impact > 3 m/s. Damage only when a player/police-driven car is involved and impact > 6 (traffic never self-destructs). Cars with health < 15 burn down.
- Explosion: `vehicle:destroyed {vehicle}`, audio `explosion`, blast shoves/damages cars within 8 m, hurts on-foot player (<7 m, `player.damage(n,'explosion')`) and peds (`peds.damage(ped,100,'explosion')`). Wrecks burn ~16 s and are removed when far.
- `exit(v)` sets driver null, marks `owned` (never despawned nearby) and returns a free {x,z} beside the car. `enter(v,'player')` on an npc car emits `vehicle:hijacked`. Unoccupied cars auto-brake and sleep. `getNearest` skips destroyed cars.
- Police: set `sirenOn` to flash the bar; drive via `setControls`. `spawn(type,x,z,h,{driver:'police'|'npc'|null, color, health, speed})`.
- Traffic: 25 npc cars (spawn 80-150 m away, out of camera view; despawn >200 m or long idle), 30 parked cars along curbs (despawn >260 m). Uses `world.randomRoadPoint` if present (snapped to own lane), else computed from config.

## Verified
- `npx vite build` OK, `npm run smoke` -> SMOKE OK (293 draw calls, 56 vehicles, update ~1.5 ms/frame in headless).
- Node sim (240 s): 0 traffic wall hits, 0 off-road samples; only occasional npc-npc intersection bumps (no damage).

## Known issues / next ideas
- No traffic lights; cars yield by "intersection occupied" check, rare npc-npc bumps remain.
- Cars are 2D: no ramps/slopes, wrecks do not collide as obstacles for peds beyond circle radius.
- NPC does not flee/panic when hit; no police-style pursuit helpers (Police team drives via setControls).
- Ideas: tire skid marks, engine damage (reduced top speed), lights at night (`world.isNight`), more types (bus, motorbike), traffic reacting to sirens (pull over), crash debris.
