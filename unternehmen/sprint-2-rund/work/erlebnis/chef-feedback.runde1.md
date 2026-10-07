# Chef-Feedback T4 Erlebnis

ABNAHME: NEIN (eine kleine Pflicht-Aufgabe)

## Gut
- Das Fadenkreuz nutzt die echte Spieler-API, die Waffenanzeige zeigt `clip / ammo` und RELOADING.
- Das Missionsziel steht nur noch im Titelbalken (Etappe und Timer), die Toasts links verschwinden.
- Save/Load hält 9 kaputte Stände aus, „New Game“ löscht wirklich. Die Lautstärkeregler im Pausemenü sehen gut aus.
- 15 Pickups mit 5 Draw Calls, keiner steht in einem Gebäude.

## Pflicht-Aufgabe (zugleich aufgaben.md)
1. **Die Verfolgungsmission darf nicht durch Despawn scheitern.** In einem von zwei Prüfläufen endete `chase` mit „The thief got away“, weil der VehicleManager NPC-Autos ab 200 m Abstand oder nach 30 s Stillstand entfernt (VehicleManager.js:362 verschont nur Autos mit `owned`, bis 450 m).
   - Zu tun in `src/missions/missionDefs.js` (Mission `chase`): Setz beim Spawn `v.owned = true` für das Fluchtauto und gib die Verfolgung bei großem Abstand fair auf, etwa mit „The thief got away“ erst ab 300 m Abstand für mehr als 5 s statt beim Verschwinden aus der Liste. Am Missionsende (Erfolg oder Fehlschlag) setzt du `owned` zurück, damit der Wagen normal entsorgt wird.
   - Erledigt, wenn 3 von 3 Testläufen mit Spieler-Verfolgung (Teleport des Spielers hinter den Dieb, kein Eingreifen) nicht mehr durch Despawn enden und ein Lauf mit Zerstörung des Wagens „MISSION PASSED“ zeigt.
   - Beleg: `tools/heavy.sh node unternehmen/sprint-2-rund/work/erlebnis/test.mjs` (oder ein eigenes `chase.mjs`), Ausgabe in `uebergabe.md` unter „Runde 2“.

## Für später (keine Nacharbeit jetzt)
- `Save.load` prüft nicht, ob die gespeicherte Position in einem Gebäude liegt. Bei einer späteren Layout-Änderung sollte die Position auf den nächsten Gehweg gesetzt werden.
