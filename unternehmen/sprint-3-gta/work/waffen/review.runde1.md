VERDIKT: FEHLER

Geprüft: T2 `waffen`. Eigene Probe-Skripte lagen im Scratchpad (Vite mit hmr:false, watch:null, Start über tools/heavy.sh). Es wurde kein Code geändert. Die GLBs wurden vom Blender-Lauf neu geschrieben, sind aber byteidentisch zu vorher.

## Kriterien
- A1: `npm run build` ist fehlerfrei ("built in 148ms"). Es gibt nur die übliche Chunk-Größenwarnung.
- A2: `tools/heavy.sh npm run smoke` gibt SMOKE OK (drawCalls 228, 51 Autos, 40 Passanten, System `shop` und `weaponWheel` vorhanden). `tools/heavy.sh node tests/qa-tour.mjs` gibt QA OK.
- A3: Punkte T2.1–T2.6 sind im Code vorhanden. Offene Punkte stehen in der Übergabe (kein Sichtlinien-Check bei Granaten, Schrotflinte lädt alles auf einmal usw.).
- A4: Ich habe nicht per Diff geprüft, weil das Projekt kein Git-Repo ist. Die Dateiliste der Übergabe passt zum Ordnerzuschnitt (zusätzlich `src/core/modelList.js`, nur Ergänzungen).
- A5: Zugriffe auf andere Systeme sind mit `?.` abgesichert (Shop, Grenades, Wheel). Der Smoke-Lauf funktioniert.
- A6: Es gibt keine Allokationen pro Frame in Weapons, Impacts und Grenades. Dort werden Wiederverwendungs-Objekte genutzt (`_near`, `_m`, `_q`, `_v`). Die Instanz-Löcher sind ein Draw Call. Die Angabe "+15 Draw Calls" (182 gegen 167) habe ich nicht nachgemessen, sie ist plausibel. Der Smoke-Wert 228 ist eine Fahrt, nicht die feste Messposition.
- A7: 21 Screenshots, darunter Waffenrad, Laden-Menü und Waffe in der Hand. Mit Einschränkung, siehe Mangel 4.
- A8: Der Abschnitt "API" in `uebergabe.md` ist vorhanden.
- A9: Es gibt keine Fremd-Assets. Alles ist per Blender-Skript selbst erzeugt.
- A10: Ich habe nichts committet (kein Git-Repo).

## Schwerpunkte
1. Kauf (Probe `probe.mjs`):
   - Mit 1000 $ und Marker betreten öffnet das Menü. Enter kauft die SMG, danach 100 $, SMG owned, 30/120.
   - Die Schrotflinte (1500 $) wird mit 100 $ abgelehnt: Geld bleibt 100, `owned=false`, Meldung "Not enough cash".
   - `timeScale` ist nach F wieder 1. `gta7.arms` enthält `{"v":1,"owned":["pistol","smg"],"ammo":{...}}`.
   - Das ist in Ordnung.
   - Waffenrad: Tab öffnet es, `timeScale` ist 0.25. Bei `paused=true` bleibt das Rad offen. Nach Fortsetzen schließt es und `timeScale` ist 1. Beim Tod mit gehaltenem Tab war `open=false` und `timeScale=1`.
   - Das Rad schließt also sicher, hat aber einen kleinen Makel (Mangel 5).
   - Scope: Das Overlay ist laut Screenshot `sniper-scope.png` und Code vorhanden. Ich habe es nicht selbst im Browser ausgelöst.
2. Granaten: Der Code `Grenades.explode()` prüft keine Sichtlinie. Der Schaden an Spieler, Passanten und Autos geht im Radius 9 m durch Wände. Das bewerte ich als Mangel (Mangel 2). Der Wurf blockiert weder `timeScale` noch den Spieler. Granaten haben nur ein Zeitlimit (FUSE 2,8 s), `explode()` setzt `active=false` und es gibt eine feste Pool-Größe von 6.
3. Speichern: Der Schlüssel `gta7.arms` stimmt. Kaputte Daten stürzen nicht ab. Die vier Varianten `{not json`, `null`, Typ-Müll und `owned:"x"` laufen ohne Fehler durch. Aber **New Game löscht den Schlüssel nicht** (Mangel 1).
4. Laden: Der Marker liegt bei (-7.9, 39). Die Kollisionsbox [-18.3..-10.3]x[33..45] überlappt keinen anderen Collider (`overl=0`). Es gibt genau einen POI `weapons` und einen `getBlips`-Eintrag. Die Minimap liest nur `missions.getBlips()` und den POI. Damit gibt es kein Doppel-Icon. Auf dem Screenshot `shop-front.png` steht der Laden an einem Gehsteig in einem Parkblock, nicht auf der Straße. Das ist in Ordnung.
5. Draw Calls: siehe A6.
6. Reproduzierbarkeit: `tools/heavy.sh blender -b --factory-startup --python tools/blender/weapon_build.py` exportiert alle 6 GLBs mit denselben Größen wie vorher (Sniper byteidentisch). Materialien: 3 je Waffe, 4 beim Scharfschützengewehr (also höchstens 6). Dreiecke: 60–220.

