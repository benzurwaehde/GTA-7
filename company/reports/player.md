# Player team report (Sprint 1)

## Built (src/player/)
- `Player.js` - controller, vehicles, life cycle. `Character.js` - procedural humanoid (jacket, jeans, sunglasses; pivots for hips/spine/neck/head/arms+elbows/legs+knees; walk/run/idle/jump/punch/aim/death animations in code). `Weapons.js` - fists/pistol/SMG, hitscan, muzzle flash, tracers, sparks. `CameraRig.js` - orbit + chase camera with building collision.
- On foot: camera-relative WASD, Shift sprint (4.4 / 8.2 m/s), Space jump, collisions via `resolveCircleVsBoxes` against a cached nearby subset of `world.colliders`, clamped to `CITY.half-1`. Spawns at `world.getSpawnPoint()` on first update.
- Camera: pointer-lock mouse orbit, over-shoulder, shortened by `rayBox` against colliders. In vehicle: chase camera, pulled back and FOV widened with speed, re-aligns behind the car 1.2 s after mouse stops.
- F: nearest vehicle within 4 m (`getNearest`, `enter(v,'player')`), mesh hidden, position follows vehicle, `setControls` every frame (W/S throttle / brake-then-reverse, A/D steer, Space handbrake), H horn. F again -> `exit(v)` point. Handles vehicle destroyed/crash events (eject + damage). All calls are optional-chained/try-guarded.
- Weapons: Q/E cycle (also 1/2/3), LMB (only when pointer-locked) or Ctrl fires; pistol semi-auto (48 ammo), SMG auto (150). Hitscan from chest along camera yaw (flat), picks nearest of wall / `peds.hitTest` / vehicle circle; `peds.damage(ped,dmg,'player')`, `vehicles.damage(v,n)`. Emits `weapon:fired {position, weapon:id}` (guns only), plays `gunshot|smg|punch|hit`.
- Health/armor (armor absorbs 70% of damage), `damage(amount, source)`, `heal(n)`. Death: fall animation, `player:died`, `hud:bigtext WASTED`, respawn after 4 s at nearest hospital POI (else spawn), -10% money (`money:changed {money, delta}`), `player:respawn`. `player:busted`: respawn after 3 s at nearest police POI, also -10% money.
- Extra API: `addAmmo(id,n)`, `addArmor(n)`, `teleport(x,z)`; events `player:damaged`, `weapon:changed`.

## Verified
`npx vite build` ok; `npm run smoke` prints SMOKE OK. Also tested with injected mock world/vehicles (run, jump, punch, SMG, wall camera, enter/drive/exit, death/respawn): no console errors.

## Known issues / notes
- Steer sign convention for `setControls` unverified against the real vehicle system (see requests/player.md).
- Fists `ammo` is `Infinity`.
- Aim is flat (no vertical aiming); no right-mouse aim mode (Input has no RMB).
- Collision is 2D; buildings are not climbable and low colliders (maxY < 0.2) are not special-cased.

## Next ideas
Vertical aiming + crosshair, RMB zoom, melee on vehicles, hijack animation (pull NPC out), reload, weapon pickups, ragdoll with limb physics, footstep sounds, swim/vault, car-door animation.
