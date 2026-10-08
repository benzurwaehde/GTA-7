# T1 menschen - Übergabe

## Quelle und Lizenz (Entscheidung)
- Gewählt: Quaternius-Charaktere (Man, Man in Suit, Woman, Woman Casual, Woman in Dress, Woman in Tank Top), CC0 1.0, Lizenz auf der Quellseite (Poly Pizza und quaternius.com) geprüft. Gemeinsames 31-Bone-Skelett, ca. 1,8-2,1k Dreiecke, je ca. 0,45-0,55 MB.
- Ein Google-Drive-Download der Originalpakete scheiterte ("Quota exceeded"), daher die GLB-Fassungen von Poly Pizza (Direktdownload der static-Dateien, kein Skript ausgeführt). Eigenes Modellieren war nicht nötig.
- Nachweise in `CREDITS.md` (Name, Autor, URL, Lizenz, Datum). Rohdateien: `tools/assets-src/polypizza-quaternius/`.
- Hunyuan3D wurde nicht benutzt.

## Was gebaut wurde
- `tools/blender/human_build.py` (`blender -b --factory-startup --python tools/blender/human_build.py [-- name ...]`): importiert die Quellen, entfernt Hilfsmeshes, backt alle Materialien in EIN Vertexfarben-Material (COLOR_0 = Farbe, COLOR_1.r = Regionen-ID: Shirt/Hose/Haar/Haut), skaliert auf 1,8 m, behält die Clips Idle/Walk/Run/Jump/Punch/Death, ergänzt beim Polizisten eine Mütze, exportiert `public/models/human_*.glb` (7 Zivilisten-Varianten + `human_cop`). Vertexfarbe der Mütze exportiert Blender weiß, deshalb wird sie über die Shirt-Region eingefärbt.
- `src/characters/humanMaterial.js`: ein Lambert-Material pro Outfit, gleicher Shader (Region x Outfitfarbe), 40 Passanten = 40 Draw Calls statt vorher 5 pro Figur.
- `src/characters/Human.js`: Klon plus Skelett-Rebind, AnimationMixer mit Überblendung, Zusammenzucken (`flinch`), Arm-Zielen und Zweihand-IK, `rightHand`-Proxy.
- `src/characters/Ragdoll.js`: Verlet, 13 Partikel (Hüften, Schultern, Kopf, Ellbogen, Hände, Knie, Knöchel), Längenbedingungen, Minimalabstände als Gelenkgrenzen (Ellbogen, Knie, Hals), Boden und Gebäude-Boxen (ColliderGrid), Ruhe-Erkennung, treibt die Bones. Keine Physik-Bibliothek.
- `src/characters/Blood.js`: gepoolte Blutspritzer (ein Points-Objekt, keine Allokation pro Frame) und 24 Blutlachen (wachsen in 3 s, verblassen nach ca. 30 s).
- `src/npc/PedModel.js`: `buildPedMesh(kind)` / `releasePedMesh(mesh)` unverändert kompatibel, liefert Human-Gruppe (`userData.human`), sonst prozedurale Figur als Fallback.
- `src/npc/Pedestrians.js`: Animation (idle/walk/run, Flucht = run x1,3, Schlag = punch), LOD, Treffer-Reaktion, Ragdoll beim Tod, Blut. `hitTest` unverändert (Radius 0,4, Höhe 1,85 passt zur 1,8-m-Figur).
- `src/player/Character.js`: neue Klasse `Character` (GLB `human_man_a`), alte Klasse bleibt als `ProceduralCharacter`-Fallback, wenn das GLB fehlt.
- `src/core/modelList.js`: die 8 `human_*` ergänzt.
- A4-Hinweis: `src/police/Police.js` und andere Dateien stehen in `git status` als geändert, das stammt nicht von T1.

## Erfüllung der Punkte 1-6
1. Modelle: 7 Passanten-Varianten + Polizist + Spielerfigur, Farbvariation per Outfit-Material (Shirt, Hose, Haar, Haut).
2. Animationen: idle, walk, run, Flucht (run, schneller), punch, Treffer-Reaktion (prozedural, richtungsabhängig), 2 Sterbe-Animationen als Fallback (Man_Death, Mirror-Variante, in Schussrichtung ausgerichtet; Hauptpfad ist der Ragdoll). Spieler zusätzlich: jump, zielen (Arme zeigen nach vorn, optional mit Neigung `pitch`), Tod. Mixer mit Cross-Fade. Geschwindigkeit der Clips an Gehtempo angepasst (Walk-Referenz 1,65 m/s, Run 3,6 m/s, in Blender gemessen).
3. Ragdoll: siehe oben. Höchstens 8 aktive (`MAX_RAGDOLLS`), ältere frieren in ihrer Pose ein. Impuls in Schussrichtung (`damage(..., hit.dir)` oder weg vom Spieler) bzw. Fahrzeuggeschwindigkeit. `game.peds.useRagdoll = false` schaltet auf die Sterbe-Animation (getestet, Screenshot 07).
4. Treffer-Feedback: Blutspritzer bei jedem Treffer, Blutlache unter Leichen, Zusammenzucken bei nicht tödlichen Treffern.
5. Integration: Passanten, Polizisten (`spawnCop`), Spieler. LOD: bis 50 m jedes Frame, 50-100 m jedes 3. Frame, darüber oder außerhalb des Sichtfelds jedes 6. bis 8. Frame (Mixer-dt akkumuliert).
6. Fallback: ohne GLB prozedurale Figuren (Passanten und Spieler), unverändert im Code erhalten.
- Offen: "in ein Auto einsteigen" für den Spieler (Figur wird beim Einsteigen weiterhin ausgeblendet, kein Einsteige-Clip im CC0-Set); Spieler-Tod ist eine Sterbe-Animation, kein Ragdoll; Sterbe-Animation Nr. 2 ist eine Spiegelung, kein eigener Clip.

