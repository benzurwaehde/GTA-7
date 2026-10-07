import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Preloaded GLB models (made in Blender, see tools/blender/). Files live in public/models/<name>.glb.
// getModel(name) returns a fresh clone (shares geometry/materials) or null if the file is missing,
// so every system must keep a procedural fallback.
const cache = new Map();

export async function preloadModels(names) {
  const loader = new GLTFLoader();
  await Promise.all(names.map(async name => {
    try {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
      cache.set(name, gltf);
    } catch { /* missing model -> procedural fallback */ }
  }));
}

export function getModel(name) {
  const gltf = cache.get(name);
  return gltf ? gltf.scene.clone(true) : null;
}

export function getModelAnimations(name) { return cache.get(name)?.animations ?? []; }
export function hasModel(name) { return cache.has(name); }
