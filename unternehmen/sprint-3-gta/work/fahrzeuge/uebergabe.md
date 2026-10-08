# Übergabe T4 `fahrzeuge`

Alles ausgeführt und getestet. Kein Commit. Nur Dateien in meinen Ordnern geändert (siehe unten).

## Was gebaut wurde
1. **Neue Fahrzeugtypen** (alle per Blender-Skript, reproduzierbar, in `public/models/`):
   - `muscle` (Muscle-Car, `car_muscle.py`), `van` (`car_van.py`), `bus` (`car_bus.py`, feste blaue Lackierung), `bike` (Motorrad, `vehicle_bike.py`, GLB `vehicle_bike.glb`).
   - Alle in `SPECS` (`models.js`), im Verkehr (Mix `MIX_TRAFFIC`) und bei Parkplätzen (`MIX_PARKED`, ohne Bus) und über `vehicles.spawn(type, x, z, heading, opts)` erreichbar. Prozedurale Fallbacks für alle Typen, falls ein GLB fehlt.
   - **Motorrad:** eigene Physik-Werte (leicht, griffig, kleiner Lenkwinkel), neigt sich in Kurven nach innen (`spec.lean`), steht geparkt auf dem Seitenständer, liegt bei Totalschaden. Bei hartem Aufprall (>8) wird der Fahrer abgeworfen: Spieler steigt aus und bekommt Schaden, NPC-Fahrer verschwindet, Motorrad liegt 4 s. Fahrer sichtbar: einfache Blockfigur mit Helm (Fallback, ein zusätzlicher Draw Call pro Motorrad), sichtbar nur wenn `driver !== null`. Die T1-Figur ist **nicht** eingebunden (offen).
2. **Schadensbild** (`src/vehicles/damage.js`, klont die Karosserie erst beim ersten Treffer):
   - Dellen: Vertex-Offset um den Kontaktpunkt (nach innen, max. 0,45 m), Lack dunkler, Flächen flach schattiert (wirkt zerknautscht). Kontaktpunkte kommen aus Welt- und Auto-gegen-Auto-Kollision.
   - Stufen: Dellen bei jedem harten Aufprall (>4), Scheiben splittern bei Gesundheit <60 oder Aufprall >11, Rauch aus der Motorhaube ab <50 (dichter <30), Feuer <15, bei 0 Explosion und ausgebranntes, schwarz verkohltes Wrack (Holzkohle-/Rostfarben, schwarze Scheiben, eingesunkenes Dach, verbrannte Reifen, `MATS.charred`).
   - Explosionstrümmer: unregelmäßige verkohlte Platten in der **Lackfarbe des Autos** (jede dritte dunkles Metall), 72 Instanzen, bleiben ca. 6-9 s liegen. Keine roten Würfel mehr.
3. **Polizei-Hubschrauber** (`src/vehicles/Helicopter.js`, Blender `vehicle_heli.py` -> `vehicle_heli.glb`, Fallback prozedural):
   - Erscheint 4 s nach Erreichen von 5 Sternen (Respawn-Sperre 45 s nach Abschuss), 130 m entfernt, kreist in ca. 26 m Radius über dem Spieler, bleibt über den Dächern (`_rooftops`, Höhe der Gebäude-Collider +9 m), neigt sich bei Beschleunigung/Seitendrift.
   - Rotor und Heckrotor drehen, Blur-Scheibe, blinkende Positionslichter.
   - Suchscheinwerfer als Lichtkegel-Mesh (additiv) plus Leuchtfleck am Boden, folgt dem Spieler mit Verzögerung, nachts stärker. Kein echtes SpotLight (kein Shader-Recompile durch neue Lichtanzahl).
   - Beschießt den Spieler in Salven (Sichtlinie über `police.grid.lineClear`, Trefferchance sinkt mit Distanz und Tempo, Schaden 4-6, Leuchtspur über `police._tracer`).
   - Abschuss: 140 HP. Bei 0 HP dreht er ab, stürzt mit Rauch- und Feuerspur, explodiert am Boden (Schaden an Spieler/Passanten/Autos im Umkreis), bleibt ca. 35 s als verkohltes Wrack. Event `helicopter:destroyed`.
   - Unter 5 Sternen oder bei Tod des Spielers fliegt er weg und wird entfernt.
