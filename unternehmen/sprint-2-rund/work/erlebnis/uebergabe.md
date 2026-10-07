# Übergabe T4 erlebnis (alle Prüfungen bestanden)

## Gebaut
1. Fadenkreuz (`HUD.js`, `hudStyles.js`): nur zu Fuß mit Schusswaffe. Nutzt `player.getAimInfo?.()` (aiming, spread), Fallback RMB und feste Streuung je Waffe. Im Zielmodus kleiner und cyan. Treffermarker (X, bei Kill rot) bei `ped:damaged` mit `source==='player'`.
2. Waffenanzeige: `clip / ammo` und "RELOADING", Fallback auf die alte Anzeige.
3. Missionsziel nur noch im Titelbalken oben. Der Stage-Toast in `Missions.enterStage` ist entfernt, `HUD.message` blockt zusätzlich Toasts, die dem aktuellen Ziel entsprechen. Max. 3 Toasts links.
4. `src/pickups/Pickups.js` (`game.pickups`): 15 Pickups (5 Gesundheit, 5 Rüstung, 5 Munition), feste Positionen auf Gehwegen (drei in den Blöcken nahe dem Start), rotierend, schwebend, leuchtend, Respawn nach 60 s, Sound `pickup`, Minimap-Rauten. 5 Draw Calls (InstancedMesh). Gesundheit/Rüstung werden nicht aufgenommen, wenn schon voll.
5. `src/save/Save.js` (`game.save`): localStorage `gta7.save` (v1): Geld, abgeschlossene Missionen, Munition (und clip, falls vorhanden), Uhrzeit, Position. Autosave alle 30 s und bei `mission:completed`. Laden im ersten Frame. Jedes Feld wird einzeln validiert, kaputte oder alte Stände werden ignoriert. `newGame()` löscht Stand und lädt neu.
6. Pausemenü: Regler Master/Music/SFX (`audio.setVolume`, in `gta7.volumes` gemerkt), "New Game" (zweiter Klick bestätigt), Steuerung mit RMB, R, Mausrad.
7. Missionen in `missionDefs.js`: `chase` (Run Down: sports-Wagen mit `ai.factor` 1.8 flieht, Sieg bei Zerstörung oder wenn er neben dem Spieler 2 s steht, Niederlage bei Zeitlimit 150 s oder wenn er entfernt wird) und `delivery` (Special Delivery: Paket holen, Etappe 1 zu Fuß, Etappe 2 per Auto, Zeitlimit mit Zeitbonus je Etappe).
- `src/main.js`: `pickups` und `save` vor `hud` registriert.

## API (für ARCHITECTURE.md)
- `game.pickups.items[] {type:'health'|'armor'|'ammo', x, z, color, active}`, `getBlips()`.
- `game.save`: `save()`, `load()`, `newGame()`, `hasSave`. Key `gta7.save`.
- HUD liest optional: `player.getAimInfo()`, `weapon.clip/clipSize/reloading`.

## Tests (alle über tools/heavy.sh)
- `npm run build`: OK.
- `npm run smoke`: SMOKE OK (104 Draw Calls im Smoke-Lauf).
- `node tests/qa-tour.mjs`: QA OK (67 Draw Calls am Ende der Tour).
- `node unternehmen/sprint-2-rund/work/erlebnis/test.mjs`: ERLEBNIS OK, alle Checks PASS: 15 Pickups, alle 15 erreichbar und einsammelbar (Gesundheit heilt, danach inaktiv), Fadenkreuz an/aus (Fäuste), Zielmodus, Treffermarker, Waffenanzeige `clip / ammo` + RELOADING (mit simulierter Waffe, weil Weapons `reloading` pro Frame selbst setzt), Missionsziel nicht doppelt als Toast, Lieferung komplett (Etappe 1 zu Fuß, Etappe 2 Auto, Geld), chase-Mission (Sieg durch Zerstörung), Save-Inhalt, kaputter Stand ohne Crash, Laden stellt Geld/Missionen/Munition/Position wieder her, Lautstärkeregler.
- Fixes: Pickup-Positionen (vorher teils im Gebäude) jetzt auf Gehweg-Kanten; Testskript-Fehler (Teleport im Auto, Pointer-Lock im Headless-Test) behoben.

