# GTA 7: Vice Bay

Browserbasiertes Open-World-Spiel mit Three.js und Vite. Alles ist prozedural oder selbst in Blender per Skript erzeugt.

## Starten

```bash
npm install
npm run dev        # Spiel im Browser (Vite)
npm run build      # Produktions-Build
npm run smoke      # Headless-Smoke-Test (schlägt bei jedem Konsolenfehler fehl)
node tests/qa-tour.mjs   # Screenshot-Tour typischer Szenen -> tests/screenshots/qa-*.png
```

Schwere Tests (Smoke, QA-Tour, Blender) laufen bei parallelem Arbeiten über `tools/heavy.sh <befehl>`. Das Skript lässt höchstens zwei gleichzeitig zu (`HEAVY_SLOTS`), damit der Laptop nicht überhitzt.

Die Blender-Modelle baust du neu mit `blender -b --factory-startup --python tools/blender/car_sedan.py`. Die Exporte landen in `public/models/`.

## Aufbau

- `src/core/` enthält Engine, Input und Asset-Loader (`assets.js`, `modelList.js`).
- In `src/world/`, `src/vehicles/`, `src/player/`, `src/npc/`, `src/police/`, `src/ui/`, `src/missions/`, `src/audio/`, `src/pickups/` und `src/save/` liegen die einzelnen Systeme.
- `company/ARCHITECTURE.md` beschreibt den API-Vertrag zwischen den Systemen.

## Stand und wie es weitergeht

Den Entwicklungsstand des laufenden Sprints findest du in [`unternehmen/sprint-2-rund/STAND.md`](unternehmen/sprint-2-rund/STAND.md). Den Auftrag beschreibt [`BRIEF.md`](unternehmen/sprint-2-rund/BRIEF.md) im selben Ordner.
