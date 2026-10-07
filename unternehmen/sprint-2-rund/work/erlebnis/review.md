VERDIKT: OK

Geprüft am 2026-10-07, eigene Läufe über tools/heavy.sh, Testskript `review-test.mjs` (Vite-Dev-Server mit `hmr:false, watch:null`). Es wurde kein Code geändert.

## Akzeptanzkriterien
- A1: `tools/heavy.sh npm run build` läuft durch ("built in 175ms").
- A2: `tools/heavy.sh npm run smoke` gibt `SMOKE OK` aus. `tools/heavy.sh node tests/qa-tour.mjs` gibt `QA OK` aus.
- A3: T4.1 bis T4.7 sind umgesetzt (siehe unten). Offene Punkte stehen in der Übergabe.
- A4: Nur src/ui, src/missions, src/pickups, src/save und die Registrierung in src/main.js (Zeilen 8, 9, 26, 27) fallen in T4. Beim Lesen ist nichts Fremdes aufgefallen. Einen Diff gibt es nicht, da kein Git.
- A5: Zugriffe auf andere Systeme sind defensiv (`?.`).
- A6: Draw Calls: Smoke 226 (gesamte Welt, alle Teams), QA-Tour 165. Pickups brauchen 5 Draw Calls (InstancedMesh). Der Pickup-Anteil liegt weit unter 80. Keine Allokation pro Frame in `Pickups.update` (wiederverwendete Matrix, Quaternion und Vektoren).
- A7: Drei Screenshots liegen im Ordner und sind in der Übergabe beschrieben. Angesehen: Pickups und Fadenkreuz (grünes Kreuz mit Lichtsäule, Fadenkreuz, "PISTOL 12 / 36") und Missionsleiste.
- A8/A9: API steht in der Übergabe. Es wurde nichts committet (keine Git-Repo).

## Schwerpunkte
- Save/Load robust: Ich habe 9 kaputte oder alte Stände vor dem Start gesetzt (`{`, `null`, `[]`, `"x"`, `{"v":0}`, falsche Typen, NaN/1e9-Position, 1e30 Geld, `completed:null`). Ergebnis: 0 Konsolenfehler und 0 Seitenfehler. Position, Zeit und Munition bleiben gültig (Spieler bei 8.5/0/20, Pistole 36/12, SMG 120/30). Ein Teilstand `{"v":1,"pos":{"x":0,"z":0}}` lädt die Position korrekt. Ein gültiger Stand wird mit `localStorage 'gta7.save'` korrekt geschrieben.
- "New Game": Der erste Klick zeigt "Really? Click again". Der zweite Klick leert `gta7.save` und `gta7.missions.completed` und lädt neu. Danach: save=null, missions=null, Geld 0. `disabled=true` verhindert Neuschreiben vor dem Reload.
- Missionsziel nur einmal: `Missions.enterStage` erzeugt keinen Toast mehr, und `HUD.message` blockt Texte gleich dem aktuellen Ziel. Im Screenshot steht links nur der Intro-Toast, oben das Ziel mit Timer.
- Fadenkreuz: `HUD.updateCrosshair` ruft `p.getAimInfo?.()` auf (HUD.js:330) und nutzt `aiming` und `spread`. Fallback ist die rechte Maustaste. Die echte `Player.getAimInfo` existiert (Player.js:66). Das Fadenkreuz ist nur zu Fuß mit Schusswaffe aktiv (nicht bei Fäusten und nicht im Auto). Treffermarker an `ped:damaged` mit `source==='player'` ist vorhanden.
- Waffenanzeige: HUD.js:254-260 liest `wp.clip`, `wp.ammo` und `wp.reloading`. Die Felder `clip`, `reloading` und `clipSize` existieren in `Weapons.states`. Fallback bei fehlendem `clip` ist die alte Anzeige. Screenshot: "PISTOL 12 / 36".
- Neue Missionen:
  - `delivery` (Special Delivery): Der Timeout-Fehlschlag wurde geprüft (`active` danach false, nicht abgeschlossen). Der Sieg wurde von T4 im eigenen Test belegt.
  - `chase` (Run Down): Fehlschlag durch Zeitlimit wurde per Event bestätigt (`reasons: ["Out of time"]`). Sieg durch Zerstörung steht in der Übergabe, Code geprüft (`destroyed`/`health<=0` führt zu `complete`). Ohne eigene Fahrt gibt der Dieb nach 150 s auf.
- Pickups nicht in Gebäuden: Alle 15 Pickups gegen `game.world.colliders` (ohne Boundary) mit 0,5 m Puffer geprüft: `PICKUPS_IN_COLLIDERS []`. Im Screenshot steht eines auf dem Gehweg vor einem Laden.
- Draw-Call-Budget: siehe A6.
- Lautstärkeregler und Steuerungsliste (RMB, R, Mausrad) sind im HUD-Code vorhanden (`VOLUMES`, `KEYS`).

## Hinweise (keine Fehler, kein Blocker)
1. `src/missions/missionDefs.js:220`: Die Verfolgung kann auch mit "The thief got away" enden. `VehicleManager` entfernt NPC-Autos ab >200 m Abstand oder nach 30 s Stillstand (VehicleManager.js:357). Der Dieb startet bis 130 m entfernt und fährt mit Faktor 1,8. In einem meiner zwei Läufe (Spieler stand still) endete die Mission vorzeitig (Distanz 202 m), im zweiten nicht. Das ist ein Spielbarkeitsrisiko. Der Chef kann entscheiden, ob der Dieb nicht entfernt werden soll.
2. `Save.load` prüft nicht, ob die gespeicherte Position in einem Gebäude liegt. Wenn das Welt-Team das Layout ändert, kann ein alter Stand den Spieler in einem Gebäude absetzen. Die Position kommt sonst immer aus dem Spiel selbst.
3. Zielmodus und echtes `getAimInfo` wurden von T4 nur mit dem Fallback getestet. Der Code ist korrekt gegen die echte API verdrahtet (`aiming`, `spread` in Radiant, Lücke `4 + spread*240` px).
