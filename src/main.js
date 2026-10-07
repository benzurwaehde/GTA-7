import { Game } from './core/Game.js';
import { City } from './world/City.js';
import { Player } from './player/Player.js';
import { VehicleManager } from './vehicles/VehicleManager.js';
import { Pedestrians } from './npc/Pedestrians.js';
import { Police } from './police/Police.js';
import { Missions } from './missions/Missions.js';
import { HUD } from './ui/HUD.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { preloadModels } from './core/assets.js';
import { MODEL_LIST } from './core/modelList.js';

await preloadModels(MODEL_LIST);

const game = new Game(document.getElementById('game'), document.getElementById('ui'));
// Order matters: world first, camera-owning player after vehicles, HUD last.
game.add('world', new City(game));
game.add('audio', new AudioSystem(game));
game.add('vehicles', new VehicleManager(game));
game.add('peds', new Pedestrians(game));
game.add('police', new Police(game));
game.add('player', new Player(game));
game.add('missions', new Missions(game));
game.add('hud', new HUD(game));
game.events.emit('game:ready', {});
game.start();
window.game = game; // debugging + smoke tests
