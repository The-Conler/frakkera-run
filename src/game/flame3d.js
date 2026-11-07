// =====================================================================
// Fiamma 3D della frakkera: tre lingue di fuoco a strati (shader con
// rumore animato, additive) orientate verso la camera + nucleo caldo.
// Nessuna allocazione per frame.
// =====================================================================
import * as THREE from 'three';

const _u = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `
uniform float uTime; uniform float uSeed; uniform float uI; uniform float uLean; uniform float uNormal;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  float y = vUv.y;
  float n = fbm(vec2(vUv.x * 2.6 + uSeed, y * 2.2 - uTime * 2.3));
  float n2 = fbm(vec2(vUv.x * 5.5 - uSeed * 1.7, y * 4.6 - uTime * 3.9));
  float x = (vUv.x - 0.5) * 2.0 + (n - 0.5) * 1.25 * y + (n2 - 0.5) * 0.35 * y + uLean * y * y;
  float w = mix(0.78, 0.04, pow(y, 0.85));
  float body = 1.0 - smoothstep(w * 0.45, w, abs(x));
  float h = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.45 + n2 * 0.45, 1.0, y));
  float f = body * h * (0.55 + 0.8 * n2);
  float n3 = fbm(vec2(vUv.x * 9.0 + uSeed * 0.3, y * 7.0 - uTime * 5.2));
  f *= smoothstep(0.15, 0.55, n3 + (1.0 - y) * 0.75);           // lingue staccate in alto
  f = smoothstep(0.16, 0.78, f);
  vec3 col = mix(uA, uB, smoothstep(0.15, 0.6, f));
  col = mix(col, uC, smoothstep(0.62, 1.0, f) * (1.0 - y * 0.8));
  gl_FragColor = uNormal > 0.5 ? vec4(col, clamp(f * 1.3, 0.0, 1.0) * uI) : vec4(col * f * uI, 1.0);
}`;

// strato esterno con blending normale (si legge anche contro il cielo chiaro), interni additivi
// v5s42: basi abbassate: la parte visibile della fiamma (il fondo dello shader e' trasparente) parte sulla punta della frakkera
const LAYERS = [
  { w: 2.5, h: 4.4, a: '#8a1a08', b: '#d8400e', c: '#ff8a22', i: 0.95, y: -0.75, normal: true },
  { w: 1.8, h: 3.4, a: '#c2300a', b: '#ff7a18', c: '#ffc04a', i: 1.0, y: -0.62 },
  { w: 1.2, h: 2.3, a: '#ff6a12', b: '#ffc23a', c: '#fff2c8', i: 1.1, y: -0.45 },
  { w: 0.6, h: 1.1, a: '#ffb02a', b: '#fff0b0', c: '#ffffff', i: 1.0, y: -0.28 },
];

export class Flame3D {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = 16;
    this.layers = [];
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    LAYERS.forEach((L, k) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: L.normal ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, toneMapped: false,
        uniforms: { uNormal: { value: L.normal ? 1 : 0 }, uTime: { value: 0 }, uSeed: { value: k * 3.7 + 1.3 }, uI: { value: L.i }, uLean: { value: 0 }, uA: { value: new THREE.Color(L.a) }, uB: { value: new THREE.Color(L.b) }, uC: { value: new THREE.Color(L.c) } },
      });
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(L.w, L.h, 1); m.position.y = L.y; m.renderOrder = 16 + k; m.frustumCulled = false;
      this.group.add(m); this.layers.push({ m, mat, L });
    });
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0; this.fade = 0;
  }
  // pos: base della fiamma (punta della frakkera); size 0..1 (carburante); on: accesa
  update(dt, camera, pos, size, on, flickerLow, lean, axis) {
    this.fade += ((on ? 1 : 0) - this.fade) * Math.min(1, dt * (on ? 6 : 2.2));
    this.group.visible = this.fade > 0.02;
    if (!this.group.visible) return;
    this.t += dt;
    this.group.position.copy(pos);
    if (axis) {
      // v5s42b: base incollata alla punta, la fiamma segue in parte l'inclinazione della frakkera ma brucia verso l'alto;
      // billboard cilindrico attorno al proprio asse (la base non scivola via quando la camera guarda dall'alto)
      _u.copy(axis); if (_u.y < 0) _u.negate(); _u.multiplyScalar(0.5).add(_up).normalize();
      _z.copy(camera.position).sub(pos); _z.addScaledVector(_u, -_z.dot(_u));
      if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1); _z.normalize();
      _x.crossVectors(_u, _z).normalize(); _z.crossVectors(_x, _u);
      _m.makeBasis(_x, _u, _z); this.group.quaternion.setFromRotationMatrix(_m);
    } else this.group.quaternion.copy(camera.quaternion);
    const s = (0.6 + 0.55 * size) * (0.75 + 0.25 * this.fade);
    const fl = flickerLow ? (Math.sin(this.t * 23) > -0.3 ? 1 : 0.55) : 1;
    for (const { m, mat, L } of this.layers) {
      const wob = 1 + Math.sin(this.t * (9 + L.i * 4)) * 0.05 + Math.sin(this.t * 17.3 + L.i) * 0.04;
      m.scale.set(L.w * s * (2 - wob), L.h * s * wob, 1);
      mat.uniforms.uTime.value = this.t;
      mat.uniforms.uI.value = L.i * this.fade * fl;
      mat.uniforms.uLean.value = lean;
    }
  }
}

// v5s16: materiali condivisi per le fiamme delle frakkere a bordo strada (stesso shader della fiamma del giocatore)
export function sharedFlameMats() {
  return LAYERS.slice(0, 3).map((L, k) => new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: L.normal ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, toneMapped: false,
    uniforms: { uNormal: { value: L.normal ? 1 : 0 }, uTime: { value: 0 }, uSeed: { value: k * 5.1 + 7.7 }, uI: { value: L.i }, uLean: { value: 0 }, uA: { value: new THREE.Color(L.a) }, uB: { value: new THREE.Color(L.b) }, uC: { value: new THREE.Color(L.c) } },
    userData: { L },
  }));
}