4. **Verkehr und Sirenen** (`traffic.js`, `VehicleManager.sirens`): Fährt ein Polizeiauto mit Sirene (Tempo >4) von hinten in gleicher Richtung heran (bis 55 m, Querabstand <9 m), rückt der NPC-Wagen etwas nach rechts und hält an, hält 2,5 s nach dem Vorbeifahren und fährt dann weiter. In oder kurz vor einer Kreuzung rollt er erst durch (max. 9 m/s), steht also nie mitten im Kreuzungsfeld. Hinweis: Am Bordstein stehen geparkte Autos, deshalb nur ca. 0,5 m Versatz nach rechts, Hauptsache ist das Anhalten.
5. **Allokationen entfernt:**
   - `VehicleManager.carVsCar`: Wiederverwendetes `_best`-Objekt, `[1,-1]`-Arrays durch Zählschleifen ersetzt; `registerImpact` ohne `[[a,b],[b,a]]`; `explode` ohne `slice()`; `emitSkid` ohne Array; `updateNight` ohne for-of.
   - `Vehicle.collideWorld`: kein `[1,-1]`, eigener allokationsfreier Kreis-gegen-Box-Test (`resolveCircle`) statt `resolveCircleVsBoxes` (das pro Treffer ein Objekt und ein Array plus `sort` erzeugt; `core/physics.js` gehört nicht mir).
   - `traffic.driveNPC`: wiederverwendetes Control-Objekt statt `setControls({...})` pro Auto und Frame.
   - `Police`: alle for-of und `|| []` in den Pro-Frame-Pfaden durch Indexschleifen, `_evasion`/`_updateCar`/`_updateLeaving` ohne Optionsobjekte pro Frame, `heatLeaveTarget` ohne neues Objekt, Tracer-Suche ohne Closure, `path.map().find()` durch Schleife ersetzt, `roadPath` (BFS) läuft nur noch bei Wechsel der Straßenzelle von Auto oder Spieler statt alle 1,2 s pro Auto.
   - `effects.Debris.emit`: kein `set([x,y,z])`-Array mehr.

## API
- `game.vehicles.spawn('muscle'|'van'|'bus'|'bike'|..., x, z, heading, opts)` (opts: `driver`, `color`, `speed`, `health`).
- `vehicle.dentAt(wx, wz, depth)`, `vehicle.crackGlass()`, `vehicle.fallT`/`fallSide` (Motorrad liegt), `vehicle.spec.lean` (Motorrad).
- `game.vehicles.effects.explosion(x, y, z, paintHex?)`: Signatur bleibt kompatibel, der vierte Parameter (Lackfarbe) ist optional. Ohne ihn nur dunkle Metalltrümmer (so ruft T2 auf).
- `game.vehicles.sirens`: Array der Sirenenfahrzeuge (pro Frame neu).
- `game.vehicles.registerImpact(a, b, impact, pax?, paz?, pbx?, pbz?)`: neue optionale Kontaktpunkte.
- **Hubschrauber, `game.police.helicopter`** (`null`, wenn keiner aktiv ist):
  - `hit(point, dmg)`: `point = {x,y,z}` in Kapsel (Rumpf plus Heckausleger, ca. 2,6 m Toleranz) -> Schaden, `true` bei Treffer. Das ist der von T2 verlangte Aufruf `game.police.helicopter?.hit?.(point, dmg)`.
  - `rayHit(origin, dir, maxDist)`: Distanz zur Kugel (r = 3 m um die Kabine) oder `Infinity`, ohne Schaden. `dir` normiert.
  - `hitRay(origin, dir, maxDist, dmg)`: Ray-Test plus Schaden, gibt Distanz oder `Infinity` zurück. Für Hitscan-Waffen besser als `hit`.
  - `blast(x, y, z, radius, dmg)`: Explosionsschaden mit Abfall (für Granaten).
  - `position`, `hp`, `state` (`attack|leave|crash|wreck`), `dead`.
- Events: `helicopter:destroyed` ({position}); bestehende wie `vehicle:crash`/`vehicle:destroyed` unverändert.

## Geänderte Dateien
`src/vehicles/{Vehicle,VehicleManager,models,traffic,effects}.js`, neu `src/vehicles/{damage,Helicopter}.js`, `src/police/Police.js`, `src/core/modelList.js` (nur Einträge `car_muscle`, `car_van`, `car_bus`, `vehicle_bike`, `vehicle_heli`), `tools/blender/{car_muscle,car_van,car_bus,vehicle_bike,vehicle_heli}.py`, `public/models/{car_muscle,car_van,car_bus,vehicle_bike,vehicle_heli}.glb`. Keine Fremd-Assets (alles selbst modelliert), deshalb kein Eintrag in `CREDITS.md`.

