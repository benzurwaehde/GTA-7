# Chef-Feedback T4 Erlebnis (Runde 2)

ABNAHME: JA

- Pflicht-Aufgabe erledigt: Das Fluchtauto der Mission `chase` wird nicht mehr despawnt. Die Ursache lag im VehicleManager (`owned` wurde im NPC-Zweig nicht beachtet). Der Chef hat sie als Integrationsfix in `src/vehicles/VehicleManager.js` behoben. Die Wiedereinsetzung durch die Mission bleibt als Sicherheitsnetz.
- Beleg (vom Chef selbst gefahren): `chase.mjs` gibt CHASE OK. Das Auto übersteht 215 m und Stillstand, die Zerstörung zeigt MISSION PASSED, und `owned` wird zurückgesetzt.
- Alle übrigen Punkte sind seit Runde 1 bestätigt (siehe chef-feedback.runde1.md und review.md).

## Für später
- Das faire Aufgeben ab 300 m ist ungetestet, weil die Stadt dafür zu klein ist.
- `Save.load` prüft nicht, ob die Position in einem Gebäude liegt.
