
## An vehicles (T1): `owned` auch fuer NPC-Fahrer beachten
VehicleManager.manage entfernt Autos mit `driver === 'npc'` ab 200 m oder bei Leerlauf, ohne `v.owned` zu pruefen (nur der `driver === null`-Zweig tut das). Die Mission `chase` setzt `owned = true` am Fluchtwagen; bitte im npc-Zweig `if (v.owned) { traffic++; continue; }` (oder aehnlich) ergaenzen. Bis dahin setzt die Mission den Wagen selbst zurueck, wenn er entfernt wird.

> Erledigt vom Chef (Sprint 2): `VehicleManager.manage()` beachtet `owned` jetzt auch im NPC-Zweig (Despawn erst ab 450 m, kein Idle-Despawn).
