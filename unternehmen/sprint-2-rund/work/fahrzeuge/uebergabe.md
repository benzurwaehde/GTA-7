# Übergabe T1 `fahrzeuge`

## Was gebaut wurde
1. **Blender-Autos** (`tools/blender/car_lib.py` plus `car_sedan.py`, `car_sports.py`, `car_truck.py`, `car_taxi.py`, `car_police.py`; Vorschau-Renderer `car_preview.py`). Karosserie aus Querschnitt-Lofts (Superellipsen), dazu abgeschrägte Hauben und Scheiben, Dach und Säulen, Stoßstangen, Grill, Radkästen, Spiegel, Scheinwerfer und Rücklichter. Spoiler beim Sports, Ladefläche beim Truck, Dachschild beim Taxi, Lichtbalken und Schwarz/Weiß-Lackierung bei der Polizei. Die Räder sind echte Zylinder mit Reifen, Felge und Nabe, ohne „X“.
   - Wheels heißen `wheel_FL/FR/RL/RR`. Materialien: `Paint`, `Glass`, `Trim`, `Rim`, `Headlight`, `Taillight`, und bei der Polizei `Siren_Red`/`Siren_Blue`. Das sind höchstens 6 pro Auto. Bei der Polizei dient `Siren_Red` auch für die Rücklichter (Objektname `taillight`), und die Felgen sind weiß (`Paint`).
   - Maßstab Meter, vorne +Z, Boden y=0 (in Blender zeigt die Front nach -Y). Die Größen entsprechen `SPECS`.
   - Neu erzeugen: `tools/heavy.sh blender -b --factory-startup --python tools/blender/car_<typ>.py` schreibt `public/models/car_<typ>.glb`. Je GLB ca. 100 bis 150 KB.
2. **`models.js`** lädt per `getModel('car_<typ>')`. Beim ersten Auto eines Typs wird das GLB zu 5 Geometrien verschmolzen (Body, Head, Tail, Vorder- und Hinterachse, bei der Polizei plus 2 Sirenen). Dadurch bleibt es bei **5 Draw Calls pro Auto** wie vorher. Die Farbe steckt in Vertex-Colors, `Paint` wird pro Auto umgefärbt. Rad-Rotation und Lenkung laufen unverändert. Fehlt ein GLB, greift das prozedurale Modell als Fallback.
3. **Nachtlicht**:
   - `setCarNight(f)` in `models.js` färbt die gemeinsamen Lampen-Materialien um (Scheinwerfer, Rücklicht, Bremslicht heller).
   - Nur gefahrene Autos leuchten. Geparkte Autos nutzen `headIdle`/`tailIdle`.
   - Das Spielerauto hat einen echten `SpotLight`-Kegel (`VehicleManager.headSpot`). Er ist immer in der Szene und hat tagsüber Intensität 0, damit sich die Shader nicht neu kompilieren.
   - NPC-Autos bekommen zwei additive Lichtflecke auf der Straße (Scheinwerfer, Rücklicht, beim Bremsen heller). Das sind Instanzen eines einzigen InstancedMesh, also ein Draw Call. Es gibt keine SpotLights für NPCs.
4. **Explosion** (`effects.js`, komplett neu):
   - Weiche Billboard-Partikel mit Canvas-Gradient-Sprites (Instanced Shader, ein Draw Call für Rauch und einer für Feuer).
   - Heller Kern, Feuerball, Trümmerbrocken (InstancedMesh mit Bodenaufprall), kurzer PointLight-Blitz (ein gepoolter Light, Intensität 0 im Ruhezustand), Rauchsäule mit Pilzkappe.
   - Die Brandpartikel `smokePuff`/`firePuff` nutzen dasselbe System.
5. **Reifenspuren**: Pool aus 360 Quads (ein Draw Call, Multiply-Blending). Sie entstehen bei Drift (seitlicher Schlupf), Handbremse und harter Bremsung an den Hinterrädern, nur nahe beim Spieler. Sie verblassen in ca. 28 s.
6. **Ampeln im NPC-Verkehr** (`traffic.js`): Nutzt `game.world?.signalAt?.(ix, iz, 'ns'|'ew')` für die nächste Kreuzung. Bei Rot oder Gelb bremsen die Autos weich bis zur Haltelinie (Gelb nur, wenn sie noch halten können). Autos über der Linie fahren weiter. Ohne `signalAt` gilt das alte Verhalten. Fliehende Autos ignorieren Ampeln.
7. **Treffer-Reaktion**: Ein NPC-Wagen, den Spieler oder Polizei mit Aufprall > 3.5 rammen, hupt (3 s Cooldown). Bei Aufprall > 8 flieht er 5 s mit 1.75-fachem Tempo (`ai.fleeT`).

