# Übergabe T2 spieler (UNVOLLSTÄNDIG GEPRÜFT)

## Status (Runde 2)
Alle Punkte 1-7 umgesetzt und geprüft. `npm run build` ok, `tools/heavy.sh node .../test-spieler.mjs` gibt `SPIELER OK` (11 PASS, keine Konsolenfehler), `npm run smoke` gibt `SMOKE OK`, `node tests/qa-tour.mjs` gibt `QA OK` (201 Draw Calls).

Behoben in Runde 2 (pro Mangel eine Zeile):
- A1 Autokollision: echter Codefehler. Zwei Kreise pro Auto ließen die Fahrzeugmitte frei (Kreisabstand 3,25 m bei 2,05 m Durchmesser), der Spieler lief hindurch. Jetzt Kapsel entlang der Fahrzeuglänge (`collideVehicles` in `Player.js`). Test: Abstand zum Rumpf 0,40 m nach 2 s Sprint gegen das Auto.
- A1 Testskript: `window.__car` fehlte (frühere Korrektur war nie angewendet worden), Abstand wird jetzt gegen die Kapsel gemessen, Vite läuft ohne HMR/Watch, damit Dateiänderungen anderer Teams den Test nicht neu laden.
- A6 Schritte: `steps=undefined` kam vom Seiten-Reload durch HMR (andere Teams änderten Dateien). Mit `hmr:false, watch:null` zählt der Test 6 Schritte in 3 s.

## Geändert (nur src/player/)
- `Player.js`: Fahrzeugkollision zu Fuß (`collideVehicles`, Kapsel pro Auto, auch geparkte). Zielmodus (RMB, nur mit Schusswaffe): `aimK`, 55 % Tempo, kein Sprint, Blick in Kamerarichtung. `getAimInfo()`. Mausrad wechselt die Waffe, KeyR lädt zu Fuß nach. Schritte (`audio.play('footstep',{x,z})`, alle 2,3 m, passend zum Laufzyklus). Kamerawackeln bei Crash (`vehicle:crash`, Impact > 4) und bei `player:damaged`.
- `CameraRig.js`: Parameter `aim` (Distanz 4,6 → 2,2, FOV 65 → 46, mehr Schulterversatz, geringere Mausempfindlichkeit). `shake()`, `kick()` (Rückstoß mit teilweiser Erholung). `aimOrigin`/`aimDir` = Kamerastrahl durch die Bildschirmmitte, vor dem Wackeln gespeichert.
- `Weapons.js`: Magazin (Pistole 12 / SMG 30, Reserve = `ammo`), `startReload()`, `reloadProgress`, automatisches Nachladen bei leerem Magazin, `empty`-Klick (`play('empty')`) bei leerer Waffe, `play('reload')`. Schuss: Kamerastrahl bestimmt den Zielpunkt, danach Kugelstrahl von der Brust dorthin. `castRay` prüft Wände (höhenabhängig), Passanten, Autos und Boden. Spread mit Bloom beim Dauerfeuer. Rückstoß und Wackeln pro Schuss.
- `Character.js`: Nachlade-Animation (Parameter `reload` 0..1).

## API (für ARCHITECTURE.md)
- `player.getAimInfo() -> { aiming, weaponId, spread }` (spread in Radiant, wächst beim Dauerfeuer, kleiner beim Zielen).
- `player.weapon = { id, name, ammo (Reserve), clip, clipSize, reloading }`. Fäuste: `clip`/`clipSize` = Infinity.
- `player.cam.shake(0..1)`, `player.cam.kick(pitch)`, `player.cam.aimOrigin`/`aimDir`, `player.weapons.startReload()`, `player.weapons.castRay(origin, dir, maxDist)` (liefert ein wiederverwendetes Objekt `{dist, kind, target, point}`; nicht aufbewahren).
- Aufgerufene Sounds: `footstep`, `reload`, `empty` (alle über `game.audio?.play?.`).

## Testergebnisse
Alle Prüfungen PASS: Autokollision (Abstand 0,40 m), Magazin 12/36, Zielmodus (FOV 46, Distanz 2,2), steiler Strahl trifft Passanten, flacher fliegt darüber, SMG verbraucht Magazin und Spread wächst (0,013 -> 0,033), R-Nachladen (Reserve 120 -> 93), Auto-Reload bei letzter Patrone, Mausrad wechselt Waffe, 6 Schritte in 3 s.

## Screenshots (in diesem Ordner)
- `spieler-autokollision.png`: Spieler läuft gegen einen Pickup und steht davor, nicht darin; Fadenkreuz und Anzeige `PISTOL 12 / 36` sichtbar.
- `spieler-zielmodus.png`: Zielmodus, Kamera nah über der Schulter, kleines FOV.
- `spieler-schiessen.png`: SMG im Zielmodus.
- `spieler-nachladen.png`: Nachlade-Pose.

## Offen
- Kein Fall getestet: fahrendes Auto drückt den Spieler in eine Wand (Wand wird nach den Autos erneut aufgelöst).
- T5 muss die Sounds `footstep`, `reload`, `empty` liefern; ohne sie bleibt es stumm (Aufrufe sind defensiv).
