# World team report - Sprint 1

## Built (src/world/: City.js, util.js, textures.js, sky.js, props.js)
- Procedural city on the CITY grid, seeded RNG (same city every load). 8x8 blocks: downtown towers with setbacks and antennas (centre),
  mid-rise ring, houses with gable roofs at the edges. Parks (trees, paths or pond), parking lots with stall markings, 5 POI buildings.
- Roads: asphalt with double-yellow centreline and edge lines, intersections, zebra crosswalks and stop lines, raised sidewalks (0.18 m), curbs.
- Window textures via CanvasTexture (3 facade styles) with emissive lit windows at night; street lamps (instanced, glow pools at night), trees, palms, beach.
- Sea plane + sand beach on S/E, grass on N/W; invisible boundary colliders at +-(half+50).
- Sky dome shader (gradient, sun, moon, stars, clouds), fog, hemisphere + directional light with shadows following game.player?.position (texel-snapped),
  day/night cycle (start 10:00, 1 game hour per real minute).
- Perf: about 26 world meshes, ~80 draw calls total in smoke (incl. shadow pass, other teams' meshes). World ~190k tris (mostly crosswalk quads, lamps, trees).

## API notes
- All contract members implemented: colliders, getSpawnPoint, randomSidewalkPoint, randomRoadPoint (lane centre, right-hand traffic, heading; forward = (sin h, cos h)), pois, districtAt, timeOfDay (writable, applied each update), isNight (getter), sun.
- Districts: Meridian Central (centre), Ashgrove Heights (N), Marlin Pier (S), Coral Flats (E), Foundry Quarter (W), "Vice Bay Shore" outside the grid.
- POIs (door on sidewalk): hospital Saint Marlow Hospital, police Vice Bay PD - Central, garage Redline Garage, shop NightOwl Mart, safehouse Palm Loft Safehouse. Each has an emissive sign and a coloured beacon column.
- Extras: `nightFactor` (0..1), `collidersNear(x, z, r)` (40 m spatial grid; returns nearby colliders; boundary walls only when far out), `colliders[i].type` ('building'|'tree'|'boundary'), `maxY` set.
- randomRoadPoint avoids intersections (|offset| from any road line > 10 m). Spawn is (8.5, 20) on the sidewalk next to the central intersection.
- World sets `renderer.toneMapping = ACESFilmic` (exposure 1.05) in the City constructor (property only, no core file edit). Scene fog is owned by the world.

## Known issues
- Colliders list is flat (about 800 boxes); consumers should use `collidersNear` or their own grid (Peds already has one).
- Trees/palms have small square colliders; lamp posts have none. Windows only (no storefronts / doors on ground floors).
- Parked cars are not placed by world (Vehicles team). Sea has no foam; water is a lit plane with moving normal map.
- Under software GL (swiftshader) the smoke test is slow; a real GPU is fine.

## Ideas next sprint
- Ground-floor storefronts, awnings, neon/billboards downtown, bridges/piers/harbour at Marlin Pier, hills in Ashgrove, rain/weather.
- Interior-less doors for POIs (mission markers), traffic lights (needs vehicles cooperation), street signs, benches, hydrants, dumpsters.
- Shore foam + animated waves shader, LOD/cheaper shadow cascades, minimap data export (block rects, roads).
