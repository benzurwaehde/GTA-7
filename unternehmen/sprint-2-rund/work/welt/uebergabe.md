# Übergabe T3 `welt`

## Was gebaut wurde
Neue Dateien in `src/world/`: `signals.js` (Ampeln), `shops.js` (Läden, Neon, Dachwerbung), `furniture.js` (Straßenmöbel). `City.js` bindet sie ein und enthält den Nacht-Look.

1. **Ampeln** (`signals.js`): An allen 81 Kreuzungen gibt es 4 Masten mit Ausleger und je einem Signalkopf über der Anfahrspur. Die Leuchten wechseln per Instanzfarbe (rot/gelb/grün, im Dunkeln mit Halo). Zyklus 22 s: ns 8 s grün, 2 s gelb, 1 s allrot, danach ew genauso. Jede Kreuzung hat einen festen Phasenversatz.
2. **Läden** (`shops.js`): 156 Ladenfronten an Gebäuden im Zentrum und im Mid-Rise-Ring (Tier 0 und 1, keine Häuser). Jede hat Schaufenster, Tür, gestreifte Markise und ein Schild mit prozeduralem Namen (Atlas aus 32 Namen als CanvasTexture). Nachts leuchten Fenster, Schild und Lichtpfütze auf dem Gehweg. Einige Läden sind „geschlossen“ (dunkel).
3. **Neon/Werbung**: 19 Neon-Ausleger (HOTEL, BAR, CLUB, ...) an Hochhäusern im Zentrum und Dachwerbetafeln (NEON NIGHTS, VICE FM 104.2 ...). Sie leuchten nachts mit additivem Glow.
4. **Nacht-Look** (`City._applyTime`): Hemisphärenlicht +1.2 (hellere Farben), Mondlicht 0.45 auf 1.15, Exposure nachts bis 1.35, Laternen-Lichtpools größer (30 m) und voll deckend. Ergebnis: dunkle Nacht, Straße und Autos sind erkennbar.
5. **Straßenmöbel** (`furniture.js`): 428 Stück (Bänke, Hydranten, Mülltonnen, Briefkästen), 4 InstancedMeshes. Prozedural, kein Blender (nicht nötig). Ohne Collider, damit Passanten und Autos nicht hängen bleiben.
6. **Budget**: Ca. 13 zusätzliche Draw Calls (Ampeln 3, Läden 5, Möbel 4, plus 1). Ladenmeshes und Ampeln werfen keine Schatten. Keine Allokationen pro Frame (`signalAt` rechnet geschlossen, kein Objekt).

## API (für ARCHITECTURE.md)
- `game.world.signalAt(x, z, axis) -> 'green' | 'yellow' | 'red' | null`. `axis`: `'ns'` (entlang Z), `'ew'` (entlang X). Es gilt die nächste Kreuzung. `null`, wenn der Abstand zum Kreuzungsmittelpunkt über 25 m liegt. Zeitbasis ist `game.time` (pausiert mit dem Spiel).
- Haltelinien liegen 11.4 m vom Kreuzungsmittelpunkt, also im 25-m-Bereich. Eine Auto-Position mitten zwischen zwei Kreuzungen (über 25 m) liefert `null`.
- Zusätzlich: `game.world.signals`, `game.world.shops` (nur intern).

## Tests (alle über tools/heavy.sh bzw. bei geringer Last)
- `npm run build`: OK.
- `npm run smoke`: `SMOKE OK` (drawCalls 86 im Smoke-Fenster).
- `tools/heavy.sh node tests/qa-tour.mjs`: `QA OK`, Draw Calls 270 (andere Teams eingerechnet).
- Eigenes Skript `shots.mjs`: Sequenz an einer Kreuzung über 22 s: `red/green, red/yellow, red/red, green/red, yellow/red, red/red, red/green`. Nie beide Achsen gleichzeitig nicht rot (0 von 220 Messpunkten). Weit zwischen Kreuzungen und außerhalb: `null`. 100000 Aufrufe in 5 ms.

