// =====================================================================
// v5c: nuovo personaggio di default "IL PORTATORE" in stile mascotte cartoon
// (testa grande, occhi espressivi, sopracciglia spesse, corpo piu' corto,
// mani grandi, berritta nera, camicia bianca, gilet nero, pantaloni neri,
// scarponi scuri). Modello 3D vero costruito da primitive morbide in un'unica
// SkinnedMesh (un solo draw call) legata RIGIDAMENTE alle ossa dello
// scheletro esistente del GLB: usa le stesse clip (idle/run/left/right/
// stumble/gameover), quindi corsa, salto, abbassata e scivolata restano
// identiche. Le misure sono in metri nello spazio del modello (posa di riposo
// del GLB: y su, +z avanti, -x = destra del personaggio).
// =====================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MASCOT = {
  LEG_K: 0.76,          // gambe piu' corte (scala delle ossa della coscia): corpo piu' tozzo
  HEAD_K: 1.3,          // testa grande (scala rispetto alle misure di base)
};
const COL = {
  skin: '#f4c4a0', skinD: '#e7a682', nose: '#f0b690', shirt: '#f3efe6', shirtD: '#dcd6ca', vest: '#25211e', trousers: '#302925',
  boot: '#3a2920', sole: '#16110e', cap: '#1d1a18', capBand: '#141210', hair: '#2a1b14', brow: '#1d140f',
  eyeW: '#fbf8f2', iris: '#4a2a17', pupil: '#120a06', mouth: '#7e3f33', lid: '#3a2418',
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const V = (a) => new THREE.Vector3().fromArray(a);

export function buildMascot(model, J) {
  const bones = [], idx = {}, parts = [];
  const bi = (n) => { if (!(n in idx)) { const b = model.getObjectByName(n); if (!b) throw new Error('osso mancante ' + n); idx[n] = bones.length; bones.push(b); } return idx[n]; };
  const push = (g, color, bone, m) => {
    g.deleteAttribute('uv'); if (!g.index) g = g.toIndexed?.() || g;
    g.applyMatrix4(m);
    const n = g.attributes.position.count; _c.set(color).convertSRGBToLinear();
    const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), b = bi(bone);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; si[i * 4] = b; sw[i * 4] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  };
  // ellissoide: centro, raggi, rotazione (quaternione o eulero [x,y,z])
  const ell = (c, r, color, bone, rot, seg = [14, 10]) => {
    const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
    const q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0])));
    push(g, color, bone, _m.compose(c, q, _s.set(r[0], r[1], r[2])).clone());
  };
  // tronco di cono morbido tra due punti (con le sfere alle estremita')
  const seg = (a, b, r1, r2, color, bone, rs = 10, caps = true) => {
    const d = b.clone().sub(a), L = d.length();
    const g = new THREE.CylinderGeometry(r2, r1, L, rs, 1, true);
    push(g, color, bone, _m.compose(a.clone().add(b).multiplyScalar(0.5), _q.setFromUnitVectors(UP, d.normalize()), _s.set(1, 1, 1)).clone());
    if (caps) { ell(a, [r1, r1, r1], color, bone, null, [rs, 7]); ell(b, [r2, r2, r2], color, bone, null, [rs, 7]); }
  };
  const along = (dir, extra) => { const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()); return extra ? q.multiply(extra) : q; };
  const K = MASCOT.LEG_K, iK = 1 / K;

  // ---------------------------------------------------------------- testa
  const hd = V(J.head), nk = V(J.neck_01);
  const [rx, ry, rz] = [0.205, 0.215, 0.195], HK = MASCOT.HEAD_K;
  const H = new THREE.Vector3(0, hd.y + 0.165 * HK - 0.02, hd.z + 0.03);
  const head0 = parts.length;
  const surfZ = (x, y) => H.z + rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - ((y - H.y) / ry) ** 2));
  ell(H, [rx, ry, rz], COL.skin, 'head', null, [20, 14]);
  ell(new THREE.Vector3(0, H.y - 0.09, H.z + 0.015), [0.16, 0.11, 0.15], COL.skin, 'head', null, [14, 8]);   // guance e mento pieni
  // capelli (nuca, lati, basette)
  ell(new THREE.Vector3(0, H.y + 0.045, H.z - 0.04), [rx - 0.006, ry - 0.012, rz - 0.004], COL.hair, 'head', null, [18, 12]);
  ell(new THREE.Vector3(0, H.y - 0.05, H.z - 0.09), [rx - 0.04, 0.12, 0.11], COL.hair, 'head', null, [14, 8]);   // nuca
  // orecchie
  for (const s of [-1, 1]) {
    ell(new THREE.Vector3(s * (rx - 0.004), H.y - 0.025, H.z - 0.005), [0.03, 0.048, 0.024], COL.skin, 'head', [0, s * 0.35, 0], [10, 8]);
    ell(new THREE.Vector3(s * (rx + 0.012), H.y - 0.025, H.z), [0.012, 0.028, 0.012], COL.skinD, 'head', null, [6, 5]);
  }
  // occhi grandi: bianco, iride castana, pupilla, riflesso, palpebra superiore
  const ey = H.y - 0.005;
  for (const s of [-1, 1]) {
    const ex = s * 0.072, ez = surfZ(ex, ey);
    ell(new THREE.Vector3(ex, ey, ez - 0.012), [0.041, 0.05, 0.026], COL.eyeW, 'head', [0, s * 0.3, 0], [12, 10]);
    ell(new THREE.Vector3(ex - s * 0.004, ey - 0.004, ez + 0.006), [0.028, 0.035, 0.012], COL.iris, 'head', [0, s * 0.3, 0], [10, 8]);
    ell(new THREE.Vector3(ex - s * 0.004, ey - 0.004, ez + 0.013), [0.016, 0.02, 0.008], COL.pupil, 'head', [0, s * 0.3, 0], [8, 6]);
    ell(new THREE.Vector3(ex + s * 0.006, ey + 0.012, ez + 0.019), [0.008, 0.009, 0.004], '#ffffff', 'head', null, [6, 5]);
    ell(new THREE.Vector3(ex, ey + 0.036, ez - 0.01), [0.042, 0.008, 0.02], COL.lid, 'head', [0, s * 0.3, s * 0.08], [10, 6]);
    // sopracciglia spesse, aggrottate (l'estremita' interna piu' bassa)
    ell(new THREE.Vector3(s * 0.076, ey + 0.068, surfZ(s * 0.076, ey + 0.068) + 0.004), [0.058, 0.021, 0.022], COL.brow, 'head', [0.1, s * 0.3, s * 0.32], [10, 6]);
  }
  ell(new THREE.Vector3(0, H.y - 0.055, surfZ(0, H.y - 0.055) + 0.008), [0.02, 0.019, 0.022], COL.nose, 'head', null, [10, 8]);   // naso
  ell(new THREE.Vector3(0, H.y - 0.118, surfZ(0, H.y - 0.118) - 0.002), [0.028, 0.006, 0.01], COL.mouth, 'head', [0, 0, 0], [8, 5]);   // bocca seria
  // berritta / coppola nera: calotta piatta, fascia e visiera corta
  const cy = H.y + 0.13;
  ell(new THREE.Vector3(0, cy + 0.035, H.z - 0.01), [0.238, 0.09, 0.238], COL.cap, 'head', [0.14, 0, 0], [20, 10]);
  seg(new THREE.Vector3(0, cy - 0.025, H.z - 0.012), new THREE.Vector3(0, cy + 0.03, H.z - 0.004), 0.212, 0.222, COL.capBand, 'head', 18, false);
  ell(new THREE.Vector3(0, cy - 0.022, H.z + 0.19), [0.17, 0.018, 0.085], COL.cap, 'head', [0.22, 0, 0], [14, 6]);
  ell(new THREE.Vector3(0, cy + 0.118, H.z - 0.02), [0.016, 0.01, 0.016], COL.capBand, 'head', null, [6, 4]);
  { const T = new THREE.Matrix4().makeTranslation(H.x, H.y, H.z).multiply(new THREE.Matrix4().makeScale(HK, HK, HK)).multiply(new THREE.Matrix4().makeTranslation(-H.x, -H.y, -H.z));
    for (let i = head0; i < parts.length; i++) parts[i].applyMatrix4(T); }
  // collo e colletto della camicia
  seg(nk.clone().add(new THREE.Vector3(0, -0.03, 0)), hd.clone().add(new THREE.Vector3(0, 0.04, 0)), 0.06, 0.06, COL.skin, 'neck_01', 10, false);
  for (const s of [-1, 1]) ell(new THREE.Vector3(s * 0.052, nk.y - 0.02, nk.z + 0.075), [0.05, 0.03, 0.022], COL.shirt, 'spine_03', [0.35, s * 0.5, s * 0.55], [8, 6]);
  seg(new THREE.Vector3(0, nk.y - 0.06, nk.z - 0.005), new THREE.Vector3(0, nk.y + 0.005, nk.z - 0.01), 0.1, 0.075, COL.shirt, 'spine_03', 12, false);

  // ---------------------------------------------------------------- busto
  const s3 = V(J.spine_03), s1 = V(J.spine_01), pv = V(J.pelvis);
  ell(new THREE.Vector3(0, s3.y + 0.08, s3.z + 0.015), [0.212, 0.19, 0.135], COL.shirt, 'spine_03', null, [16, 10]);   // petto (camicia)
  ell(new THREE.Vector3(0, s1.y + 0.02, s1.z + 0.03), [0.19, 0.15, 0.13], COL.shirt, 'spine_01', null, [16, 10]);   // pancia (camicia)
  // gilet nero aperto davanti a V
  ell(new THREE.Vector3(0, s3.y + 0.085, s3.z + 0.012), [0.22, 0.205, 0.143], COL.vest, 'spine_03', null, [16, 10]);
  ell(new THREE.Vector3(0, s1.y + 0.03, s1.z + 0.03), [0.198, 0.17, 0.138], COL.vest, 'spine_01', null, [16, 10]);
  { const g = new THREE.ConeGeometry(0.062, 0.3, 3, 1); // scollatura a V: camicia bianca visibile
    push(g, COL.shirt, 'spine_03', _m.compose(new THREE.Vector3(0, s3.y + 0.16, s3.z + 0.133), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI - 0.12, Math.PI / 6, 0)), _s.set(1, 1, 0.28)).clone()); }
  // camicia che esce sotto il gilet e cintura dei pantaloni
  ell(new THREE.Vector3(0, pv.y + 0.04, pv.z + 0.02), [0.196, 0.045, 0.137], COL.shirt, 'pelvis', null, [16, 6]);
  ell(new THREE.Vector3(0, pv.y - 0.03, pv.z), [0.2, 0.11, 0.142], COL.trousers, 'pelvis', null, [16, 8]);

  // ---------------------------------------------------------------- braccia e mani grandi
  for (const sd of ['l', 'r']) {
    const sh = V(J['upperarm_' + sd]), el = V(J['lowerarm_' + sd]), wr = V(J['hand_' + sd]), mid = V(J['middle_01_' + sd]), th = V(J['thumb_01_' + sd]);
    const sx = sd === 'l' ? 1 : -1;
    ell(sh.clone().add(new THREE.Vector3(sx * 0.01, 0.0, 0)), [0.095, 0.095, 0.095], COL.shirt, 'upperarm_' + sd, null, [12, 8]);
    seg(sh, el, 0.088, 0.072, COL.shirt, 'upperarm_' + sd, 12);
    seg(el, wr, 0.07, 0.06, COL.shirt, 'lowerarm_' + sd, 12);
    const fw = wr.clone().sub(el).normalize();
    seg(wr.clone().addScaledVector(fw, -0.035), wr.clone().addScaledVector(fw, -0.005), 0.066, 0.066, COL.shirtD, 'lowerarm_' + sd, 12, false);   // polsino
    // mano: pugno grande che stringe (mitten), pollice
    const hdir = mid.clone().sub(wr).normalize();
    ell(wr.clone().addScaledVector(hdir, 0.07), [0.058, 0.078, 0.05], COL.skin, 'hand_' + sd, along(hdir), [12, 10]);
    ell(wr.clone().addScaledVector(hdir, 0.115).add(new THREE.Vector3(0, -0.012, 0)), [0.056, 0.05, 0.052], COL.skin, 'hand_' + sd, along(hdir), [10, 8]);
    ell(th.clone().addScaledVector(hdir, 0.02).addScaledVector(th.clone().sub(wr).setY(0).normalize(), 0.02), [0.022, 0.045, 0.022], COL.skin, 'hand_' + sd, along(hdir.clone().add(new THREE.Vector3(0, 0, 0.5))), [8, 6]);
  }

  // ---------------------------------------------------------------- gambe (misure divise per LEG_K: le ossa della coscia vengono scalate)
  for (const sd of ['l', 'r']) {
    const hp = V(J['thigh_' + sd]), kn = V(J['calf_' + sd]), an = V(J['foot_' + sd]), ba = V(J['ball_' + sd]);
    seg(hp.clone().add(new THREE.Vector3(0, 0.04, 0)), kn, 0.105 * iK, 0.088 * iK, COL.trousers, 'thigh_' + sd, 12);
    seg(kn, an.clone().add(new THREE.Vector3(0, 0.06, 0)), 0.085 * iK, 0.09 * iK, COL.trousers, 'calf_' + sd, 12);
    // scarpone: tomaia, gambaletto e suola (appoggiata a y = 0 prima della scala)
    const fwd = ba.clone().sub(an).setY(0).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
    const bc = an.clone().addScaledVector(fwd, 0.055 * iK); bc.y = 0.062 * iK;
    ell(bc, [0.072 * iK, 0.058 * iK, 0.135 * iK], COL.boot, 'foot_' + sd, q, [14, 8]);
    ell(bc.clone().addScaledVector(fwd, 0.06 * iK).setY(0.07 * iK), [0.064 * iK, 0.05 * iK, 0.07 * iK], COL.boot, 'foot_' + sd, q, [12, 8]);
    seg(an.clone().setY(0.06 * iK), an.clone().setY(0.13 * iK + 0.03), 0.075 * iK, 0.07 * iK, COL.boot, 'foot_' + sd, 12, false);
    ell(bc.clone().setY(0.016 * iK), [0.078 * iK, 0.018 * iK, 0.142 * iK], COL.sole, 'foot_' + sd, q, [14, 6]);
  }

  const geo = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0, name: 'mascot' });
  mat.envMapIntensity = 0;
  const fill = { value: 0.3 };
  mat.onBeforeCompile = (sh) => {   // luce di riempimento come il vecchio modello (il sole e' davanti, la camera dietro)
    sh.uniforms.uFill = fill;
    sh.fragmentShader = 'uniform float uFill;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uFill;');
  };
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'mascot'; mesh.frustumCulled = false;
  model.add(mesh);
  model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  const drop = (V(J.thigh_l).y) * (1 - K);   // di quanto scende il corpo con le gambe piu' corte (metri nel modello)
  return { mesh, mat, fill, drop, triangles: geo.index.count / 3 };
}
