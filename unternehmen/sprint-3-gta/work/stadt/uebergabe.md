# Übergabe T3 `stadt`

Kein Commit, kein Push. Geändert nur: `src/world/*`, `tools/blender/prop_boats.py`, `public/models/prop_boat_*.glb`, eine Zeile in `src/core/modelList.js` (3 Bootsnamen angehängt).

## Was gebaut wurde
1. **Wasser und Küste** (`water.js`, `coast.js`): Shader-Meer (ersetzt das Phong-Meer, weiterhin 1 Mesh, folgt der Kamera). Vier laufende Sinuswellen (zwei verschieben Vertices, alle vier ergeben die Normale), zwei gegenläufig scrollende Normalmaps, Fresnel-Mix Wasser/Himmel, Sonnen- und Mondglanz, Tiefenfarbe (türkis flach, blau tief), Schaumband mit auf- und ablaufender Welle an der Küste, kleine Schaumkronen. Farbe und Licht kommen aus `City._applyTime` (Tag/Nacht). Die Küste ist jetzt ein echter Strandabfall: Boden flach bis `H+27`, Wasserlinie bei `H+30.9`, unsichtbare Grenzwand bei `H+31.5` (vorher `H+50`, dadurch war das Meer vorher unerreichbar). Nasser Sand und Meeresboden sind eingefärbt.
2. **Hafen Marlin Pier** (`harbor.js`, Süden, Straßenachse x=0): Holzsteg (8 m breit, ab `z=H+8` bis `H+112`, T-Kopf bis `H+126`) mit Pfählen, Geländer, Laternen, Poller, Kiosk. Strandpromenade (Bohlen, Laternen, Bänke) bei `z=H+21..25.5`. Kai (x 36..152, z `H+26..H+46`) mit 2 Portalkränen, Frachtschiff, ca. 50 Containern (instanziert) und 8 Booten (3 Typen aus `prop_boat_*.glb`, ein Mesh, per CPU auf der echten Wellenfläche geschaukelt). Collider: Stegränder (unsichtbar, 1,9 m hoch), Kaikante, Kranbeine, Container-Stapel, Kiosk. Die Südwand hat Lücken für Stegkanal und Kai.
3. **Gebäude und Landmarken:**
   - Dachränder (Brüstung) auf allen Flachdächern; Klimaanlagen, Wassertanks, Antennen (`roofs.js`), alles in das vorhandene Dach-Mesh gemerged (0 Draw Calls extra).
   - Landmarken (`landmarks.js`, Liste in `game.world.landmarks.list`): **Meridian Tower** (188 m + Spitze, Mitte des zentralen Plaza-Parks, x=-37 z=37, Collider), **Marlin Wheel** (Riesenrad, x=-48 z=`H+14`, dreht, 12 Gondeln, Lichter nachts), **Pier Light** (Leuchtturm x=205 z=`H+20`, drehender Strahl nachts, Collider), **Ashgrove Pavilion** (Pavillon im ersten teichlosen Park im Norden).
   - Neue Fassadenstile 3 (Industrie-Bandfenster, Süd/West) und 4 (Wohnblock mit schmalen Fenstern, sonst) für ca. die Hälfte der Randbezirk-Blöcke, zusätzliche Wandfarben pro Bezirk (eigener RNG `_rnd2`, das Stadtlayout bleibt identisch, auch Positionen für T2).
4. **Kleinigkeiten:** Laternenmasten haben Collider (`type:'lamp'`, 0,4 m, maxY 1,9, damit Kamera und Polizei-Sichtlinie sie ignorieren). Nachtfenster: Helligkeit, Farbton (warm, weiß, bläulich, rosa), Vorhänge und je Etage unterschiedliche Belegung, kaum noch flächig weiß.
5. **Budget:** siehe unten.

## API (Ergänzungen)
- `game.world.sea` (`Sea`), `game.world.harbor`, `game.world.landmarks.list: [{name,x,z,type}]`.
- `world/coast.js`: `COAST {sea, flat, shore, wall,...}`, `groundHeight(d)` mit `d=max(|x|,|z|)`.
- `world/water.js`: `seaSurface(x,z,t,out)` liefert `{h,gx,gz}` (Wellenhöhe/Neigung, in tiefem Wasser) für schwimmende Objekte.
- Neue Collider-Typen: `lamp`, `rail`, `crane`, `container`, `landmark`. Nichts an bestehenden Signaturen geändert.
- Bekannt für andere Teams: Fahrzeuge sind weiter bei `|x|,|z| ≤ 330` begrenzt, der Steg (z bis ca. 429) ist nur zu Fuß erreichbar.

## Start und Tests
- Boote neu erzeugen: `tools/heavy.sh blender -b --factory-startup --python tools/blender/prop_boats.py`.
- `npm run build`: OK. `tools/heavy.sh npm run smoke`: **SMOKE OK** (drawCalls 301 am Ende der Fahrt, Gesamtszene mit allen Teams). `tools/heavy.sh node tests/qa-tour.mjs`: **QA OK**.
- Screenshots: `tools/heavy.sh node unternehmen/sprint-3-gta/work/stadt/shots.mjs [filter]` (Vite ohne HMR). Liefert auch die Draw-Call-Messung.

