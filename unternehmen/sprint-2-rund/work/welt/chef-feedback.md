# Chef-Feedback T3 Welt

ABNAHME: JA (nach 3 Prüfrunden)

## Begründung
- An allen 81 Kreuzungen stehen Ampeln, der Vertrag `signalAt` ist exakt eingehalten. Der Verkehr (T1) und die Passanten (T5) nutzen ihn bereits.
- Das schwarze Band ist behoben. Ursache waren die Markisen-Unterseiten.
- Die Läden sitzen bündig an der Fassade: dunkler Sockel, farbige Markisen. Nachts haben sie gegliederte, warm und türkis leuchtende Schaufenster.
- Die Nacht ist erkennbar, Neon und Läden leuchten, die Hochhausfenster sind gedämpft. Möbel sind instanziert.
- Es entstehen nur ca. 13 zusätzliche Draw Calls, und es gibt keine Allokationen pro Frame mehr in `_applyTime`.

## Für später (keine Nacharbeit jetzt)
1. Einige Hochhausfenster wirken nachts immer noch fast weiß. Mehr Variation in Helligkeit und Farbe würde helfen.
2. Gebäude- und Ladenwände sind von innen einseitig. Die Kamera sollte nicht in Ladenfronten geraten (Kamera-Kollision von T2 gegen Laden-Collider).
3. Die Draw Calls schwanken im Smoke-Test stark mit der Kameraposition (86 bis 377). Für die Integration braucht es eine feste Messposition.
