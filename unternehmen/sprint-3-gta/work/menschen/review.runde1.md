VERDIKT: FEHLER

## Blocker: Ragdoll-Leiche versinkt im Gehweg (Ursache gefunden)
Der Chef-Verdacht (falscher Raum oder kollabierte Partikel) trifft NICHT zu. Skelett und Partikel sind korrekt. Der Boden des Ragdolls liegt aber 18 cm zu tief.

Ursache:
- `src/characters/Ragdoll.js:125-126` setzt den Boden fest auf y = 0 (`if (p[o+1] < r) p[o+1] = r`).
- Die Gehwegplatte der Stadt liegt bei `SLAB = 0.18` (`src/world/City.js:19`, Gehweg `walkGB.box(..., 0, ..., SLAB, ...)` in Zeile 197). Straßen liegen bei `SLAB + 0.03` (Zeile 363).
- Die Partikel kommen bei y = 0.04 bis 0.13 zur Ruhe (Radius 0.04 bis 0.13). Der Körper liegt damit fast ganz unter der Gehwegoberfläche. Nur Kopf und ein Bein ragen heraus.

Messungen (eigenes Playwright-Skript im Scratchpad, Vite mit hmr:false und watch:null, Aufruf über `tools/heavy.sh node ...`):
- Passant 5 m vor dem Spieler, tödlicher Treffer wie in `t1-shots.mjs`. Nach 4 s sind die Partikel eingefroren. Beispiel: Kopf (8.90, 0.12, 28.36), Knöchel (8.68, 0.04, 26.48), Becken y = 0.13.
- Die Vertex-Ausdehnung der Skinned-Mesh ist 0.55 x 0.35 x 1.70 m, mit min y = -0.12. Das ist ein voller, liegender Körper (Kopf-Fuß ca. 1,7 m). Eine CPU-Skinning-Nachrechnung mit `skeleton.boneMatrices` ergibt exakt dieselben Werte wie `getVertexPosition`.
- Wireframe und Draufsicht (4 m über der Leiche) zeigen aber nur Kopf und ein Bein, Rumpf und Arme fehlen. Das entspricht `03-ragdoll-liegt.png`, `03-ragdoll-b.png` und `03-ragdoll-schraeg.png`.
- Gegenprobe: Setzt man nach dem Tod `ped.mesh.position.y = 0.2`, ist der ganze Körper sichtbar (Pose glaubwürdig, Kopf, Rumpf, Arme, Beine erkennbar).
- Variantentest: Alle 7 Modellvarianten sind nach dem Tod in der Ausdehnung plausibel. Das Problem ist also nicht modellabhängig.

Folgemängel derselben Wurzel:
- Die Blutlache liegt bei y = 0.03 (`src/characters/Blood.js:49`) und damit ebenfalls unter dem Gehweg. Sie ist nie sichtbar. Das passt zu "Pfütze klein oder verdeckt" in der Übergabe. Die Spritzer sterben bei `pos.y < 0.02` (Blood.js:64), also auch unter der Gehwegoberfläche.
- `ped.position.y = 0` und `player.position.y = 0`. Auf `01-spieler-nah.png` und `05b` enden die Beine über den Schuhen am Gehweg, die Füße stecken also im Boden. Der Befund wurde nur am Screenshot gesehen, nicht gemessen.

Vorschlag für den Fix (nicht umgesetzt, nur Prüfer):
- Bodenhöhe als Parameter, z. B. `ground = 0.18`, für Ragdoll, Blutlache und Spritzer.
- Der `ped.mesh`-Offset ist dann y + 0.18.
- Beachten: Außerhalb der Stadt (Strand, Park) kann der Boden anders liegen. Besser eine Funktion `groundY(x,z)`, falls die Welt eine bietet.
- Danach `03-ragdoll-*.png` neu erzeugen.
- Der Rumpf soll auf allen Screenshots sichtbar sein. Die Blutlache soll sichtbar sein.

