# Chef-Feedback T1 Fahrzeuge

ABNAHME: JA

## Begründung
- Die Blender-Autos sind deutlich besser als die alten Quader: runde Karosserie, Radkästen, echte Felgen, Spoiler beim Sportwagen. Sie sind reproduzierbar (byte-identischer Neubau laut Review).
- Nachts sieht man Scheinwerferkegel und Rücklichtschein auf der Straße, es gibt nur ein SpotLight.
- Der Ampelstopp funktioniert mit dem echten `signalAt` (160 Überfahrten, keine bei Rot).
- Draw Calls und Allokationen liegen im Rahmen.

## Verbesserungen für einen späteren Sprint (keine Nacharbeit jetzt)
1. Die Trümmer der Explosion sind leuchtend rote Würfel. Besser wären dunkle, verkohlte Teile in Lackfarbe mit wenig Glut.
2. Der Feuerball ist auf den Screenshots kaum zu sehen, weil das schwarze Band (Ursache vermutlich T3) ihn verdeckt. Prüfe nach dem T3-Fix erneut mit einem Screenshot.
3. Kleine Array-Allokationen in `VehicleManager.js:242` und `carVsCar` entfernen.
4. `tools/blender/__pycache__/` in `.gitignore` aufnehmen (macht der Chef bei der Integration).
