import { rainLap } from '../systems/weather.js';
// v5 stage 23: giornata di neve. Giro 1 normale; nel giro 2 comincia a nevicare e si imbiancano appena tetti e
// bordi; dal giro 3 tutto bianco. Solo grafica (nessun effetto sulla simulazione, quindi resta deterministica):
// il livello dipende solo dalla distanza percorsa. Nella galleria della miniera la neve non c'e'.
import * as THREE from 'three';
import { CYCLE } from './biomes/config.js';

export const SNOW_CFG = {
  DUST: 0.38,          // copertura a fine giro 2
  FULL_AT: 0.06,       // quota del giro 3 a cui e' tutto bianco
  FLAKES_MOBILE: 450, FLAKES_DESKTOP: 900,   // tetto fiocchi (un solo draw call)
  COLD: 0.55,          // quanto la luce vira al freddo a neve piena
};
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// livello di neve al suolo (0..1) e intensita' della nevicata (0..1) a distanza b (metri, con i giri)
export function snowAt(b) {
  const lap = Math.floor(Math.max(0, b) / CYCLE), f = (Math.max(0, b) - lap * CYCLE) / CYCLE;
  if (lap <= 0) return { ground: 0, fall: 0, lap };
  if (rainLap(lap)) return { ground: 1 - sm(0, 0.12, f), fall: 0, lap };          // v5s25: la pioggia scioglie la neve
  if (lap > 2 && rainLap(lap - 1)) return { ground: sm(0, SNOW_CFG.FULL_AT, f), fall: 1, lap };
  if (lap === 1) return { ground: SNOW_CFG.DUST * sm(0.02, 0.7, f), fall: sm(0.0, 0.08, f) * 0.75, lap };
  return { ground: lap === 2 ? SNOW_CFG.DUST + (1 - SNOW_CFG.DUST) * sm(0, SNOW_CFG.FULL_AT, f) : 1, fall: 1, lap };
}

// uniformi condivise da tutti i materiali innevati
export const SNOW_U = { uSnow: { value: 0 } };

// inietta la neve sulle facce rivolte verso l'alto (copertura a chiazze che si allarga col livello).
// road: true = strada, con le tracce delle corsie lasciate piu' scure (corsie leggibili)
export function addSnow(m, o = {}) {
  const prev = m.onBeforeCompile;
  const cap = (o.cap ?? 0.92).toFixed(3);
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSnow = SNOW_U.uSnow;
    sh.vertexShader = 'varying vec3 vSnW; varying float vSnUp;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 sw = vec4(transformed, 1.0); vec3 sn = objectNormal;
        #ifdef USE_INSTANCING
          sw = instanceMatrix * sw; sn = mat3(instanceMatrix) * sn;
        #endif
        vSnW = (modelMatrix * sw).xyz; vSnUp = normalize(mat3(modelMatrix) * sn).y; }`);
    sh.fragmentShader = 'uniform float uSnow; varying vec3 vSnW; varying float vSnUp;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
      if (uSnow > 0.001) {
        vec2 sq = floor(vSnW.xz * 1.7);
        float sn = fract(sin(dot(sq, vec2(12.9898, 78.233))) * 43758.5453) * 0.6 + fract(sin(dot(floor(vSnW.xz * 0.35), vec2(39.3, 11.1))) * 9631.7) * 0.4;
        float up = smoothstep(0.3, 0.75, vSnUp);
        ${o.road ? 'sn = mix(sn, 0.08, 0.82);' : ''}
        float s = smoothstep(sn - 0.12, sn + 0.12, uSnow * 1.15) * up * ${cap};
        ${o.road ? `float ax = abs(vSnW.x);
        float lane = min(abs(ax - 3.4), ax);
        float track = 1.0 - smoothstep(0.35, 0.9, lane);
        float edge = smoothstep(3.8, 5.4, ax);
        s *= mix(0.78, 1.0, edge) * (1.0 - track * 0.55 * (1.0 - edge));` : ''}
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98), s);
        ${o.fade ? 'diffuseColor.a = mix(diffuseColor.a, 0.0, s);' : ''}
      }
      #include <emissivemap_fragment>`);
  };
  const key = m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.customProgramCacheKey = () => (key ? key() : '') + 'snow' + (o.road ? 'r' : '') + (o.fade ? 'f' : '') + cap;
  return m;
}

// fiocchi: una nuvola di punti attorno alla camera, animata nello shader (nessun costo CPU per fiocco)
export function buildFlakes(n, tex) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3), s = new Float32Array(n);
  let x = 12345;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  for (let i = 0; i < n; i++) { p[i * 3] = (rnd() - 0.5) * 44; p[i * 3 + 1] = rnd() * 22; p[i * 3 + 2] = -rnd() * 60; s[i] = rnd(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uA: { value: 0 }, uMap: { value: tex }, uPR: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uT, uPR; uniform vec3 uCam; varying float vA;
      void main() {
        vec3 q = position;
        q.y = mod(q.y - uT * (1.6 + seed * 1.4), 22.0) - 4.0;
        q.x += sin(uT * (0.5 + seed) + seed * 40.0) * 0.8;
        q.z = mod(q.z - uCam.z + 60.0, 60.0) - 60.0 + uCam.z;        // il campo segue la camera senza saltare
        q.x += uCam.x; q.y += uCam.y - 3.0;
        vec4 mv = modelViewMatrix * vec4(q.x, q.y, q.z, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.6 + seed * 0.7) * 90.0 * uPR / -mv.z, 1.0, 9.0 * uPR);
        vA = smoothstep(-58.0, -40.0, q.z - uCam.z) * smoothstep(0.0, -3.0, q.z - uCam.z);
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uA; varying float vA;
      void main() { float a = texture2D(uMap, gl_PointCoord).a * uA * vA; if (a < 0.02) discard; gl_FragColor = vec4(0.96, 0.98, 1.0, a); }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 17; pts.visible = false;
  return pts;
}

// v5s25: pioggia (gocce allungate che cadono veloci, stesso trucco dei fiocchi: tutto nello shader)
export function buildRain(n) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3), s = new Float32Array(n);
  let x = 777;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  for (let i = 0; i < n; i++) { p[i * 3] = (rnd() - 0.5) * 40; p[i * 3 + 1] = rnd() * 20; p[i * 3 + 2] = -rnd() * 50; s[i] = rnd(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uA: { value: 0 }, uPR: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uT, uPR; uniform vec3 uCam; varying float vA;
      void main() {
        vec3 q = position;
        q.y = mod(q.y - uT * (16.0 + seed * 8.0), 20.0) - 4.0;
        q.z = mod(q.z - uCam.z + 50.0, 50.0) - 50.0 + uCam.z;
        q.x += uCam.x; q.y += uCam.y - 3.0;
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(260.0 * uPR / -mv.z, 3.0, 34.0 * uPR);
        vA = smoothstep(-48.0, -30.0, q.z - uCam.z) * smoothstep(0.0, -2.5, q.z - uCam.z) * (0.5 + seed * 0.5);
      }`,
    fragmentShader: `uniform float uA; varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float a = (1.0 - smoothstep(0.03, 0.1, abs(c.x + c.y * 0.12))) * (1.0 - smoothstep(0.3, 0.5, abs(c.y))) * uA * vA; if (a < 0.02) discard; gl_FragColor = vec4(0.88, 0.93, 1.0, min(1.0, a * 1.0)); }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 17; pts.visible = false;
  return pts;
}