## API (für ARCHITECTURE.md)
- Neue interne Felder: `vehicle.ai.fleeT` (s), `vehicle.ai.hitHonkCd`.
- `game.vehicles.effects`: `explosion(x,y,z)`, `smokePuff`, `firePuff`, `skid(x,z,dir,len,dark)`, `setNight(f)`. `game.vehicles.effects.pools` sind die Straßen-Lichtflecke.
- `game.vehicles.headSpot` ist der SpotLight des Spielerautos.
- `models.js` exportiert zusätzlich `setCarNight(f)`.
- `Vehicle.model.zr` ist die z-Position der Hinterachse.
- Keine Änderungen an bestehenden Methoden. Es wurden keine Dateien außerhalb meines Bereichs geändert. `src/core/modelList.js` enthielt die car_*-Namen bereits.

## Tests (alle über `tools/heavy.sh`)
- `npm run build`: ok.
- `npm run smoke`: `SMOKE OK`. In der Messung waren es 380 Draw Calls, 50 Fahrzeuge. Das ist der Gesamtwert über alle Teams. Mein Anteil ist ca. 6 zusätzliche Calls für die Effekt-Pools.
- `node tests/qa-tour.mjs`: `QA OK`.
- `signal-test.mjs`: mit einem Mock-`signalAt` hält ein NPC-Sedan bei Rot ca. 12.6 m vor der Kreuzungsmitte (Geschwindigkeit 0) und fährt bei Grün wieder an. Ausgabe `SIGNAL OK`. Es wurde nur mit dem Mock getestet, nicht mit dem echten `signalAt` von T3.

## Belege (A7)
Im Ordner `shots/` (Skript `shots.mjs`):
- `shots/lineup-day.png` und `shots/closeup-sedan.png` zeigen die fünf Autos tagsüber (Sedan, Sports, Truck, Taxi, Police).
- `shots/closeup-police-taxi.png` zeigt Truck und Taxi in der Nahaufnahme. Zu sehen sind runde Räder mit Felgen, Radkästen und Spiegel.
- `shots/lineup-night.png` und `shots/closeup-night.png` zeigen Nachtlicht und rote Lichtflecke.
- `shots/night-drive-spot.png` zeigt das Spielerauto mit Lichtkegel nachts.
- `shots/skids-top.png` zeigt Reifenspuren nach einem Drift.
- `shots/explosion-0` bis `-3.png` und `explosion-night-0`/`-1.png` zeigen die Explosion mit Feuerball, Trümmern und Rauchpilz, auch nachts mit Lichtblitz.
- `blender/car_*_front|rear|side.png` sind die Blender-Renders der Modelle. In den Renders sind sie rot, weil `Paint` dort Rot ist. Im Spiel wird umgefärbt.

## Offen / Hinweise
- Reifenspuren: `skids-top.png` (aktueller Stand) zeigt durchgehende Doppelspuren nach dem Drift. Das Spielerauto im Bild ist lila, weil `Paint` pro Auto zufällig umgefärbt wird.
- **Schwarzes Band in `explosion-*.png`**: Im Bild verläuft ein großes schwarzes Band über den Rasen. Es steht auch in Läufen ohne meine Effekte an derselben Stelle. Ich halte es für einen Schatten-Artefakt der neuen Ampelmasten (T3). Das ist nicht überprüft. Bitte bei T3 gegenchecken.
- Das Rad-Merging fasst je ein Radpaar zu einem Mesh zusammen (Draw-Call-Budget). Ein einzelnes Rad lässt sich im Spiel deshalb nicht separat lenken. Das ist ohnehin nur an der Vorderachse nötig und funktioniert paarweise.
- Rauch-Billboards ignorieren den Nebel (Rauch wird nachts per Tint abgedunkelt).
- Die Polizei hat keine Siren-Lichtflecke auf der Straße.
- Taxi-Dachschild nutzt das Material `Headlight`. Es wird nachts hell, tagsüber blass.