## Weitere Mängel
2. Explosion wird nicht behandelt. `grep` findet in `src/characters/` und `src/npc/Pedestrians.js` weder ein `explosion`-Event noch eine Radiusbehandlung. Granate, Autowrack und Hubschrauber rufen `peds.damage(ped, 100, 'explosion')` ohne `hit`. Dann fliegt die Leiche in `Pedestrians.js:168-170` "weg vom Spieler" statt weg vom Explosionszentrum. Der Impuls nach oben ist 3 m/s und unabhängig vom Abstand. Das Event `explosion {x,y,z,radius,source}` (`src/player/Grenades.js:88`) wird von T1 nicht abonniert. Mindestens sollte die Richtung vom Explosionsmittelpunkt kommen und der Impuls mit dem Abstand abnehmen. Danach bräuchte man einen Test mit Granate nahe einer Gruppe.
3. Autounfall: `Pedestrians.js:287-288` übergibt die Fahrzeuggeschwindigkeit als Impuls. Das ist plausibel, wurde aber nicht visuell belegt (kein Screenshot, kein Test). Wegen Mangel 1 ist die Wirkung ohnehin nicht überprüfbar.
4. Ragdoll-Hot-Path: `Ragdoll._collide` ruft pro Partikel und pro Iteration `grid.near(...)` auf. Das ist 13 x 4 x 60 Aufrufe pro Sekunde und Körper. `ColliderGrid.query` gibt ein Array zurück (`src/npc/ColliderGrid.js:56-65`, `this.out` wird wiederverwendet, also vermutlich ohne Allokation). Das ist vom Prüfer nicht im Heap gemessen worden. `Ragdoll.step` benutzt `for (const l of this.links)` (Iterator pro Aufruf, kleine Allokation). Human, Blood und Ragdoll nutzen Temporärvektoren. Das Kriterium "keine Allokation pro Frame" ist also weitgehend erfüllt, aber ungemessen. Zusätzlich liegt in `Pedestrians.hitTest` (Zeile 156) ein `new THREE.Vector3` pro Treffer. Das ist alt und unkritisch.
5. Gelenkgrenzen: Es gibt nur Mindestabstände, keine Winkelgrenzen (vom Agenten selbst erwähnt). Brief T1.3 verlangt "einfache Winkelgrenzen". Die Verdrehung ist auf `03`-Bildern unauffällig. Das ist ein kleiner Punkt, aber nicht erfüllt.
6. Variante der Leiche nach 9 s: Bei einem der 7 Testkörper war der Ragdoll nach der Wartezeit noch nicht eingefroren (`frozen:false`, Ausdehnung 1.28 x 0.55 x 0.65). Die Zeit war Echtzeit mit langsamer SwiftShader-Spielzeit, daher ist das wohl nur eine Messartefakt-Vermutung. Zu prüfen bleibt, ob er irgendwann ruht (Obergrenze `age > 9` s greift in jedem Fall).
7. Sterbe-Animation Nr. 2 ist eine Spiegelung (laut Übergabe). Spieler-Tod ist keine Ragdoll, Auto-Einsteigen ist offen. Das ist in der Übergabe begründet und akzeptiert, laut Brief ("wenn möglich").
8. Lizenzhygiene: In `tools/assets-src/polypizza-quaternius/` liegen zusätzlich `animhuman.glb`, `animwoman.glb`, `business.glb`, `casual.glb`, `charanim.glb`. Diese stehen NICHT in `CREDITS.md`, `human_build.py` nutzt sie nicht. Falls einer davon CC-BY ist (z. B. "Business Man"), sollte er entfernt oder dokumentiert werden. Die Quellseite wurde vom Prüfer nicht online geprüft (kein Netzzugriff verlangt). Die CREDITS-Einträge der 7 genutzten Modelle sind vollständig (Autor, URL, CC0 1.0, Datum). Der Quaternius-Gesamtpack-Ursprung ist vermerkt.
9. Reproduzierbarkeit: Das Blender-Skript wurde NICHT ausgeführt, weil es die ausgelieferten GLBs in `public/models/` überschreiben würde. Ein Aufruf mit `--` und einem Namen schreibt ebenfalls dorthin. Das Skript hat dokumentierten Aufruf, importiert nur aus `tools/assets-src` und führt keine fremden Skripte aus.

