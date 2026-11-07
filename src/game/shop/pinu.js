// v5s11b: Pinu rifatto da zero come mesh a faccette vere, modellata in Blender headless
// (tools/pinu_blender.py -> public/models/pinu.glb) sul riferimento dell'utente
// (reference/gadoni/pinu-confronto-utente.jpg, target2-garage-di-pinu.jpg): faccia lunga e spigolosa,
// mascella forte, espressione severa, niente baffi ne' sorriso, coppola piatta, spalle larghe e
// spioventi, giacca antracite a pieghe, camicia bianca e cravatta, mani grandi a dita intrecciate
// sul tavolo. Origine locale: piano del tavolo, z = 0 sul bordo posteriore (il tavolo e' verso +z).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const PINU_URL = `${import.meta.env.BASE_URL}models/pinu.glb`;
let geoP = null;
export function loadPinuGeometry() {
  if (!geoP) geoP = new Promise((res) => new GLTFLoader().load(PINU_URL, (g) => { let geo = null; g.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; }); res(geo); }, undefined, () => res(null)));
  return geoP;
}
export function buildPinu() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, flatShading: true });
  grp.userData.ready = loadPinuGeometry().then((geo) => {
    if (!geo) return false;
    const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; grp.add(m);
    return true;
  });
  return grp;
}