## API
- `character.rightHand`: Object3D unter `character.root`, Einheitsskala, +Z = Richtung von Unterarm/Hand, +Y ungefähr oben. Hängt am Hand-Bone und wird bei jedem `character.update` nachgeführt. Waffenmodelle (T2) hängen sich hier an. Fallback-Pistole/SMG hängen ebenfalls dort, wenn `setWeapon(id)` gerufen wird.
- `character.setPose('aim'|'idle', { twoHanded })`: 'aim' hebt die Arme auch ohne rechte Maustaste. Optional `twoHanded: true|false`.
- **`character.setWeaponStyle('pistol'|'rifle'|'none')`**: 'rifle' = Zweihand-Haltung (linke Hand greift den Vorderschaft, ca. 0,36 m vor der rechten Hand, Zwei-Knochen-IK); 'pistol' = linke Hand stützt den Pistolengriff von der Seite; 'none' = Fäuste. T2 soll beim Waffenwechsel `character.setWeaponStyle?.(def.twoHanded ? 'rifle' : 'pistol')` rufen (Schrotflinte, Sturmgewehr, Scharfschützengewehr = 'rifle'). Wirkt nur im Zielmodus (aiming / pose 'aim').
- `character.update(dt, { speed, grounded, aiming, dying, vy, reload, pitch })`: `pitch` (rad, optional) neigt die Zielhaltung nach oben/unten. `punch()`, `punching`, `muzzleObject`, `setWeapon(id)` wie zuvor.
- `peds.damage(ped, amount, source = 'player', hit = null)`: `hit = { point: Vector3, dir: Vector3 }` optional (Blut am Einschuss, Zucken und Ragdoll-Richtung). Ohne `hit` wird "weg vom Spieler" und Brusthöhe angenommen, es funktioniert also ohne Änderung bei T2.
- `peds.kill(ped, source, vx, vy, vz)`: wie zuvor, die Geschwindigkeit wird dem Ragdoll als Impuls gegeben.
- `peds.blood` und `game.blood`: `blood.spray(point, dir, n, speed)`, `blood.puddle(x, z, size)`.
- `peds.useRagdoll` (bool), `peds.ragdolls` (aktive Instanzen).
- Ped-Objekt: neue Felder `ped.human`, `ped.ragdoll`. Bei toten Passanten ist `ped.position` eine eigene Kopie, `ped.mesh` bleibt am Sterbeort.
- `buildPedMesh(kind)`, `releasePedMesh(mesh)`: unverändert.

## Tests und Messwerte
- `npm run build`: fehlerfrei.
- `tools/heavy.sh npm run smoke`: SMOKE OK (drawCalls 177 im Smoke, vorher ca. 190).
- `tools/heavy.sh node tests/qa-tour.mjs`: QA OK.
- `tools/heavy.sh node unternehmen/sprint-3-gta/work/menschen/perf.mjs` (Spawnposition, 40 Passanten alle Human-Modelle): Draw Calls 192 mit Passanten, 185 ohne, also ca. 7 Calls für Passanten im Sichtfeld; Update der Passanten ca. 0,09 ms pro Frame (Chromium-SwiftShader). Ragdoll-Kosten nur für höchstens 8 Körper. Gesamtwert schwankt je nach Frame und Autos (177-250 in verschiedenen Läufen), die Passanten-Zahl ist nicht der Treiber.
- Konsole in `t1-shots.mjs` ohne Fehler, nur Three-Deprecation-Warnungen aus der Basis.
- Alle Skripte starten Vite mit `hmr: false, watch: null`.

## Screenshots (in diesem Ordner)
- `01-spieler-nah.png`: Spielerfigur nah (Idle). `01b-spieler-laeuft.png`: Lauf-Animation.
- `02-gruppe.png`: Gruppe von acht Passanten mit Männern und Frauen in verschiedenen Outfits, im Gehen.
- `03-ragdoll-a.png` bis `03-ragdoll-c.png`: Ragdoll-Moment (Körper fliegt nach dem Treffer, schlägt auf, rutscht), `03-ragdoll-liegt.png` / `03-ragdoll-oben.png` / `03-ragdoll-schraeg.png`: Körper liegt, daneben Blutspritzer.
- `04-treffer-reaktion.png`: Treffer ohne Tod (Zucken, Blutpunkte).
- `05-spieler-zielt.png`: Pistolen-Haltung, `05b-spieler-zielt-zweihand.png` und `05c-...-links.png`: Zweihand-Haltung ('rifle').
- `06-polizist.png`: Polizist mit Mütze. `07-fallback-sterbeanimation.png`: Sterbe-Animation ohne Ragdoll.
- Skripte: `t1-shots.mjs` (Screenshots), `perf.mjs` (Draw Calls), `clips.mjs` (Clip-Betrachter, z. B. `death`).

