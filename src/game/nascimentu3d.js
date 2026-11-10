// v5s37: partenza a Natale davanti al campanile (riferimento: foto "Su Nascimentu", piazza della chiesa di Gadoni).
// - fili di luci "a raggiera" che partono dalla cima del campanile e attraversano la via
// - gonna di luci attorno al campanile sotto la cella campanaria (il cono luminoso della foto)
// - capanna del presepe "Su Nascimentu" di tronchi e rami contorti, nicchie azzurre, cartello di legno
// - grande leccio accanto al campanile
// Coordinate locali: origine = centro della base del campanile (come buildVista prima della traslazione VISTA.X),
// +z verso chi arriva, la via e' a +x. Il gruppo segue la posizione della vista (world3d).
// Mobile: fili = 1 LineSegments, lampadine = Points (nucleo + alone additivo in 2 gruppi che sfarfallano),
// capanna + albero = 1 mesh Kit (mats2), cartello = 1 mesh con texture canvas. Nessuna luce dinamica in piu'.
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';
import { tree, addRock, ROCK, shrub } from './biomes/builders/common.js';
import { VISTA, TOWER } from './biomes/builders/church.js';

export const NASC = {
  HUB_Y: TOWER.H * 1.05 - 0.6,          // punto alto dei fili (sotto la cornice di coronamento)
  SKIRT_Y: 12.6 * 1.05,                 // attacco della gonna di luci (sotto la cella campanaria)
  HUT: { x: 2.2, z: 9.2, ry: 0.42 },    // v5s44b: davanti all'edificio, tutta fuori dalla carreggiata (x mondo <= -5.55)
  ROAD_R: 7.4,                          // x mondo dei punti d'arrivo oltre la via (facciate di destra)
  nightTo: [73, 133],                   // v5s44b: piena fino a dopo la capanna/chiesa (AT_M 58), sfuma a 133 m
};

const WIRE = '#2a2420';
function cat(a, b, sag, t) { return new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)); }

function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 112); g.addColorStop(0, '#9a6a40'); g.addColorStop(0.5, '#8a5a34'); g.addColorStop(1, '#6e4426');
  x.fillStyle = g; x.fillRect(0, 0, 512, 112);
  x.globalAlpha = 0.18; x.strokeStyle = '#3a2412'; for (let i = 0; i < 14; i++) { x.lineWidth = 1 + (i % 3); x.beginPath(); x.moveTo(0, 6 + i * 7.5); x.bezierCurveTo(170, 2 + i * 7.5 + (i % 2 ? 4 : -3), 340, 10 + i * 7.5, 512, 6 + i * 7.5); x.stroke(); }
  x.globalAlpha = 1; x.strokeStyle = '#4a2c16'; x.lineWidth = 6; x.strokeRect(3, 3, 506, 106);
  const draw = () => { x.font = '64px "Lilita One", "Baloo 2", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#3e2412'; x.fillText('SU NASCIMENTU', 258, 61); x.fillStyle = '#f6e6c4'; x.fillText('SU NASCIMENTU', 256, 58); };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (document.fonts && document.fonts.load) document.fonts.load('64px "Lilita One"').then(() => { x.clearRect(0, 0, 0, 0); draw(); t.needsUpdate = true; }).catch(() => {});
  return t;
}

