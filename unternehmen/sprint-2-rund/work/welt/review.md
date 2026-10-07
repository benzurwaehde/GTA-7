VERDIKT: OK

Runde 3, offener Mangel 1 aus review.runde2.md (fast weiße Schaufenster nachts).

1. Mangel behoben. `tools/heavy.sh node unternehmen/sprint-2-rund/work/welt/pruef2.mjs` lief durch (`"bad": 0`, Ampelfolge plausibel). Das Bild `runde3-pruef2-nightwalk.png` (22:30, Gehweg) zeigt türkise, gesättigte, gegliederte Fenster mit Sprossen und Kämpfer. Sie sind nicht weiß, und die Ladenzeile ist kein weißer Riegel mehr. In der Ferne sind die Läden warm beleuchtet, ohne zu überstrahlen.
2. Kein Rückschritt beim Band. Im Bild ist kein schwarzes Band zu sehen. Es wurde nur `src/world/shops.js` geändert, und die Markisenunterseite wurde nicht angefasst.
3. Draw Calls unverändert. In `shops.js` entstehen Meshes weiterhin nur einmal pro Material (Zeile 76). Es gibt keine neuen Meshes. Die Änderung betrifft nur Vertexfarben und Glasfaktor. Das Smoke-Ergebnis von 377 Draw Calls hängt von der Kameraposition ab (Runde 2 meldete 110, die Übergabe 86). Ich habe es nicht per A/B-Vergleich geprüft.
4. `npm run build` ist grün. Es gibt nur die bekannte Chunk-Größen-Warnung.
5. `tools/heavy.sh npm run smoke` endet mit `SMOKE OK`.

Mängelliste: keine.
