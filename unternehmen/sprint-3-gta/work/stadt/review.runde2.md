VERDIKT: OK

Runde 2, T3 `stadt`. Geprüft mit eigenen Skripten (Vite hmr:false, watch:null, über tools/heavy.sh) und Screenshots. Halbfertige T1/T2-Änderungen nicht bewertet.

## Punkte
1. API: OK.
   - `isWalkable`: true auf Kai (90,H+36), Steg (0,H+60), T-Kopf (0,H+120), Stegansatz (0,H+8) und Strand (-100,H+30 -> true, -0.53). False im Wasser: (20,H+60), (0,H+140), (-100,H+30.5), Kai-Ausserhalb (90,H+50), Steg-Rand (4.1,H+60).
   - `groundAt`: Land 0, Strand fällt auf -0.53 bei H+30, Steg 0.06, Kai 0.03, Wasser null. `playLimit` = 333.4. Plausibel.
   - Player-Clamp greift schon (`src/player/Player.js:214`). Im Spiel gemessen:
     - Spieler läuft von z=290 über die alte Grenze 302 hinaus.
     - Auf dem Strand endet er bei z=333.3, y=-0.58 (Meer -0.7). Osten ebenso, x=333.3.
     - Den Steg läuft er bis z=428.6 (Ende bei 429).
     - Seitlich bleibt er am Steg: x=-3.6 bei hw=4 (Spielerradius).
     - T-Kopf endet bei x=13.6 (headHW 14).
     - Kai-Wasserkante bei z=348.6 (Kai-Ende 349).
   - Mangel 1 der Runde 1 ist damit behoben.
2. Turm: OK. Baum-Ausschluss ±15 (`City.js:356`), Steinplatz 28x28 (`City.js:351`), Collider ±10.2 (`landmarks.js:46`) bei Flossen bis ±10.0. `tower-plaza-day.png` zeigt keine Bäume im Sockel und keine Wege darunter.
3. Strahl: OK. `lighthouse-night.png` zeigt weichen Verlauf, keine harte Kante oder Ring.
4. Riesenrad: OK. `wheel-night.png` zeigt leuchtende Birnen an Felge und Speichen.
5. Pavillon: OK. `pavilion-day.png` zeigt den Pavillon mittig.
6. Frachtschiff: OK. Eigener Screenshot (Scratchpad `ship-side.png`, `ship-bow.png`, `ship-stern.png`, Tagsüber):
   - Rumpf ist jetzt marineblau mit Wasserlinienstreifen. Er ist nicht mehr schwarz (`ship-day.png` und `ship-night.png` aus der Übergabe zeigen noch den alten, fast schwarzen Rumpf und sind veraltet).
   - Aufbau mit drei Stufen und blaugrauen Fensterbändern, Schornstein mit rot-weiß-schwarzem Band, Reling, Masten, Derricks.
   - Bug ist angeschrägt und gebogen (`ship-bow.png` ist nur aus der Ferne, `ship-bow-day.png` zeigt den Bug).
7. Rückschritte: keine.
   - Wasser, Küstenschaum und Boote unverändert sauber.
   - Hafen-Collider halten den Spieler wie geplant auf Steg und Kai.
   - Draw Calls Spawn-Messung (`shots.mjs`): 120 gegen Basis 80, also +40 am Limit, noch OK. Nord 110, Süd 112.
   - `tools/heavy.sh npm run smoke`: SMOKE OK (drawCalls 160).
   - `landmarks.update` und `harbor.update`: keine `new`/clone pro Frame (nur Modul-Konstante `_dim`).
   - Keine Seitenfehler (pageerror) in den Läufen.

## Mängelliste
Keine Mängel, die ein FEHLER-Verdikt begründen. Hinweise (nicht blockierend):
1. Die Screenshots `ship-day.png`, `ship-bow-day.png` und `ship-night.png` in `work/stadt/shots/` zeigen noch den alten, fast schwarzen Rumpf und verdecken den Aufbau hinter dem Kran. Sie sollten neu erzeugt werden (`tools/heavy.sh node unternehmen/sprint-3-gta/work/stadt/shots.mjs ship`), damit die Doku stimmt.
2. Draw Calls stehen exakt auf dem Limit (+40). Jede weitere Ergänzung in `src/world/` sprengt das Budget.
