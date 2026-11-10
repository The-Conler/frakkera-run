// v5s33 (Sa Stiddiosa, ricostruzione dal target): parete a moduli 3D (massi a strati generati con Hunyuan3D dal concept,
// ridotti a ~1.5k triangoli, colori per vertice, meshopt) disposti in due piani che seguono lo sbalzo, e tende di felci
// su carte con trasparenza (atlante disegnato nel codice) appese ai labbri delle masse. Solo grafica: niente collisioni.
// Se i modelli non si caricano resta la parete procedurale (stiddiosaCliffPiece) e le felci si appendono alle sue cenge.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { rng } from '../kit.js';

const NAMES = ['a', 'b', 'c', 'd'];   // v5s35: 4 tipi (~800-1000 triangoli), pietra grigia con crepe scure (cavita' cotte nei colori)
const URL = (n) => `${import.meta.env.BASE_URL}models/stiddiosa-rock-${n}.glb`;
let prom = null, models = null;
// geometria normalizzata: larghezza x in [-0.5,0.5], altezza y in [0,1], profondita' z in [-0.5,0.5] (fronte verso +z)
function normalize(geo) {
  geo.computeBoundingBox(); const b = geo.boundingBox, s = new THREE.Vector3(); b.getSize(s);
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(1 / s.x, 1 / s.y, 1 / s.z);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}
// labbri delle masse (facce rivolte in alto sul fronte), cercati una volta sola col raggio dal davanti
function findLips(geo) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), rc = new THREE.Raycaster(), lips = [];
  const o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1);
  for (let i = 0; i < 12; i++) { const x = -0.44 + (i / 11) * 0.88; let lastY = -1;
    for (let j = 0; j < 44; j++) { const y = 0.04 + (j / 43) * 0.94; o.set(x, y, 2); rc.set(o, d); const h = rc.intersectObject(mesh, false)[0];
      if (!h || !h.face) continue; const n = h.face.normal;
      if (n.y > 0.3 && n.z > -0.2 && y - lastY > 0.09) { lips.push(new THREE.Vector3(h.point.x, h.point.y, h.point.z)); lastY = y; } } }
  return lips;
}
export function loadCliffModels() {
  if (!prom) {
    const ld = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    prom = Promise.all(NAMES.map((n) => ld.loadAsync(URL(n)).then((g) => { let geo = null; g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => { if (o.isMesh && !geo) { geo = new THREE.BufferGeometry(); const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
        for (const k of ['position', 'normal', 'color']) { const a = src.attributes[k]; if (!a) continue; const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c); geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); }   // via la quantizzazione di gltfpack
        geo.applyMatrix4(o.matrixWorld); } });
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
      if (geo.attributes.color && geo.attributes.color.itemSize === 4) { const c = geo.attributes.color, a = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { a[i * 3] = c.getX(i); a[i * 3 + 1] = c.getY(i); a[i * 3 + 2] = c.getZ(i); } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
      normalize(geo); return { geo, lips: findLips(geo) }; })))
      .then((list) => { models = list; return list; })
      .catch((e) => { console.warn('[frakkera] parete 3D di Sa Stiddiosa non caricata, uso quella procedurale:', e && e.message || e); return null; });
  }
  return prom;
}
export function cliffModels() { return models; }

