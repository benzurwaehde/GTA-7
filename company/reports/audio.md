# Audio report (Sprint 1)

Files: `src/audio/AudioSystem.js`, `sfx.js` (one-shots), `radio.js` (stations). All WebAudio, no assets.

## Built
- Lazy AudioContext, created and resumed on first pointerdown/keydown. Every call is try/catch guarded; no console output when audio is unavailable.
- Buses: sfx / music / ambience -> master -> compressor. `setMuted(bool)`, `setVolume('master'|'sfx'|'music'|'ambience', 0..1)`.
- `play(name, {x,z,volume})`: gunshot, smg, punch, explosion, horn, crash, pickup, mission, wasted, hit. Unknown names are ignored. With x/z, volume falls off with distance to `game.player.position` (silent beyond 180 m) and pans using the camera's right vector. Max 24 concurrent voices.
- Engine for `player.vehicle`: saw, square and sine oscillators plus noise. Pitch comes from |speed| through 5 virtual gears, with an RPM dip on upshift. It reads `vehicle.controls.throttle` if present, otherwise the W key. It is torn down when you leave the car.
- Tire screech: handbrake held (`vehicle.controls.handbrake` or Space) or lateral slip derived from yaw rate x speed.
- Siren: one shared wail voice, volume set by the nearest `sirenOn` vehicle within 120 m. It is stopped when idle.
- Ambience: wind, distant traffic rumble and a faint hiss. It is louder by day (from `world.timeOfDay`) and quieter inside a car.
- Radio: R cycles Off -> Neon FM -> Bay Beats -> Static Talk -> Off, only while in a vehicle. It emits `hud:message` ('📻 Name'). A 60 ms lookahead scheduler (0.2 s ahead) runs the stations. Music stops on exit and the station resumes on re-entry.
- Events: `vehicle:crash` (scaled by impact, ignored below 2), `vehicle:destroyed` -> explosion, `mission:completed` -> mission, `player:died` -> wasted. `money:changed` is ignored on purpose.

## Verification
`npx vite build` OK. `npm run smoke` prints SMOKE OK. A playwright script called every sound and all stations with no errors.

## Known issues
- The vehicle `speed` scale is assumed to be 0–55 m/s, with per-type maxima guessed in `_updateEngine`.
- The horn is a fixed 0.5 s one-shot, not sustained while H is held.
- Only the player's engine is synthesized. Traffic has no engine sound.
- Audio was not auditioned by ear in headless mode. Mix levels are untested.

## Next ideas
- Sustained horn, traffic and police engine voices (cheap, pooled), and footsteps.
- Ricochet and bullet-by-whiz sounds, plus a `weapon:fired` hook if senders stop calling `play`.
- A mute and volume UI in the pause menu, via `game.audio.setVolume`.
- A reverb send for explosions, and radio DJ jingles.

## Core requests
None.