## Was offen ist / Hinweise
- Blutlache ist ein Quad; in `03-*`-Bildern wächst sie erst über ca. 3 s und ist auf den Standbildern klein oder von der Leiche verdeckt.
- Ragdoll hat nur eine grobe Gelenkgrenze (Minimalabstände), keine Winkelgrenzen der Hüfte; Körper kann sich leicht verdrehen.
- Schultern/Torso sind ein ebenes Viereck, Verdrehen um die Körperachse ist begrenzt.
- Bei der Spielerfigur wurde das Auto-Einsteigen nicht animiert (siehe oben).
- Lizenz-Hinweis: die Poly-Pizza-Seite nennt für einige verwandte Quaternius-Modelle (Worker, Suit, Zombie, Wizard) CC-BY 3.0; diese wurden NICHT verwendet.

## Runde 2
- Blocker Leiche im Gehweg: Ursache war der feste Boden y = 0 (Gehweg 0,18, Straße 0,21). Neu `src/characters/surface.js` mit `surfaceY(x, z)` = `world.groundAt` + 0,19 m innerhalb des Stadtrasters (gleiche Regel wie in City.js für Props), außerhalb nur `groundAt` (Strand, Pier), Wasser = -0,5. Ragdoll-Boden, Blutlache und Spritzer nutzen es pro Partikel. Belege: `03-ragdoll-liegt.png`, `03-ragdoll-seite-nah.png` (ca. 3 m seitlich, ganzer Körper und Lache sichtbar), `03-ragdoll-oben.png`.
- Füße im Boden (Spieler und Passanten): behoben mit demselben `surfaceY` als visueller Offset auf `human.model.position.y` (Spiellogik bleibt bei y = groundAt, `ped.position`/Hit-Test unverändert). `01-spieler-nah.png` und `05*.png` neu, die Schuhe stehen auf dem Gehweg.
- Explosionen: `Pedestrians` abonniert das Event `explosion {x,y,z,radius,source}` und merkt sich die letzte Explosion. Bei Tod innerhalb von 0,3 s und 1,3 x Radius geht der Impuls vom Zentrum weg, Horizontalgeschwindigkeit 6 bis 20 m/s und Aufwärts 4 bis 10 m/s, je näher desto stärker. Bei `source: 'explosion'` ohne Event (Autowrack, Hubschrauber) wird das nächste frisch explodierte Fahrzeug (`burnT > 15`) als Zentrum genommen. Beleg: `08-explosion-a/b.png` (6 Passanten um den Einschlag, 5 tot und weggeschleudert, Ausgabe der Abstände im Testlauf).
- Autounfall: `peds.kill(..., vx, vy, vz)` mit 11 m/s getestet, `09-autounfall-a/b.png`.
- Winkelgrenzen: Knie biegen nur nach vorn, Ellbogen nur zur Gegenseite (Hinge-Constraint relativ zur Körpervorderseite im Torso-Raum). Hüfte: Mindestabstand Knie-Schulter (Oberschenkel kann nicht auf die Brust klappen) plus bestehende Hüfte-Kopf-Grenze. Kopf: Mindestabstand zur Hüfte, der Hals ist über feste Längen an beide Schultern gebunden. Echte Kegel-/Twist-Grenzen für Hüfte und Hals bleiben offen.
- Rohdateien: `animhuman`, `animwoman`, `business`, `casual`, `charanim` aus `tools/assets-src/polypizza-quaternius/` gelöscht. Übrig sind nur die 7 benutzten, alle in `CREDITS.md`.
- `for..of` in `Ragdoll.step` durch Index-Schleife ersetzt.
- Pinker Fleck in `work/waffen/shots/hold-rifle.png`: Das war nicht die Blutlache, sondern der Rest einer im Gehweg versunkenen Leiche (rosa Kleid/Shirt, nur ein Zipfel über der Platte). Mit dem Boden-Fix behoben. Zusätzlich ist das Blut jetzt dunkelrot (`#5c0910`, Textur mit unregelmäßigem Rand und Spritzern, zufällig gedehnt und gedreht) statt einfarbiger Kreis.
- Tests: `npm run build` ok, `tools/heavy.sh npm run smoke` SMOKE OK, `tools/heavy.sh node tests/qa-tour.mjs` QA OK. Skript `t1-shots.mjs` erzeugt alle Bilder.
- Hinweis A4: `src/player/Character.js` (T1-Datei) ruft `surfaceY` auf; keine anderen fremden Dateien geändert.
