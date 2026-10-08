# Backlog (CEO maintains; top = next)

## Sprint 1 — "It's a game" ✅ done
- [x] World: procedural city, day/night, POIs, districts
- [x] Vehicles: arcade driving, traffic, parked cars, damage/explosions
- [x] Player: on-foot controller, camera, weapons, enter/exit/hijack
- [x] Street AI: pedestrians, wanted system, police chase
- [x] Experience: HUD, minimap, 3 missions, pause/title screen
- [x] Audio: SFX, engine, sirens, radio

## Sprint 2 — "Runder machen" ✅ done (siehe SPRINTS.md)

## Sprint 3 — "Living city" (next)
- [ ] Police: lane-correct pursuit, roadblocks at 4★, helicopter at 5★
- [ ] Peds: arm swing, look before crossing, varied archetypes, fight back sometimes
- [ ] Player: vertical aim + right-mouse aim mode, reload, weapon/armor/health pickups, ammu shop
- [ ] World: storefronts & doors on ground floors, night headlights/neon signs, skid marks
- [ ] Mobile/touch controls

## Aus Sprint 2 offen (chef-feedback.md)
- [ ] Explosion: verkohlte Trümmer statt roter Würfel
- [ ] Zielmodus: Kamera weiter rechts, Figur verdeckt weniger; castRay auf Fahrzeug-Kapsel
- [ ] Allokationen pro Schuss (Weapons.js), Rest-Allokationen in Police._evasion/_updateCars, VehicleManager carVsCar
- [ ] Nachtfenster der Hochhäuser variabler, Kamera-Kollision gegen Ladenfronten
- [ ] Draw Calls an fester Messposition erfassen, Passanten-LOD (> 60 m nur Oberkörper)
- [ ] Straßensperre: NPC-Verkehr umleiten. Save: Position außerhalb von Gebäuden erzwingen
- [ ] Chase-Mission: faires Aufgeben ab 300 m testen

## Aus Sprint 3 offen (chef-feedback.md)
- [ ] Ragdoll-Explosionsimpuls deckeln (Körper flogen > 100 m). Spieler-Ragdoll, Einsteige-Animation ins Auto
- [ ] Motorradfahrer als neue Figur. Rotor- und Motorsounds der neuen Fahrzeuge, Hubschrauber auf der Minimap
- [ ] Schrotflinte Patrone für Patrone laden, Wurfbahn-Vorschau für Granaten, Einschusslöcher an Fahrzeugen
- [ ] Shop-Blip „$“ über `shop.getBlips()` in der Minimap
- [ ] Welt-Draw-Call-Budget ausgereizt: weitere Deko nur mit Merge/LOD. Riesenrad-Lichter farbiger

## Later ideas
- Save/load (localStorage), garages, weapon shops, more vehicle types (bikes, boats), water & beach district
- Story campaign with characters and cutscenes, rampages, stunt jumps, collectibles
- Mobile/touch controls, graphics settings, LOD, performance pass