## Screenshots (in diesem Ordner)
Tag: `tag-ampel.png` (Kreuzung mit Ampeln, Läden, Neonschildern), `tag-laeden.png` (Ladenzeile am Park), `tag-strasse.png`.
Nacht: `nacht-ampel.png`, `nacht-laeden.png`, `nacht-strasse.png` (Ampel, Markisen, beleuchtete Schilder, Lichtpools), `nacht-downtown.png` (Straße aus der Höhe, Neon, Laternen).
Hinweis: Die Fotos `nacht-*` und `tag-*` wurden vor dem letzten Fix zur Neon-Spiegelung (SUSHI) bzw. danach neu erstellt: die aktuellen Dateien stammen vom zweiten Lauf mit dem Fix.

## Offen / Hinweise
- Die Fassaden-Fenster der Hochhäuser (bestehende Emissive) wirken mit der höheren Exposure nachts recht hell. Ein Feintuning (`e` in `_applyTime`) ist möglich, ich habe es nicht angefasst.
- Ampeln und Möbel haben keine Collider. Wunsch an Chef: nur bei Bedarf.
- Die Ampelköpfe zeigen eine Seite pro Kreuzungsarm (kein Fußgängersignal).
- Vehicles/Peds müssen `signalAt` selbst abfragen (`game.world?.signalAt?.(...)`).

## Runde 2
- Mangel 1 (hoch, schwarzes Band): Die Markisen-Unterseiten in `shops.js` sind entfernt. Die Kamerastellung aus `pruef-inside-mit.png` zeigt das Band nicht mehr (`runde2-tag-innen.png`).
- Mangel 2 (mittel, einseitige Wände): Mit entfernten Unterseiten ragt keine nach unten zeigende Fläche mehr ins Bild. Gebäude und Läden blieben unverändert einseitig, ein weiterer Fix war laut Review nicht nötig.
- Mangel 3 (niedrig, Allokationen): `City._applyTime` nutzt jetzt wiederverwendete Objekte (`this._moonDir`, `this._c.*`). Kein `clone()` und kein `new THREE.Color` mehr pro Frame.
- Mangel 4 (niedrig, Fenster zu hell): Die Fassaden-Emissive nachts sinkt von `night * 0.95` auf `night * 0.62`. Die Fenster wirken wärmer und weniger ausgebrannt (`nacht-strasse.png`). Sie sind weiterhin hell, bei Bedarf kann der Wert weiter runter.
- Chef-Punkt 5 (Läden als weißer Riegel): Der Ladensockel ist jetzt aus der Wandfarbe des Gebäudes abgeleitet (38 % Helligkeit). Tagsüber ist das Schaufensterglas dunkel (Material 0.16, nachts voll), und die Markisen sind farbig mit dunkler Gegenfarbe statt weiß-gestreift. Die Läden liegen bündig an der Fassade (Versatz 4 cm).
- Tests: `npm run build` OK, `tools/heavy.sh npm run smoke` gibt SMOKE OK, `tools/heavy.sh node tests/qa-tour.mjs` gibt QA OK (ein früherer Lauf brach durch Last ab, der Wiederholungslauf war grün). `shots.mjs` meldet `signalAt` unverändert korrekt.
- Neue Screenshots: `runde2-tag-innen.png` (Stellung wie `pruef-inside-mit.png`), `runde2-tag-gehweg.png`, `runde2-nacht-gehweg.png`; die Standardbilder `tag-*`/`nacht-*` wurden neu erzeugt.

## Runde 3
- Mangel (Schaufenster nachts fast weiß): (a) Der Nachtfaktor des Glases ist jetzt `0.16 + night * 0.34` (max. 0.5, vorher 1.0). Die Vertexfarben sind warm und gesättigt (Orange, Gelb, Türkis), nicht mehr nahe Weiß. (b) Fenster sind gegliedert: unterer Teil hell, oberer Teil dunkler, drei dunkle Regalstreifen, Sprossen alle ca. 1.5 m und ein Kämpfer. Alles steckt in den vorhandenen Glas- und Body-Meshes, es gibt keine neuen Meshes oder Draw Calls.
- Beleg: `runde3-pruef2-nightwalk.png` (Repro aus `pruef2.mjs`, Kamera 8.6, 2.2, 22 → 8.6, 2.2, 60 um 22:30), `runde3-nacht-laeden.png`, `runde3-nacht-gehweg.png`.
- Tests: `npm run build` OK, `tools/heavy.sh npm run smoke` gibt SMOKE OK, `tools/heavy.sh node tests/qa-tour.mjs` gibt QA OK.