// disposizione dei moduli: colonne tra una cascata e l'altra (tacca libera di ~6 m attorno a ogni cascata), due piani
// piano 0: fronte a ~6.3 m dal centro della via, alto ~22 m; piano 1: da ~20 m, fronte 3.5 m piu' in fuori e inclinato verso la via
// v5s35: tre piani di blocchi piu' piccoli (~16 m) che seguono lo sbalzo: fronte 6.3 -> 4.6 -> 2.2 m, l'ultimo inclinato verso la via
export const CLIFF_LAYOUT = { FRONT: [6.3, 4.6, 2.2], H: [16.5, 16, 16], Y: [-0.8, 13.2, 26.6], TILT: [0, 0.05, 0.12], DEPTH: 8, NOTCH: 2.2 };
export function cliffLayout(fallsLz, from = -6, to = 247) {   // solo dentro Sa Stiddiosa (0..250 m): niente moduli nel viadotto
  const L = CLIFF_LAYOUT, r = rng(331), cols = [];
  const cuts = [from, ...fallsLz.slice().sort((a, b) => a - b), to];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i] + (i ? L.NOTCH : 0), b = cuts[i + 1] - (i < cuts.length - 2 ? L.NOTCH : 0), len = b - a; if (len < 4) continue;
    const n = Math.max(1, Math.round(len / 14)), step = len / n;
    for (let j = 0; j < n; j++) cols.push({ lz: a + step * (j + 0.5), w: step * 1.22 });
  }
  const inst = [];
  for (const c of cols) for (let t = 0; t < 3; t++) {
    const type = r.int(4), w = c.w * r.range(0.82, 1.15), h = L.H[t] * r.range(0.85, 1.15), d = L.DEPTH * r.range(0.85, 1.2);
    const ry = -Math.PI / 2 + r.range(-0.32, 0.32);
    const front = L.FRONT[t] + r.range(-0.5, 0.6) * (t ? 1 : 0.4);
    inst.push({ type, t, lz: c.lz + r.range(-1.2, 1.2), w, h, d, ry, rz: L.TILT[t] + r.range(-0.03, 0.04), x: front + d / 2, y: L.Y[t] + (t ? r.range(-1, 1) : 0) });
  }
  // v5s37: architrave SOLO sul piano alto sopra ogni cascata (niente mensole a meta' che fluttuano):
  // la tacca resta sotto (canale), in cima c'e' sbalzo continuo e l'acqua nasce SOTTO la roccia
  for (let i = 1; i < cuts.length - 1; i++) {
    const lz = cuts[i], t = 2;
    const w = L.NOTCH * 2.6 + r.range(1.5, 3.2), h = L.H[t] * r.range(0.65, 0.9), d = L.DEPTH * r.range(0.95, 1.25);
    const front = L.FRONT[t] + r.range(-0.2, 0.35), type = r.int(4);
    // y abbassato di ~1.5 m: il labbro copre meglio la cresta dell'acqua
    inst.push({ type, t, lz: lz + r.range(-0.3, 0.3), w, h, d, ry: -Math.PI / 2 + r.range(-0.14, 0.14), rz: L.TILT[t] + r.range(-0.02, 0.03), x: front + d / 2, y: L.Y[t] - 1.4 + r.range(-0.4, 0.5) });
  }
  return inst;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function instMatrix(it, out = new THREE.Matrix4()) {
  _e.set(0, it.ry, it.rz, 'ZYX'); _q.setFromEuler(_e); _p.set(it.x, it.y, -it.lz); _s.set(it.w, it.h, it.d);
  return out.compose(_p, _q, _s);
}
// le istanze (una InstancedMesh per tipo: 3 draw call) + i punti dove appendere le felci
let cliffMat = null;
export function buildCliffInstances(list, mat, fallsLz) {
  // v5s35: materiale proprio leggermente freddo -> pietra grigia anche sulle facce al sole (il materiale condiviso resta com'e')
  if (!cliffMat || cliffMat.userData.src !== mat) {
    cliffMat = mat.clone(); cliffMat.color.set('#c2c6ca'); cliffMat.userData.src = mat;
    // v5s46c (4): la parete non sembra piu' una massa liscia: faccette (flat shading) + strati e crepe in coordinate mondo
    cliffMat.flatShading = true;
    cliffMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 rw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            rw = instanceMatrix * rw;
          #endif
          vRW = (modelMatrix * rw).xyz; }`);
      sh.fragmentShader = 'varying vec3 vRW;\nfloat rkH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n'
        + 'float rkN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(rkH(i), rkH(i + vec3(1,0,0)), f.x), mix(rkH(i + vec3(0,1,0)), rkH(i + vec3(1,1,0)), f.x), f.y), mix(mix(rkH(i + vec3(0,0,1)), rkH(i + vec3(1,0,1)), f.x), mix(rkH(i + vec3(0,1,1)), rkH(i + vec3(1,1,1)), f.x), f.y), f.z); }\n'
        + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        { float n = rkN(vRW * 0.9) * 0.55 + rkN(vRW * 2.7) * 0.3 + rkN(vRW * 7.0) * 0.15;
          float strata = sin(vRW.y * 2.3 + rkN(vRW * 0.35) * 5.0) * 0.5 + 0.5;
          float crack = smoothstep(0.035, 0.0, abs(rkN(vRW * vec3(1.6, 0.55, 1.6)) - 0.5));
          diffuseColor.rgb *= (0.78 + 0.34 * n) * (0.9 + 0.12 * strata) * (1.0 - 0.45 * crack); }`);
    };
    cliffMat.customProgramCacheKey = () => 'cliffRough';
    cliffMat.needsUpdate = true;
  }
  mat = cliffMat;
  const L = cliffLayout(fallsLz), meshes = [], lips = [];
  // v5s35: istanze divise in due blocchi lungo la via (0-125 / 125-250 m) cosi' quello alle spalle viene scartato dal frustum
  for (let k = 0; k < list.length; k++) for (const half of [0, 1]) {
    const its = L.filter((it) => it.type === k && (it.lz >= 125) === !!half); if (!its.length) continue;
    const im = new THREE.InstancedMesh(list[k].geo, mat, its.length);
    its.forEach((it, i) => { instMatrix(it, _m); im.setMatrixAt(i, _m);
      for (const lp of list[k].lips) { const p = lp.clone().applyMatrix4(_m); lips.push({ x: p.x, y: p.y, z: p.z, t: it.t }); } });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox?.();
    meshes.push(im);
  }
  // v5s36: punti d'appoggio delle felci presi sulla faccia VISIBILE della parete: raggi orizzontali dalla via verso la roccia,
  // griglia ~3.4 m (lungo la via) x 3.6 m (in altezza). Cosi' le tende non finiscono nascoste dietro il piano di blocchi davanti.
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3(1, -0.08, 0).normalize(), rr = rng(919), face = [];
  for (const im of meshes) im.updateMatrixWorld(true);
  const lzMax = Math.max(...L.map((it) => it.lz));
  for (let lz = -4; lz < lzMax + 4; lz += 3.4) for (let y = 7; y < 46; y += 3.6) {
    o.set(0, y + rr.range(-0.8, 0.8), -(lz + rr.range(-1, 1))); rc.set(o, dir); rc.far = 30;
    const h = rc.intersectObjects(meshes, false)[0]; if (!h) continue;
    face.push({ x: h.point.x, y: h.point.y, z: h.point.z, t: h.point.y > 14 ? 1 : 0 });
  }
  return { meshes, lips: face.length > 40 ? face : lips };
}

