# Chef-Feedback T2 Spieler

ABNAHME: JA

## Begründung
- Der Spieler läuft nicht mehr in Autos: 0,40 m Abstand, Screenshot belegt es. Auch der Fall „Auto drückt den Spieler gegen eine Wand“ funktioniert sauber (Review).
- Zielmodus mit Schulterkamera, vertikales Zielen über den Kamerastrahl, Magazin, Nachladen und Auto-Nachladen, Schritte und Mausrad sind belegt und funktionieren.

## Verbesserungen für einen späteren Sprint (keine Nacharbeit jetzt)
1. Im Zielmodus verdeckt die Figur fast ein Drittel des Bildes. Die Kamera soll etwas weiter nach rechts versetzt sein, damit die Figur am linken Rand steht und mehr Sicht bleibt.
2. `castRay` trifft Autos über einen Kreis mit `v.radius`. Für mehr Treffergenauigkeit dieselbe Kapsel wie bei der Kollision verwenden.
3. Allokationen pro Schuss in `Weapons.js` (`clone` und `new Vector3`) durch wiederverwendete Vektoren ersetzen.
4. `uebergabe.md` hat noch veraltete Abschnitte („UNVOLLSTÄNDIG GEPRÜFT“, Screenshot als „Pickup“ beschrieben). Der Chef korrigiert das in ERGEBNIS.md.
