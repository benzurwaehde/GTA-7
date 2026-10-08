# BRIEF – Sprint 3 „Mehr GTA“

Projekt: `~/Developer/GTA-7`, Branch `sprint-2-rund`. Nicht committen, das macht der Chef.
Pflichtlektüre: `company/ARCHITECTURE.md` (API-Vertrag) und `README.md`.

## Ziel
Der Nutzer wünscht sich zwei Dinge:
1. Die **Menschen** sollen realistischer aussehen. Beim Anschießen sollen sie **wie in GTA umfallen**.
2. Es soll ein **Waffenrad** und einen **Waffenladen** („Ammu-Nation“-artig, aber mit eigenem Namen) geben, in dem man neue Waffen kauft.

## Neue Kern-Schnittstellen (vom Chef eingebaut)
- `game.timeScale` (Standard 1) skaliert die Spielzeit, zum Beispiel 0.25 für Zeitlupe. `game.realDt` ist die ungeskalierte Frame-Zeit für UI.
- Weiterhin gelten `getModel(name)` und `hasModel(name)` aus `src/core/assets.js`, Modellnamen stehen in `src/core/modelList.js` (diese Datei dürfen beide Teams erweitern).
- Mit `getModelAnimations(name)` bekommst du die AnimationClips eines GLB.

## Lizenz- und Asset-Regeln (Pflicht)
- Assets aus dem Internet sind jetzt erlaubt, aber **nur mit CC0** (bevorzugt) **oder CC-BY** und Namensnennung. Bevorzugte Quellen: Quaternius (CC0), Poly Pizza (CC0-Filter), Kenney (CC0), Poly Haven (CC0).
- Verboten sind Assets aus GTA oder anderen kommerziellen Spielen, „Ripped“-Modelle, Mixamo-Rohdaten und alles ohne klare Lizenz.
- Jedes Fremd-Asset kommt in `CREDITS.md` im Projektstamm: Name, Autor, Quelle (URL), Lizenz, Datum.
- Lade herunter nur in einen eigenen leeren Ordner, etwa `tools/assets-src/<name>/`. Fremde Skripte aus Downloads führst du nicht aus.
- GLBs landen in `public/models/`. Bearbeitet (Skalierung, Retarget, Materialien, Kompression) wird reproduzierbar per Blender-Skript in `tools/blender/`, mit `blender -b --factory-startup --python ...`.
- Budget: Ein Charakter-GLB ist höchstens ca. 1,5 MB groß und hat höchstens ca. 6 000 Dreiecke, Passanten sind skinned.

## Vertrag zwischen den Teams
- T1 liefert `game.player.character.rightHand`, ein Object3D am Handgelenk bzw. Hand-Bone des Spielers, Vorne = Blickrichtung der Hand. Außerdem `character.setPose('aim'|'idle'|...)`, falls der Zielmodus eine eigene Pose braucht.
- T2 hängt das Waffenmodell an `rightHand`. Fehlt es, gilt die bisherige Darstellung als Fallback.
- Fremde Methoden immer defensiv aufrufen (`?.`).

## Teilaufgaben (parallel, getrennte Ordner)

