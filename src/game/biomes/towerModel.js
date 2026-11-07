// v5s27n: la torre di roccia come modello 3D vero (generato dalla scheda di riferimento), al posto della torre procedurale.
// Se il modello non si carica resta la torre procedurale (fallback).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
export const TOWER_URL = `${import.meta.env.BASE_URL}models/tower.glb`;
export const NEAR_X = -4.7;   // punto piu' vicino alla via della torre procedurale (v5s27l)
export const TOWER_ROT = 0.0;      // rotazione del modello attorno all'asse verticale (lato visto dalla via)
let prom = null, model = null;
export function loadTower() {
  if (!prom) prom = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(TOWER_URL).then((g) => {
    const grp = new THREE.Group();
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (!o.isMesh) return;
      const src = o.material, mat = new THREE.MeshLambertMaterial({ map: src.map || null, color: src.map ? 0xffffff : (src.color || 0xaaaaaa) });
      if (mat.map) { mat.map.colorSpace = THREE.SRGBColorSpace; mat.color.setScalar(1.25); mat.emissive.setRGB(1, 0.95, 0.88); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.28; }   // la texture generata e' piu' scura della pietra di gioco
      const geo = o.geometry; if (!geo.attributes.normal) geo.computeVertexNormals();
      { // v5s27o: piede della torre piu' chiaro (la texture generata e' molto scura in basso): schiarita che sfuma salendo
        geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, hh = geo.boundingBox.max.y - y0, P = geo.attributes.position, c = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) { const t = (P.getY(i) - y0) / hh, q = Math.max(0, Math.min(1, t / 0.72)), k = 1 + 1.1 * (1 - q * q * (3 - 2 * q)); c[i * 3] = k; c[i * 3 + 1] = k * 0.98; c[i * 3 + 2] = k * 0.95; }
        geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); mat.vertexColors = true; }
      const m = new THREE.Mesh(geo, mat); m.applyMatrix4(o.matrixWorld); grp.add(m); });
    model = grp; return grp; }).catch((e) => { console.warn('[frakkera] torre 3D non caricata, uso la torre procedurale:', e && e.message || e); return null; });
  return prom;
}
export function towerModel() { return model; }
// adatta il modello all'ingombro della torre procedurale (stessa altezza, stessa base, stesso centro)
export function fitTower(proc, parent) {
  const place = (src) => { if (!src) return;
    const inst = src.clone(); const bb = new THREE.Box3().setFromObject(inst); const pg = proc.geometry; pg.computeBoundingBox(); const pb = pg.boundingBox;
    const s = (pb.max.y - pb.min.y) / (bb.max.y - bb.min.y);
    const sw = 0.85; inst.scale.set(s * sw, s, s * sw);   inst.rotation.y = TOWER_ROT;   // stesso L/A della torre di prima (~0.40)
    const c = new THREE.Vector3(); bb.getCenter(c);
    const pc = new THREE.Vector3(); pb.getCenter(pc);
    const off = c.clone().multiply(new THREE.Vector3(s * sw, s, s * sw)).applyAxisAngle(new THREE.Vector3(0, 1, 0), TOWER_ROT);
    inst.position.set(proc.position.x + pc.x - off.x, proc.position.y + pb.min.y - bb.min.y * s, proc.position.z + pc.z - off.z);
    inst.updateMatrixWorld(true); { const wb = new THREE.Box3().setFromObject(inst); if (wb.max.x > NEAR_X) inst.position.x -= wb.max.x - NEAR_X; }   // mai piu' vicina alla via di prima
    inst.name = 'towerModel'; parent.add(inst); proc.visible = false; };
  // v5s27p: niente torre procedurale che compare e poi cambia: resta nascosta finche' il modello arriva, e si vede solo se il modello manca
  if (model) place(model); else { proc.visible = false; loadTower().then((m) => { if (m) place(m); else proc.visible = true; }); }
}