## Draw Calls (feste Messposition = Spawnpunkt, nur Welt, Frame inkl. Schattenpass)
Messung mit `shots.mjs`; Basis = Checkout von `HEAD` (vor Sprint 3), gleiche Messung.
| Blickrichtung | Basis | jetzt | Differenz |
|---|---|---|---|
| Standard-Spawnblick | 80 | 118 | +38 |
| Nord (weg von der Küste) | 92 | 110 | +18 |
| Süd (zur Küste) | 80 | 110 | +30 |
Budget +40 eingehalten. Neue Draw-Call-Quellen: Fassadenstil 3 und 4 (2), Hafen (Holz, Feststoff, Container, Boote = 4), Riesenrad (Gerüst, Rad, Gondeln = 3), Leuchtturm (Turm, Strahl = 2), Pavillon (1). Dreiecke Welt ca. +85 000.

## Screenshots (`work/stadt/shots/`)
Tag: `water-coast-day`, `pier-day`, `harbor-day`, `harbor-boats-day`, `skyline-day` (Turm vom Riesenrad aus), `tower-day`, `wheel-day`, `lighthouse-day`, `outskirts-west-day`, `outskirts-east-day`, `roofs-day` (Dachdetails, Brüstung, Riesenrad hinten), `pavilion-day`.
Nacht: `water-night`, `pier-night`, `harbor-night`, `wheel-night`, `lighthouse-night` (Strahl), `skyline-night`, `windows-night` (Fensterhelligkeit), `outskirts-night`.

## Lizenzen
Keine Fremd-Assets: Boote per eigenem Blender-Skript, alles andere prozedural. Poly Haven wurde nicht genutzt, deshalb kein `CREDITS.md`-Eintrag nötig.

## Offen / Hinweise
- Pavillon-Position ist vom Zufallslayout abhängig (siehe `landmarks.list`), im Screenshot `pavilion-day` nicht sauber getroffen.
- Schaum an Stegpfählen und Schiffsrümpfen fehlt, Wellen haben keine Vertex-Interaktion mit Objekten.
- Kein Stadion (Brief: "Stadion oder Pavillon", Pavillon gewählt).
- Brüstungen/Details nur auf Flachdächern, nicht auf Giebeldächern.
- Auswirkung auf Wasserlinie: Spieler laufen nur bis `H+31.5`, Spawns und Verkehr sind davon nicht betroffen.

## Runde 2
Nur `src/world/` geändert. Build OK, `tools/heavy.sh npm run smoke`: SMOKE OK, `tools/heavy.sh node tests/qa-tour.mjs`: QA OK.

### API (neu, in `City`)
- `world.playLimit` (getter): max |x| / |z| für Gehen an Land = `COAST.shore - 0.5` (H+30.4). Dort liegt der Boden etwa bei -0,5, also knapp über dem Meer (-0,7). Die Grenzwand steht bei H+31.5.
- `world.isWalkable(x, z)`: `true` an Land innerhalb `playLimit` und auf Steg, T-Kopf und Kai (ragen über das Limit hinaus bis z = H+126 bzw. H+46). Der Spieler soll mit dieser Funktion statt mit `CITY.half-1` geklemmt werden. Wasser daneben ist nicht begehbar (Geländer-Collider halten ihn auf dem Steg).
- `world.groundAt(x, z)`: Bodenhöhe in m. Land/Strand: Profil aus `coast.js` (0 bis H+27, dann abfallend bis ca. -0,5 am Limit). Steg-Deck 0,06, Kai-Deck 0,03. Überall sonst außerhalb des Limits (Wasser): `null` (dort kann man nicht stehen). Es wird kein Meeresboden geliefert.
- Hinweis: `groundHeight(d)` in `coast.js` gibt weiterhin das reine Profil, auch unter Wasser.

### Mängel
1. Meridian Tower: Baum-Ausschluss auf ±15 m erweitert, Steinplatz (28x28) deckt die Parkwege unter dem Turm ab, Collider ±10,2 (inkl. Eckflossen).
2. Leuchtturm-Strahl: Alpha-Verlauf per Vertexfarbe bis 0 am Ende, schmaler (Radius 7), keine harte Kante mehr (`lighthouse-night.png`).
3. Riesenrad nachts: eigenes unbeleuchtetes Bulb-Mesh (Felge plus Lichterketten an den Speichen), Farbe wechselt langsam und hängt am nightFactor (`wheel-night.png`). Kostet 1 Draw Call.
4. `pavilion-day.png` wird auf `landmarks.list` ausgerichtet und zeigt den Pavillon. Bootszahl auf 8 korrigiert.
5. Frachtschiff: gebogener, ansteigender Bug, drei Aufbau-Stufen mit echten blaugrauen Fensterbändern samt Sprossen (keine schwarze Fläche), Schornstein mit rot-weiß-schwarzem Band, Radarmast, Decksderricks, Reling, Wasserlinienstreifen, hellerer Rumpf. Alles im vorhandenen Feststoff-Mesh, kein zusätzlicher Draw Call (`ship-day`, `ship-bow-day`, `ship-night`).

### Draw Calls (gleiche Messung wie oben)
Standard-Spawnblick 120 (Basis 80, +40), Nord 110 (Basis 92, +18), Süd 112 (Basis 80, +32). Das Budget +40 ist am Limit.

### Neue Screenshots
`pavilion-day`, `ship-day`, `ship-bow-day`, `ship-night`, `tower-plaza-day`, `lighthouse-night`, `wheel-night`.
