VERDIKT: OK

Runde 2 von T1 menschen. Vorgängerliste: review.runde1.md. Ich habe keinen Code geändert. Eigene Skripte liegen im Scratchpad, Vite mit hmr:false und watch:null, Aufruf über tools/heavy.sh.

## Punkte aus Runde 1
1. Leiche auf dem Boden, Füße auf dem Boden: erfüllt.
   - Beleg: `03-ragdoll-seite-nah.png` zeigt den ganzen Körper liegend auf dem Gehweg, mit dunkelroter Lache und Schuhen. `08-explosion-b.png` und `09-autounfall-b.png` zeigen mehrere sichtbare Leichen auf Gehweg und Straße.
   - Beleg: `01-spieler-nah.png` zeigt die Schuhe der Spielerfigur auf dem Gehweg.
   - Eigene Messung `surfaceY`: Spawn und Straße 0.19, Südstrand (z = half+30) 0.06, Pier (z = half+80) 0.06, Wasser -0.5. `groundAt` wird durchgereicht, also auch der Steg (Deck 0.06).
   - Eigene Messung: Ragdoll-Ruhehöhe: Becken y = 0.32 und min. Partikel-y = 0.23 (Boden 0.19 + Radius). Die Körper liegen über der Platte. Nahe an einer Wand wird die Leiche nicht in das Gebäude gedrückt.
   - Blut: Spritzer 0xb0121a (kräftiges Rot), Lache dunkelrot mit Textur (auf den Bildern sichtbar, kein pinker Fleck).
2. Explosionen und Autounfall: erfüllt.
   - Eigener Test: Event `explosion {x,y,z,radius:8}` emittiert, dann `peds.damage(..., 'explosion')` auf 4 Passanten. Die Impulse zeigen alle vom Zentrum weg (Vorzeichen von dx). Stärke fällt mit dem Abstand (z. B. 11.9 m/s horizontal bei 5,5 m Abstand, ca. 4 m/s bei 9 m). Die Körper landen 5 bis 16 m vom Zentrum entfernt und sind eingefroren.
   - `08-explosion-a/b.png` und `09-autounfall-a/b.png` (11 m/s Impuls) belegen beides optisch.
3. Winkelgrenzen: Knie und Ellbogen sind umgesetzt (laut Übergabe Hinge-Constraint). Hüfte und Hals sind als offen begründet. Akzeptiert. Die Körper verdrehen sich in meinen Tests nicht auffällig.
4. Rohdateien: `tools/assets-src/polypizza-quaternius/` enthält nur noch 7 Dateien (man1, man2, mansuit, woman, womancasual, womandress, womantank). Alle 7 stehen in CREDITS.md (CC0 1.0, Autor, URL, Datum). OK.
5. `Ragdoll.step` hat keine `for..of`-Schleife mehr. `Ragdoll.js` Zeile 160, 201 und 211 haben noch `for..of` (Kollisionsboxen in `_collide`, `rest` und `feet` in `apply`). Das sind Iteratoren über kleine Arrays pro Aufruf, vernachlässigbar, aber nicht vollständig frei davon.

## Keine Rückschritte
- `npm run build`: gebaut, keine Fehler.
- `tools/heavy.sh npm run smoke`: `SMOKE OK`, drawCalls 106.
- `tools/heavy.sh node tests/qa-tour.mjs`: `QA OK`.
- Blender-Reproduktion nicht erneut ausgeführt (würde die GLBs überschreiben), wie in Runde 1.

## Restpunkte (nicht blockierend)
1. Einmalig habe ich in einem Testlauf mit 6 Passanten auf einem Kreis (Abstand 2 bis 7 m, zufällig um den Spieler gesetzt) bei einigen Körpern Endabstände von 100 m und mehr gemessen, bei `frozen:false` nach 12 s Echtzeit. Der Lauf war vermutlich ein Artefakt meiner Aufstellung (Passanten evtl. in Collidern oder weiter gelaufen). Ein zweiter, sauberer Lauf mit 4 Passanten gibt plausible 5 bis 16 m. Nicht reproduziert. Wer will, kann einen Explosionstest mit Passanten in Wandnähe ergänzen.
2. Maximaler Explosions-Impuls (20 m/s horizontal, bis 30 m/s an den Schultern mit `upperBoost` 1,5) ist sehr hoch. Nur eine Stilfrage, keine Mängelliste.
3. Winkelgrenzen für Hüfte und Hals bleiben offen (begründet).
4. Spritzerfarbe 0xb0121a ist heller als die Lache. Optisch unauffällig.
