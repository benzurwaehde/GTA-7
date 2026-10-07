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

## Als Mac-App

Das Spiel steckt in einer Electron-App (`electron/main.cjs`). Sie liefert den Vite-Build über `app://` aus.

```bash
npm run app           # Build bauen und direkt im App-Fenster starten (ohne Installation)
npm run dist:mac      # Mac-App bauen -> release/mac-arm64/GTA 7 Vice Bay.app
npm run app:install   # bauen und nach /Applications installieren
npm run app:test      # gepackte App starten und automatisch prüfen
npm run icon          # App-Icon neu erzeugen (build/icon.icns)
```

Nach einer Änderung am Spiel genügt `npm run app:install`, dann ist die installierte App aktuell. Die App ist nicht signiert. Da sie lokal gebaut wird, öffnet macOS sie trotzdem ohne Rückfrage. Vollbild gibt es über das Menü „Ansicht“ oder mit ⌃⌘F.

Schwere Tests (Smoke, QA-Tour, Blender) laufen bei parallelem Arbeiten über `tools/heavy.sh <befehl>`. Das Skript lässt höchstens zwei gleichzeitig zu (`HEAVY_SLOTS`), damit der Laptop nicht überhitzt.

Die Blender-Modelle baust du neu mit `blender -b --factory-startup --python tools/blender/car_sedan.py`. Die Exporte landen in `public/models/`.

## Aufbau

- `src/core/` enthält Engine, Input und Asset-Loader (`assets.js`, `modelList.js`).
- In `src/world/`, `src/vehicles/`, `src/player/`, `src/npc/`, `src/police/`, `src/ui/`, `src/missions/`, `src/audio/`, `src/pickups/` und `src/save/` liegen die einzelnen Systeme.
- `company/ARCHITECTURE.md` beschreibt den API-Vertrag zwischen den Systemen.

## Stand und wie es weitergeht

Den Entwicklungsstand des laufenden Sprints findest du in [`unternehmen/sprint-2-rund/STAND.md`](unternehmen/sprint-2-rund/STAND.md). Den Auftrag beschreibt [`BRIEF.md`](unternehmen/sprint-2-rund/BRIEF.md) im selben Ordner.