// ------------------------------------------------------------------ felci su carte
// atlante 1024x512: 4 celle 256x512 (disegnato qui come riserva; di norma sostituito da textures/stiddiosa-ferns.webp: 4 tende FLUX)
let fernTex = null;
export function fernAtlas() {
  if (fernTex) return fernTex;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'); const r = rng(77);
  const G = ['#2a5a1e', '#356a22', '#417a28', '#4f8a2e', '#5e9834', '#6ea83c', '#86bc4a'];
  const frond = (x0, y0, len, dir, sway, w0, cols) => {   // fronda: stelo che pende con foglioline a coppie
    let px = x0, py = y0, a = dir; const n = Math.floor(len / 6);
    for (let i = 0; i < n; i++) { const t = i / n; a += sway * 0.02 + (r() - 0.5) * 0.04; const nx = px + Math.sin(a) * 6, ny = py + Math.cos(a) * 6;
      x.strokeStyle = '#3a5a20'; x.lineWidth = 1.6 * (1 - t) + 0.6; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      const lw = w0 * (1 - t * 0.85) * (0.8 + r() * 0.4);
      for (const s of [-1, 1]) { x.fillStyle = cols[Math.min(cols.length - 1, Math.floor((r() * 0.6 + t * 0.4) * cols.length))];
        x.save(); x.translate(nx, ny); x.rotate(-a + s * (1.0 + r() * 0.3)); x.beginPath(); x.ellipse(0, lw * 0.5, lw * 0.32, lw * 0.62, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(220,255,160,0.22)'; x.beginPath(); x.ellipse(-lw * 0.08, lw * 0.4, lw * 0.12, lw * 0.4, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
      px = nx; py = ny; }
  };
  for (let cell = 0; cell < 3; cell++) {
    const ox = cell * 256;
    // massa di muschio in alto (attacco)
    for (let i = 0; i < 26; i++) { x.fillStyle = G[r.int(4)]; x.beginPath(); x.ellipse(ox + 30 + r() * 196, 8 + r() * 22, 8 + r() * 14, 5 + r() * 9, 0, 0, Math.PI * 2); x.fill(); }
    const nF = cell === 1 ? 26 : 24;
    for (let i = 0; i < nF; i++) { const fx = ox + 14 + r() * 228, len = (cell === 1 ? 220 : 260) + r() * (cell === 2 ? 180 : 230);
      if (cell === 1 && r() < 0.5) { // liana sottile con foglie tonde
        let py = 14, px = fx; const lenV = Math.min(len, 470); x.strokeStyle = '#3a5a22'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, py); while (py < lenV) { px += (r() - 0.5) * 3; py += 6; x.lineTo(px, py); } x.stroke();
        for (let y = 20; y < lenV; y += 9 + r() * 6) { x.fillStyle = G[2 + r.int(5)]; x.beginPath(); x.ellipse(fx + (r() - 0.5) * 8, y, 4 + r() * 3, 5 + r() * 3, r() * 3, 0, Math.PI * 2); x.fill(); }
      } else { const y0 = 8 + r() * 30; frond(fx, y0, Math.min(len, 470 - y0), (r() - 0.5) * 0.35, (r() - 0.5) * 0.6, 26 + r() * 12, G.slice(1)); }
    }
  }
  // cella 4: ciuffo di felce a ventaglio (dal basso verso l'alto)
  for (let i = 0; i < 14; i++) { const a = Math.PI + (i / 13 - 0.5) * 2.4; x.save(); x.translate(768 + 128, 500); x.rotate(0); frond(0, 0, 230 + r() * 140, a, (i < 7 ? -1 : 1) * 0.8, 22 + r() * 8, G.slice(1)); x.restore(); }
  fernTex = new THREE.CanvasTexture(c); fernTex.colorSpace = THREE.SRGBColorSpace; fernTex.anisotropy = 4;
  // v5s35: tende di felci generate (FLUX) e scontornate: sostituiscono quelle disegnate appena l'immagine arriva (se manca restano queste)
  if (typeof Image !== 'undefined') { const img = new Image(); img.onload = () => { fernTex.image = img; fernTex.needsUpdate = true; }; img.src = `${import.meta.env.BASE_URL}textures/stiddiosa-ferns.webp`; }
  return fernTex;
}
let fernMat = null; export const FERN_U = { uT: { value: 0 } };
export function fernMaterial() {
  if (fernMat) return fernMat;
  fernMat = new THREE.MeshLambertMaterial({ map: fernAtlas(), alphaTest: 0.2, side: THREE.DoubleSide, vertexColors: true });
  fernMat.onBeforeCompile = (sh) => { sh.uniforms.uT = FERN_U.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float k = 1.0 - uv.y; float w = sin(uT * 1.4 + position.z * 0.35 + position.y * 0.2) + 0.5 * sin(uT * 2.3 + position.z * 0.9);
        transformed.z += w * 0.18 * k * k; transformed.x += w * 0.08 * k * k; }`); };
  fernMat.customProgramCacheKey = () => 'fernSway';
  return fernMat;
}
// una carta pendente: 2 tratti in verticale (4 triangoli), si stacca un po' dalla parete scendendo
function card(pos, uv, col, cx, cy, cz, w, L, cell, out, shade) {
  // v5s46c (4): carte piu' morbide: 4 tratti che si staccano dalla parete in curva e ondeggiano un po' di lato
  // (prima 2 tratti dritti: le fronde lunghe sembravano righe tirate col righello); si usa la parte alta, piu' fitta, della tenda
  const u0 = cell * 0.25 + 0.008, u1 = u0 + 0.234, segs = [0, 0.22, 0.48, 0.74, 1], dx = [0, -0.2, -0.46, -0.66, -0.78];
  const ph = cx * 1.7 + cz * 0.9, sway = [0, 0.18, -0.12, 0.22, -0.08].map((v, i) => v * Math.sin(ph + i));
  const V0 = 1, V1 = 0.5;   // solo la meta' alta dell'atlante (fronde fitte); sotto erano fili dritti radi
  for (let s = 0; s < 4; s++) {
    const ya = cy - L * segs[s], yb = cy - L * segs[s + 1], xa = cx + dx[s], xb = cx + dx[s + 1];
    const va = V0 + (V1 - V0) * segs[s], vb = V0 + (V1 - V0) * segs[s + 1], za = cz + sway[s] * L * 0.25, zb = cz + sway[s + 1] * L * 0.25;
    const P = [[xa, ya, za - w / 2, u0, va], [xa, ya, za + w / 2, u1, va], [xb, yb, zb + w / 2, u1, vb], [xb, yb, zb - w / 2, u0, vb]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(P[i][0], P[i][1], P[i][2]); uv.push(P[i][3], P[i][4]); col.push(col.r0 * shade, col.g0 * shade, col.b0 * shade); }
  }
}
// tende di felci: lips = punti {x (mondo, lato destro), y, z}
// v5s36: cortine fitte e sovrapposte (~50-60% della parete). I bordi vengono raggruppati in "mensole" (una ogni ~2.6 m x 3.2 m,
// si tiene il punto piu' vicino alla via), ogni mensola porta 2-3 carte sfalsate in profondita'; tetto MAX_CARDS -> <=5k triangoli.
// Restituisce due geometrie (0-125 / 125-250 m) cosi' quella alle spalle viene scartata: 2 draw call.
export const FERN_MAX_CARDS = 1240;   // v5s46c: 8 triangoli a carta -> <= 9920 triangoli
export function buildCurtains(lips, seed = 5, o = {}) {
  const r = rng(seed), keep = o.keep ?? 1, cells = new Map();
  for (const lp of lips) {
    const k = Math.round(lp.z / 3.4) + ':' + Math.round(lp.y / 3.6), c = cells.get(k);
    if (!c || lp.x < c.x) cells.set(k, lp);
  }
  const ledges = [...cells.values()].sort((p, q) => p.z - q.z || p.y - q.y);
  for (let i = ledges.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ledges[i], ledges[j]] = [ledges[j], ledges[i]]; }
  const B = [0, 1].map(() => ({ pos: [], uv: [], col: [] })); let cards = 0;
  const put = (lp, x, y, z, w, L, shade) => {
    let Lc = L; if (x < 5.6) Lc = Math.min(L, y - 3.2); if (Lc < 1.2) return;   // mai sotto i 3 m dentro la via
    const b = B[-z >= 125 ? 1 : 0], kk = r.range(0.95, 1.12), warm = r.range(0, 0.06);
    b.col.r0 = kk + warm; b.col.g0 = kk; b.col.b0 = kk * 0.92;
    card(b.pos, b.uv, b.col, x, y, z, w, Lc, r.int(4), null, shade); cards++;
  };
  const avoid = o.avoid || [];   // v5s37: niente tende davanti alle cascate
  for (const lp of ledges) {
    if (cards >= FERN_MAX_CARDS) break;
    if (r() > keep) continue;
    // evita solo la colonna d'acqua (sotto il labbro); le felci sul labbro restano e mascherano la cresta
    if (avoid.some((f) => Math.abs(lp.z - f.z) < f.half && lp.y < (f.y0 - 1.2) && lp.y > (f.yMin ?? 3))) continue;
    const n = r.chance(0.45) ? 3 : 2, gap = r.range(0.9, 1.35);
    for (let i = 0; i < n && cards < FERN_MAX_CARDS; i++) {
      const L = (r.chance(0.6) ? r.range(5.0, 7.2) : r.range(2.5, 5.0)) * (lp.t ? 1.08 : 1) * 0.6;   // v5s46c: tende piu' corte (la parte rada e dritta in basso non si usa piu')
      const z = lp.z + (i - (n - 1) / 2) * gap + r.range(-0.3, 0.3);
      const back = (i === Math.floor(n / 2)) ? 0 : r.range(0.12, 0.4);   // centrale davanti, laterali un po' piu' indietro e piu' scure
      put(lp, lp.x - 0.5 + back, lp.y + r.range(0.1, 0.45), z, r.range(2.6, 3.8), L, back ? r.range(0.8, 0.92) : 1);
    }
  }
  return B.filter((b) => b.pos.length).map((b) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  });
}
