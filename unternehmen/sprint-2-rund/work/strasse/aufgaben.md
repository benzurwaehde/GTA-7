# Aufgaben T5 `strasse` (Nacharbeit, Pflicht)

Alle Läufe über `tools/heavy.sh node unternehmen/sprint-2-rund/work/strasse/<datei>`. Zeilennummern in Police.js geprüft, sie stimmen mit dem Feedback überein (Stand vor deiner Änderung; danach verschieben sie sich).

## 1. Straßensperre zuverlässig machen
Befund beim Prüfen: `this.noCars` wird nie zurückgesetzt (nur Z.75 auf false, gesetzt in Z.297, 301, 466). Schlägt ein einziger `vehicles.spawn` fehl, ist `_roadblock` wegen Z.448 (`|| this.noCars`) für den Rest der Partie tot. Zweite stille Abbruchstelle: Z.459 (`Math.abs(a) > CITY.half - 15` mit `return`) und Z.472 (`cars.length < 2`).

Zu ändern in `src/police/Police.js`, Methode `_roadblock` (Z.436-475):
- a) Die Sperre darf nicht von `this.noCars` abhängen. Entweder Z.448 ohne `noCars` prüfen und Z.466 kein `noCars` mehr setzen, oder `noCars` nach kurzer Zeit (z. B. 5 s) wieder auf false setzen. Eigene Sperr-Wagen spawnen (wie bisher über `g.vehicles.spawn`), nicht fremde Wagen abziehen.
- b) Schlägt das Spawnen eines der 2 Wagen fehl (Z.466/472), die schon gespawnten entfernen und in der nächsten Runde (`blockT`, höchstens 1-2 s) erneut versuchen. Kein dauerhaftes Aufgeben.
- c) Z.459: Liegt `a` zu nah am Kartenrand, `a` auf den Rand begrenzen oder die Gegenrichtung/Querachse nutzen, statt still zurückzukehren.
- d) Ursache im Code-Kommentar oder in der Übergabe in einem Satz festhalten (welcher der Abbruchzweige in den 2 Fehlläufen griff). Dazu im Test per Log ausgeben, welcher Zweig zuletzt abbrach.

Erledigt-Kriterium: In mindestens 5 von 5 Läufen steht `police.block` (nicht null, 2 Wagen, `block: true`) innerhalb von 10 Spielsekunden nach `setWanted(4)`. Darunter Startpunkt (-148,-120) Blick +Z und (148,-120) Blick +Z, die übrigen drei frei gewählt (z. B. (0,5) Blick +X, (60,200) Blick -Z, (200,-60)). Zusätzlich: ein Lauf, in dem der erste Spawn künstlich scheitert (Stub liefert einmal null), danach entsteht die Sperre trotzdem.
Beleg: neues Skript `unternehmen/sprint-2-rund/work/strasse/roadblock5.mjs`, Ausgabe je Lauf: Startpunkt, Blickrichtung, Zeit bis `block`, Positionen der 2 Wagen, Schluss `ROADBLOCK 5/5 OK`. Ausgabe in `uebergabe.md` einfügen. Außerdem `test.mjs` weiterhin `T5 OK`.

## 2. Pro-Frame-Allokationen in Police.js entfernen (A6)
Zu ändern in `src/police/Police.js` (Zeilen wie im Feedback, geprüft):
- Z.81/202-203: `pPrev` als zwei Zahlen (`pPrevX`, `pPrevZ`, plus Flag) statt neues Objekt je Frame.
- Z.206-207: `this.cops.filter` / `this.cars.filter` durch In-place-Kompaktierung (Schleife mit Schreibindex, `length` kürzen) ersetzen.
- Z.231: `this.cars.filter(...).length` durch Zählschleife ersetzen.
- Z.243, Z.247: `this.cops.slice()` / `this.cars.slice()` durch Rückwärtsschleife (`for (let i = len-1; i >= 0; i--)`) ersetzen, wenn dabei entfernt wird. Die Aufräum-Stellen Z.318/319 und Z.618/624 sind nicht pro Frame, nur ändern, wenn es dieselbe Schleife betrifft.
- Z.439: `B.cars.filter(...)` durch Zählschleife über `B.cars` ersetzen (nur Anzahl und lebende Einträge nötig, kein neues Array; für das Entfernen in Z.443 direkt über `B.cars` iterieren).
- Z.490/495: Closures `moveTo` und `chase` in `_updateCop` zu Methoden bzw. Funktionen außerhalb machen. Ergebnisse (`vx`, `vz`) über Felder auf `ai` oder ein wiederverwendetes Objekt der Klasse (`this._mv`) übergeben, keine neuen Funktionsobjekte je Aufruf.
- Nicht verlangt: `roadPath` (Z.352), läuft nur alle 1,2 s.

