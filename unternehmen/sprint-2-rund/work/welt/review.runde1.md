VERDIKT: FEHLER

Prüfer T3 `welt`. Alle Befehle aus /Users/benzurwahde/Developer/GTA-7, schwere über tools/heavy.sh.

## Kriterien
- A1 Build: `npm run build` endet ohne Fehler (nur Chunk-Größen-Warnung). OK.
- A2 Smoke: `tools/heavy.sh npm run smoke` -> `SMOKE OK` (drawCalls 76). `tools/heavy.sh node tests/qa-tour.mjs` -> `QA OK` (draw 212). OK.
- A3 T3.1-T3.6: alle umgesetzt (Ampeln 81 Kreuzungen, 156 Läden, 19 Neon-Ausleger plus Dachtafeln, Nacht-Look, 428 Möbel in 4 InstancedMeshes). Siehe aber Mangel 1.
- A4 Bereich: geändert/neu sind nur src/world/ (signals.js, shops.js, furniture.js, City.js). OK.
- A5 Defensiv: `signalAt` ist in City vorhanden. Es greift nicht in fremde Systeme ein (nur `game.player?.position`, `game.time ?? `). OK.
- A6 Performance: `shots.mjs` meldet draw 299 gesamt (alle Teams, Ausgangswert ca. 230). T3 selbst: Ampeln 3, Läden 5, Möbel 4 plus Schattenpass der Möbel (castShadow=true). Das bleibt im Budget (<= 60). Pro-Frame-Allokation siehe Mangel 3.
- A7 Screenshots: 7 vorhanden und angesehen. Hinweis: mein Lauf von `shots.mjs` hat tag-*/nacht-*.png mit identischer Szene überschrieben.
- A8/A9: API steht in uebergabe.md, kein Commit. OK.

## Ampel-Vertrag signalAt
- Signatur `signalAt(x, z, axis) -> 'green'|'yellow'|'red'|null`, auf `game.world` (City.js:435). OK.
- `tools/heavy.sh node .../shots.mjs`: `far:null`, `edgeNull:null` (Abstand > 25 m und außerhalb der Stadt), Sequenz an Kreuzung `red/green, red/yellow, red/red, green/red, yellow/red, red/red, red/green`, `bothNonRed:0` bei 220 Messpunkten. Zyklus 22 s = 8 grün / 2 gelb / 1 allrot je Achse (signals.js:22-29). OK.
- Per Hand nachgerechnet: Mast-Ecken, Ausleger und Kopfrichtung passen zur Fahrspur und zur Achse (ns: Ecken (+,+) und (-,-), ew: (-,+) und (+,-)). Phasenversatz je Kreuzung. OK.
- Keine Allokation in `signalAt`, 100000 Aufrufe in 5 ms. OK.

## Nacht
nacht-ampel/-strasse/-downtown.png: Straße, Autos, Gehwege und Lichtpools gut erkennbar, Himmel und Schatten bleiben dunkel, Neon und Läden leuchten deutlich. Kein schwarzes Bild. Die Hochhaus-Fassaden sind sehr hell (große cremeweiße Fensterblöcke, fast ausgebrannt), siehe Mangel 4 (klein). Sonst akzeptabel.

## Läden und Möbel auf Straßen
Möbel: Inset 1.7 m vom Blockrand, Gehweg ist 3 m breit, also nicht auf der Straße. Ladenmarkisen ragen max. 1.45 m vor die Fassade (Gebäude liegt >= 3.8 m vom Blockrand), enden also bei >= 2.35 m, auf dem Gehweg. Neon-Ausleger 1.55 m. Kein Befund. Screenshots (pruef-sidewalk-mit.png) bestätigen es.