Neu bauen: `tools/heavy.sh blender -b --factory-startup --python tools/blender/car_muscle.py` (analog die anderen vier Skripte).

## Tests und Ausgabe
- `npm run build`: fehlerfrei (nur die übliche Chunk-Größen-Warnung).
- `tools/heavy.sh npm run smoke`: **SMOKE OK**, drawCalls 175 an der Smoke-Messposition (vorher ca. 190, der Wert schwankt mit dem Verkehr; durch Bus/Van/Muscle kommen keine Draw Calls pro Auto dazu, Motorräder +1 für den Fahrer, Helikopter nur bei 5 Sternen ca. +10).
- `tools/heavy.sh node tests/qa-tour.mjs`: **QA OK**.
- Eigene Tests (alle ohne Konsolenfehler), Vite mit `hmr: false, watch: null`:
  - `work/fahrzeuge/t1.mjs`: Galerie der neuen Typen, Dellen und Scheiben, Explosion, verkohltes Wrack.
  - `work/fahrzeuge/t2.mjs`: Sirenen-Test (NPC-Tempo 13,1 -> 0,0 während das Polizeiauto auf 7 m heranfährt, nach dem Vorbeifahren wieder 2,1 -> 7,3), Motorrad (Roll -0,50 bei Linkskurve, Fahrer sichtbar), Hubschrauber.
  - `work/fahrzeuge/t3.mjs`: Hubschrauber-Nahaufnahmen, `hit` (miss `false`, Treffer `true`, HP 140 -> 110 -> 80 -> 50), `hitRay` (Distanz 22), Absturz, Explosion, Wrack (`state` = `wreck`).

## Screenshots (`work/fahrzeuge/shots/`)
- `t1_new_types.png`: Motorrad, Muscle-Car, Van (orange) und Bus auf der Straße.
- `t1_damage_dents_glass.png`: eingedellte Front, gesplitterte Scheiben und Rauch (blau) neben einem unbeschädigten Auto.
- `t1_blast_debris.png`, `t1_wreck_charred.png`, `t1_wreck_vs_dented.png`: Explosion mit Trümmern, ausgebranntes Wrack, Wrack neben Delle.
- `t2_bike_parked.png`, `t2_bike_lean.png`: Motorrad mit Fahrer in Schräglage.
- `t3_heli_search.png`, `t3_heli_damaged_smoke.png`, `t3_heli_falling.png`, `t3_heli_explosion.png`, `t3_heli_wreck.png`: Hubschrauber, Rauch nach Treffern, Absturz und Wrack. Der Lichtkegel ist am Tag nur schwach zu sehen (nachts stärker).
- `blender/`: Blender-Renderings aller fünf Modelle (vorne, hinten, Seite).

## Offen und Hinweise
- Motorradfahrer ist eine Blockfigur, die T1-Figur (Sitzpose) ist nicht eingebunden.
- Kein Motor- und Rotor-Sound: `src/audio` gehört mir nicht, `AudioSystem` kennt für Bus/Van/Muscle/Bike nur den Standardwert, der Hubschrauber hat keinen Rotorsound. Vorschlag: Rotor-Loop in `sfx.js`, abhängig vom Abstand zu `game.police.helicopter?.position`.
- T2 muss den Hubschrauber noch in den Waffen-Raycast einbinden (`hitRay` oder `hit`) und für Granaten `blast` aufrufen. Ohne diese Aufrufe lässt er sich nicht abschießen. Zum Testen reichen die Aufrufe aus `t3.mjs`.
- Hubschrauber kollidiert nicht mit Gebäuden (er bleibt über den Dächern, aber der Absturz kann durch ein Gebäude fallen) und taucht nicht auf der Minimap auf.
- Beschädigung durch Schüsse zeigt nur Scheiben/Rauch/Feuer, keine Einschussdellen (der Schadenspfad `damage(v, amount)` kennt keinen Treffpunkt).
- `core/physics.js` (`resolveCircleVsBoxes`, `rayBox`) allokiert weiter pro Aufruf, wird aber nur noch von Code außerhalb von `src/vehicles` genutzt. Das gehört nicht zu T4.
