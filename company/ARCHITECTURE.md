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

- `game.input.mouse.right`, `.rightPressed`, `.wheel` (wheel steps this frame).
- `core/assets.js`: `getModel(name)` returns a clone of the preloaded `public/models/<name>.glb` or `null` (always keep a procedural fallback); `hasModel(name)`. Model names live in `core/modelList.js`. Blender sources: `tools/blender/<name>.py` (`blender -b --factory-startup --python ...`).

## World — `game.world` (`src/world/City.js`, class `City`)
- `colliders: Box[]` — static obstacles (buildings, walls, big props). Everything walking/driving collides against these.
- `getSpawnPoint() -> {x, z}` player start (sidewalk near city center).
- `randomSidewalkPoint(nearX?, nearZ?, radius?) -> {x, z}`; `randomRoadPoint(...)` same signature, returns a point on a lane center with `heading`.
- `pois: [{ type: 'hospital'|'police'|'garage'|'shop'|'safehouse', name, x, z }]` (door positions on sidewalks).
- `districtAt(x, z) -> string`; `timeOfDay` (0–24, advances ~1 game hour/min); `isNight` bool.
- `sun` (DirectionalLight) whose shadow camera follows `game.player.position` if present.

- Traffic lights: `signalAt(x, z, axis) -> 'green'|'yellow'|'red'|null` (`axis` 'ns' = moving along Z, 'ew' = along X; nearest intersection, `null` beyond 25 m). Per intersection one axis is always red; cycle 8 s green, 2 s yellow, 1 s all-red per axis, phase-offset per intersection. Stop lines are 11.4 m from the intersection centre.
- Ground-floor shops (`world/shops.js`), neon signs, instanced street furniture (benches, hydrants, bins, mailboxes; no colliders).

## Vehicles — `game.vehicles` (`src/vehicles/`, class `VehicleManager`)
- `list: Vehicle[]`; `spawn(type, x, z, heading, opts?) -> Vehicle`; types: `'sedan'|'sports'|'truck'|'taxi'|'police'`.
- `getNearest(x, z, maxDist, filterFn?) -> Vehicle|null`; `remove(vehicle)`.
- `enter(vehicle, who)` (`who`: `'player'|'npc'|'police'`), `exit(vehicle) -> {x,z}` (safe exit point beside the car).
- `damage(vehicle, amount)`; at health ≤ 0 → explodes, `destroyed=true`, emits `vehicle:destroyed {vehicle}`.
- Vehicle fields: `mesh`, `position` (=== mesh.position), `heading` (yaw rad; forward = `(sin h, 0, cos h)`), `speed` (m/s, signed),
  `radius`, `type`, `driver` (`null|'player'|'npc'|'police'`), `health` (0–100), `destroyed`, `isPolice`, `sirenOn`.
- `vehicle.setControls({ throttle, steer, brake, handbrake })` (throttle/steer in −1..1; **steer +1 = turn right**, −1 = left). The manager drives `'npc'` (traffic) itself;
  `'player'` cars are controlled by the Player via `setControls` every frame; `'police'` cars by the Police system via `setControls`.
- Emits `vehicle:crash {vehicle, impact}`, `vehicle:hijacked {vehicle}` (when player enters an npc-driven car).
- Keeps ~25 traffic cars alive around the player; parked cars along curbs.

- Models come from Blender GLBs (`car_<type>.glb`; wheels `wheel_FL/FR/RL/RR`, materials `Paint`, `Headlight`, `Taillight`, `Siren_Red/Blue`), merged to 5 draw calls per car; procedural fallback if a GLB is missing.
- Night lights: emissive head/tail lamps for all cars, one SpotLight `game.vehicles.headSpot` on the player's car, NPC road light pools in one InstancedMesh. `models.js` exports `setCarNight(f)`.
- `game.vehicles.effects`: `explosion(x,y,z)`, `smokePuff`, `firePuff`, `skid(x,z,dir,len,dark)`, `setNight(f)`. Skid marks are a fading pool.
- Traffic stops at red/yellow via `game.world.signalAt` (if present); hit NPC cars honk and flee (`vehicle.ai.fleeT`).

