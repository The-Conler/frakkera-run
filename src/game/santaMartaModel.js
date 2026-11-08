// v5s38: statua di Santa Marta come GLB (KTX2 + meshopt), al posto del cono Kit.
// Stesso loader dei ballerini (dancerModel.js). Fallback: geometria Kit in village3d.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sharedKTX2Loader } from './ktx2.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const URL_HI = `${BASE}models/santa-marta.glb`;
const URL_LO = `${BASE}models/santa-marta-512.glb`;

// Altezza figura Kit attuale (cima basamento → cima aureola) / altezza GLB (base y=0).
export const LIVE_STATUE_H = 2.114;
export const GLB_H = 1.027;
export const STATUE_SCALE = LIVE_STATUE_H / GLB_H;
// Cima della portantina (bordo dorato): i piedi della GLB poggiano qui.
export const LITTER_TOP_Y = 1.52;

let loader = null, prom = {}, tpl = {};

export function initStatueModel(renderer) {
  if (loader) return;
  loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(sharedKTX2Loader(renderer));
}

export function loadStatue(q = 'hi') {
  if (!loader) return Promise.resolve(null);
  if (!prom[q]) {
    const url = q === 'lo' ? URL_LO : URL_HI;
    prom[q] = loader.loadAsync(url).then((g) => {
      const mats = new Map();
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        if (!mats.has(src)) {
          if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
          mats.set(src, new THREE.MeshLambertMaterial({ map: src.map || null }));
        }
        o.material = mats.get(src);
      });
      tpl[q] = g.scene;
      return g.scene;
    }).catch((e) => {
      console.warn('[frakkera] Santa Marta GLB non caricata, uso la statua procedurale:', e && e.message || e);
      return null;
    });
  }
  return prom[q];
}

// Clone ready for the procession (scaled). Null if not loaded yet / failed.
export function statueFromModel(q = 'hi') {
  const t = tpl[q] || tpl.hi || tpl.lo;
  if (!t) return null;
  const m = t.clone(true);
  m.scale.setScalar(STATUE_SCALE);
  return m;
}
