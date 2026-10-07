# Experience team report (Sprint 1)

## Built
- `src/ui/HUD.js` (+ `Minimap.js`, `hudStyles.js`): title screen (never blocks input; dismissed by any key or click), clock, animated money with +/- delta, wanted stars (flash on change), weapon/ammo, health/armor bars, rotating circular minimap (pre-rendered static roads/sea; POIs, vehicles, police flash red/blue, mission blips and objective clamped to rim), speedometer, district fade-in, message toasts, big center text (deduped within 1.2 s), mission panel with countdown, Esc pause menu (Resume, Controls, Shadows, Sound -> `game.audio?.setMuted?.(bool)`).
- `src/missions/Missions.js` + `missionDefs.js`: data-driven missions (stage lists). Four missions: Hot Wheels, Checkpoint Rush, Clean Getaway, Taxi Driver. Glowing ring/cylinder/beam start markers at fixed sidewalk coordinates (from `blockBounds`), objective beam, completed list in localStorage (`gta7.missions.completed`).

## API notes
- `game.missions.active` -> `{name, objectiveText, progress, timeLeft, def}`; `getObjectiveMarker() -> {x,z,label}|null`; `getBlips()` (start markers, hidden while a mission is active); `start(id)` for debugging.
- Emits `mission:started|completed|failed {mission}` (failed also has `reason`), `money:changed {money, delta}`, `hud:message`, `hud:bigtext` ("MISSION PASSED"/"MISSION FAILED"). Fails on death (`player:died`/health<=0), `player:busted`, timeout, vehicle destroyed. WASTED/BUSTED bigtext is NOT emitted by us.
- Add a mission: append an object to `MISSIONS` in `missionDefs.js` (`start()`, `stages[{text, enter, update, marker, marker2}]`; call `m.fail/complete/setTimer/addTime`).
- HUD uses polling (`game.state`, `game.player`, `game.world`) so it works without events. HUD.update does not run while paused; the pause menu is pure DOM.

## Known issues / notes
- Verified build + smoke OK, but world/vehicles/peds/police were still stubs during my test, so car-based mission stages and minimap vehicle/POI icons were not exercised in a live world (only code paths guarded with `?.`).
- Minimap ignores land beyond the city rect (draws sea); change `Minimap.buildStatic` if the world team adds land outside.
- Taxi passenger is a marker only (no ped model). Fonts rely on Impact-like system fonts (fallback sans-serif).
- Esc while pointer-locked: handled via `pointerlockchange` (opens pause) with a 200 ms guard against double toggle.

## Next ideas
Mission replay payouts, mission-select via phone, passenger ped for taxi, radar for pedestrians/gunfire, stats screen, save money/progress.
