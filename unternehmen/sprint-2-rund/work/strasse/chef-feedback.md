# Chef-Feedback T5 Straße (Runde 2)

ABNAHME: JA

- Die Straßensperre ist zuverlässig: `roadblock5.mjs` gibt 7/7 OK, auch mit erzwungenem Spawn-Fehler und `noCars`. Die Ursache (`noCars` wurde nie zurückgesetzt) ist behoben, dazu gibt es einen neuen Versuch und Ausweichrichtungen am Kartenrand.
- Die Allokationen in Police.js sind stark reduziert: kein filter/slice mehr, keine Closures, und `rayBox` allokiert nicht mehr.
- Das Ausweichen ist belegt (`dodge.mjs`): ca. 3 m Versatz, mindestens 2,7 m Seitenabstand, keine Kollision.

## Für später
- Ein unerklärtes Zurücksetzen des Wanted-Levels in einem frühen Testlauf beobachten.
- In `_evasion` und `_updateCars` bleiben noch ca. 1 KB Allokation pro Frame.
- Die Sperre leitet NPC-Verkehr nicht um. Arme und Beine von Passanten über 60 m nicht zeichnen (LOD).
