VERDIKT: OK

Geprüft: T1 `fahrzeuge` (T1.1 bis T1.7, A1 bis A9). Alle schweren Läufe liefen über `tools/heavy.sh`. Der Code wurde nicht geändert.

## Kriterien

- T1.1 Blender-Autos: OK.
  - Beleg: `node scratchpad/glbinfo.mjs public/models/car_*.glb`. Pro Auto gibt es `wheel_FL/FR/RL/RR` an der erwarteten Position (Radius y = wheelR).
  - Materialien: `Trim, Paint, Glass, Headlight, Taillight, Rim`, also genau 6. Die Polizei hat `Trim, Paint, Glass, Headlight, Siren_Blue, Siren_Red`, ebenfalls 6.
  - Dreiecke: 2668 bis 3310 pro Auto.
  - Sicht: Renders und Screenshots (`shots/lineup-day.png`, `closeup-sedan.png`) zeigen runde Karosserien, echte Räder ohne „X“ und Radkästen.
- Reproduzierbarkeit: OK.
  - Befehl: `tools/heavy.sh blender -b --factory-startup --python tools/blender/car_sedan.py`.
  - Ausgabe: `materials [...] 6`.
  - Ergebnis: `cmp public/models/car_sedan.glb <Kopie des Originals>` meldet IDENTICAL, md5 `b7ebc331...` vorher und nachher.
  - Nur das Sedan-Skript wurde neu gebaut (Stichprobe). Taxi und Police nutzen dasselbe `car_sedan.build()`.
- T1.2 `getModel` und Fallback: OK.
  - Mit `page.route` blockierte GLBs (Skript `review-signal.mjs`) werden alle 5 Typen prozedural gebaut: 488 bis 560 Dreiecke, Vorderachse vorhanden, Sirenen bei der Polizei vorhanden.
  - Die einzigen Konsolenfehler sind meine absichtlich abgebrochenen GLB-Requests.
- T1.3 Nachtlicht: OK.
  - Nachts (`nightFactor 1`) steht genau ein SpotLight in der Szene (`headSpot`, Intensität 260, am Spielerauto, y = 0.8).
  - Es gibt keine weiteren Spot- oder PointLights außer dem gepoolten Blitzlicht (Intensität 0, y = -50). Lichtflecke für NPCs laufen über ein InstancedMesh (`poolN` = 22).
  - Sicht: `shots/night-drive-spot.png` und `lineup-night.png` zeigen Lichtkegel, rote Rücklichtflecke und Bremslicht.
- T1.4 Explosion: OK.
  - Weiche Sprites, Feuerball, Trümmer, Lichtblitz und Rauchsäule mit Kappe sind im Code (`effects.js`) und in den Screenshots zu sehen.
  - `tests/screenshots/qa-explosion.png` zeigt einen weichen Feuerball.
  - Hinweis: `explosion-1.png` zeigt wenig Feuer, weil ein Gebäudeschatten-Artefakt davor liegt (siehe Beobachtung 1).
- T1.5 Reifenspuren: OK.
  - Pool von 360 Quads in einem Draw Call. Alte Spuren verblassen in 28 s, der Ringpuffer überschreibt die ältesten.
  - `shots/skids-top.png` zeigt durchgehende Doppelspuren.
- T1.6 Ampelstopp mit dem ECHTEN `signalAt`: OK.
  - Test: `tools/heavy.sh node unternehmen/sprint-2-rund/work/fahrzeuge/review-signal.mjs`. Das ist normaler Verkehr mit unverändertem `game.world.signalAt` von T3, ohne Mock, 75 s Spielzeit.
  - Ausgabe: `REAL-SIGNAL cross events 160 violations [] max cars stopped near red 14`.
  - Also gab es 160 Überfahrten der Haltelinie, keine bei Rot (>1,5 s rot und Tempo >1). Bis zu 14 NPC-Autos standen gleichzeitig vor einer roten Ampel.
  - `signalAt` ist eine Funktion und liefert `green` für (0,0).
  - Ohne `signalAt` greift das alte Verhalten (`game.world?.signalAt` im Guard, `traffic.js:158`).
