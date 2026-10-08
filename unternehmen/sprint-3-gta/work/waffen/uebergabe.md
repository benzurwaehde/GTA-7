# Übergabe T2 `waffen`

Kein Commit, kein Push. Alle Punkte 1–6 des BRIEF sind umgesetzt (Einschränkungen unter „Offen").

## Was gebaut wurde
1. **Neue Waffen** (`src/player/Weapons.js`, `Grenades.js`): Schrotflinte (8 Kugeln, Streuung, Schaden fällt mit Distanz, starker Rückstoß), Sturmgewehr (automatisch, präzise), Scharfschützengewehr (RMB = Zielfernrohr, FOV 12, Overlay, Schaden 250 = ein Schuss tötet), Granate (Wurf im Bogen, Abprallen an Boden und Wänden, 2,8 s Zündzeit, Explosion über `game.vehicles.effects.explosion`, Schaden an Passanten, Autos und Spieler in 9 m). Jede Waffe hat Magazin, Reserve, Nachladen und eigenen Sound. Start weiter mit Fäusten und Pistole. Die SMG gibt es jetzt auch erst im Laden.
2. **Waffenmodelle:** `tools/blender/weapon_build.py` erzeugt `public/models/weapon_{pistol,smg,shotgun,rifle,sniper,grenade}.glb` (60–220 Dreiecke, 6–15 KB, Empty `Muzzle` an der Mündung). Sie hängen an `character.rightHand` (T1 liefert das schon in `src/characters/Human.js`). Fehlt es, nehme ich `character.gunMount`. Fehlt das Modell, gilt die alte prozedurale Waffe.
3. **Waffenrad** (`src/ui/WeaponWheel.js`, `game.weaponWheel`): Tab halten öffnet es, `timeScale = 0.25`. Die Maus wählt die Richtung, Loslassen wechselt. Ein Canvas zeigt Icon, Name und Munition. Nicht besessene Waffen sind ausgegraut (LOCKED). Mausrad, Q/E und Ziffern 1–7 gehen weiter (übergehen nicht besessene Waffen). Während das Rad offen ist, schießt der Spieler nicht und die Kamera dreht nicht.
4. **Waffenladen „Bullseye Arms"** (`src/shop/`, `game.shop`): freistehendes Ladengebäude mit Schild, Vordach und pulsierendem Eingangsmarker mit Lichtstrahl. Es steht an einem freien Streifen an einer Blockkante in der Nähe des Starts (Position per Suche zur Laufzeit, bei Seed 7007: Marker bei x=-7.9, z=39). Es gibt eine Kollisionsbox und einen Minimap-Blip. Betritt man den Marker, öffnet sich das Kaufmenü. Es ist per Tastatur bedienbar (W/S oder Pfeile, Enter = kaufen, F oder Esc = raus) und per Mausklick, falls der Zeiger frei ist. Der Pointer-Lock bleibt dabei erhalten, sonst würde das HUD pausieren. Das Spiel läuft mit `timeScale = 0.02` quasi stehend. Angebot und Preise:
   - Waffen: SMG 900, Schrotflinte 1500, Sturmgewehr 2800, Scharfschützengewehr 4500, Granaten (5er-Pack, auch wiederholt kaufbar) 600.
   - Munition: Pistole +24 für 80, SMG +60 für 180, Schrotflinte +12 für 150, Sturmgewehr +60 für 300, Scharfschütze +10 für 350.
   - Schutzweste (+100 Armor): 450.
   - Bezahlt wird mit `game.state.money`, dazu `money:changed`.
   - **Speichern:** Besitz und Munition liegen unter dem eigenen Schlüssel `gta7.arms` in localStorage (bei Kauf, alle 10 s, beim Schließen und bei `beforeunload`). Das Laden passiert im ersten Frame nach `Save.load()`. **Save.js ist unverändert.** „New Game" löscht den Schlüssel mit, dazu umhüllt der Shop `game.save.newGame` zur Laufzeit. Eine Änderung an Save.js ist nicht nötig.
5. **Einschusslöcher und Funken** (`src/player/Impacts.js`): ein InstancedMesh (1 Draw Call) mit 64 Löchern im Ringpuffer. Sie liegen an der Wandnormalen und am Boden, leben 28 s und schrumpfen in den letzten 4 s. Funken: Metall gelb, Staub grau/braun, Blut rot. Das Mündungsfeuer hat je Waffe eigene Größe und Farbe (Schrotflinte groß und orange, Scharfschütze lang und hell, SMG klein).
6. **Zielmodus-Kamera:** `CameraRig` rückt die Kamera im Zielmodus weiter über die Schulter (Offset 0,55 → 1,1 m, Abstand 2,6 m). Die Figur steht links im Bild, das Fadenkreuz ist frei (Screenshot `aim-camera-rifle`). Dazu ein Scope-Modus (Kamera am Kopf, FOV 12, Empfindlichkeit −80 %, Figur ausgeblendet).

## API (neu, für `company/ARCHITECTURE.md`)
- `game.weaponWheel`: `open` (bool), `hover`, `stick`, `show(bool)`. Setzt `game.timeScale = 0.25` und stellt es beim Schließen zurück.
- `game.shop`: `isOpen`, `position` (Marker), `placed`, `getBlips() -> [{x,z,color,letter,name}]`, `open()`, `close()`. Schlüssel `gta7.arms`. Der Shop trägt außerdem `{type:'weapons', name:'Bullseye Arms'}` in `game.world.pois` ein, damit die Minimap ein Icon zeigt (Fallback-Stil „shop").
- `player.weapons`:
  - `WEAPON_DEFS` hat jetzt 7 Einträge: fists, pistol, smg, shotgun, rifle, sniper, grenade.
  - Jeder State hat `owned`.
  - `select(i) -> bool` (nicht besessen = false und HUD-Hinweis), `cycle(dir)` überspringt nicht besessene Waffen.
  - `give(id, ammoTotal?)`, `addAmmo(id, n) -> hinzugefügt` (gedeckelt durch `maxReserve`, nicht besessene Waffen bekommen nichts), `stateOf(id)`, `defOf(id)`.
  - `updateFx(dt)` läuft jetzt jeden Frame aus `Player.update`, auch beim Fahren oder wenn der Spieler tot ist.
  - `castRay` liefert zusätzlich `nx, ny, nz` (Oberflächennormale).
  - `muzzleWorld(out)`, `refreshVisual()`, `impacts` und `grenades`.
- `player.scopeK` (0..1), `player.cam.update(dt, focus, { scope, freeze })`.
- Event `explosion {x,y,z,radius,source:'grenade'}` bei Granatenexplosionen. T1 kann damit die Ragdoll-Impulse vom Explosionsort aus berechnen (bisher kommt der Impuls von der Spielerposition). Granaten rufen `peds.damage(ped, n, 'player')` auf.
- Neue Sounds: `shotgun`, `rifle`, `sniper`, `grenade`, `bounce`, `buy`, `deny`, `tick`.
- Tasten: Tab (Rad), 4 = Schrotflinte, 5 = Sturmgewehr, 6 = Scharfschütze, 7 = Granate.

## Geänderte Dateien
`src/player/{Weapons,Player,CameraRig}.js`, neu `src/player/{Impacts,Grenades}.js` (liegen in meinem Ordner `src/player/`, T1 fasst dort nur Character.js an), neu `src/ui/WeaponWheel.js`, neu `src/shop/{Shop,ShopMenu,Storefront,catalog}.js`, `src/audio/sfx.js` (nur ergänzt), `src/main.js` (zwei neue Systeme, `weaponWheel` nach `player`, `shop` nach `save`), `src/core/modelList.js` (nur die 6 Namen ergänzt), `tools/blender/weapon_build.py`, 6 GLBs. Keine Fremd-Assets, deshalb kein CREDITS-Eintrag nötig (alles selbst in Blender per Skript erzeugt).

## Tests und Ausgaben
- `npm run build`: fehlerfrei.
- `tools/heavy.sh npm run smoke`: **SMOKE OK** (Systeme inkl. `shop`, 49 Autos, 38 Passanten, 279 Draw Calls beim Fahren, ohne Konsolenfehler).
- `tools/heavy.sh node tests/qa-tour.mjs`: **QA OK**.
- Eigene Tests in `work/waffen/` (Vite mit `hmr:false, watch:null`): `t1.mjs` (Laden), `t2.mjs` (Marker öffnet Menü, Kaufen per Tastatur, Rad, Wechsel), `t3.mjs` und `t4.mjs` (Waffen, Zielkamera, Löcher, Scope, Granate), `dc.mjs` (Draw Calls). Ausgabe `t2`:
  - Menü öffnet beim Betreten des Markers, `timeScale` 0,02.
  - Nach dem Kauf mit 6000 $ gehören SMG, Schrotflinte und Sturmgewehr dem Spieler, Rest 800 $. Der Scharfschütze (4500 $) wird mangels Geld abgelehnt.
  - Rad: `timeScale` 0,25, nach dem Loslassen wieder 1, Waffe gewechselt.
  - `t3`: Scope setzt `scopeK ≈ 1`, FOV 12, Overlay sichtbar. Granate wird geworfen, explodiert und hat die Spielerin in der Nähe verletzt (HP 100 → 74).
- Draw Calls an fester Messposition (Spawn, Blick nach Norden, Passanten entfernt): **182 mit meinen Neuerungen, 167 ohne** (Laden etwa 5, Löcher 1, Waffenmodelle etwa 3–5, Rest Zufall der Sichtbarkeit). Das sind etwa +15. Der Smoke-Wert 279 stammt von einer Fahrt, nicht von der Messposition, und enthält auch T1/Fahrzeug-Änderungen.

## Screenshots (`work/waffen/shots/`)
- `weapon-wheel.png`: Waffenrad in Zeitlupe mit 7 Sektoren, Icons, Munition, ausgegrautem Scharfschützengewehr und Granate, aktuelle Waffe in der Mitte.
- `shop-menu.png` und `shop-menu-after.png`: Kaufmenü „Bullseye Arms" (das zweite nach dem Kauf: OWNED-Zeilen, Restgeld, Ammo-Packs, Schutzweste). Beide stammen vom letzten Lauf von `t2.mjs`.
- `shop-front.png`: Ladenfront mit Schild und Marker.
- `aim-camera-rifle.png`, `hold-shotgun.png`, `hold-pistol.png`, `hold-sniper.png`: Waffe in der Hand im Zielmodus, Figur links im Bild.
- `flash-shotgun.png`: Mündungsfeuer der Schrotflinte.
- `sniper-scope.png`: Scharfschützen-Overlay.
- `bullet-holes.png`: Einschusslöcher am Sockel der Ladenwand (klein, helle Putzränder).
- `grenade-blast.png`: Granatenexplosion.

## Offen / bekannte Grenzen
- Die Ausrichtung von T1s `rightHand` (+Z = Blickrichtung) habe ich angenommen. Getestet habe ich mit dem alten `gunMount`-Rahmen und einer Stichprobe. Falls T1s Hand anders ausgerichtet ist, genügt ein Offset auf `weapons.hold` (`position`/`rotation`).
- Die Minimap liest nur `game.missions.getBlips()`. Mein Blip erscheint deshalb über den POI-Eintrag. Für einen eigenen „$"-Blip müsste der Minimap-Owner zusätzlich `game.shop?.getBlips?.()` einlesen (Request an HUD/Minimap). Dann den POI-Eintrag entfernen, sonst Doppelicon.
- Granaten: keine Sichtlinienprüfung der Explosion (Schaden geht durch Wände), keine Wurfbahn-Vorschau, Wurfanimation nutzt `character.punch()`.
- Schrotflinte lädt das ganze Magazin auf einmal (kein Patrone-für-Patrone-Nachladen).
- Einschusslöcher gibt es nur an Wänden und am Boden, nicht an Fahrzeugen.
- Die Shop-Kollisionsbox wird zur Laufzeit in `world.colliders` eingetragen. Passanten-Raster und Gebäude-Collider-Grid der Welt kennen sie nicht, da der Laden aber auf dem Block (nicht auf dem Gehweg) steht, ist das ohne Folgen.
- Das HUD-Fadenkreuz bleibt im Scope sichtbar (liegt unter dem Scope-Fadenkreuz).

## Runde 2

Review-Mängel und Zusatzaufgaben, eine Zeile pro Punkt. Belege: `t5.mjs`, `t6.mjs` (über `tools/heavy.sh`, Vite mit `hmr:false, watch:null`).

1. **New Game (Blocker):** Der Wrapper um `save.newGame` setzt jetzt `shop.disabled = true`. `persist()` (und damit `beforeunload`) schreibt dann nichts mehr. Beleg `t5`: Scharfschütze besessen, `persist()`, `save.newGame()`, nach dem Reload ist `gta7.arms` = `null` und der Scharfschütze nicht besessen.
2. **Granate und Wände:** `Grenades.explode()` prüft die Sichtlinie (Explosionspunkt zu Ziel gegen `world.colliders`, Höhe `maxY` beachtet, allokationsfrei) für Passanten, Autos und Spieler. Hinter einer Wand gibt es keinen Schaden. Beleg `t5` (dünne Wand auf der Straße): ohne Wand Passant tot und Spieler −26 HP, mit Wand Passant 100 HP und Spieler 0.
3. **Kaputte Munitionsdaten:** `restore()` fällt auf die Startmunition der Waffe zurück. Beleg `t5`: `{"sniper":{"ammo":"x"}}` ergibt Sniper besessen, Magazin 5, Reserve 10.
4. **Sturmgewehr in der Hand:** Die Modellgruppe `weapons.hold` ist 1,45-fach skaliert und 3 cm nach vorn verschoben. Sie hängt an T1s `rightHand`. Neues `shots/hold-rifle.png` zeigt es am Arm. Von hinten gesehen wirkt es wegen der Perspektive kurz.
5. **Pause:** Das Waffenrad schließt bei Esc, bei Verlust des Pointer-Locks und bei `blur`, das setzt `timeScale` sofort zurück (`t5`: nach Esc `open=false`, `timeScale=1`, `paused=true`).
6. **Tab im Kaufmenü:** Das Rad öffnet 300 ms nach dem Schließen des Menüs nicht (`shop.closedAt`).
7. **Hubschrauber:** `castRay` kennt `kind 'heli'` (über `helicopter.rayHit`), Hitscan-Schaden über `hitRay` (Fallback `hit`), Granaten rufen `helicopter.blast(x,y,z,12,120)` auf. Beleg `t6`: Scharfschuss 140 → 15 HP, weitere Schüsse bringen ihn auf ≤ 0. Granate unter dem Hubschrauber 140 → 56 (`t5`).
8. **Hafen:** `Player.walk` nutzt `world.isWalkable` (Schritt wird sonst auf einer Achse zurückgenommen, Wasser bleibt unbetretbar), `world.groundAt` für die Fußhöhe (Strandabfall, Stegdeck) und `world.playLimit` als Fallback-Klemme, ohne die API gilt `CITY.half - 1` und `y = 0`. Beleg `t5`: Spieler läuft den Steg bis z = 420,9 (y 0,06) und kann seitlich nicht ins Wasser, am Strand stoppt er bei z = 333,4 (y −0,57). Screenshot `shots/pier-walk.png`. Beim seitlichen Test stand der Spieler im T-Kopf (x = 10,8 ist dort Deck).
9. **Zweihand-Pose:** `refreshVisual()` ruft `character.setWeaponStyle('rifle')` für SMG, Schrotflinte, Sturmgewehr und Sniper, sonst `'pistol'` (Fäuste `'none'`). `Player` übergibt `pitch` (Blickhöhe) an `character.update`.

Tests: `npm run build` fehlerfrei, `tools/heavy.sh npm run smoke` SMOKE OK, `tools/heavy.sh node tests/qa-tour.mjs` QA OK.

Weiter offen: `hold-rifle` wirkt von hinten klein, die Beine der Zweihand-Pose habe ich nicht im Detail geprüft. Die übrigen Punkte aus „Offen" oben bleiben bestehen (Schrotflinte lädt alles auf einmal, keine Wurfbahn-Vorschau, keine Löcher an Fahrzeugen).