## Player — `game.player` (`src/player/`, class `Player`)
- `position` (Vector3 feet; follows the vehicle while driving), `heading`, `radius` (0.4), `health` (0–100), `armor`, `alive`,
  `vehicle` (Vehicle|null), `weapon` `{ id, name, ammo }`, `mesh`.
- Owns the camera every frame (third-person on foot, chase cam in vehicle). Mouse look via pointer lock.
- Controls: WASD move, Shift sprint, Space jump, F enter/exit (hijack if npc driver), LMB or Ctrl shoot, RMB aim mode (over-shoulder, smaller FOV), R reload on foot, Q/E/1-3/mouse wheel weapon cycle (fists, pistol, SMG).
  In car: W/S throttle/brake-reverse, A/D steer, Space handbrake, H horn (`game.audio?.play('horn')`).
- `damage(amount, source)`; `heal(n)`; on death emits `player:died`; respawns at nearest hospital POI after ~4 s, −10% money, emits `player:respawn`.
- Shooting: uses `game.peds.hitTest(origin, dir, maxDist)` and vehicle circles; emits `weapon:fired {position, weapon}`.

- Aiming follows the camera ray (vertical aim). `getAimInfo() -> { aiming, weaponId, spread }` (spread in rad).
- `weapon = { id, name, ammo (reserve), clip, clipSize, reloading }`; fists have `clip/clipSize = Infinity`. `weapons.startReload()`; auto reload on empty clip. Pistol clip 12, SMG 30.
- `cam.shake(0..1)`, `cam.kick(pitch)`, `cam.aimOrigin/aimDir`; `weapons.castRay(origin, dir, maxDist)` returns a reused `{dist, kind, target, point}` (do not keep it).
- Collides on foot with vehicles (capsule along the car). Plays `footstep`, `reload`, `empty` via `game.audio`.

## Street AI — `game.peds` (`src/npc/`, class `Pedestrians`), `game.police` (`src/police/`, class `Police`)
- Peds: `list: Ped[]` (`mesh, position, heading, health, alive, state:'walk'|'flee'|'dead', radius`), ~40 around the player on sidewalks.
  `hitTest(origin: Vector3, dir: Vector3, maxDist) -> {ped, point, dist}|null`; `damage(ped, amount, source)`.
  Peds flee on `weapon:fired`; get run over by vehicles with |speed| > 4 (peds system checks `game.vehicles.list`).
  On death emits `ped:killed {ped, source}` (`source`: `'player'|'vehicle'|'police'|...`); may drop cash (adds to `game.state.money` when walked over, emits `money:changed`).
- Police: `wanted` 0–5 (mirror into `game.state.wanted`), `setWanted(n)`, `addHeat(n)`. Emits `wanted:changed {level}`.
  Crimes: killing peds, shooting near people, hijacking, hitting cop cars. Spawns police cars (`game.vehicles.spawn('police', ...)`) that chase the player
  and cops on foot that shoot (`game.player.damage`). Stars fade after ~25 s out of sight. Busted when player is on foot, slow and next to a cop for 3 s at 1–2 stars → emits `player:busted`.
  Reset to 0 on `player:died`/`player:busted`.

- Peds (Sprint 2): varied models (hair/caps, 3 body types, skirt/trousers, swinging arms; `buildPedMesh(kind)`, `releasePedMesh(mesh)`); fields `fighter`, `waiting` (`null|'ns'|'ew'`), state `'fight'` (~15 % punch back at an unarmed player). Peds cross at crosswalks only when `signalAt` is red for crossing traffic (fallback: no moving car within 15 m).
- Police (Sprint 2): pursuit in the right lane beyond 60 m, dodges traffic; roadblock at 4★+ ~85 m ahead of the player: `police.block = null | { cars, fx, fz }` (entries have `block: true`), retries on spawn failure.

## Experience — `game.missions` (`src/missions/`), `game.hud` (`src/ui/`)
- Missions: glowing markers in the world; walk in to start. `active`, `getObjectiveMarker() -> {x, z, label}|null`.
  Emits `mission:started|completed|failed {mission}`, rewards money (`game.state.money += n; emit('money:changed')`).
- Anyone may emit `hud:message {text, duration?}` and `hud:bigtext {text, color?, duration?}`.
- HUD: health/armor, money, wanted stars, weapon/ammo, speedometer, minimap (roads, player, blips for missions/POIs/police), district name,
  messages, WASTED/BUSTED screens, Esc pause menu (sets `game.paused`), controls help, title screen "Click to play".

