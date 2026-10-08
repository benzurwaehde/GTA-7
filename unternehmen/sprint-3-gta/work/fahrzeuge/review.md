VERDIKT: OK

Eigene Tests (Skripte im Scratchpad, Vite hmr:false/watch:null, schwere Läufe über tools/heavy.sh). Keine Konsolen- oder Seitenfehler in allen Läufen.

## Kriterien
- A1: `npm run build` fehlerfrei (nur Chunk-Größen-Warnung).
- A2 (Teil): `tools/heavy.sh npm run smoke` gibt SMOKE OK, drawCalls 100 (Messposition, Vorwert ca. 190, stabil). QA-Tour nicht erneut gelaufen (T1-T3 ändern parallel).
- A3/T4.1 Motorrad: Spawn, Einsteigen mit F, Fahren (Tempo bis 43 m/s, y bleibt 0, kein Durchfallen), Neigung (Roll -0,31 links, +0,50 rechts; Auto nur ca. 0,07), Aussteigen mit F (vehicle=null, Spieler sichtbar). Beim Wandaufprall mit Impact >8 wird der Fahrer abgeworfen (fallT 4 s, Schaden ca. 20), danach steht das Motorrad nicht fest.
- T4.2 Schadensbild: Scheiben brechen bei hp<60 (glassBroken=true bei hp 45), Delle über dentAt, bei 0 Explosion und verkohltes Wrack (Screenshot `t1_wreck_vs_dented.png`). Materialien sind geteilt (`paintMaterial`/`MATS.charred`); nur die Geometrie wird geklont und in `remove()` über `disposeVisual` freigegeben. Szenen-Materialanzahl 276 vor und nach 30 Dellen/Wracks/remove: kein Leak. Wracks werden entfernt (`manage`: >250 m oder verbrannt >15 s, außer Sicht und >60 m).
- T4.3 Hubschrauber: erscheint bei 5 Sternen (`helicopter` true), bei Fahndung 0 Zustand `leave`, nach 12 s entfernt, Neuspawn bei erneut 5 Sternen, nach Spielertod `none`. `hit` (Miss false, Treffer true), `rayHit` (27, kurz und Gegenrichtung Infinity), `hitRay` (Distanz, HP -10), `blast` (Abfall, außerhalb Radius kein Schaden) funktionieren. Abschuss führt zu crash, dann wreck, danach `hit` gibt false. Schießen nur mit `police.grid.lineClear`.
- T4.4 Sirenen: 3 Polizeiautos mit Sirene durch den Verkehr, NPCs yielden (1-2 gleichzeitig), nach Entfernen 4 s und 12 s später kein Stau (alle 25 NPCs aktiv, Anteil fahrend schwankt mit Ampeln: 17 Basis, 15 und 11 danach).
- T4.5 Allokationen: Code-Durchsicht (Vehicle.collideWorld/resolveCircle, carVsCar, Police-Indexschleifen) bestätigt die in der Übergabe genannten Änderungen.
- A6: Draw Calls 100 (Smoke) bzw. 123 (Testlauf), stabil.
- A7: Screenshots gesichtet (Motorrad in Schräglage, Wrack neben Delle, Hubschrauber mit Lichtkegel), aussagekräftig.
- A8: API steht in `uebergabe.md`.
- A9: Eigene Modelle, keine Fremd-Assets.
- Reproduzierbarkeit: `tools/heavy.sh blender -b --factory-startup --python tools/blender/vehicle_bike.py` erzeugt `vehicle_bike.glb` mit identischem MD5 (76d67ed7a99fb592c0353f4d67291f83) wie vorher. Hinweis: Die Datei wurde dabei mit identischem Inhalt neu geschrieben.

## Mängelliste (nicht blockierend, Hinweise)
1. `src/vehicles/Helicopter.js` `dispose()`: Das Material des Rotor-Blur-Meshs (`this.blur.material`) wird nicht freigegeben, ein kleiner Leak pro Hubschrauber (ca. alle 45 s bei 5 Sternen). Reproduktion: Hubschrauber spawnen, `dispose()` aufrufen. `renderer.info` zeigt es nicht, nur das Material bleibt unreferenziert (GC räumt es später auf).
2. Motorrad wirft den Fahrer schon bei Wandaufprall um ca. 8 m/s ab (`VehicleManager._impactFor`, Schwelle `impact > 8`, Spielerschaden bis 45). Das ist sehr streng für Spieler-Bikes. Reproduktion: Motorrad 3 m vor einer Wand besteigen und W halten. Gameplay-Tuning, kein Fehler.
3. Offen laut Übergabe (nachvollziehbar begründet): T1-Figur nicht eingebunden, kein Rotor- und Motorsound, Hubschrauber ohne Gebäudekollision beim Absturz und nicht auf der Minimap, Beschuss nur 2D-Sichtlinie.
4. QA-Tour (`tests/qa-tour.mjs`) von mir nicht erneut ausgeführt, da T1-T3 parallel Code ändern. Die Übergabe nennt QA OK.
