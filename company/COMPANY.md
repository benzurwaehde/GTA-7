# Rockridge Interactive (fictional studio) — building "GTA 7: Vice Bay"

An original, browser-based open-world crime game inspired by the genre.
No assets, names or code from existing commercial games are used: everything is procedural.

## Org chart

| Role | Runs on | Owns |
|------|---------|------|
| **CEO / Creative & Technical Director** | Opus | Vision, architecture (`src/core`, `src/main.js`, `company/`), sprint planning, integration, QA, commits & pushes |
| World Team | Sonnet subagent | `src/world/` — procedural city, day/night, POIs, districts |
| Vehicles Team | Sonnet subagent | `src/vehicles/` — arcade car physics, traffic AI, damage |
| Player Team | Sonnet subagent | `src/player/` — character, camera, weapons, enter/exit vehicles |
| Street-AI Team | Sonnet subagent | `src/npc/`, `src/police/` — pedestrians, wanted system, cops |
| Experience Team | Sonnet subagent | `src/ui/`, `src/missions/` — HUD, minimap, menus, missions |
| Audio Team | Sonnet subagent | `src/audio/` — procedural WebAudio SFX, sirens, radio |

## Operating loop (fully autonomous)

1. **Plan** — CEO reads `BACKLOG.md`, `SPRINTS.md` and team reports, picks the next sprint goals.
2. **Delegate** — CEO briefs each team (parallel Sonnet subagents) with exact file ownership and the API contract in `ARCHITECTURE.md`.
3. **Build** — Teams only edit their own folders. Cross-team needs go to `company/requests/<team>.md`.
4. **Integrate & QA** — CEO runs `npm run build` + `npm run smoke` (headless Chromium, screenshots), reviews, fixes integration bugs.
5. **Ship** — CEO commits and pushes, logs the sprint in `SPRINTS.md`, refills `BACKLOG.md`.
6. **Self-trigger** — a scheduled routine wakes the CEO session again, which goes back to step 1.

No human input is required. The human may drop wishes into `company/WISHES.md` at any time; the CEO reads it every sprint with top priority.