### T1 `menschen` – Agent `agent-code`
Ordner: neu `src/characters/`, `src/npc/PedModel.js`, `src/npc/Pedestrians.js` (nur Darstellung, Tod und Treffer), `src/player/Character.js`, `tools/blender/human_*.py`, `tools/assets-src/`, `public/models/human_*.glb`, `CREDITS.md`.
1. **Menschen-Modelle:** Such passende CC0-Charaktere (realistische Proportionen, Low-Poly-Stil passend zum Spiel, mit Skelett) und wähl sie aus. Gebraucht werden mindestens 4 Passanten-Varianten, ein Polizist und eine Spielerfigur. Eine farbliche Variation per Material ist erlaubt. Gibt es keine brauchbaren CC0-Modelle, modellier und rigge selbst in Blender per Skript. Dokumentier die Entscheidung in `uebergabe.md`.
2. **Animationen:** idle, gehen, rennen, fliehen bzw. panisch rennen, schlagen, Treffer-Reaktion, mindestens 2 Sterbe-Animationen. Für den Spieler zusätzlich springen, zielen (Oberkörper Richtung Kamera) und in ein Auto einsteigen, wenn das möglich ist. Nutz `AnimationMixer` mit Überblendung.
3. **Umfallen wie in GTA:** Beim Tod gibt es einen **Ragdoll**. Verlet-Partikel auf den Haupt-Bones (Becken, Wirbelsäule, Kopf, Ober- und Unterarme, Ober- und Unterschenkel) mit Längen- und einfachen Winkelgrenzen. Der Körper bekommt einen Impuls in Schussrichtung bzw. vom Auto, kollidiert mit Boden und Gebäuden und kommt zur Ruhe. Keine externe Physik-Bibliothek. Fallback ist eine Sterbe-Animation passend zur Trefferrichtung. Höchstens ca. 8 aktive Ragdolls gleichzeitig, danach einfrieren.
4. **Treffer-Feedback:** Blutspritzer als Partikel und Blutlache unter Leichen (Decal oder Quad, verblasst). Dazu ein kurzes Zusammenzucken (Hit-Reaction) bei nicht tödlichen Treffern.
5. **Integration:** Passanten, Polizisten und Spieler nutzen die neuen Modelle. Die API `buildPedMesh(kind)` und `releasePedMesh(mesh)` bleibt kompatibel. `hitTest` passt zur neuen Figur. Leistung: 40 Passanten bleiben flüssig. Nutze Skinned-Mesh-Instanzierung oder LOD: Ab ca. 50 m reicht eine einfache Animation mit niedrigerer Update-Rate.
6. Bei fehlenden GLBs bleiben die prozeduralen Figuren als Fallback.

### T2 `waffen` – Agent `agent-code`
Ordner: `src/player/Weapons.js`, `src/player/Player.js`, `src/player/CameraRig.js`, neu `src/ui/WeaponWheel.js`, neu `src/shop/`, `src/audio/sfx.js` (nur neue Sounds ergänzen), `tools/blender/weapon_*.py`, `public/models/weapon_*.glb`. `src/main.js` darfst du nur ändern, um neue Systeme zu registrieren.
1. **Neue Waffen:**
   - Schrotflinte: mehrere Schrotkugeln, kurze Reichweite, starker Rückstoß.
   - Sturmgewehr: automatisch, präzise.
   - Scharfschützengewehr: Zielfernrohr-Zoom mit rechter Maustaste und Overlay, ein Schuss tötet.
   - Granaten: Wurf im Bogen, abprallen, Zündzeit, Explosion über `game.vehicles?.effects?.explosion` plus Schaden an Passanten, Autos und Spieler.
   - Jede Waffe hat Magazin, Reserve, Nachladen und einen eigenen Sound.
   - Der Spieler startet weiterhin mit Fäusten und Pistole, alles andere gibt es im Laden.
