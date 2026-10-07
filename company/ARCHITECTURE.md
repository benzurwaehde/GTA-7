# Architecture & API contract

Stack: Three.js + Vite, plain ES modules, no other runtime deps. Y is up, ground at y=0, units = meters.
`window.game` is the `Game` instance (`src/core/Game.js`). Systems are registered in `src/main.js` and reachable as
`game.world`, `game.audio`, `game.vehicles`, `game.peds`, `game.police`, `game.player`, `game.missions`, `game.hud`.
Each system is a class `constructor(game)` with `update(dt)`. Update order = registration order.

**Rules**
- Other systems may be stubs or missing methods: always call across systems defensively (`game.audio?.play?.('gunshot')`).
- Never edit another team's folder or `src/core/` — file a request in `company/requests/<your-team>.md`.
- No external assets/network: generate geometry, textures (CanvasTexture), and sound procedurally.
- Performance budget: 60 fps on a laptop. Use InstancedMesh / merged geometry for repeated things. Keep draw calls < ~400.
- `npm run build` and `npm run smoke` must pass (smoke fails on any console error).

## Shared core (CEO)
- `core/config.js`: `CITY`, `ROAD_LINES`, `blockBounds(i,j)`, `isOnRoad(x,z)`, `nearestRoadLine(v)`.
  City is a grid of `CITY.blocks²` blocks; roads (width `CITY.roadWidth`) run along every `ROAD_LINES` value on both axes. Two lanes: right-hand traffic.
- `core/physics.js`: `resolveCircleVsBoxes(pos, r, boxes)`, `circlesOverlap(...)`, `rayBox(ox,oz,dx,dz,box)`. Boxes are `{minX,maxX,minZ,maxZ}` (optionally `maxY`).
- `game.input`: `isDown(code)`, `pressed(code)` (one frame), `mouse.{dx,dy,left,leftPressed,locked}`. Codes are `KeyboardEvent.code` (`'KeyW'`, `'Space'`, `'ShiftLeft'`...).
- `game.events`: `on(name, fn)` / `emit(name, payload)`.
- `game.state`: `{ money, wanted }` — shared numbers shown by the HUD.
- `game.time`, `game.paused`, `game.scene`, `game.camera`, `game.renderer`, `game.ui` (DOM overlay root, `pointer-events:none`; add class `clickable` to interactive elements).

## World — `game.world` (`src/world/City.js`, class `City`)
- `colliders: Box[]` — static obstacles (buildings, walls, big props). Everything walking/driving collides against these.
- `getSpawnPoint() -> {x, z}` player start (sidewalk near city center).
- `randomSidewalkPoint(nearX?, nearZ?, radius?) -> {x, z}`; `randomRoadPoint(...)` same signature, returns a point on a lane center with `heading`.
- `pois: [{ type: 'hospital'|'police'|'garage'|'shop'|'safehouse', name, x, z }]` (door positions on sidewalks).
- `districtAt(x, z) -> string`; `timeOfDay` (0–24, advances ~1 game hour/min); `isNight` bool.
- `sun` (DirectionalLight) whose shadow camera follows `game.player.position` if present.

## Vehicles — `game.vehicles` (`src/vehicles/`, class `VehicleManager`)
- `list: Vehicle[]`; `spawn(type, x, z, heading, opts?) -> Vehicle`; types: `'sedan'|'sports'|'truck'|'taxi'|'police'`.
- `getNearest(x, z, maxDist, filterFn?) -> Vehicle|null`; `remove(vehicle)`.
- `enter(vehicle, who)` (`who`: `'player'|'npc'|'police'`), `exit(vehicle) -> {x,z}` (safe exit point beside the car).
- `damage(vehicle, amount)`; at health ≤ 0 → explodes, `destroyed=true`, emits `vehicle:destroyed {vehicle}`.
- Vehicle fields: `mesh`, `position` (=== mesh.position), `heading` (yaw rad; forward = `(sin h, 0, cos h)`), `speed` (m/s, signed),
  `radius`, `type`, `driver` (`null|'player'|'npc'|'police'`), `health` (0–100), `destroyed`, `isPolice`, `sirenOn`.
