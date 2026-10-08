# Chef-Feedback S3 T2 Waffen

ABNAHME: JA (nach 2 Prüfrunden)

## Begründung
- Neue Waffen: Schrotflinte, Sturmgewehr, Scharfschützengewehr mit Zielfernrohr und Granaten. Jede hat Magazin, Nachladen, eigenen Sound und ein Blender-Modell, reproduzierbar.
- Das Waffenrad (Tab, Zeitlupe) sieht aus wie in GTA und schließt bei Pause, Tod und Blur sicher.
- Der Laden „Bullseye Arms“ hat ein klares Kaufmenü, Preise und gespeicherten Besitz. New Game setzt alles zurück.
- Granaten respektieren Wände. Waffen und Granaten treffen den Polizeihubschrauber.
- Strand, Steg und Kai sind zu Fuß erreichbar (über die World-API), Wasser nicht.
- Zweihand-Haltung über `setWeaponStyle` für Langwaffen.

## Für später
1. Auf hold-rifle.png liegt ein pinker, sichelförmiger Fleck auf dem Bordstein (Ursache unklar). Der Chef prüft das bei der Integration.
2. Die Schrotflinte lädt das ganze Magazin auf einmal (GTA-typisch wäre Patrone für Patrone). Es gibt keine Wurfbahn-Vorschau für Granaten.
3. Einschusslöcher fehlen an Fahrzeugen.
4. `t6.mjs` ist nicht deterministisch (Spawn neben dem Hubschrauber kann in einem Gebäude landen).
5. Für den Laden einen eigenen Minimap-Blip („$“) statt des POI, sobald die Minimap `game.shop.getBlips()` liest.