2. **Waffenmodelle:** Low-Poly-Modelle per Blender-Skript (Pistole, SMG, Schrotflinte, Sturmgewehr, Scharfschützengewehr, Granate) als GLB, getragen an `character.rightHand` (Fallback, falls das fehlt).
3. **Waffenrad:** Die Tab-Taste gedrückt halten öffnet ein Radialmenü mit Icons, Name und Munition je Waffe. Die Maus wählt die Richtung, die Zeitlupe läuft über `game.timeScale = 0.25`, Loslassen wechselt die Waffe. Nicht besessene Waffen sind ausgegraut. Mausrad und Q/E funktionieren weiter.
4. **Waffenladen** (eigener Name, z. B. „Bullseye Arms“):
   - Ein Laden in der Stadt mit Schild und Eingangsmarker. Platziere ihn selbst an einer freien Ladenfront bzw. einem Gebäude-Erdgeschoss nahe einer Straße, ohne Welt-Code zu ändern. Eigene Meshes in `src/shop/` sind erlaubt.
   - Minimap-Blip über `getBlips()`.
   - Am Marker öffnet ein Kaufmenü (Pause oder Zeitlupe): Waffen kaufen, Munition nachkaufen, Schutzweste. Preise sind gestaffelt und werden mit `game.state.money` bezahlt (dazu `money:changed`).
   - Besitz und Munition werden über `game.save` gespeichert. Erweitere dafür die Speicherdaten defensiv mit einem eigenen Schlüssel oder über Events, ohne Save.js umzubauen. Geht das nicht ohne Änderung an Save.js, beschreib die minimale Änderung in `uebergabe.md`.
5. **Treffer an der Umgebung:** Einschusslöcher und Funken an Wänden und Boden (Pool, verblasst). Das Mündungsfeuer passt zur Waffe.
6. **Zielmodus-Kamera:** Die Figur steht weiter links im Bild, damit das Fadenkreuz frei ist (Backlog-Punkt aus Sprint 2).

## Akzeptanzkriterien (für beide Teams)
- A1: `npm run build` läuft fehlerfrei.
- A2: `tools/heavy.sh npm run smoke` gibt SMOKE OK, `tools/heavy.sh node tests/qa-tour.mjs` gibt QA OK.
- A3: Jeder nummerierte Punkt ist umgesetzt oder in `uebergabe.md` begründet als offen markiert.
- A4: Nur die eigenen Ordner geändert.
- A5: Aufrufe in andere Systeme sind defensiv. Der eigene Teil funktioniert auch ohne die Lieferung des anderen Teams.
- A6: Die Performance bleibt flüssig. Keine Allokationen pro Frame in heißen Schleifen. Draw Calls an fester Messposition dokumentiert (Smoke-Wert vorher ca. 190).
- A7: Mindestens 3 aussagekräftige Screenshots im Arbeitsordner, in `uebergabe.md` beschrieben. T1 zeigt eine Figur nah, eine Gruppe Passanten und einen Ragdoll-Moment. T2 zeigt Waffenrad, Laden-Menü und eine Waffe in der Hand.
- A8: Neue APIs stehen in `uebergabe.md` unter „API“. `company/ARCHITECTURE.md` nicht direkt ändern.
- A9: Lizenzen sind dokumentiert (`CREDITS.md`), keine verbotenen Assets.
- A10: Kein Commit, kein Push.

## Randbedingungen
- Schwere Jobs (Playwright, Blender) laufen nur über `tools/heavy.sh <befehl>`, höchstens 2 parallel, sonst überhitzt der Mac des Nutzers. Erlaubt sind diese Formen: `tools/heavy.sh npm run smoke`, `tools/heavy.sh node tests/<datei>`, `tools/heavy.sh node unternehmen/sprint-3-gta/work/<team>/<datei>`, `tools/heavy.sh blender -b ...`.
- Testskripte starten Vite mit `server: { hmr: false, watch: null }`, weil das andere Team parallel Dateien ändert.
- Sprache der Übergaben: Deutsch. Code-Kommentare: Englisch.

---

## Nachtrag: Allgemeine Verbesserungen (T3, T4)
Der Nutzer wünscht sich, dass das Unternehmen selbst sucht, was besser werden kann. Es gelten dieselben Akzeptanzkriterien A1–A10 und dieselben Asset- und Lizenzregeln wie oben. Die Ordner sind strikt getrennt von T1 und T2.