- Pickups — `game.pickups` (`src/pickups/`): `items[] {type:'health'|'armor'|'ammo', x, z, color, active}` (15, respawn after 60 s), `getBlips()`.
- Save — `game.save` (`src/save/`): `save()`, `load()`, `newGame()`, `hasSave`; localStorage key `gta7.save` (money, missions, ammo, time, position); autosave every 30 s and after missions.
- HUD (Sprint 2): crosshair from `player.getAimInfo()`, hit marker on `ped:damaged`, `clip / ammo` + RELOADING; objective only in the top bar; pause menu with volume sliders and New Game. Missions: 6 incl. `chase` and `delivery`; a mission def may have `leave(m)` called on finish. A mission target car can set `owned = true` to avoid despawn.

## Audio — `game.audio` (`src/audio/`, class `AudioSystem`)
- All sounds synthesized with WebAudio; context resumed on first user gesture.
- `play(name, opts?)` one-shots: `'gunshot'|'smg'|'punch'|'explosion'|'horn'|'crash'|'pickup'|'mission'|'wasted'|'hit'`; optional `{x, z}` for distance attenuation.
- Continuous: engine pitch from `game.player.vehicle.speed`, siren when any police car has `sirenOn` near the player, radio in car (R cycles procedural stations, off).
- Sprint 2: `play('footstep'|'reload'|'empty')`; `hornStart()/hornStop()` (H held → sustained horn); pooled traffic engine hum (max 4 voices).

## Sprint 3 additions
- Core: `game.timeScale` (slow motion), `game.realDt` (unscaled frame time). Third-party assets allowed only CC0/CC-BY, listed in `CREDITS.md`.
- Characters — `src/characters/` (Human, Ragdoll, Blood, surface): Quaternius CC0 humans (`human_*.glb`, shared 31-bone skeleton). `surfaceY(x,z)` = walkable surface height (sidewalk slab, coast, pier).
  - `character.rightHand` (Object3D, +Z along hand), `setWeaponStyle('pistol'|'rifle'|'none')` (rifle = two-handed IK), `setPose('aim'|'idle',{twoHanded})`, `update(dt,{speed,grounded,aiming,dying,vy,reload,pitch})`.
  - `peds.damage(ped, amount, source, hit?)` with `hit={point,dir}`; `peds.kill(ped, source, vx,vy,vz)`; verlet ragdolls (max 8 active), `peds.useRagdoll`, `peds.ragdolls`; `game.blood.spray(point,dir,n,speed)`, `.puddle(x,z,size)`. Peds react to the `explosion` event.
- Weapons — fists, pistol, smg, shotgun, rifle, sniper, grenade (`WEAPON_DEFS`, `owned`, `select/cycle/give/addAmmo/stateOf/defOf`). Keys: Tab = weapon wheel (`game.weaponWheel`, slow motion), 1–7 direct. `castRay` returns surface normal and `kind:'heli'`. Event `explosion {x,y,z,radius,source}`. Grenades check line of sight vs colliders.
- Shop — `game.shop` ("Bullseye Arms"): `isOpen`, `position`, `getBlips()`, `open()/close()`; ownership persisted under `gta7.arms` (cleared by New Game).
- World — sea shader (`world.sea`, `seaSurface(x,z,t,out)`), harbour (`world.harbor`), landmarks (`world.landmarks.list`), rooftop details. Walkability: `world.playLimit`, `world.isWalkable(x,z)` (land, pier, quay), `world.groundAt(x,z)` (null in water). New collider types `lamp, rail, crane, container, landmark`.
- Vehicles — types `muscle, van, bus, bike` (+ sedan, sports, truck, taxi, police); damage (`dentAt`, `crackGlass`, charred wreck); `effects.explosion(x,y,z,paintHex?)`; traffic yields to sirens (`vehicles.sirens`).
- Police helicopter at 5★ — `game.police.helicopter` (null if none): `hit(point,dmg)`, `rayHit(o,d,max)`, `hitRay(o,d,max,dmg)`, `blast(x,y,z,r,dmg)`, `hp`, `state`; event `helicopter:destroyed`.