## Akzeptanzkriterien
- A1: `npm run build` fehlerfrei. Beleg: Build lief durch, nur die bekannte Chunk-Größen-Warnung. OK.
- A2: `tools/heavy.sh npm run smoke` gibt `SMOKE OK`, `drawCalls: 173`, peds 32. `tools/heavy.sh node tests/qa-tour.mjs` gibt `QA OK`. OK.
- A3: Alle Punkte umgesetzt oder begründet offen. Der Ragdoll-Teil (T1.3) ist wegen Blocker 1 visuell nicht erfüllt, daher FEHLER.
- A4: `git status` zeigt viele fremde Änderungen (andere Teams). T1-Dateien liegen in den erlaubten Ordnern. `src/core/modelList.js` ist laut Übergabe ergänzt. OK. Nicht Zeile für Zeile gegen die anderen Teams abgeglichen.
- A5: Fallback ohne GLB (prozedurale Figur) ist im Code vorhanden (`PedModel.js`, `Pedestrians._animate` Zweig ohne `human`). Nicht durch Löschen des GLB ausgeführt. Die Fallback-Sterbeanimation (`useRagdoll=false`) ist in `07-fallback-sterbeanimation.png` belegt.
- A6: Draw Calls Smoke 173 (vorher ca. 190). 40 Passanten teilen eine Material-Programmvariante. LOD: bis 50 m jedes Frame, 50 bis 100 m jedes 3., darüber oder außerhalb des Sichtfelds jedes 6. bis 8. Frame (`Pedestrians.js:436-446`). OK. Eine eigene Frame-Zeit-Messung der 40 Passanten wurde nicht gemacht.
- A7: Screenshots vorhanden (Figur nah, Gruppe, Ragdoll). Der Ragdoll-Moment (`03-ragdoll-b/liegt/schraeg`) zeigt aber KEINEN erkennbaren Körper, nur ein Gebilde in Schuhgröße. A7 ist deshalb nicht erfüllt, bis die Bilder nach dem Fix neu erzeugt sind.
- A8: API steht in `uebergabe.md`. OK.
- A9: CC0-Quaternius-Modelle in `CREDITS.md` dokumentiert. Verbotene Assets sind nicht im Spiel. Siehe Mangel 8 für ungenutzte Rohdateien. Teilweise OK.
- A10: Kein Commit durch den Prüfer. Nicht prüfbar, was der Agent tat, `git status` zeigt nur unversionierte und geänderte Dateien.

## Schwerpunkte kurz
- Spieler: Idle-, Lauf- und Zielhaltung sind auf den Bildern 01, 05 und 05b sichtbar. In `05b` (Zweihand) stehen die Arme nach vorn, nicht abgespreizt. `Weapons.js:93,107` hängt die Waffe an `rightHand` und ruft `setWeaponStyle('rifle'|'pistol'|'none')`. Der Aufruf ist vorhanden. Das Gewehr wurde nicht mit echter T2-Waffe im Bild geprüft. Die Füße stecken im Gehweg (siehe Blocker, Folgemängel).
- Kompatibilität: `buildPedMesh` und `releasePedMesh` werden in `Pedestrians._make` und `removePed` benutzt. `hitTest` ist unverändert (Radius 0.4, Höhe 1.85) und passt zur 1,7 bis 1,85 m großen Figur (gemessene Ausdehnung 1.71 m stehend). Cops über `spawnCop` laufen (`06-polizist.png`).
- Max. 8 Ragdolls: `MAX_RAGDOLLS = 8` (`Pedestrians.js:18`), ältere werden mit `freeze()` eingefroren. Nicht mit 9 Toten getestet.
- Zittern oder Explodieren: Bei 7 Testkörpern kein Explodieren, keine NaN. Der Körper bleibt in der Ausdehnung beschränkt.
- GLB-Größen: 0,43 bis 0,56 MB pro Datei (Budget 1,5 MB). 4 000 bis 5 800 Vertices, laut Übergabe ca. 2 000 Dreiecke (Budget 6 000). OK.

## Nötig für OK
1. Boden des Ragdolls, der Blutlache und der Spritzer auf die tatsächliche Gehweg-/Straßenhöhe (0,18 bis 0,21) anheben. Danach Screenshots neu erzeugen, auf denen der Körper erkennbar liegt.
2. `explosion`-Event abonnieren (oder Richtung und Impuls bei `source: 'explosion'` vom Explosionsmittelpunkt ableiten) und mit Granate testen.
3. Winkelgrenzen ergänzen oder in der Übergabe als bewusst offen begründen.
4. `tools/assets-src/` von nicht dokumentierten Rohdateien bereinigen oder dokumentieren.