// capanna del presepe (coordinate della capanna: fronte verso +z, larghezza lungo x)
function buildHut(k, r) {
  const W = 7.2, D = 3.4, H = 2.7, wood = ['#5a3f28', '#6b4a2e', '#4a3420', '#7a5838', '#3e2c1c'], dry = ['#8a6a48', '#7a5a3a', '#9a7a52'];
  // pavimento di terra e pietre
  k.add(G.box(W + 1.2, 0.16, D + 1.6), '#6a5a48', { y: 0.08, z: 0.3, vary: 0.1 });
  // fondo scuro e nicchie azzurre illuminate (sempre accese)
  k.add(G.box(W - 0.2, H - 0.1, 0.2), '#1c2238', { y: H / 2, z: -D / 2 + 0.1 });
  const niches = [[-2.45, 1.3, 1.5], [0, 1.9, 2.0], [2.45, 1.3, 1.5]];
  for (const [nx, nw, nh] of niches) {
    k.add(G.box(nw, nh, 0.06), '#3d6cff', { x: nx, y: 0.35 + nh / 2, z: -D / 2 + 0.24, unlit: true });
    k.add(G.box(nw * 0.7, nh * 0.55, 0.05), '#8fb4ff', { x: nx, y: 0.35 + nh * 0.55, z: -D / 2 + 0.29, unlit: true });
  }
  // pareti interne fra le nicchie (rami intrecciati)
  for (const sx of [-1.25, 1.25]) k.add(G.box(0.5, H, D - 0.4), r.pick(wood), { x: sx, y: H / 2, z: -0.1, vary: 0.2 });
  for (const sx of [-W / 2, W / 2]) k.add(G.box(0.35, H, D), r.pick(wood), { x: sx, y: H / 2, vary: 0.2 });
  // pali di tronco storti sul fronte e sul retro
  for (let i = 0; i <= 6; i++) for (const zz of [D / 2, -D / 2]) {
    const x = -W / 2 + (W * i) / 6, h = H + r.range(0.1, 0.5);
    k.add(G.cyl(0.13, 0.22, h, 6), r.pick(wood), { x: x + r.range(-0.1, 0.1), y: h / 2, z: zz, rz: r.range(-0.12, 0.12), rx: r.range(-0.08, 0.08), flat: true, vary: 0.25 });
  }
  // architrave di tronchi e rami contorti sopra le aperture (bordo frastagliato come nella foto)
  for (let i = 0; i < 9; i++) k.add(G.cyl(0.11, 0.15, W / 3 + r.range(0, 1.4), 5), r.pick(wood), { x: -W / 2 + 0.6 + i * (W - 1.2) / 8, y: H + r.range(-0.05, 0.25), z: D / 2 + 0.1, rz: Math.PI / 2 + r.range(-0.25, 0.25), flat: true, vary: 0.25 });
  for (let i = 0; i < 26; i++) { const x = r.range(-W / 2, W / 2); k.add(G.cyl(0.05, 0.08, r.range(0.6, 1.4), 4), r.pick(dry), { x, y: H - 0.25 + r.range(-0.15, 0.15), z: D / 2 + 0.22, rz: r.range(-1.3, 1.3), flat: true }); }
  // tetto: tavolato in leggera pendenza, coperto d'erba e muschio, bordo di coppi
  k.add(G.box(W + 1.0, 0.28, D + 1.2), '#4a3a28', { y: H + 0.35, z: 0, rx: -0.1 });
  for (let i = 0; i < 46; i++) k.add(G.ico(r.range(0.35, 0.7), 0), r.pick(['#4f6e2e', '#5f7f36', '#3f5a28', '#6b8a3c', '#556b30']), { x: r.range(-W / 2 - 0.3, W / 2 + 0.3), y: H + 0.6 + r.range(-0.05, 0.25), z: r.range(-D / 2 - 0.3, D / 2 + 0.4), sy: 0.55, flat: true, vary: 0.2 });
  for (let x = -W / 2 - 0.4; x < W / 2 + 0.4; x += 0.42) k.add(G.cyl(0.15, 0.15, 0.5, 6, 1, true), r.pick(['#c9773a', '#bf6c34', '#d48544', '#b8622e']), { x, y: H + 0.3, z: D / 2 + 0.75, rx: 0.15, vary: 0.1 });
  // presepe nella nicchia centrale: Maria (azzurro), Giuseppe (bruno), mangiatoia col Bambino, bue e asinello
  const nz = -D / 2 + 0.75;
  const fig = (x, col, h) => { k.add(G.cone(0.32, h, 8), col, { x, y: 0.35 + h / 2, z: nz, unlit: true }); k.add(G.sph(0.16, 8, 6), '#f3dcc0', { x, y: 0.35 + h + 0.1, z: nz, unlit: true }); };
  fig(-0.62, '#e8eef8', 1.05); fig(0.62, '#e2d2b8', 1.2);
  k.add(G.box(0.62, 0.3, 0.36), '#b08a5a', { y: 0.5, z: nz + 0.15, unlit: true }); k.add(G.sph(0.14, 8, 6), '#fff6e6', { y: 0.72, z: nz + 0.15, sx: 1.5, unlit: true });
  k.add(G.box(0.55, 0.42, 0.3), '#cfc6b8', { x: -0.45, y: 0.6, z: nz - 0.45, unlit: true }); k.add(G.box(0.5, 0.42, 0.3), '#a8a0a0', { x: 0.45, y: 0.6, z: nz - 0.45, unlit: true });
  // statuine nelle nicchie laterali (pastori)
  for (const sx of [-2.45, 2.45]) { k.add(G.cone(0.22, 0.75, 7), '#d8d0c4', { x: sx - 0.2, y: 0.72, z: nz, unlit: true }); k.add(G.sph(0.11, 7, 5), '#efd8bc', { x: sx - 0.2, y: 1.18, z: nz, unlit: true }); k.add(G.box(0.38, 0.28, 0.24), '#e8e2d8', { x: sx + 0.3, y: 0.5, z: nz + 0.2, unlit: true }); }
  // davanti: radici e tronchi contorti, pietre, recinto basso di rami (allestimento della foto)
  for (let i = 0; i < 16; i++) k.add(G.cyl(0.1, 0.17, r.range(1.0, 2.4), 5), r.pick(wood.concat(dry)), { x: r.range(-W / 2 - 0.4, W / 2 + 0.4), y: r.range(0.15, 0.55), z: D / 2 + r.range(0.6, 2.2), rz: Math.PI / 2 + r.range(-0.5, 0.5), ry: r.range(-0.8, 0.8), flat: true, vary: 0.25 });
  for (let i = 0; i < 12; i++) addRock(k, r, r.range(-W / 2 - 0.4, W / 2 + 0.4), 0.15, D / 2 + r.range(0.4, 2.4), r.range(0.18, 0.4), ROCK.granite, { squash: 0.6 });
  for (const sx of [-W / 2 - 0.5, W / 2 + 0.5]) shrub(k, r, sx, 0, D / 2 + 0.6, 0.7, ['#3f5a28', '#4f6e2e', '#5f7f36']);
  // pali del cartello
  for (const sx of [-1.25, 1.25]) k.add(G.cyl(0.11, 0.14, 1.5, 6), r.pick(wood), { x: sx, y: 0.75, z: D / 2 + 2.6, flat: true });
}