Erledigt-Kriterium: In `Police.js` kommt im Pfad `update` / `_spawnLogic` / `_roadblock` (laufend) / `_updateCop` / `_updateCar` kein `.filter(`, `.slice(`, `= { x`-Objektliteral für `pPrev` und kein `=> ` bzw. `const ... = (` Closure je Frame mehr vor. Prüfbar mit `Grep` auf `\.filter\(|\.slice\(|pPrev = \{` (Treffer nur noch außerhalb der Frame-Pfade, z. B. Z.139 `kills`, Aufräumfunktionen). Verhalten unverändert.
Beleg: Grep-Ausgabe in `uebergabe.md`, dazu ein Lauf von `tools/heavy.sh npm run smoke` (`SMOKE OK`) und `test.mjs` (`T5 OK`). Optional, aber erwünscht: Messlauf `alloc.mjs`, der 600 Frames `police.update` bei Wanted 4 mit Cops und Autos aufruft und `process.memoryUsage().heapUsed` vor/nach vergleicht (Ziel: Zuwachs unter 200 KB nach `global.gc()`-freiem Lauf bzw. deutlich unter dem Wert vor der Änderung, beide Zahlen angeben).

## 3. Ausweichen der Polizei vor Verkehr belegen
Kein Codeumbau, sondern Messung (Fehler im Code nur beheben, wenn die Messung ihn zeigt, und das dokumentieren).
Neues Skript `unternehmen/sprint-2-rund/work/strasse/dodge.mjs`:
- Aufbau: gerade Straße, Streifenwagen (Entry in `police.cars`, Wanted 2+, Spieler >65 m entfernt vorn) fährt hinter einem NPC-Auto, das in derselben Spur langsam fährt (ca. 4-6 m/s, Streifenwagen schneller als der NPC). Alternativ NPC-Auto stehend in der Spur.
- Messung je Frame/Sample: Abstand Streifenwagen zu NPC-Auto, seitlicher Versatz des Streifenwagens zur Fahrspur, Geschwindigkeit.

Erledigt-Kriterium: Über den ganzen Lauf (mindestens 10 Spielsekunden, mindestens 2 Läufe: NPC fährt langsam und NPC steht) gilt: kein Auffahren (Abstand Fahrzeugmitten nie unter der Summe der halben Fahrzeuglängen, bzw. keine Kollision gemeldet) UND mindestens eines von: seitlicher Versatz > 1,5 m beim Passieren, oder Geschwindigkeit sinkt unter 60 % der Ausgangsgeschwindigkeit bei Abstand < 15 m. Ein Kontrolllauf ohne Ausweichlogik (oder mit NPC weit weg) zeigt zum Vergleich Versatz/Geschwindigkeit.
Beleg: Ausgabe von `tools/heavy.sh node unternehmen/sprint-2-rund/work/strasse/dodge.mjs` mit Tabelle (Zeit, Abstand, Versatz, Tempo) für beide Läufe und Schlusszeile `DODGE OK`. Ausgabe in `uebergabe.md` einfügen.

## Abschluss
- `uebergabe.md` aktualisieren: Abschnitt „Offen / Hinweise“ anpassen (Ausweichen jetzt gemessen, Sperre Ursache und Fix).
- Nur in `src/police/` (und Tests im Aufgabenordner) ändern. Kein Commit.
- Die Punkte „Für später“ (Sperre leitet NPC-Verkehr um, Arme/Beine ab 60 m) nicht bearbeiten.
