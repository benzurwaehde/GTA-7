# Chef-Feedback T5 Straße

ABNAHME: NEIN

## Gut
- Die Passanten sind deutlich vielfältiger: Frisuren, Kappen, Röcke, Farbpaletten, schwingende Arme.
- Die Straßensperre sieht genau richtig aus, wenn sie kommt: zwei quergestellte Streifenwagen zwischen zwei Kreuzungen.
- Polizei auf der rechten Spur ist belegt (37 von 37 Samples). Draw Calls im Normalfall unkritisch.

## Verbesserungen (Pflicht für die Abnahme)
1. Die Straßensperre muss zuverlässig erscheinen. Im Review kam sie in 2 von 4 Läufen bei 4 Sternen nicht (Startpunkte (-148,-120) und (148,-120), Blick +Z). Ursache finden, Verdacht ist ein stilles Abbrechen bei `cars.length < 2` in Police.js:472. Wenn gerade keine zwei Wagen frei sind, eigene Sperr-Wagen spawnen oder später erneut versuchen. Beleg: mindestens 5 von 5 Läufen mit Sperre, darunter die zwei genannten Startpunkte.
2. Pro-Frame-Allokationen in Police.js entfernen (A6): `pPrev`-Objekt (Z.203), `filter`/`slice` auf cops und cars (Z.206/207, 231, 243, 247, 439), Closures in `_updateCop` (Z.490/495).
3. Das Ausweichen der Polizei vor Verkehr ist nicht belegt. Belege es mit einem Testlauf, in dem ein Streifenwagen hinter einem NPC-Auto verfolgt (Messung: kein Auffahren, seitlicher Versatz oder Bremsen).

## Für später (keine Nacharbeit jetzt)
- Die Sperre leitet NPC-Verkehr nicht um.
- Arme und Beine von Passanten über ca. 60 m nicht mehr zeichnen, falls Draw Calls gespart werden müssen.
