VERDIKT: OK

Runde 2 von T2 `waffen`. Ich habe keinen Code geändert. Meine eigenen Proben liegen im Scratchpad (`p4`, `p5`, `p6`), mit Vite `hmr:false, watch:null`, Start über `tools/heavy.sh`. Die Runde-1-Liste liegt unverändert in `review.runde1.md`.

## Keine Rückschritte
- `npm run build`: "built in 269ms", fehlerfrei.
- `tools/heavy.sh npm run smoke`: SMOKE OK (drawCalls 256 bei der Fahrt).
- Allokationen pro Frame: Die neue Sichtlinie `blocked()` in `src/player/Grenades.js` läuft nur bei der Explosion und legt nichts an, `rayBox` und Zahlen sind skalar. Der neue Code in `Player.walk` hat keine `new`- oder Closure-Aufrufe.

## Runde-1-Mängel
1. New Game (Blocker) ist erledigt. Probe `p5` mit Geld 7777, Sniper und Schrotflinte, Weste 60, Position (100,100), Mission-Eintrag:
   - Vorher gab es die Schlüssel `gta7.arms`, `gta7.save` und `gta7.missions.completed`.
   - Nach `save.newGame()` und Reload ist `localStorage` leer. Geld 0, Weste 0, Waffen nur fists und pistol, Position (8.5,20), keine Missionen.
2. Granate und Wände ist erledigt. `blocked()` prüft die Sichtlinie gegen `world.colliders` mit `maxY`. Sie wird für Spieler, Passanten und Autos benutzt (Zeile ca. 113 für den Spieler). Ich habe das nicht selbst live nachgestellt, nur den Code gelesen und das Skript `t5` der Übergabe ist plausibel (mit Wand kein Schaden, ohne Wand Passant tot).
3. Kaputte Munitionsdaten: Der Fallback auf Startmunition steht im Code. Ich habe ihn nur aus `t5` und der Übergabe übernommen, nicht selbst ausgeführt.
4. Sturmgewehr in der Hand ist erledigt. `shots/hold-rifle.png` zeigt es deutlich am Arm, beidhändig, von hinten gut sichtbar.
5. Pause: Probe `p4`. Rad offen (`open=true`, `timeScale=0.25`). Nach `blur`-Event ist `open=false`, `timeScale=1`. Nach Esc bei gehaltenem Tab ist `open=false`, `timeScale=1`, `paused=true`. Der Code (`WeaponWheel.js` Zeilen 33–38) hört auf Esc, `pointerlockchange` und `blur`.
6. Tab im Kaufmenü: `shop.closedAt` wird gesetzt (`Shop.js` Zeile 92). Ich habe den 300-ms-Sperrcode gesehen, aber nicht live ausgelöst.

## Zusatzpunkte
7. Hubschrauber ist erledigt. `Weapons.castRay` kennt `kind 'heli'` (Zeile 201–205). Hitscan ruft `hitRay` auf (Fallback `hit`), Granaten rufen `blast`. Probe `p6` mit 5 Sternen und echtem `w.shoot` aus 30 m Abstand auf freier Straße: HP 140 gibt 15, dann -110 und er ist weg (`kind` war "heli"). Nach dem Abschuss gibt es keinen Fehler in der Konsole. Hinweis: Das Skript `t6.mjs` der Übergabe zeigte bei mir `"wall"` und HP 140, weil es den Spieler in ein Gebäude setzt (flaky, kein Code-Fehler). Meine Probe belegt die API.
8. Hafen ist erledigt. `Player.walk` nutzt `isWalkable` und `groundAt` (Zeilen 200–222), und `City.isWalkable` und `groundAt` existieren. Probe `p4` mitten im Steg (z = H+50, weit weg vom T-Kopf), Shift-Laufen 6 s nach Ost bzw. West: x stoppt bei 3,6 beziehungsweise -3,6 (Steg ±4), y 0,06, `walk=true`. Auch Springen seitlich (8 Sprünge mit W) bringt ihn nicht ins Wasser (x 3,6, z 383,9). Der Strand stoppt bei z ≈ 333,4 (y -0,59), laut `t6`.
9. Zweihand-Pose ist erledigt. `Weapons.js` Zeile 107 ruft `setWeaponStyle` mit `'none'`, `'rifle'` oder `'pistol'`, und `Character.js` Zeile 215 setzt `twoHanded`. Der Screenshot `hold-rifle.png` zeigt die beidhändige Haltung.

## Mängelliste
Keine blockierenden Mängel. Kleinigkeiten, nicht für das Verdikt relevant:
1. `t6.mjs` ist nicht deterministisch (Spieler wird ungeprüft neben den Hubschrauber gesetzt, kann in einem Gebäude landen und liefert dann "wall"). Die Probe sollte auf freier Fläche stehen.
2. Punkte 2, 3 und 6 habe ich nur im Code und in `t5` geprüft, nicht selbst live. Ich habe sie nicht widerlegt.