### T3 `stadt` – Agent `agent-code`
Ordner: `src/world/`, `tools/blender/prop_*.py` bzw. `building_*.py`, `public/models/prop_*.glb`. CC0-Assets von Poly Haven sind erlaubt (Blender-MCP ist verbunden, `search_assets` und `import_asset` für Poly Haven sind AN, siehe unten).
1. **Wasser und Küste:** Animierte Wellen per Shader (Vertex-Displacement oder Normal-Scroll in zwei Richtungen), Schaum an der Küstenlinie, ein Spiegel- bzw. Fresnel-Effekt und Farbwechsel bei Tag und Nacht.
2. **Hafen in Marlin Pier (Süden):** ein Holzsteg ins Meer, ein paar Boote als Deko (Low-Poly per Blender-Skript oder CC0), Container und Kräne. Begehbar mit Collidern.
3. **Abwechslungsreichere Gebäude:**
   - Dachdetails: Klimaanlagen, Wassertanks, Antennen, Dachränder, instanziert.
   - Mindestens 3 Landmarken: zum Beispiel ein markanter Wolkenkratzer mit Spitze downtown, ein Riesenrad oder eine Strandpromenade mit Leuchtturm sowie ein Stadion oder Park-Pavillon.
   - Mehr Fassadenvarianten (Farben, Fensterraster) in den Randbezirken.
4. **Kleinigkeiten:** Laternenmasten bekommen kleine Collider. Die Hochhausfenster bekommen nachts mehr Helligkeitsvariation, damit sie nicht flächig weiß wirken (Backlog).
5. Budget: höchstens +40 Draw Calls insgesamt, Instancing bzw. Merge.

### T4 `fahrzeuge` – Agent `agent-code`
Ordner: `src/vehicles/`, `src/police/Police.js`, `tools/blender/car_*.py` bzw. `vehicle_*.py`, `public/models/car_*.glb` bzw. `vehicle_*.glb`, dazu `src/core/modelList.js` (nur Einträge ergänzen).
1. **Neue Fahrzeugtypen** (Blender-Skript wie die bisherigen Autos): ein Bus bzw. Van für Verkehr und Parkplätze, ein Motorrad mit eigener Fahrphysik (Neigung in Kurven, Fahrer sichtbar – Fallback einfache Figur, falls T1 noch nicht fertig ist), ein Sportwagen-Variant bzw. Muscle-Car. Sie sind in den Verkehr und das Spawn-System integriert und über `spawn(type, ...)` erreichbar.
2. **Schadensbild:** Ab bestimmten Schwellen gibt es Delle bzw. Verformung (Vertex-Offset oder Wechsel auf ein beschädigtes Material), Rauch aus der Motorhaube, zerbrochene Scheiben und am Ende ein ausgebranntes, schwarz verkohltes Wrack. Die Explosionstrümmer sind verkohlte Teile in Lackfarbe statt roter Würfel (Backlog).
3. **Polizei-Hubschrauber bei 5 Sternen:** Low-Poly-Modell per Blender, rotierender Rotor, Suchscheinwerfer (ein SpotLight oder ein Lichtkegel-Mesh), folgt dem Spieler in der Luft und beschießt ihn. Er kann abgeschossen werden (Treffer per Ray gegen eine Kugel bzw. Kapsel) und stürzt dann ab und explodiert.
4. **Verkehr reagiert auf Sirenen:** NPC-Autos machen Platz bzw. fahren rechts ran, wenn ein Polizeiauto mit Sirene von hinten kommt.
5. Die Allokationen aus dem Backlog (`VehicleManager carVsCar`, `[-1,1]`-Arrays, `Police._evasion` bzw. `_updateCars`) werden entfernt.

Hinweis zur Zusammenarbeit: T2 (Waffen) ruft für Granaten `game.vehicles?.effects?.explosion(x,y,z)` auf. Die Signatur bleibt also stabil. Treffer am Hubschrauber werden über `game.police.helicopter?.hit?.(point, dmg)` gemeldet. Ruf das von T4 aus bereit und dokumentier es unter API. T2 bindet es defensiv an, falls es da ist.
