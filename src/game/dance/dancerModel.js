// v5s30: ballerina del ballu tundu come modello 3D (GLB, TRELLIS MIT) — solo le donne; gli uomini restano procedurali.
// v5s30b: pivot di spalle/anche corretti (mesh su un figlio del nodo) + ballerino uomo GLB (dancer-man*.glb).
// Female Ballu Tundu dancer as a GLB with rigid nodes fig / arm_R / arm_L / leg_R / leg_L.
// The procedural dancer stays as fallback (load error, not loaded yet, or male dancer).
// Loaders: KTX2 (basis transcoder in public/basis/) + Meshopt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sharedKTX2Loader } from '../ktx2.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const URLS = {
  w: { hi: `${BASE}models/dancer-woman.glb`, lo: `${BASE}models/dancer-woman-512.glb` },
  m: { hi: `${BASE}models/dancer-man.glb`, lo: `${BASE}models/dancer-man-512.glb` },
};
// the GLB is 1.62 m tall; the procedural woman is ~2.05 units tall (veil top). The scale goes on `fig`
// (not into the geometry: meshopt positions are quantized normalized ints and would overflow), so
// fig.position.y bounce (danceStep/animateCrowd, written in root space) keeps its current units.
// man: GLB 1.92 m incl. hat; procedural man ~2.47 units overall -> K ~1.286.
const KS = { w: 2.05 / 1.62, m: 2.47 / 1.92 };
let loader = null; const prom = {}, tpl = {};

export function initDancerModels(renderer) {           // call once where the WebGLRenderer exists (world3d.js)
  if (loader) return;
  loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(sharedKTX2Loader(renderer));
}
export function loadWoman(q = 'hi') { return loadDancer('w', q); }
export function loadMan(q = 'hi') { return loadDancer('m', q); }
function loadDancer(sex, q) {
  if (!loader) return Promise.resolve(null);
  const key = sex + q;
  if (!prom[key]) prom[key] = loader.loadAsync(URLS[sex][q]).then((g) => {
    const fig = g.scene.getObjectByName('fig');
    if (!fig || !['arm_R', 'arm_L', 'leg_R', 'leg_L', 'body'].every((n) => g.scene.getObjectByName(n))) throw new Error('dancer GLB: missing nodes');
    const mats = new Map();
    fig.scale.setScalar(KS[sex]);
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      if (!mats.has(src)) { if (src.map) src.map.colorSpace = THREE.SRGBColorSpace; mats.set(src, new THREE.MeshLambertMaterial({ map: src.map || null })); }
      o.material = mats.get(src);                       // one shared Lambert material, like towerModel.js
    });
    tpl[key] = g.scene; return g.scene;
  }).catch((e) => { console.warn(`[frakkera] ${sex === 'w' ? 'ballerina 3D non caricata, uso quella' : 'ballerino 3D non caricato, uso quello'} procedurale:`, e && e.message || e); return null; });
  return prom[key];
}
// same shape as buildDancer(): { root, fig, legs:[-x, +x], arms:[-x, +x], woman }
export function womanFromModel(q = 'hi') { return fromModel('w', q); }
export function manFromModel(q = 'hi') { return fromModel('m', q); }
function fromModel(sex, q) {
  const t = tpl[sex + q] || tpl[sex + 'hi'] || tpl[sex + 'lo']; if (!t) return null;
  const root = t.clone(true);                           // clones share geometry + material
  const N = (n) => root.getObjectByName(n);
  return { root, fig: N('fig'), arms: [N('arm_R'), N('arm_L')], legs: [N('leg_R'), N('leg_L')], woman: sex === 'w' };
}
