# Chef-Feedback S3 T4 Fahrzeuge

ABNAHME: JA

## Begründung
- Neue Typen Muscle-Car, Van, Bus und Motorrad (mit Schräglage), reproduzierbar aus Blender. Der Neubau ist MD5-identisch.
- Schadensbild mit Dellen, gebrochenen Scheiben, Rauch und verkohltem Wrack. Die Trümmer haben jetzt Lackfarbe statt roter Würfel. Kein Material-Leak.
- Der Polizeihubschrauber kommt bei 5 Sternen, hat einen Suchscheinwerfer, schießt nur bei Sichtlinie und ist abschießbar (API vorhanden, T2 bindet sie an).
- Der Verkehr macht Sirenen Platz, ohne Stau. Allokationen sind entfernt, die Draw Calls sind stabil.

## Für später
1. `Helicopter.dispose()` gibt das Material des Rotor-Blur nicht frei.
2. Motorrad: Die Abwurfschwelle (Impact > 8) ist für Spieler zu streng. Höher setzen oder Schaden reduzieren.
3. Es fehlen Rotor- und Motorsounds für die neuen Typen, und der Hubschrauber fehlt auf der Minimap.
4. Der Absturz kollidiert nicht mit Gebäuden.
5. Die T1-Figur als Motorradfahrer einbinden, sobald T1 fertig ist.
