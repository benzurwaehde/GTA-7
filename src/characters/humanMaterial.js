// One Lambert material per outfit. The GLBs carry flat colours in COLOR_0 (luminance hint for tinted parts) and a region id
// in COLOR_1.r (.25 shirt, .5 pants, .75 hair, 1 skin); the shader multiplies the region by an outfit colour.
// All materials share one shader program (same cache key), so outfits cost no extra compile.
import * as THREE from 'three';

const cache = new Map();
const REGIONS = ['shirt', 'pants', 'hair', 'skin'];

export function outfitMaterial(look) {
  const key = REGIONS.map(r => look[r]).join('|');
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uni = {};
  for (const r of REGIONS) uni[r] = { value: new THREE.Color(look[r]) };
  m.onBeforeCompile = sh => {
    for (const r of REGIONS) sh.uniforms['u_' + r] = uni[r];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 color_1;\nvarying float vReg;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvReg = color_1.r;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vReg;\nuniform vec3 u_shirt;\nuniform vec3 u_pants;\nuniform vec3 u_hair;\nuniform vec3 u_skin;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 tn = vec3(1.0);
        tn = mix(tn, u_shirt, step(0.2, vReg) * step(vReg, 0.3));
        tn = mix(tn, u_pants, step(0.45, vReg) * step(vReg, 0.55));
        tn = mix(tn, u_hair, step(0.7, vReg) * step(vReg, 0.8));
        tn = mix(tn, u_skin, step(0.95, vReg));
        diffuseColor.rgb *= tn;`);
  };
  m.customProgramCacheKey = () => 'outfit';
  cache.set(key, m);
  return m;
}