## Schwarzes Band: Ursache geklärt
Ursache: **Unterseiten der Markisen** in `src/world/shops.js`, Zeile 195 (zweiter `G.body.quad` in der Streifen-Schleife, Farbe `c.map(v => v*0.45)`, ctr `P(..., y+6, 0.5)`, also nach unten zeigende Fläche). Erzeuger ist `Shops` (`world.group.children[18]`, das Body-Mesh der Läden), nicht Schatten und nicht die Ampelmasten.
Belege:
1. Alle `world.group`-Kinder einzeln ausgeblendet (`pruef-band.mjs`): Nur Kind 18 (Shops-Body) senkt die Zahl schwarzer Pixel im Bandbereich von 20739 auf 5857. Ampelmasten (Kind 15), Möbel und Schatten-Kinder ändern praktisch nichts.
2. Bisektion der Dreiecke (`pruef-bisect.mjs`) landet bei Markisen-Dreiecken (Normale (0.42,-0.91,0), Farbe 0.02).
3. Strahlen durch die Bandpixel (`pruef-ray.mjs`) treffen Shops-Body-Dreiecke (Ladenband, Markise) bei x=11.4: Die Kamera der Testszene (22, 4.5, 30) liegt im Grundriss eines Gebäudes (x 11.4..35.6, z 11.4..35.6). Die Gebäudewände sind einseitig und von innen unsichtbar, die nach unten/innen zeigenden Markisen-Unterseiten sind von innen sichtbar und nur vom dunklen Boden-Hemisphärenlicht beleuchtet, also fast schwarz. Sie ziehen als Band zu den Fluchtpunkten.
4. Gegenprobe (`pruef-awning.mjs`): Alle Dreiecke mit Normale y < -0.5 aus dem Shops-Body entfernt -> Band verschwindet vollständig (`pruef-inside-ohne-unterseiten.png` gegen `pruef-inside-mit.png`).
Das gleiche Band erscheint in den Fahrzeug-Screenshots (explosion-0.png, band-*.png): Die Kamera liegt dort offenbar unter oder in einer Ladenfront. Die Kamera hat keine Wandkollision. Dass das Band auch an Park-Seiten steht, passt: Es sind Markisen der Gebäude hinter/neben der Kamera, die quer durchs Bild laufen.
Die Kamera in tag-ampel.png steht selbst im Gebäude, das Band ist dort ein Testartefakt. Im Spiel entsteht es aber bei Kamera unter oder nahe der Markise, also im Normalbetrieb.

## Mängelliste
1. (hoch) Schwarze Markisen-Unterseiten erzeugen großes schwarzes Band im Bild, sobald die Kamera unter oder in einer Ladenfront steht. Datei `src/world/shops.js:195`. Repro: `tools/heavy.sh node unternehmen/sprint-2-rund/work/welt/pruef-awning.mjs`, Bilder `pruef-inside-mit.png` gegen `...-ohne-unterseiten.png`. Vorschlag: Unterseite entfernen oder deutlich heller färben (z. B. `c.map(v => v*0.8)` plus Grundhelligkeit), und die Unterseite nicht nach innen sichtbar lassen (Markise nur außen, Ladenfront mit Rückseite oder FrontSide-Culling beachten).
2. (mittel) Ladenband und Fassadenbänder sind einseitig. Von innerhalb eines Gebäudes (Kamera ohne Wandkollision) sieht man Teile der Läden und die Gebäude selbst nicht. Gehört zu 1, bitte mitprüfen. Kein Fix an Gebäuden nötig, wenn 1 behoben ist.
3. (niedrig) Pro-Frame-Allokationen in `City._applyTime` (City.js:511 `sd.clone().negate()`, 519 `new THREE.Color(...)`, 525-526 `new THREE.Color(...)` x3, 531). Läuft jeden Frame über `update`. Wiederverwendbare Farbobjekte als Felder anlegen (A6).
4. (niedrig) Nacht: Fassadenfenster der Hochhäuser wirken mit Exposure 1.35 und Emissive fast ausgebrannt (nacht-ampel.png, nacht-strasse.png). Die Übergabe nennt das selbst als offen. Empfehlung: `e` in City.js:529 leicht senken (z. B. 0.95 -> 0.7).

Keine Mängel bei: Ampel-Vertrag, Draw-Call-Budget, Möbel und Läden nicht auf der Straße.

Prüfskripte (nur lesend/Screenshots): `pruef-band.mjs`, `pruef-bisect.mjs`, `pruef-geo.mjs`, `pruef-ray.mjs`, `pruef-awning.mjs` in diesem Ordner.