export function buildNascimentu(tex) {
  const root = new THREE.Group(); root.name = 'nascimentu';
  const r = rng(2412);
  // ---------------------------------------------------- capanna + leccio (una mesh)
  const kh = new Kit(2413); buildHut(kh, r);
  const hutGeo = kh.build({ ao: 0.22 });
  const kt = new Kit(2415);
  tree(kt, r, -6.2, 0, 1.5, 2.3, ['#3f6a2c', '#4a7a32', '#3a602a', '#5a8a3a']);   // leccio a sinistra del campanile: non copre mai torre e capanna
  for (let i = 0; i < 4; i++) shrub(kt, r, r.range(-8, -4), 0, r.range(3, 6), 0.8);
  const hutM = new THREE.Matrix4().makeRotationY(NASC.HUT.ry).setPosition(NASC.HUT.x, 0, NASC.HUT.z);
  const hutMesh = { geo: hutGeo, m: hutM };
  const treeGeo = kt.build({ ao: 0.2 });
  // ---------------------------------------------------- fili di luci
  const wires = [], bulbs = [], tw = TOWER.W * 1.05 / 2;
  const toLocal = (wx) => wx - VISTA.X;   // x mondo -> x locale (il gruppo e' traslato di VISTA.X)
  const strand = (a, b, sag, every = 0.75, skip = 0) => {
    const L = a.distanceTo(b), n = Math.max(6, Math.round(L / 2.2));
    for (let i = 0; i < n; i++) { const p0 = cat(a, b, sag, i / n), p1 = cat(a, b, sag, (i + 1) / n); wires.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); }
    const nb = Math.floor(L / every); for (let i = 1; i < nb; i++) { if (i / nb < skip) continue; const p = cat(a, b, sag, i / nb); bulbs.push(p.x, p.y - 0.06, p.z); }
  };
  const ry = VISTA.RY, rot = (x, z) => [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  // v5s37b (foto di riferimento): tutti i fili partono da UN punto sul campanile, alla base della cella campanaria,
  // e salgono a raggiera sopra la via fino ai pali sui marciapiedi (davanti e dietro): da chi corre si vedono come
  // raggi che convergono sulla torre. Attorno al punto, la "gonna" fitta di luci; tre fili salgono fino alla cima.
  const [hx, hz] = rot(tw * 0.55, tw + 0.15), HUB = new THREE.Vector3(hx, NASC.SKIRT_Y + 0.6, hz);
  const XR = toLocal(6.75), XL = toLocal(-6.75), poles = [];
  // v5s45 (20): niente fili oltre la torre (z <= 6, cioe' da ~52 m in poi): passavano davanti e sopra il cerchio del ballu tundu
  const RZ = [66, 54, 43, 33, 24, 15], LZ = [66, 56, 47];
  for (const z of RZ) { poles.push([XR, z, 13.6]); strand(HUB, new THREE.Vector3(XR, 13.4, z), 0.5, 0.62, 0.3); strand(HUB, new THREE.Vector3(XR, 12.2, z + 1.2), 0.7, 0.62, 0.3); }
  for (const z of LZ) { poles.push([XL, z, 13.6]); strand(HUB, new THREE.Vector3(XL, 13.4, z), 0.5, 0.62, 0.3); strand(HUB, new THREE.Vector3(XL, 12.2, z - 1.2), 0.7, 0.62, 0.3); }
  // gonna di luci attorno al punto di partenza (il cono luminoso della foto)
  for (let i = 0; i < 34; i++) { const ang = (i / 34) * Math.PI * 2, [x0, z0] = rot(Math.cos(ang) * tw * 1.04, Math.sin(ang) * tw * 1.04);
    const R = 4.6 + Math.sin(i * 1.7) * 0.35; strand(new THREE.Vector3(x0, HUB.y + 0.2, z0), new THREE.Vector3(Math.cos(ang) * R, HUB.y - 3.0, Math.sin(ang) * R), 0.2, 0.36); }
  // fili verticali sulla facciata, dal punto fino alla cima
  for (const u of [-0.6, 0, 0.6]) { const [fx, fz] = rot(u * tw, tw + 0.1); strand(new THREE.Vector3(fx, HUB.y, fz), new THREE.Vector3(fx, NASC.HUB_Y, fz), 0, 0.5); }
  // pali scuri sui marciapiedi (reggono i fili; stile dei pali dei fili del paese)
  const kp = new Kit(2416);
  for (const [x, z, h] of poles) { kp.add(G.cyl(0.07, 0.11, h, 6), '#2e2a2a', { x, y: h / 2, z, flat: true }); kp.add(G.box(0.18, 0.08, 0.18), '#1e1a1a', { x, y: h + 0.02, z }); }
  // ---------------------------------------------------- assemblaggio mesh
  const gHut = hutMesh.geo.clone(); gHut.applyMatrix4(hutMesh.m);
  const kAll = new Kit(2417); kAll.lit.push(...splitLit(gHut, 0), ...splitLit(treeGeo, 0), ...splitLit(kp.build(), 0)); kAll.unlit.push(...splitLit(gHut, 1));
  const geo = kAll.build({ ao: 0 });
  // ---------------------------------------------------- oggetti
  const out = { root, geo, hutM, poles };
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: WIRE, transparent: true, opacity: 0.85 })));
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
  const core = new THREE.Points(bg, new THREE.PointsMaterial({ color: '#fff4cc', size: 0.36, sizeAttenuation: true, map: tex.glow, transparent: true, depthWrite: false, toneMapped: false }));
  root.add(core);
  // aloni: due gruppi alterni che sfarfallano piano
  const halos = [];
  for (let h = 0; h < 2; h++) { const p = []; for (let i = h * 3; i < bulbs.length; i += 6) p.push(bulbs[i], bulbs[i + 1], bulbs[i + 2]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: '#ffcf6a', size: 0.62, sizeAttenuation: true, map: tex.glow, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pts = new THREE.Points(g, m); pts.renderOrder = 14; root.add(pts); halos.push(m); }
  // bagliore azzurro delle nicchie e caldo della capanna (sprite additivi, niente luci vere)
  const glows = [];
  const addGlow = (lx, ly, lz, col, s, o) => { const m = new THREE.SpriteMaterial({ map: tex.glow, color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(m); sp.scale.set(s, s, 1); const v = new THREE.Vector3(lx, ly, lz).applyMatrix4(hutM); sp.position.copy(v); sp.renderOrder = 15; root.add(sp); glows.push(m); };
  // fari caldi alla base del campanile (come nella foto): due aloni grandi e tenui sulle facce verso chi arriva e verso la via
  { const fl = (lx, lz, s, o) => { const m = new THREE.SpriteMaterial({ map: tex.glow, color: '#ffb860', transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); const sp = new THREE.Sprite(m); sp.scale.set(s, s * 1.6, 1); const [x, z] = rot(lx, lz); sp.position.set(x, 8, z); sp.renderOrder = 13; root.add(sp); };
    fl(0, tw + 0.6, 4, 0.1); fl(tw + 0.6, 0, 3.4, 0.07); }
  addGlow(0, 1.4, -0.6, '#4f7dff', 2.6, 0.26); addGlow(-2.45, 1.0, -0.7, '#3d6cff', 1.6, 0.2); addGlow(2.45, 1.0, -0.7, '#3d6cff', 1.6, 0.2); addGlow(0, 1.0, -0.4, '#fff0d0', 1.0, 0.3);
  // cartello "SU NASCIMENTU"
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.72, 0.14), [0, 1, 2, 3].map(() => new THREE.MeshLambertMaterial({ color: '#6e4426' })).concat([new THREE.MeshLambertMaterial({ map: signTexture(), emissive: '#ffffff', emissiveIntensity: 0.0 }), new THREE.MeshLambertMaterial({ color: '#6e4426' })]));
  sign.material[4].emissiveMap = sign.material[4].map; sign.material[4].emissiveIntensity = 0.35;
  sign.position.set(0, 1.25, 3.4 / 2 + 2.68).applyMatrix4(hutM); sign.rotation.y = NASC.HUT.ry; root.add(sign);
  out.update = (t) => { halos[0].opacity = 0.2 + 0.07 * Math.sin(t * 2.3); halos[1].opacity = 0.2 + 0.07 * Math.sin(t * 2.3 + 2.4); glows[0].opacity = 0.28 + 0.06 * Math.sin(t * 1.3); };
  out.nBulbs = bulbs.length / 3;
  return out;
}
// separa i gruppi (0 = lit, 1 = unlit) di una geometria Kit in geometrie singole
function splitLit(g, idx) {
  if (!g.groups.length) return idx === 0 ? [g] : [];
  const res = [];
  for (const gr of g.groups) { if (gr.materialIndex !== idx) continue; const s = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes)) s.setAttribute(name, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    res.push(s); }
  return res;
}
