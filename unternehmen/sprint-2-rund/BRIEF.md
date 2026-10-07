# BRIEF – Sprint 2 „Runder machen“

Projekt: `~/Developer/GTA-7` (Three.js + Vite, Browser-Open-World-Spiel „GTA 7: Vice Bay“). Branch `sprint-2-rund`.
Pflichtlektüre vor dem Start: `company/ARCHITECTURE.md` (API-Vertrag) und der Bericht deines Bereichs in `company/reports/`.

## Ziel
Das Spiel soll sich runder anfühlen: schönere Modelle (mit Blender), glaubwürdigere Stadt bei Tag und Nacht, besseres Kampf- und Laufgefühl, klarere UI und eine Stadt, die lebendiger wirkt. Es geht um Feinschliff, nicht um neue Großsysteme.

## Gefundene Mängel (QA durch den Chef)
1. Der Spieler läuft durch Autos hindurch und steht dann im Fahrzeug.
2. Nachts haben Autos keine Scheinwerfer oder Rücklichter. Straßen und Autos sind fast schwarz.
3. Die Explosion besteht aus großen, flachen, harten Polygonen.
4. Autos sind sehr klotzig, die Räder zeigen ein „X“. Passanten sind Quader.
5. Es gibt kein Fadenkreuz, kein vertikales Zielen, keinen Zielmodus und kein Nachladen.
6. Das Missionsziel steht doppelt im Bild (Panel links und Titel oben).
7. Es gibt keine Ampeln und keine Läden im Erdgeschoss. Die Stadt wirkt leer.
8. Es gibt keine Pickups (Gesundheit, Rüstung, Munition) und keinen Spielstand.

## Neue Kern-Schnittstellen (vom Chef bereits eingebaut)
- `game.input.mouse.right`, `.rightPressed` (rechte Maustaste) und `.wheel` (Mausrad, ±Schritte pro Frame).
- `src/core/assets.js`: `getModel(name)` gibt einen Klon des vorab geladenen GLB `public/models/<name>.glb` zurück, oder `null`, wenn die Datei fehlt. `hasModel(name)` gibt es ebenfalls. Neue Modellnamen trägst du in `src/core/modelList.js` ein. Das ist die einzige Datei in `src/core/`, die Teams ändern dürfen.
- Blender 5.2 ist installiert (`blender` im PATH) und läuft headless: `blender -b --factory-startup --python <script.py>`. Blender-Quellskripte liegen in `tools/blender/<name>.py`, Exporte in `public/models/<name>.glb`. Jedes GLB muss reproduzierbar aus seinem Skript entstehen.
- `tests/qa-tour.mjs` macht Screenshots typischer Szenen (`node tests/qa-tour.mjs`, Ausgabe nach `tests/screenshots/qa-*.png`). Nutze das Skript und schau dir die Bilder an.

## Neuer Vertrag: Ampeln (World liefert, Vehicles und Peds nutzen)
`game.world.signalAt(x, z, axis) -> 'green' | 'yellow' | 'red' | null`
- `axis`: `'ns'` = Verkehr entlang der Z-Achse, `'ew'` = entlang der X-Achse.
- Bezieht sich auf die Kreuzung, die (x, z) am nächsten liegt. `null` bedeutet: keine Ampel in der Nähe (> 25 m).
- Pro Kreuzung gilt: Ist eine Achse grün oder gelb, ist die andere rot. Ein Zyklus dauert ca. 8 s grün, 2 s gelb und 1 s allrot. Kreuzungen dürfen phasenversetzt sein.
- Aufrufer müssen damit rechnen, dass die Funktion fehlt (`game.world?.signalAt?.(...)`).

## Teilaufgaben (parallel, strikt getrennte Ordner)

