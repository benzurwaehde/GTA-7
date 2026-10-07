import * as THREE from 'three';

// [hour, top, horizon]
const KEYS = [
  [0, 0x040918, 0x0a1430], [4.8, 0x070e24, 0x1a2140], [5.8, 0x2a3f72, 0xf29a72], [7, 0x4a82cc, 0xf2d2b0],
  [9, 0x3f86dc, 0xb4d6f0], [13, 0x2f78d6, 0xa6d2f2], [16.5, 0x3f80cc, 0xc4d8ea], [18.2, 0x3a5090, 0xff9050],
  [19.3, 0x1a2552, 0x6a4a60], [20.5, 0x0a1230, 0x1c1c3c], [24, 0x040918, 0x0a1430],
];
const _a = new THREE.Color(), _b = new THREE.Color();
export function skyColors(h, outTop, outHor) {
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - k0[0]) / (k1[0] - k0[0])));
  outTop.copy(_a.set(k0[1])).lerp(_b.set(k1[1]), t);
  outHor.copy(_a.set(k0[2])).lerp(_b.set(k1[2]), t);
}

export function makeSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uNight: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uTop, uHor, uSun; uniform float uNight, uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
      float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHor, uTop, pow(h, 0.55));
        float sd = max(dot(d, uSun), 0.0);
        float day = 1.0 - uNight;
        // sun glow + disc
        vec3 sunCol = mix(vec3(1.0,0.55,0.25), vec3(1.0,0.95,0.8), clamp(uSun.y*2.0,0.0,1.0));
        col += sunCol * (pow(sd, 6.0)*0.25 + pow(sd, 60.0)*0.35) * day;
        col += sunCol * smoothstep(0.9993, 0.9998, sd) * 6.0 * day;
        // moon
        vec3 mdir = -uSun; float md = max(dot(d, mdir), 0.0);
        col += vec3(0.75,0.82,1.0) * (smoothstep(0.9993, 0.9996, md)*2.2 + pow(md, 80.0)*0.12) * uNight;
        // stars
        if (d.y > 0.0) {
          vec3 sp = floor(d * 260.0);
          float s = step(0.9965, hash3(sp));
          col += vec3(s) * uNight * smoothstep(0.02, 0.3, d.y) * (0.5 + 0.5*hash3(sp+3.0));
        }
        // clouds
        if (d.y > 0.0) {
          vec2 p = d.xz / (d.y + 0.18) * 1.2 + vec2(uTime*0.006, uTime*0.002);
          float c = smoothstep(0.52, 0.85, fbm(p));
          c *= smoothstep(0.0, 0.18, d.y);
          vec3 cc = mix(vec3(1.0), uHor*1.1 + 0.15, 0.25) * (0.35 + 0.65*day);
          cc = mix(cc, sunCol, pow(sd, 4.0)*0.4*day);
          col = mix(col, cc, c * 0.85);
        }
        if (d.y < 0.0) col = mix(uHor, uHor*0.8, min(1.0, -d.y*4.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.position);
  return dome;
}
