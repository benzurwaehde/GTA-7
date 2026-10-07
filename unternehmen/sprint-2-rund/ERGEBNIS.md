# ERGEBNIS – Sprint 2 „Runder machen“

## Zusammenfassung
GTA 7: Vice Bay fühlt sich deutlich runder an:
- schönere Autos aus Blender
- eine Stadt mit Ampeln, Läden und Neon, die auch nachts lesbar ist
- ein besseres Kampfgefühl mit Zielmodus, vertikalem Zielen und Nachladen
- klarere UI mit Fadenkreuz und Missionsbalken
- Pickups und Spielstand
- lebendigere Straßen mit vielfältigen Passanten, Polizei auf der Spur und Straßensperren

Alle fünf Teilaufgaben sind nach dem Unternehmens-Ablauf abgenommen.

Gesamttest nach der Integration: `npm run build` ✅, `npm run smoke` ✅ (190 Draw Calls), `node tests/qa-tour.mjs` ✅ (159 Draw Calls), keine Konsolenfehler.

## Abgenommene Aufgaben
| Teil | Runden (Prüfung / Abnahme) | Ergebnis |
|---|---|---|
| T1 Fahrzeuge | 1 / 1 | 5 Blender-Autos (`tools/blender/`, `public/models/`), Nachtlichter, Explosion, Reifenspuren, Ampelstopp |
| T2 Spieler | 2 / 1 | Kollision mit Autos, Zielmodus, vertikales Zielen, Magazin und Nachladen, Rückstoß, Schritte, Mausrad |
| T3 Welt | 3 / 1 | 81 Ampeln (`signalAt`), Läden bündig mit Nachtfenstern, Neon, Möbel, Nacht-Look. Das schwarze Band (Markisen-Unterseiten) ist behoben |
| T4 Erlebnis | 1 / 2 | Fadenkreuz, Missionsbalken, Pickups, Save/Load, Lautstärkeregler, Missionen `chase` und `delivery`. Despawn des Fluchtautos behoben |
| T5 Straße | 1 / 2 | Passanten-Vielfalt, Ampelquerung, Zurückschlagen, Polizei auf der Spur und ausweichend, Straßensperre 7/7 zuverlässig, neue Sounds |

Arbeit des Chefs:
- Kern-Schnittstellen: rechte Maustaste, Mausrad, GLB-Preloader.
- Werkzeuge: QA-Tour und `tools/heavy.sh` (höchstens 2 schwere Jobs, damit der Laptop nicht überhitzt).
- Integrationsfix: `owned` gilt im VehicleManager auch für NPC-Autos.
- Doku: ARCHITECTURE, SPRINTS, BACKLOG und README.

## Offene Punkte
Sie stehen gesammelt im BACKLOG unter „Aus Sprint 2 offen“, die Details in den jeweiligen `work/*/chef-feedback.md`.
- Die Explosionstrümmer sind noch rote Würfel. Im Zielmodus verdeckt die Figur viel vom Bild.
- Es gibt noch Rest-Allokationen in Weapons.js und Police.js.
- Die Draw Calls schwanken je nach Kameraposition stark. Es fehlt eine feste Messposition und ein Passanten-LOD.
- Die Straßensperre leitet keinen Verkehr um. Save prüft die Position nicht gegen Gebäude.

## Pfade
- Auftrag: `unternehmen/sprint-2-rund/BRIEF.md`. Übergaben, Prüfungen und Abnahmen: `unternehmen/sprint-2-rund/work/<teil>/`.
- Code: `src/vehicles/`, `src/player/`, `src/world/`, `src/ui/`, `src/missions/`, `src/pickups/`, `src/save/`, `src/npc/`, `src/police/`, `src/audio/`, `src/core/`.
- Blender: `tools/blender/car_*.py` erzeugt `public/models/car_*.glb`.
