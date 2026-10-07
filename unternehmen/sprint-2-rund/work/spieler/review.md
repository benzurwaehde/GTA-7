VERDIKT: OK

Geprüft: T2.1 bis T2.7 und A1 bis A9 gegen BRIEF.md. Ich habe alles selbst ausgeführt (Runde 2).

## Kriterien
- A1 Build: `npm run build` läuft durch (nur Chunk-Größen-Warnung, kein Fehler).
- A2 Smoke und QA: `tools/heavy.sh npm run smoke` gibt `SMOKE OK` (drawCalls 142). `tools/heavy.sh node tests/qa-tour.mjs` gibt `QA OK` (draw 78).
- A3 Punkte: `tools/heavy.sh node unternehmen/sprint-2-rund/work/spieler/test-spieler.mjs` gibt `SPIELER OK`: 11 PASS, keine Konsolenfehler. Der Fehler aus Runde 1 (gap=4.17, steps=undefined) ist weg: `gap=0.40`, `steps=6`.
- T2.1 Autokollision: `collideVehicles` (Player.js 160-178) nutzt die gleiche Kapsel wie VehicleManager (`cr`, `coff` aus Vehicle.js 27/28). Auch geparkte Autos, nur bei y<1.2. Der Test misst 0,40 m Abstand zum Rumpf nach 2 s Sprint, also nicht im Auto.
- T2.2 Zielmodus: FOV 46, Distanz 2,2, `aiming:true`, 55 % Tempo, kein Sprint (CameraRig.js 55, Player.js 185/193).
- T2.3 Vertikales Zielen: Kamerastrahl (`aimOrigin`/`aimDir`, CameraRig.js 82-83), danach Kugelstrahl von der Brust. Die Tests zeigen: steiler Strahl trifft den Passanten bei y≈1,2, flacher fliegt darüber. `getAimInfo()` liefert `{aiming, weaponId, spread}`.
- T2.4 Magazin und Nachladen: 12/36 (Pistole), SMG-Magazin 30. R zu Fuß lädt nach (Reserve 120 → 93). Auto-Reload greift bei der letzten Patrone. Im Auto ist `KeyR` nur innerhalb von `if (!this.vehicle)` (Player.js 243-252), das Radio bleibt also frei. `empty`-Klick und `reload`-Sound sind eingebaut. Nachlade-Animation per `reload`-Parameter in Character.js.
- T2.5 Rückstoß und Wackeln: `cam.kick`/`cam.shake` pro Schuss. Wackeln bei `vehicle:crash` (Impact>4) und `player:damaged`. Das Wackeln wird erst nach dem Speichern des Zielstrahls angewendet, wirft Schüsse also nicht ab.
- T2.6 Schritte: `audio.play('footstep',{x,z})` alle 2,3 m, 6 Aufrufe in 3 s Gehen.
- T2.7 Mausrad: `weapons.cycle` über `mouse.wheel`, Test 2→0 PASS.
- Sounds (Schwerpunkt 5): `footstep`, `reload` und `empty` existieren jetzt in src/audio/sfx.js (Zeilen 96, 103, 116). AudioSystem.js:121 kennt Lebensdauern für alle drei. Die Aufrufe sind in Player.js:217 und Weapons.js:72/140.
- A4 Bereich: Änderungen liegen laut Übergabe nur in src/player/. Ohne Git konnte ich das nicht diffen.
- A5 Defensive Aufrufe: durchgängig `?.`.
- A6 Performance: In `Player.update`, `walk`, `collideVehicles`, `CameraRig.update` und `Weapons.update` gibt es keine pro-Frame-Allokationen. `refreshNear` filtert nur alle 10 m. Der Kamerastrahl und `castRay` nutzen wiederverwendete Objekte.
- A7 Screenshots: 4 Stück vorhanden (siehe Mangel 1 zur Beschreibung).
- A8/A9: API steht in der Übergabe. Kein Commit ist nicht prüfbar, kein Hinweis auf einen Verstoß.

## Schwerpunkt 1: Fahrendes Auto drückt Spieler in eine Wand
Der Agent hat diesen Fall nicht getestet. Ich habe ihn synthetisch geprüft (Skript im Scratchpad, 400 Frames, Auto 10 m/s gegen den stehenden Spieler vor einer Wand). Das Auto im Test hat keine Wandkollision.
- Ausgabe: `maxJump 0.1667` (genau eine Frame-Bewegung des Autos, kein Wegschleudern), Spieler bleibt bei x=19,6 (vor der Wand), z=1,36, `inside` = 8 Frames. Er wird also seitlich aus der Kapsel geschoben.
- Es gibt keinen Hänger und keinen Durchbruch durch die Wand. Während des Einklemmens liegt die Kapsel kurz (8 Frames) in der Wand. Das ist eine Folge der Reihenfolge Auto → Wand und akzeptabel.

## Schwerpunkt 2: Screenshot spieler-autokollision.png
Ich habe den Screenshot angesehen. Er zeigt den Spieler vor einem grünen Sportwagen (kein Pickup), also einem AUTO. Der Beleg passt zur Kollision mit einem Auto. Die Beschreibung in der Übergabe ist falsch (siehe Mangel 1). Der Spieler steht hinter bzw. an der Karosserie, nicht darin. Die Perspektive allein beweist die Tiefe nicht ganz. Das belegt der numerische Test (gap 0,40 m).

## Mängelliste (nicht blockierend)
1. `uebergabe.md`, Abschnitt Screenshots: Der Text „Spieler läuft gegen einen Pickup" ist falsch. Das Bild zeigt einen grünen Sportwagen. Bitte korrigieren, um Verwechslung mit den T4-Pickups (Gesundheit usw.) zu vermeiden.
2. `uebergabe.md`, Status: Überschrift „UNVOLLSTÄNDIG GEPRÜFT" und „Offen: Kein Fall getestet…" sind veraltet bzw. stimmen nicht mit dem Ergebnis überein. Der Fall „Auto drückt in Wand" ist weiterhin kein Teil von test-spieler.mjs.
3. `Weapons.js` 189, 196, 204 und 154/155: pro Schuss bzw. Schlag Allokationen (`HIT.point.clone()`, `new THREE.Vector3()` für das Mündungsfeuer, `origin.clone()` im Event, `.clone()` plus `new Vector3` in `punch`). Das sind keine pro-Frame-Allokationen, aber bei der SMG bis zu etwa 12 pro Sekunde. Zu ersetzen durch wiederverwendete Objekte, wenn Zeit bleibt.
4. `Weapons.js` 100: Autotreffer im `castRay` verwendet einen Kreis mit `v.radius` (z. B. 1,71 m), nicht die Kapsel. Schüsse knapp neben dem Auto können es treffen. Kosmetisch.
