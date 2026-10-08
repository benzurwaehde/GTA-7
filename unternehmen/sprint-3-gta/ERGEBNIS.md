# ERGEBNIS – Sprint 3 „Mehr GTA“

## Zusammenfassung
Die beiden Wünsche des Nutzers sind erfüllt: realistischere Menschen, die beim Anschießen **wie in GTA umfallen**, sowie ein **Waffenrad** mit einem **Waffenladen**. Dazu kommen die vom Unternehmen selbst gefundenen Verbesserungen:
- eine lebendigere Küste mit begehbarem Hafen und Landmarken,
- neue Fahrzeuge mit sichtbarem Schaden,
- ein Polizeihubschrauber.

Alle vier Teilaufgaben sind nach dem Unternehmens-Ablauf geprüft und abgenommen.

Gesamttest nach der Integration: `npm run build` ✅, `npm run smoke` ✅ (55 Fahrzeuge, 40 Passanten, 199 Draw Calls), `node tests/qa-tour.mjs` ✅, keine Konsolenfehler.

## Abgenommene Aufgaben
| Teil | Runden | Ergebnis |
|---|---|---|
| T1 Menschen | 2 | Quaternius-CC0-Figuren (7 Varianten plus Polizist), Animationen, Verlet-Ragdoll mit Explosions- und Unfall-Impuls, Blut, Treffer-Reaktion, Zweihand-Haltung |
| T2 Waffen | 2 | Schrotflinte, Sturmgewehr, Scharfschütze mit Zielfernrohr, Granaten, Waffenmodelle aus Blender, Waffenrad mit Zeitlupe, Laden „Bullseye Arms“, Einschusslöcher, neue Zielkamera, Hubschrauber abschießbar, Hafen begehbar |
| T3 Stadt | 2 | Meer-Shader mit Wellen und Schaum, Hafen Marlin Pier (Steg, Kai, Kräne, Frachtschiff, 8 Boote), Meridian Tower, Riesenrad mit Lichtern, Leuchtturm, Pavillon, Dachdetails, World-API für Begehbarkeit |
| T4 Fahrzeuge | 1 | Muscle-Car, Van, Bus, Motorrad mit Schräglage, Dellen, Glasbruch und Wrack, verkohlte Trümmer, Polizeihubschrauber ab 5★, Verkehr macht Sirenen Platz |

Arbeit des Chefs:
- Kern-Schnittstelle `game.timeScale` und die Mac-App.
- Steuerung der Schnittstellen zwischen den Teams: Hand-Bone und Zweihand (T1/T2), Hubschrauber-Treffer (T4/T2), Hafen-Zugang (T3/T2).
- Integration und Doku.

## Lizenzen
Fremd-Assets gibt es nur von Quaternius (CC0). Sie stehen in `CREDITS.md`. Alles andere ist prozedural oder per Blender-Skript erzeugt.

## Offene Punkte
Gesammelt im BACKLOG unter „Aus Sprint 3 offen“, Details in `work/*/chef-feedback.md`. Die wichtigsten:
- Explosionsimpuls deckeln.
- Einsteige-Animation.
- Sounds für Hubschrauber und neue Fahrzeuge.
- Shop-Blip „$“.

## Pfade
- Auftrag `BRIEF.md`, Übergaben, Prüfungen und Abnahmen unter `work/<teil>/`.
- Code: `src/characters/`, `src/player/`, `src/ui/WeaponWheel.js`, `src/shop/`, `src/world/`, `src/vehicles/`, `src/police/`.
- Blender: `tools/blender/human_build.py`, `weapon_build.py`, `prop_boats.py`, `car_*.py`, `vehicle_*.py` erzeugen `public/models/*.glb`.
