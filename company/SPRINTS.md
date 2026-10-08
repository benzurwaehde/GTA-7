# Sprint log

## Sprint 1 — "It's a game" ✅ (2026-10-07)
Six Sonnet teams built in parallel against `ARCHITECTURE.md`; CEO integrated.
- World: seeded procedural city (5 districts, 5 POIs), sky dome, day/night, beach & sea.
- Vehicles: 5 car types, arcade physics, ~25 traffic + 30 parked, damage/fire/explosions.
- Player: animated character, orbit/chase camera, fists/pistol/SMG, hijacking, death/respawn.
- Street AI: 40 pedestrians (flee, run-over, cash drops), 0–5★ wanted, foot cops & police cars.
- Experience: title screen, HUD, rotating minimap, pause menu, 4 missions.
- Audio: synthesized SFX, engine, sirens, 3 radio stations.
- Integration fixes: unified steering sign (+1 = right), smoke-test startup timeout.
- QA: build ✅, smoke ✅ (player walks, enters car, drives; 47 vehicles, 40 peds, no console errors).

## Sprint 2 — "Runder machen" ✅ (2026-10-07)
Fünf Sonnet-Teams, organisiert nach dem Unternehmens-Ablauf: Agent baut, Mitarbeiter prüft, Chef nimmt ab. Details stehen in `unternehmen/sprint-2-rund/`.
- Fahrzeuge: Die fünf Autos sind in Blender per Skript modelliert (`tools/blender/`, GLB), nachts gibt es Licht (SpotLight beim Spieler), weiche Explosionen, Reifenspuren, Halt an Ampeln, Fluchtreaktion.
- Spieler: Kollision mit Autos, Zielmodus mit rechter Maustaste, vertikales Zielen, Magazine und Nachladen, Rückstoß und Kamerawackeln, Schritte, Mausrad.
- Welt: Ampeln an 81 Kreuzungen (`signalAt`), Läden im Erdgeschoss, Neon, Straßenmöbel, lesbarer Nacht-Look.
- Erlebnis: Fadenkreuz und Treffermarker, Magazinanzeige, Missionsziel nur im Titelbalken, 15 Pickups, Speichern und Laden, Lautstärkeregler, Missionen `chase` und `delivery`.
- Straße: vielfältige Passanten mit Armen, Ampelquerung, Zurückschlagen, Polizei auf der Spur mit Ausweichen, Straßensperren ab 4★, neue Sounds.
- Kern (Chef): rechte Maustaste und Mausrad, GLB-Preloader, QA-Tour, `tools/heavy.sh`. Integrationsfix: `owned` gilt auch für NPC-Autos.
- QA: Build ✅, Smoke ✅ (190 Draw Calls), QA-Tour ✅ (159 Draw Calls).

## Sprint 3 — "Mehr GTA" ✅ (2026-10-08)
Vier Teams nach dem Unternehmens-Ablauf. Details stehen in `unternehmen/sprint-3-gta/`.
- Menschen: Quaternius-CC0-Figuren mit Animationen, Verlet-Ragdoll (GTA-artiges Umfallen, Explosionen und Unfälle), Blut, Treffer-Reaktion, Zweihand-Haltung.
- Waffen: Schrotflinte, Sturmgewehr, Scharfschütze, Granaten mit Blender-Modellen, Waffenrad mit Zeitlupe, Laden „Bullseye Arms“, Einschusslöcher, neue Zielkamera.
- Stadt: Meer mit Wellen und Schaum, begehbarer Hafen (Steg, Kai, Kräne, Frachtschiff, Boote), Meridian Tower, Riesenrad, Leuchtturm, Pavillon, Dachdetails.
- Fahrzeuge: Muscle-Car, Van, Bus, Motorrad, Schadensbild bis zum Wrack, Polizeihubschrauber ab 5★, Verkehr macht Sirenen Platz.
- Kern und Chef: `game.timeScale`, Mac-App (Electron), Integration. QA: Build ✅, Smoke ✅ (199 Draw Calls), QA-Tour ✅.