- T1.7 Treffer-Reaktion: OK per Codeprüfung. `VehicleManager.registerImpact` (Z. 157 bis 163) lässt einen NPC bei Aufprall >3.5 hupen (3 s Cooldown) und bei >8 für 5 s mit 1.75-fachem Tempo fliehen (`traffic.js:150`). Nicht per Lauf geprüft.
- A1: OK. `tools/heavy.sh npm run build` endet mit `built in 199ms`. Es gibt nur die Chunk-Größen-Warnung.
- A2: OK. `tools/heavy.sh npm run smoke` gibt `SMOKE OK` aus (56 Fahrzeuge, 102 Draw Calls). `tools/heavy.sh node tests/qa-tour.mjs` gibt `QA OK` aus.
- A3: OK. Alle Punkte T1.1 bis T1.7 sind umgesetzt. Abweichungen sind in `uebergabe.md` unter „Offen / Hinweise“ genannt.
- A4: Nicht prüfbar, weil das Projekt kein Git-Repo ist. In `uebergabe.md` ist keine Änderung außerhalb des Bereichs genannt. `modelList.js` enthielt die Namen bereits.
- A5: OK. Alle Aufrufe in andere Systeme sind defensiv (`game.world?.signalAt`, `game.audio?.play?.`, `game.peds?.list`).
- A6: OK.
  - Nachtlauf (47 Fahrzeuge): 298 Draw Calls. Smoke: 102. QA-Tour: 81. Der Wert enthält alle Teams.
  - Der Anteil von T1 ist klein: Pro Auto bleiben es 5 Draw Calls (Polizei 7), dazu 5 Effekt-Pools (Rauch, Feuer, Trümmer, Spuren, Lichtflecke).
  - Keine pro-Frame-Allokationen in den Update-Schleifen (`driveNPC`, `updateNight`, `effects.update`). Vorhandene Objekte werden wiederverwendet (`_m`, `_q`, `_s`, `_p`, `_c`).
  - Ausnahmen (gering, nur bei Ereignissen): `for (const s of [-1,1])` in `emitSkid` (`VehicleManager.js:242`) und `[1,-1]`-Schleifen in `carVsCar`.
- A7: OK. Es gibt 15 Screenshots in `shots/` und 15 Blender-Renders in `blender/`. Alle sind in `uebergabe.md` beschrieben.
- A8: OK. Die API steht in `uebergabe.md`.
- A9: Nicht prüfbar. Es wurden keine Commits gesehen.

## Mängelliste

Keine blockierenden Mängel. Kleinigkeiten (kein Grund für FEHLER):

1. `src/vehicles/VehicleManager.js:242` und `carVsCar` (Z. 275 bis 276) legen in Schleifen kleine Arrays an (`[-1, 1]`, `[1, -1]`). Das passiert nur beim Driften bzw. bei Autonähe. Optional durch konstante Arrays ersetzen.
2. `tools/blender/__pycache__/` liegt im Repo (Python-Cache). Bitte nicht einchecken.
3. Die Räder werden im Spiel je Achse zu einem Mesh verschmolzen. Das ist dokumentiert und bedeutet, dass einzelne Räder nicht separat gelenkt werden können. Im GLB bleiben die Namen `wheel_*` erhalten. Die Lenkung wirkt paarweise wie bisher, das ist ausreichend.
4. Der Taxi-Dachschild nutzt das Material `Headlight`, es ist tagsüber blass (in `uebergabe.md` genannt).

## Beobachtungen für andere Teams (nicht T1)

1. Schwarzes Band in `shots/explosion-*.png`. Es ist NICHT von T1 verursacht.
   - Befund: Es ist schon im Bild `review-shots/band-0-before.png` zu sehen, also vor der Explosion.
   - Es bleibt, wenn alle Effekt-Meshes ausgeblendet sind (`band-2-effects-hidden.png`) und bei abgeschalteten Schatten (`band-3-shadows-off.png`).
   - Es handelt sich also um Geometrie oder Material aus der Welt (vermutlich T3). Das Band erscheint an derselben Bildposition und stört die Sicht auf die Explosion.
   - Repro: `tools/heavy.sh node unternehmen/sprint-2-rund/work/fahrzeuge/review-band.mjs`.
   - Bitte an den Chef/T3 weiterreichen.

## Eigene Prüfskripte

- `unternehmen/sprint-2-rund/work/fahrzeuge/review-signal.mjs` (echtes `signalAt`, Lichter, Fallback)
- `unternehmen/sprint-2-rund/work/fahrzeuge/review-band.mjs` (Diagnose schwarzes Band)