### T1 `fahrzeuge` – Agent `agent-code`, Ordner `src/vehicles/`, `tools/blender/car_*.py`, `public/models/car_*.glb`
1. Modelliere in Blender per Python-Skript fünf Low-Poly-Autos (sedan, sports, truck, taxi, police) mit runden Formen statt Quadern: abgeschrägte Hauben und Scheiben, Radkästen, Stoßstangen, Spiegel, echte Räder (Zylinder mit Felge, kein „X“). Exportiere sie als GLB.
   - Die Räder sind eigene Objekte mit den Namen `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, damit der Code sie drehen und lenken kann.
   - Lack-Material heißt `Paint` (wird pro Auto umgefärbt), Lichter heißen `Headlight`, `Taillight` und `Siren_Red`/`Siren_Blue`.
   - Maßstab: Meter, Vorne = +Z, Boden y=0. Die Größe entspricht der bisherigen Kollision.
   - Höchstens 6 Materialien pro Auto.
2. `models.js` lädt die Autos über `getModel()`. Fehlt ein GLB, bleibt das prozedurale Modell als Fallback. Farbvariation, Radrotation und Lenkeinschlag funktionieren wie bisher.
3. Nachts (`game.world.isNight` oder `nightFactor`) leuchten Scheinwerfer und Rücklichter, beim Bremsen heller. Das Spielerauto hat einen echten Lichtkegel (SpotLight) nach vorne. Für alle anderen Autos reichen emissive Materialien und ein günstiger additiver Lichtfleck auf der Straße. Keine SpotLights für NPC-Autos.
4. Die Explosion sieht gut aus: weiche, runde Partikel (Sprite oder Canvas-Gradient, kein harter Flat-Shaded-Polygon-Look), ein kurzer Lichtblitz (PointLight), Trümmer und ein Rauchpilz.
5. Reifenspuren beim Driften oder Handbremsen. Begrenzter Pool, alte Spuren verblassen.
6. NPC-Verkehr hält bei Rot/Gelb an der Haltelinie über `signalAt`. Autos, die schon in der Kreuzung stehen, fahren weiter. Fehlt `signalAt`, gilt das bisherige Verhalten.
7. Ein angefahrenes NPC-Auto reagiert: Es hupt und fährt bei starkem Treffer kurz schneller davon.

### T2 `spieler` – Agent `agent-code`, Ordner `src/player/`
1. Der Spieler kollidiert zu Fuß mit Fahrzeugen (Kreis gegen `game.vehicles.list`, auch geparkte). Er kann nicht mehr in Autos hineinlaufen.
2. Rechte Maustaste = Zielmodus: Die Kamera rückt näher über die Schulter, das FOV wird kleiner, der Spieler dreht sich in Blickrichtung und läuft langsamer.
3. Vertikales Zielen: Der Schuss geht entlang des Kamerastrahls, nicht flach. Er trifft, was unter dem Fadenkreuz in der Bildschirmmitte liegt. Dafür gibt es die Methode `game.player.getAimInfo() -> { aiming: bool, weaponId, spread }` für das HUD-Fadenkreuz.
4. Nachladen: Jede Waffe hat ein Magazin (Pistole 12, SMG 30) und Reservemunition. Nachgeladen wird mit der Taste `KeyR` zu Fuß (im Auto bleibt R das Radio) oder automatisch bei leerem Magazin. Es gibt eine kurze Nachlade-Animation. `player.weapon` hat zusätzlich `{ clip, clipSize, reloading }`, und `ammo` bleibt die Reserve.
5. Leichter Rückstoß und Kamerawackeln beim Schießen. Bei harten Autounfällen ebenfalls ein kurzes Wackeln.
6. Schritte: Rufe `game.audio?.play?.('footstep', {x, z})` passend zur Schrittfrequenz auf (gehen und rennen).
7. Mausrad wechselt die Waffe.

### T3 `welt` – Agent `agent-code`, Ordner `src/world/`, optional `tools/blender/prop_*.py`, `public/models/prop_*.glb`
1. Ampeln an jeder Kreuzung (Mast mit Ausleger, Leuchten pro Richtung). Sie implementieren den Vertrag `signalAt` oben. Die Leuchten wechseln sichtbar (emissive).
2. Läden im Erdgeschoss für Gebäude im Zentrum und im Mid-Rise-Ring: Schaufenster, Tür, Markise und Ladenschild mit prozeduralen Namen (CanvasTexture). Nachts leuchten sie.
3. Neon- und Werbeschilder downtown, die nachts deutlich leuchten.
4. Nacht-Look: Straßen und Fahrzeuge sind nachts noch erkennbar. Hebe das Umgebungs- und Mondlicht an, mach die Lichtpools der Laternen sichtbarer und hebe die Exposure nachts leicht an. Ziel: Es ist dunkle Nacht, aber kein schwarzes Bild.
5. Straßenmöbel (Bänke, Hydranten, Mülltonnen, Briefkästen), instanziert. Optional mit Blender modelliert.
6. Budget: Insgesamt höchstens 60 zusätzliche Draw Calls. InstancedMesh oder gemergte Geometrie.

### T4 `erlebnis` – Agent `agent-code`, Ordner `src/ui/`, `src/missions/`, neu `src/pickups/`, neu `src/save/`, und `src/main.js` (nur um neue Systeme zu registrieren)
1. Fadenkreuz in der Bildschirmmitte, nur zu Fuß mit Schusswaffe. Im Zielmodus wird es kleiner oder deutlicher, nutzt `player.getAimInfo?.()` (Fallback: rechte Maustaste). Treffermarker (kurzes X) bei `ped:damaged` durch den Spieler.
2. Waffenanzeige zeigt `clip / ammo` und „RELOADING“, falls vorhanden. Fallback auf die bisherige Anzeige.
3. Das Missionsziel steht nur noch einmal im Bild. Der Titelbalken oben zeigt das aktuelle Ziel und den Timer. Das linke Panel zeigt nur kurze Nachrichten-Toasts, die verschwinden.
4. Pickups (`src/pickups/Pickups.js`, System `game.pickups`): Gesundheit (grünes Kreuz), Rüstung (blaue Weste), Munition (gelbe Box), rotierend und leuchtend, ca. 15 Stück fest in der Stadt verteilt, nach 60 s respawnt. Sie nutzen `player.heal`, `addArmor` und `addAmmo`. Sound `pickup`, Blips auf der Minimap.
5. Speichern/Laden (`src/save/Save.js`, System `game.save`): Geld, abgeschlossene Missionen, Waffenmunition, Uhrzeit, Spielerposition. Speichert automatisch alle 30 s und nach jeder Mission in localStorage. Beim Start wird geladen. Pausemenü: „Neues Spiel“ (löscht den Stand). Ein kaputter oder alter Stand darf nichts crashen.
6. Pausemenü: Lautstärkeregler (Master/Musik/SFX) über `game.audio.setVolume`. „Steuerung“ zeigt die neuen Tasten (RMB zielen, R nachladen, Mausrad Waffe).
7. Zwei neue Missionen im bestehenden Datenformat:
   - eine Verfolgung: einen fliehenden NPC-Wagen zerstören oder stoppen,
   - eine Lieferung mit Zeitlimit zu Fuß und per Auto, mit zwei Etappen.

### T5 `strasse` – Agent `agent-code`, Ordner `src/npc/`, `src/police/`, `src/audio/`
1. Passanten-Modell runder und vielfältiger: getrennte schwingende Arme, Kopf mit Haaren oder Mütze, verschiedene Körpertypen (schlank, kräftig, Rock oder Hose) und Farbpaletten. Geteilte Geometrie, Budget wie bisher.
2. Passanten queren an Zebrastreifen nur, wenn `signalAt` für die querende Fahrtrichtung rot ist. Fehlt `signalAt`, warten sie, bis kein Auto in 15 m ist.
3. Einige Passanten (ca. 15 %) schlagen zurück, wenn der Spieler sie schlägt, statt zu fliehen.
4. Polizeiautos fahren auf der rechten Spur, wenn das Ziel weit weg ist (> 60 m), und weichen Verkehr aus. Ab 4 Sternen gibt es Straßensperren (2 quergestellte Polizeiautos vor dem Spieler).
5. Audio: `footstep` als One-Shot (kurz und leise, mit Variation), Hupe klingt, solange H gehalten wird (`game.audio.hornStart/hornStop` oder ähnlich, Player ruft weiterhin `play('horn')`, also abwärtskompatibel). Leises Motorbrummen für Verkehr in der Nähe, gepoolt, höchstens 4 Stimmen.
6. Neuer Sound `reload` (mechanisches Klicken), `empty` (Klick bei leerem Magazin).

## Akzeptanzkriterien (für alle Teilaufgaben)
A1. `npm run build` läuft ohne Fehler.
A2. `npm run smoke` gibt `SMOKE OK` aus (keine Konsolenfehler). `node tests/qa-tour.mjs` gibt `QA OK` aus.
A3. Jeder nummerierte Punkt deiner Teilaufgabe ist umgesetzt oder in `uebergabe.md` begründet als offen markiert.
A4. Nur Dateien im eigenen Bereich geändert (siehe oben). Querschnitts-Wünsche kommen nach `company/requests/<bereich>.md`.
A5. Aufrufe in andere Systeme sind defensiv (`?.`). Dein Teil funktioniert auch, wenn die anderen Teams ihre Punkte noch nicht geliefert haben.
A6. Performance: Höchstens +80 Draw Calls über alles (Ausgangswert ca. 230 laut QA-Tour). Keine pro-Frame-Allokationen in heißen Schleifen.
A7. Belege: Mindestens 2 eigene Screenshots deiner Änderungen im Arbeitsordner (Playwright, siehe `tests/qa-tour.mjs`), in `uebergabe.md` verlinkt und beschrieben.
A8. `company/ARCHITECTURE.md` wird nicht direkt geändert. Neue oder geänderte APIs stehen in `uebergabe.md` unter „API“, der Chef übernimmt sie.
A9. Kein Commit, kein Push. Das macht der Chef.

## Randbedingungen
- Keine fremden Assets aus dem Netz. Alles ist prozedural oder selbst in Blender per Skript erzeugt.
- Fünf Teams arbeiten gleichzeitig im selben Checkout. Fass keine fremden Dateien an. Die Maschine ist während der Tests ausgelastet, rechne bei Smoke-Tests mit Wartezeit.
- Sprache der Übergaben: Deutsch. Code-Kommentare: Englisch wie im Bestand.
