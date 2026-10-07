# Street-AI report (Sprint 1)

## Built
Files: `src/npc/{Pedestrians,PedModel,ColliderGrid,sidewalk,view}.js`, `src/police/Police.js`.

### Pedestrians (`game.peds`)
- ~40 civilians (shared geometry + cached materials, 4 meshes each, leg-swing animation), kept 30-125 m around the player, recycled when far.
- Own sidewalk graph from `core/config.js` (corner nodes at roadLine +-8.5 m, edges along blocks and across roads, BFS pathing). Does not depend on `world.randomSidewalkPoint`. Collides with `world.colliders` via a uniform grid.
- `weapon:fired` within 40 m -> flee (run, 5-11 s), then re-snaps to the nearest sidewalk node. `scare(x,z,r)` is public.
- Run over by any `vehicles.list` vehicle with |speed|>4 -> dies, flies/falls, `ped:killed {ped, source:'player'|'vehicle'}`.
- `hitTest(origin,dir,maxDist)` ray vs capsule, blocked by colliders. `damage(ped,amount,source)` also emits `ped:damaged {ped,amount,source}`. Bodies stay 25 s.
- Cash drops (~40%): spinning green bill, collected on foot or by player vehicle -> `state.money`, `money:changed {money,delta}`, audio `pickup`, small hud message.
- Extra API for Police: `spawnCop(x,z)`, `removePed(ped)`; cops have `ped.isCop`, `ped.cmd {vx,vz}`, `ped.aim`.

### Police (`game.police`)
- `wanted`, `setWanted(n)`, `addHeat(n, cap?)` (fractional heat, star = floor(heat)), mirrored in `game.state.wanted` (external writes to it are picked up). Emits `wanted:changed {level}` + `hud:message`.
- Crimes: player ped kill (+1, 1.5 / 2 on repeats within 45 s), cop kill (+2), damaging a cop (+1), shooting near peds (+0.2, cap 1.99) or cops (+0.5, cap 2.99), hijack with witness within 30 m (+1), ramming or shooting police cars (+1).
- Response: foot cops (2/2/3/4/5 for 1-5 stars) spawn out of view on sidewalks and path to the player (sidewalk BFS when blocked); 1 star = arrest only; 2+ stars shoot (tracers, `player.damage(n,'police')`, gunshot audio, scares civilians). Police cars (0/2/3/4/5) spawn on roads out of view, chase with road-graph pure pursuit + ram, dismount near the player (1-2 cops each). Falls back to more foot cops if `vehicles.spawn` is missing.
- Evasion: no cop with LOS within 80 m for 20 s -> -1 star. Busted: on foot, speed <3, within 2 m of a cop for 3 s at 1-2 stars -> `player:busted` + BUSTED bigtext. Reset + despawn on `player:died` / `player:busted`. Wanted 0: units walk/drive away and are removed.

## Verification
`npx vite build` OK. `npm run smoke` prints SMOKE OK when the machine is not overloaded (with 6 teams running load avg was ~12 and the stock 30 s `waitForFunction` timed out; a copy with a 240 s timeout passed). Headless tests of wanted 1/2/3/5, bust, car pursuit, run-over, hitTest, cash pickup all behaved.

## Known issues / next ideas
- Police cars drive road centers, not lanes, and do not avoid traffic; no road-block / spike strips / helicopters.
- Cops use straight-line movement when LOS is clear; cars may get stuck on props (reverse logic exists).
- Civilians do not look for traffic when crossing; no idle/talk/sit behaviors; arms do not swing (merged with torso).
- Ped ragdoll is a simple arc + tilt. Civilians could call cops (witness system), cops could use `weapon.id` specific damage, SWAT/army at 5 stars.
- No core requests needed.
