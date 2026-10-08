# Chef-Feedback S3 T1 Menschen

ABNAHME: JA (nach 2 Prüfrunden)

## Begründung
- Realistische CC0-Menschen (Quaternius, 7 Varianten plus Polizist) ersetzen die Klötze. Die Lizenz ist in CREDITS.md dokumentiert, ungenutzte Rohdateien sind entfernt.
- Animationen mit Überblendung, Zweihand-Haltung für Langwaffen (`setWeaponStyle`), die Füße stehen auf dem Boden.
- Der Ragdoll fällt wie in GTA: Der Körper liegt vollständig sichtbar auf Gehweg bzw. Straße, mit dunkelroter Blutlache. Explosionen schleudern vom Zentrum weg, Autounfälle stoßen.
- Treffer-Reaktion und Blutspritzer. LOD bzw. Draw Calls liegen niedrig (Smoke 106 bis 177).

## Für später
1. Der maximale Explosions-Impuls (20 m/s) ist hoch, Körper flogen in einem Test über 100 m. Impuls deckeln bzw. Reichweite begrenzen.
2. Es fehlen eine Einsteige-Animation ins Auto und ein Spieler-Ragdoll (der Spieler stirbt per Animation).
3. Hüft- und Hals-Winkelgrenzen. Ein echter zweiter Sterbe-Clip statt der Spiegelung.
4. Die Spritzer sind etwas heller als die Lache. Restliche `for..of` in `_collide` und `apply`.
5. Motorradfahrer (T4) auf die neue Figur umstellen.