## Mängelliste
1. **New Game löscht `gta7.arms` nicht (Pflicht).**
   - Stelle: `src/shop/Shop.js` Zeile 26 (Wrapper um `newGame`) und Zeile 20 (`beforeunload` ruft `persist()`).
   - `Save.newGame()` setzt `disabled=true`, löscht Schlüssel und ruft `location.reload()`. Der `beforeunload`-Handler des Shops schreibt den Besitz sofort wieder in `gta7.arms`, denn `persist()` kennt kein Sperr-Flag.
   - Reproduktion: `game.player.weapons.give('sniper'); game.shop.persist(); game.save.newGame()`, nach dem Reload `localStorage.getItem('gta7.arms')` und `weapons.states` prüfen.
   - Ergebnis: `{"v":1,"owned":["pistol","sniper"],...}` und Sniper ist wieder besessen. Beabsichtigt wäre `null`.
   - Fix: im Wrapper ein Flag setzen (zum Beispiel `this.disabled = true`), und `persist()` bei gesetztem Flag überspringen. Alternativ `persist()` auf `game.save.disabled` prüfen.
2. **Granatenschaden ignoriert Wände.** `src/player/Grenades.js` `explode()` (Zeilen ca. 63–91). Es gibt keine Sichtlinienprüfung gegen `world.colliders`.
   - Reproduktion: Granate hinter einer Hauswand explodieren lassen, in dem Radius, in dem der Spieler oder Passanten auf der anderen Seite stehen.
   - Beschreibung: Die Explosion trifft sie trotzdem.
   - Fix: Segment Explosionspunkt zum Ziel gegen die Collider testen (Höhe `maxY` beachten) und den Schaden dämpfen oder streichen. Nutze dabei vorallozierte Objekte.
   - Hinweis: Der Agent hat das selbst als offen gemeldet, aber ein Wanddurchschlag-Schaden ist bei Granaten kein reiner Schönheitsfehler.
3. **Wiederherstellung akzeptiert kaputte Einträge.** `src/shop/Shop.js` `restore()` (Zeile ca. 168).
   - Reproduktion: `localStorage.setItem('gta7.arms','{"v":1,"owned":["sniper"],"ammo":{"sniper":{"ammo":"x"}}}'); game.shop.restore()`.
   - Ergebnis: Der Scharfschütze ist besessen mit Magazin 0 und Reserve 0. Das ist kein Crash, aber die Waffe ist unbrauchbar.
   - Fix: bei kaputten Munitionsdaten die Startmunition vergeben (Priorität niedrig).
4. **Waffe in der Hand schwer erkennbar.** `shots/hold-rifle.png`, `weapon-rifle-hand.png`. Das Sturmgewehr ist in der Hand kaum zu sehen (Ausrichtung zu `rightHand` von T1 laut Übergabe nur angenommen). Hier ist das Modell klein und neben dem Kopf. `hold-pistol.png` zeigt die Pistole dagegen gut.
   - Fix: Offset auf `weapons.hold` prüfen und ein Screenshot mit dem Gewehr deutlich sichtbar nachliefern.
5. **Waffenrad bleibt bei Pause offen.** `src/ui/WeaponWheel.js` `update()` läuft bei `game.paused` nicht. Reproduktion: Tab halten, `game.paused=true`. Ergebnis: Das Overlay (z-index 30) bleibt über dem Pausenmenü sichtbar und `timeScale` bleibt 0.25, bis zur Fortsetzung. Das Zurücksetzen auf 1 passiert erst nach dem Fortsetzen. Der Zustand wird aber sicher wiederhergestellt. Fix (niedrig): im Pausen-Event `show(false)` aufrufen.
6. Kleinigkeit: Das Kaufmenü schließt mit Tab, und das Rad kann im selben Frame direkt öffnen (`Shop.onKey` und `WeaponWheel.update` greifen dieselbe Taste). Nicht blockierend.

Nicht blockierend, aber zu beachten: Der echte Spielstart in diesem Headless-Test läuft sehr langsam (Swiftshader), die Granaten-Explosion durch eine Wand habe ich deshalb aus dem Code geschlussfolgert und nicht live nachgestellt (der Test-Spieler war wegen eines vorherigen Tods bereits tot).
