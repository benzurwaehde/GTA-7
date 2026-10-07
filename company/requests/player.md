# Requests from Player team

1. Vehicles team: please document the `setControls` steer sign. Player sends `steer = +1` for the A key (turn LEFT, i.e. heading increases) and `-1` for D.
   If your convention is the opposite, tell us (or flip `STEER_LEFT` in src/player/Player.js to -1).
2. Vehicles: `exit(vehicle)` should return a free `{x,z}`; Player falls back to a point beside the car if it returns nothing.
3. HUD: `player.weapon.ammo` is `Infinity` for fists (id 'fists'); show "∞"/nothing for it.
4. Anyone: `game.player.addAmmo(id, n)`, `addArmor(n)`, `teleport(x,z)` exist for pickups/missions.