## Screenshots (A7)
- `screenshot-pickups-crosshair.png`: grünes Gesundheits-Pickup mit Lichtsäule vor dem Spieler, Fadenkreuz in der Mitte, Waffenanzeige "PISTOL 12 / 36".
- `screenshot-mission-bar.png`: Mission "Special Delivery": Ziel "Pick up the package", Etappe und Timer im Balken oben; links nur der Intro-Toast, das Ziel steht nicht doppelt. Fadenkreuz und "PISTOL 12 / 156" sichtbar, Minimap mit Missionsblip.
- `screenshot-pause.png`: Pausemenü mit Reglern Master/Music/SFX und "New Game".

## Offen
- Nach dem Laden ist der Verkehr einige Sekunden dünn (Fahrzeuge wurden um den Startpunkt gespawnt, werden nachgefüllt).
- Chase: Flucht nur über `ai.factor` (ignoriert Ampeln), Stopp-Erkennung nicht im Spiel beobachtet, nur der Zerstörungs-Sieg getestet.
- Fadenkreuz-Zielmodus und `getAimInfo` wurden nur mit Fallback (RMB) geprüft.

## Runde 2
- Mangel: Fluchtauto der `chase`-Mission wurde vom VehicleManager despawnt, Mission scheiterte mit "The thief got away".
- Behebung (nur `src/missions/missionDefs.js`, `Missions.js`): `spawnThief` setzt `owned = true`; jeden Frame wird `v.ai.idle = 0` gesetzt (kein Leerlauf-Despawn). Aufgabe weicht in einem Punkt vom Chef-Vorschlag ab: der VehicleManager prüft `owned` im NPC-Zweig gar nicht (`manage()`, nur im `driver === null`-Zweig). `owned` allein schützt also nicht. Deshalb setzt die Mission den Wagen mit letzter Position, Kurs, Tempo und Gesundheit wieder ein, falls er aus `vehicles.list` verschwindet. Wunsch an vehicles in `company/requests/erlebnis.md`: `owned` auch im NPC-Zweig beachten.
- Aufgeben nur noch, wenn der Spieler > 300 m entfernt ist, länger als 5 s (`The thief got away`). Am Missionsende (Erfolg und Fehlschlag) wird `owned` über den neuen Stage-Hook `leave` (aufgerufen in `Missions.finish`) zurückgesetzt.
- Beleg: `tools/heavy.sh node unternehmen/sprint-2-rund/work/erlebnis/chase.mjs` (Vite mit `hmr:false, watch:null`): CHASE OK.
  - Lauf 1: Dieb per `vehicles.remove` entfernt, Mission aktiv, Dieb wieder in der Liste: PASS.
  - Lauf 2: Spieler 215 m entfernt (natürlicher Despawn > 200 m), 4 s Spielzeit, Mission aktiv: PASS.
  - Lauf 3: `ai.idle = 45`, Mission aktiv, Dieb in der Liste: PASS.
  - Lauf 4: Dieb zerstört: `missions.completed` enthält `chase`, Anzeige "MISSION PASSED", `owned` zurückgesetzt: PASS.
- Nicht belegt: die Aufgabe bei > 300 m (Lauf 3b). Der Stadtrand lässt in dem Lauf keine 300 m Abstand zu (Abstand 102 m), der Check wurde übersprungen.
- `npm run build`: OK. Die Änderungen betreffen nur die Mission `chase` und `Missions.finish`; smoke und qa-tour wurden nach Runde 2 nicht erneut gestartet.