- `vehicle.setControls({ throttle, steer, brake, handbrake })` (throttle/steer in −1..1). The manager drives `'npc'` (traffic) itself;
  `'player'` cars are controlled by the Player via `setControls` every frame; `'police'` cars by the Police system via `setControls`.
- Emits `vehicle:crash {vehicle, impact}`, `vehicle:hijacked {vehicle}` (when player enters an npc-driven car).
- Keeps ~25 traffic cars alive around the player; parked cars along curbs.

## Player — `game.player` (`src/player/`, class `Player`)
- `position` (Vector3 feet; follows the vehicle while driving), `heading`, `radius` (0.4), `health` (0–100), `armor`, `alive`,
  `vehicle` (Vehicle|null), `weapon` `{ id, name, ammo }`, `mesh`.
- Owns the camera every frame (third-person on foot, chase cam in vehicle). Mouse look via pointer lock.
- Controls: WASD move, Shift sprint, Space jump, F enter/exit (hijack if npc driver), LMB or Ctrl shoot, Q/E weapon cycle (fists, pistol, SMG).
  In car: W/S throttle/brake-reverse, A/D steer, Space handbrake, H horn (`game.audio?.play('horn')`).
- `damage(amount, source)`; `heal(n)`; on death emits `player:died`; respawns at nearest hospital POI after ~4 s, −10% money, emits `player:respawn`.
- Shooting: uses `game.peds.hitTest(origin, dir, maxDist)` and vehicle circles; emits `weapon:fired {position, weapon}`.

## Street AI — `game.peds` (`src/npc/`, class `Pedestrians`), `game.police` (`src/police/`, class `Police`)
- Peds: `list: Ped[]` (`mesh, position, heading, health, alive, state:'walk'|'flee'|'dead', radius`), ~40 around the player on sidewalks.
  `hitTest(origin: Vector3, dir: Vector3, maxDist) -> {ped, point, dist}|null`; `damage(ped, amount, source)`.
  Peds flee on `weapon:fired`; get run over by vehicles with |speed| > 4 (peds system checks `game.vehicles.list`).
  On death emits `ped:killed {ped, source}` (`source`: `'player'|'vehicle'|'police'|...`); may drop cash (adds to `game.state.money` when walked over, emits `money:changed`).
- Police: `wanted` 0–5 (mirror into `game.state.wanted`), `setWanted(n)`, `addHeat(n)`. Emits `wanted:changed {level}`.
  Crimes: killing peds, shooting near people, hijacking, hitting cop cars. Spawns police cars (`game.vehicles.spawn('police', ...)`) that chase the player
  and cops on foot that shoot (`game.player.damage`). Stars fade after ~25 s out of sight. Busted when player is on foot, slow and next to a cop for 3 s at 1–2 stars → emits `player:busted`.
  Reset to 0 on `player:died`/`player:busted`.

## Experience — `game.missions` (`src/missions/`), `game.hud` (`src/ui/`)
- Missions: glowing markers in the world; walk in to start. `active`, `getObjectiveMarker() -> {x, z, label}|null`.
  Emits `mission:started|completed|failed {mission}`, rewards money (`game.state.money += n; emit('money:changed')`).
- Anyone may emit `hud:message {text, duration?}` and `hud:bigtext {text, color?, duration?}`.
- HUD: health/armor, money, wanted stars, weapon/ammo, speedometer, minimap (roads, player, blips for missions/POIs/police), district name,
  messages, WASTED/BUSTED screens, Esc pause menu (sets `game.paused`), controls help, title screen "Click to play".

## Audio — `game.audio` (`src/audio/`, class `AudioSystem`)
- All sounds synthesized with WebAudio; context resumed on first user gesture.
- `play(name, opts?)` one-shots: `'gunshot'|'smg'|'punch'|'explosion'|'horn'|'crash'|'pickup'|'mission'|'wasted'|'hit'`; optional `{x, z}` for distance attenuation.
- Continuous: engine pitch from `game.player.vehicle.speed`, siren when any police car has `sirenOn` near the player, radio in car (R cycles procedural stations, off).
