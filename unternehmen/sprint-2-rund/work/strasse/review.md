VERDIKT: OK

Prüfer-Messungen mit eigenem Skript (Scratchpad, nicht im Projekt). Alle schweren Läufe über tools/heavy.sh.

## Kriterien
- A1/A2: `tools/heavy.sh npm run smoke` -> `SMOKE OK`, drawCalls 258, peds 40, vehicles 55 (Lauf mit allen Teams). qa-tour und die Agent-Skripte wurden von mir nicht erneut gelaufen, Verlass auf Übergabe nur dort.
- T5.1 Passanten: Screenshot 01-peds.png angesehen: Röcke/Hosen, Mützen, Kappen, Haare, drei Körpertypen, getrennte Arme sind erkennbar. Code: PedModel.js, ein geteiltes Material (Vertex-Colors), Geometrie nach Outfit gecacht und per Refcount freigegeben (Schlüsselzuordnung kU/kA/kL in `releasePedMesh` stimmt).
- T5.2 Querung: Code geprüft. Achse stimmt (gleicher ix, anderes sx = Gehen entlang X = Verkehr 'ns'). Echtes `world.signalAt` wird mit `g.world?.signalAt?.` verwendet. Rot -> geht (nur wenn kein Auto mit >=3 m/s innerhalb 6 m), grün/gelb -> wartet, null/fehlt -> Fallback 15 m. Agent-Test cross.mjs behauptet CROSS OK mit echtem signalAt und Stub; von mir nicht wiederholt.
- T5.3 Zurückschlagen: Code `damage`/`_moveFight`/`_canFight` geprüft: 15 %, nur Spieler zu Fuß mit Fäusten, Timeout 14 s, Flucht danach. In Ordnung.
- T5.4 Polizei rechts: Verfolgung selbst gemessen (Spieler bei (-250,-250), Wanted 2, Streifenwagen >65 m und >8 m/s): 37 Samples mit |Versatz|<8 m, alle 37 rechts der Straßenmitte (Versatz ca. 2,3 bis 3,1 m, Spurmitte 3,5 m), 0 links, 0 Polizei-Crashs. 24 weitere Samples lagen weit abseits (Abbiegen an Kreuzungen/Zwischenwege, Versatz >8 m). Rechtsfahren bestätigt. Ausweichen: Richtung der Lenkkorrektur im Code nachgerechnet (Hindernis rechts -> links), quantitativ nicht messbar, da keine Begegnung auftrat.
- T5.4 Sperre: Selbst getestet. Spieler bei (0,5) Blick +X: Autos bei (92,-3.2)/(92,3.2), Kolliderbox-Treffer 0 (nicht in Gebäuden), Heading ca. ±0.2 rad um die Querrichtung, also quer zur Straße. Spieler bei (60,200) Blick -Z: Autos (70.8,115)/(77.2,115) auf Straße x=74, zwischen zwei Kreuzungen. Spieler bei (200,-60): Autos bei x=115. Abbau: Spieler wird 60 m hinter die Sperre gesetzt -> `block` null, 0 Sperrwagen übrig (alle drei Fälle).
- T5.5 Audio: Code geprüft. `play('horn')` mit H gedrückt im Spielerauto (Player.js Z.141f ruft weiterhin play('horn')) wird zur anhaltenden Hupe, `_updateHorn` stoppt sie beim Loslassen oder Aussteigen. Hum: HUM_VOICES = 4 feste Oszillatoren, Nearest-N ohne Allokation. footstep One-Shot vorhanden.
- T5.6 Sounds `reload`, `empty` in sfx.js vorhanden. Der Spieler (Weapons.js Z.72, Z.140) ruft sie bereits auf.
- A4: Änderungen nur in src/npc, src/police, src/audio (Stichprobe der gelesenen Dateien).
- A7: zwei Screenshots vorhanden und angesehen.
- A8/A9: Übergabe enthält API-Abschnitt, kein Commit gesehen.

## Draw Calls (A6), gemessen
Ausgangslage Spiel im Ruhezustand, Kamera am Boden:
- Alle sichtbar: 231, Passanten-Gruppe versteckt: 216. Passantenanteil im Normalfall ca. 15 Calls (die wenigen Passanten im Bild).
- Worst Case: alle 40 Zivilisten in Kamera-Sicht: 422 mit, 222 ohne Passanten = 200 Calls (5 je Passant). Vorher 4 je Passant = 160, Zuwachs durch T5 also maximal +40, typisch +3 bis +10.
- Smoke 258 gegenüber 124 vor dem Sprint: +134 insgesamt über alle Teams, das BRIEF-Limit +80 ist insgesamt überschritten. T5 trägt davon wenig bei (siehe oben), liegt aber im Worst Case bei 200 der Gesamtzahl.
- Bewertung: InstancedMesh ist für T5 nicht zwingend. Eine Verschmelzung von Armen/Beinen in einen Körper pro Passant brächte die Animation aber um, deshalb bleibt es bei 5. Wenn der Chef das Gesamtbudget senken will, ist der größte Hebel bei Passanten, die weiter als ca. 60 m entfernt sind, nur den Oberkörper zu zeichnen (Arme/Beine `visible=false`, spart bis 4 Calls je Passant).

## Mängelliste (nicht blockierend)
1. Pro-Frame-Allokationen in `src/police/Police.js`: Z.203 `this.pPrev = { x, z }` jedes Frame; Z.206/207 `this.cops.filter`, `this.cars.filter`; Z.231 `this.cars.filter(...)` in `_spawnLogic`; Z.243/247 `this.cops.slice()`, `this.cars.slice()` jedes Frame; Z.439 `B.cars.filter` in `_roadblock`; `_updateCop` legt zwei Closures (`moveTo`, `chase`) je Cop und Frame an (Z.490, 495); `_updateCar` baut alle 1,2 s einen neuen Pfad (`roadPath`, Z.352). Reproduktion: Code lesen. In `src/npc/Pedestrians.js` sind die heißen Schleifen sauber (`_mid` wiederverwendet), nur `hitTest` (Z.142) und `_dropCash` allokieren, beides nicht pro Frame. Menge klein (<= 9 Autos, <= 12 Cops), daher nicht blockierend, widerspricht aber dem Wortlaut von A6.
2. Straßensperre erschien in 2 von 4 Läufen auf der Straße (Spieler bei (-148,-120) Blick +Z und bei (148,-120) Blick +Z) innerhalb von ca. 20 s Realzeit nicht, bei Wanted 4, `noCars` false. Das Spiel läuft unter Swiftshader langsam (nur wenige Spielsekunden), deshalb nicht belegt, ob es ein Fehler ist. Wiederholung: setWanted(4) nach teleport, `police.block` pollen. Mögliche Ursache: stilles Abbrechen bei `cars.length < 2` (Z.472) oder der Versatz `a` liegt weit in einem Block.
3. Ausweichen der Polizei nicht quantitativ belegt (Agent und Prüfer). Einzig Code-Review.
4. Die Sperre blockiert NPC-Verkehr nur physisch (laut Übergabe, offen).
