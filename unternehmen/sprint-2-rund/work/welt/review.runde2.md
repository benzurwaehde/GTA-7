VERDIKT: FEHLER

Prüfer T3 `welt`, Runde 2. Befehle aus /Users/benzurwahde/Developer/GTA-7, schwere über tools/heavy.sh. Eigenes Skript `pruef2.mjs` (Vite `hmr: false, watch: null`), Screenshots dazu im Scratchpad. Kein Code geändert.

## Kriterien
- Build: `npm run build` endet ohne Fehler (nur Chunk-Größen-Warnung). OK.
- Smoke: `tools/heavy.sh npm run smoke` -> `SMOKE OK` (drawCalls 110). OK.
- QA: `tools/heavy.sh node tests/qa-tour.mjs` -> `QA OK` (draw 165). OK.
- signalAt unverändert korrekt (`pruef2.mjs`): `far:null`, `edge:null`, Sequenz an der Kreuzung `red/yellow, red/red, green/red, yellow/red, red/red, red/green, red/yellow`, `bad:0` bei 220 Messpunkten. signals.js enthält weiter die geschlossene Berechnung (`stateAt`, Zyklus 22 s). OK.

## Die fünf Punkte
1. Schwarzes Band: BEHOBEN. Kamera (22, 4.5, 30) -> (0, 4.5, 0) wie `pruef-inside-mit.png`: kein Band, Kreuzung und Läden sichtbar. Kamera in Gebäudewand und unter einer Ladenfront (8.6, 2.0, 30) und (14, 2.2, 22): kein schwarzes Band mehr, nur die einseitigen Wände von innen (dunkelblau), das ist Mangel 2 aus Runde 1, vom Chef akzeptiert. shops.js:194 hat nur noch die Oberseite der Markise.
2. Keine nach unten zeigenden Flächen: BEHOBEN für Läden. Per Windungsnormale über alle `world.group`-Meshes: Das Shops-Body-Mesh (Kind 18) taucht in der Liste mit Normale y < -0.5 nicht mehr auf. Übrig sind nur Unterseiten der Instanzmeshes (Bäume, Laternen, Möbel, Kinder 10-15, 23-26) und ein Rückseiten-Mesh (Kind 27, vermutlich Meer/Gelände). Das ist normal und nicht im Sichtbereich unter Läden.
3. Keine Allokationen in `City._applyTime`: BEHOBEN. City.js:466-468 legt `_top, _hor, _moonDir, _c.*` einmal an. In City.js:498-541 gibt es kein `clone()` und kein `new THREE.Color` mehr. `skyColors` (sky.js) nutzt Modulscratch `_a/_b`. OK.
4. Nachtfenster nicht ausgebrannt: BEHOBEN, mit Einschränkung. `e = night*0.62 + ...` (City.js:531). In `nightstreet.png` und `nightdown.png` zeigen die Hochhausfenster Farbe und Struktur (warm, gemustert, dunkle Zwischenräume). Nur ein Teil der Fenster ist fast weiß-cremefarben, im Rahmen des Akzeptablen.
5. Läden bündig, kein weißer Riegel: TEILWEISE. Tag und Bündigkeit sind gut: Sockel in Wandfarbe, dunkles Glas, farbige Markisen, Versatz 4 cm (`runde2-tag-gehweg.png`, `tag-laeden.png`). NACHTS ist der weiße Riegel aber wieder da (siehe Mangel 1).

## Mängelliste
1. (mittel) Nachts sind die Schaufenster riesige, fast weiße Flächen, die die ganze Ladenzeile als weißen Riegel zeigen. Belege: `nacht-laeden.png` (Ladenzeile am Park: durchgehend weißer Streifen unter den Markisen), `runde2-nacht-gehweg.png` und meine `nightwalk.png` (Kamera 8.6, 2.2, 22, 22:30 Uhr: Fenster und Tür des Ladens als weiße Tafeln, die das Bild dominieren, Warmton nicht erkennbar). Ursache: shops.js:80 `glassMat` ist `MeshBasicMaterial` mit Vertexfarbe bis 1.0 und `glassMat.color.setScalar(0.16 + night*0.84)` (shops.js:95), also volle Helligkeit. Dazu ist die Nacht-Exposure 1.35 (City.js:529). Die Farbwerte `warm` (shops.js:177) werden dadurch weiß geclippt. Reproduktion: `tools/heavy.sh node unternehmen/sprint-2-rund/work/welt/pruef2.mjs` mit `OUTDIR=<Ordner>`, Bild `nightwalk.png`, oder Kamera (8.6, 2.2, 22) -> (8.6, 2.2, 60) bei `timeOfDay = 22.5`. Vorschlag: Nachtfaktor des Glases auf ca. 0.45-0.55 begrenzen, Schaufenster mit Verlauf oder Rahmen/Sprossen gliedern, damit sie nicht flächig weiß wirken, und Farbsättigung beibehalten.

Keine Mängel bei: Punkte 1-3, signalAt, Build, Smoke, QA.
