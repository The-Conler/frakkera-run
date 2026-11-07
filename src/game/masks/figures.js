// v5s10: figure low-poly del carnevale di Gadoni (Giobia Lardaiolu), fedeli alle foto in
// reference/gadoni: su Maimoni (pelli scure, corna di capra, maschera di lana di pecora,
// campanacci sulla schiena legati con la corda, spiedo), su Stramaioni (stracci scuri da pastore,
// mantello di orbace scuro o grigio-beige con cappuccio, viso nero di fuliggine, bastone/forcone),
// sa Grastula (vedova in stracci scuri, velo nero sul viso - sa facciola - fuso e conocchia con
// la lana bianca). Ogni figura: gruppo con corpo + gambe/braccia su perni per una camminata semplice.
// Geometrie Kit (colori per vertice, materiali condivisi mats2): pochi draw call.
import * as THREE from 'three';
import { Kit, G, rng } from '../kit.js';

const cache = new Map();
const once = (k, f) => cache.get(k) || (cache.set(k, f()), cache.get(k));
const SKIN_D = ['#1e1a17', '#2a231d', '#352b22', '#171412'];     // pelli scure di capra/pecora
const WOOL = ['#e4ddcc', '#d6cdb8', '#efe9dc', '#cbbfa6'];
const BLACK = ['#141313', '#1b1a19', '#222020'];
const BRONZE = ['#8a6a2e', '#a07a34', '#6e5426'];

function shaggy(k, r, cx, cy, cz, w, h, d, n, pal, s = 0.17) {   // ciuffi di pelo: icosaedri sparsi
  for (let i = 0; i < n; i++) {
    const a = r.range(0, Math.PI * 2), y = r.range(-h / 2, h / 2);
    k.add(G.ico(r.range(s * 0.7, s * 1.25), 0), r.pick(pal), { x: cx + Math.cos(a) * w / 2, y: cy + y, z: cz + Math.sin(a) * d / 2, rx: r.range(0, 3), ry: r.range(0, 3), sy: r.range(1.1, 1.8), flat: true, vary: 0.12 });
  }
}
function legGeom(col, boot, len = 0.86) {
  const k = new Kit(3);
  k.add(G.cyl(0.11, 0.09, len, 6), col, { y: -len / 2, flat: true });
  k.add(G.box(0.2, 0.14, 0.3), boot, { y: -len - 0.02, z: 0.05 });
  return k.build();
}
function limb(geom, mats, x, y) { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(new THREE.Mesh(geom, mats)); return p; }

// ------------------------------------------------------------ su Maimoni
function maimoniBody() {
  const k = new Kit(11); const r = rng(11);
  // tronco coperto di pelli (cono largo, piegato in avanti) + ciuffi
  k.add(G.cyl(0.36, 0.5, 1.05, 8), SKIN_D[1], { y: 1.35, flat: true, vary: 0.1 });
  shaggy(k, r, 0, 1.3, 0, 0.95, 1.0, 0.85, 46, SKIN_D, 0.17);
  k.add(G.cyl(0.52, 0.6, 0.35, 8), SKIN_D[0], { y: 0.92, flat: true });           // gonna di pelli
  shaggy(k, r, 0, 0.88, 0, 1.15, 0.3, 1.0, 20, SKIN_D, 0.15);
  // maschera di lana di pecora (bianca), occhi e bocca neri
  k.add(G.ico(0.27, 1), WOOL[0], { y: 2.08, z: 0.1, sy: 1.15, flat: true });
  shaggy(k, r, 0, 2.1, 0.06, 0.5, 0.45, 0.45, 18, WOOL, 0.1);
  for (const x of [-0.09, 0.09]) k.add(G.box(0.07, 0.05, 0.05), '#0c0a09', { x, y: 2.14, z: 0.36 });
  k.add(G.box(0.12, 0.04, 0.05), '#0c0a09', { y: 1.98, z: 0.35 });
  // corna di capra: coni lunghi ricurvi all'indietro
  for (const s of [-1, 1]) {
    k.add(G.cone(0.07, 0.42, 6), '#7a6646', { x: s * 0.13, y: 2.42, z: 0.0, rx: -0.75, rz: -s * 0.35, flat: true });
    k.add(G.cone(0.045, 0.3, 6), '#5e4c33', { x: s * 0.2, y: 2.62, z: -0.25, rx: -1.7, rz: -s * 0.4, flat: true });
  }
  // campanacci sulla schiena, tenuti da un'imbragatura di corda
  for (const [x, y, s] of [[-0.25, 1.55, 1], [0.22, 1.6, 1.1], [0, 1.3, 1.25], [-0.3, 1.15, 0.9], [0.3, 1.2, 0.95], [0, 1.78, 0.85]]) {
    k.add(G.cyl(0.08 * s, 0.13 * s, 0.24 * s, 6), r.pick(BRONZE), { x, y, z: -0.48, rx: 0.25, flat: true, vary: 0.15 });
    k.add(G.box(0.05, 0.05, 0.05), '#2a2418', { x, y: y - 0.13 * s, z: -0.5 });
  }
  for (const s of [-1, 1]) k.add(G.box(0.05, 0.9, 0.05), '#b8a27a', { x: s * 0.28, y: 1.45, z: 0.05, rz: s * 0.25, rx: 0.1 });  // corde a tracolla
  k.add(G.box(0.85, 0.05, 0.05), '#b8a27a', { y: 1.4, z: -0.5 });
  return k.build({ ao: 0.15 });
}
function maimoniArm() {
  const k = new Kit(12); const r = rng(12);
  k.add(G.cyl(0.1, 0.09, 0.7, 6), SKIN_D[2], { y: -0.35, flat: true });
  shaggy(k, r, 0, -0.3, 0, 0.2, 0.55, 0.2, 7, SKIN_D, 0.09);
  k.add(G.ico(0.08, 0), '#5a4535', { y: -0.73 });
  return k.build();
}
function spitArm() {     // braccio con lo spiedo (e il lardo infilzato)
  const k = new Kit(13);
  k.add(G.cyl(0.1, 0.09, 0.7, 6), SKIN_D[2], { y: -0.35, flat: true });
  k.add(G.ico(0.08, 0), '#5a4535', { y: -0.73 });
  k.add(G.cyl(0.022, 0.022, 1.7, 5), '#a9a49a', { y: -0.75, z: 0.45, rx: Math.PI / 2 - 0.35 });
  k.add(G.box(0.16, 0.12, 0.12), '#efe2c6', { y: -0.5, z: 1.05, rx: -0.35 });
  return k.build();
}
export function buildMaimoni(mats) {
  const g = once('maimoni', () => ({ body: maimoniBody(), arm: maimoniArm(), spit: spitArm(), leg: legGeom('#1a1715', '#0e0c0b') }));
  const root = new THREE.Group(); const fig = new THREE.Group(); root.add(fig);
  fig.add(new THREE.Mesh(g.body, mats));
  const legs = [limb(g.leg, mats, -0.17, 0.88), limb(g.leg, mats, 0.17, 0.88)];
  const arms = [limb(g.arm, mats, -0.48, 1.78), limb(g.spit, mats, 0.48, 1.78)];
  fig.add(...legs, ...arms);
  fig.rotation.x = 0.18;                                 // carica piegato in avanti
  return { root, fig, legs, arms, kind: 'maimoni' };
}

// ------------------------------------------------------------ su Stramaioni
function stramaioneBody(seed, cloak) {
  const k = new Kit(seed); const r = rng(seed);
  k.add(G.cyl(0.3, 0.42, 0.95, 7), '#24201c', { y: 1.35, flat: true, vary: 0.12 });             // stracci scuri
  k.add(G.cyl(0.34, 0.66, 1.35, 9), cloak, { y: 1.28, flat: true, vary: 0.08 });               // mantello di orbace
  k.add(G.cone(0.34, 0.6, 8), cloak, { y: 2.18, z: -0.06, flat: true });                         // cappuccio a punta
  k.add(G.cyl(0.3, 0.34, 0.3, 8), cloak, { y: 1.95, flat: true });
  k.add(G.ico(0.2, 1), r() < 0.5 ? '#151312' : '#2a2725', { y: 1.98, z: 0.13, sy: 1.15, flat: true });  // viso di fuliggine / maschera di stoffa
  for (const x of [-0.07, 0.07]) k.add(G.box(0.05, 0.035, 0.03), '#d8cfc0', { x, y: 2.03, z: 0.31 });   // bianco degli occhi
  for (let i = 0; i < 9; i++) k.add(G.box(r.range(0.12, 0.22), r.range(0.2, 0.34), 0.05), cloak, { x: r.range(-0.55, 0.55), y: 0.62, z: r.range(-0.4, 0.4), ry: r.range(0, 3), vary: 0.2 }); // orlo sfilacciato
  k.add(G.cyl(0.07, 0.1, 0.17, 6), r.pick(BRONZE), { x: 0.3, y: 1.1, z: 0.32, flat: true });     // un campanaccio a tracolla
  k.add(G.box(0.05, 0.75, 0.04), '#9c8a66', { x: 0.05, y: 1.45, z: 0.4, rz: 0.6 });
  return k.build({ ao: 0.15 });
}
function staffArm(seed, fork) {
  const k = new Kit(seed);
  k.add(G.cyl(0.1, 0.09, 0.68, 6), '#2b2620', { y: -0.34, flat: true });
  k.add(G.ico(0.075, 0), '#3a2e26', { y: -0.7 });
  k.add(G.cyl(0.035, 0.04, 1.9, 5), '#6a4a2c', { y: -0.4, z: 0.1 });
  if (fork) for (const x of [-0.08, 0, 0.08]) k.add(G.cyl(0.015, 0.015, 0.3, 4), '#8a8478', { x, y: 0.67, z: 0.1 });
  else k.add(G.ico(0.09, 0), '#5a3c22', { y: 0.56, z: 0.1, flat: true });   // clava (macciocca)
  return k.build();
}
function ropeArm() {
  const k = new Kit(21);
  k.add(G.cyl(0.1, 0.09, 0.68, 6), '#2b2620', { y: -0.34, flat: true });
  k.add(G.ico(0.08, 0), '#3a2e26', { y: -0.7 });
  return k.build();
}
export const STRAMA_CLOAKS = ['#2a2622', '#b3a68a', '#3b3631', '#9d9178'];
export function buildStramaione(mats, v = 0) {
  const g = once('strama' + v, () => ({ body: stramaioneBody(30 + v, STRAMA_CLOAKS[v % 4]), staff: staffArm(40 + v, v % 2 === 0), rope: ropeArm(), leg: legGeom('#221d18', '#0e0c0b', 0.66) }));
  const root = new THREE.Group(); const fig = new THREE.Group(); root.add(fig);
  fig.add(new THREE.Mesh(g.body, mats));
  const legs = [limb(g.leg, mats, -0.15, 0.66), limb(g.leg, mats, 0.15, 0.66)];
  const arms = [limb(g.staff, mats, -0.44, 1.75), limb(g.rope, mats, 0.44, 1.75)];
  fig.add(...legs, ...arms);
  return { root, fig, legs, arms, kind: 'stramaione' };
}

// ------------------------------------------------------------ sa Grastula
function grastulaBody() {
  const k = new Kit(51); const r = rng(51);
  k.add(G.cyl(0.3, 0.6, 1.5, 9), '#1d1b1a', { y: 0.95, flat: true, vary: 0.1 });                // gonna lunga da vedova
  k.add(G.cyl(0.26, 0.34, 0.55, 8), '#252220', { y: 1.75, flat: true });                          // scialle
  k.add(G.cyl(0.42, 0.32, 0.4, 9), '#141313', { y: 1.82, flat: true });
  k.add(G.ico(0.22, 1), '#121111', { y: 2.2, sy: 1.25, flat: true });                             // fazzoletto/velo nero
  k.add(G.cone(0.3, 0.55, 9), '#141313', { y: 2.05, z: -0.08, rx: 0.12, flat: true });
  k.add(G.box(0.28, 0.32, 0.04), '#0b0b0b', { y: 2.15, z: 0.2 });                                 // sa facciola
  for (const x of [-0.06, 0.06]) k.add(G.box(0.045, 0.03, 0.03), '#6a645c', { x, y: 2.22, z: 0.23 });
  for (let i = 0; i < 10; i++) k.add(G.box(r.range(0.14, 0.24), r.range(0.15, 0.3), 0.05), r.pick(BLACK), { x: r.range(-0.55, 0.55), y: 0.2, z: r.range(-0.45, 0.45), ry: r.range(0, 3), vary: 0.2 }); // stracci
  return k.build({ ao: 0.15 });
}
function distaffArm() {   // conocchia con la lana bianca
  const k = new Kit(52); const r = rng(52);
  k.add(G.cyl(0.09, 0.08, 0.62, 6), '#1d1b1a', { y: -0.31, flat: true });
  k.add(G.ico(0.07, 0), '#c8a888', { y: -0.65 });
  k.add(G.cyl(0.025, 0.025, 1.1, 5), '#8a6a40', { y: -0.25, z: 0.12 });
  for (let i = 0; i < 9; i++) k.add(G.ico(r.range(0.08, 0.13), 0), r.pick(WOOL), { x: r.range(-0.08, 0.08), y: 0.35 + r.range(-0.1, 0.18), z: 0.12 + r.range(-0.08, 0.08), flat: true });
  return k.build();
}
export function spindleGeom() {    // fuso con un po' di filo bianco
  return once('fusoG', () => {
    const k = new Kit(53);
    k.add(G.cyl(0.02, 0.05, 0.55, 6), '#a87a48', { y: 0.27 });
    k.add(G.cyl(0.05, 0.015, 0.2, 6), '#a87a48', { y: -0.1 });
    k.add(G.ico(0.11, 1), '#efe8da', { y: 0.12, sy: 1.4, flat: true });
    k.add(G.cyl(0.07, 0.07, 0.04, 8), '#6a4a2a', { y: -0.03 });
    return k.build();
  });
}
function spindleArm() {
  const k = new Kit(54);
  k.add(G.cyl(0.09, 0.08, 0.62, 6), '#1d1b1a', { y: -0.31, flat: true });
  k.add(G.ico(0.07, 0), '#c8a888', { y: -0.65 });
  return k.build();
}
export function buildGrastula(mats) {
  const g = once('grastula', () => ({ body: grastulaBody(), distaff: distaffArm(), arm: spindleArm(), leg: legGeom('#1a1817', '#0c0b0b', 0.3) }));
  const root = new THREE.Group(); const fig = new THREE.Group(); root.add(fig);
  fig.add(new THREE.Mesh(g.body, mats));
  const legs = [limb(g.leg, mats, -0.13, 0.3), limb(g.leg, mats, 0.13, 0.3)];
  const arms = [limb(g.distaff, mats, -0.4, 1.95), limb(g.arm, mats, 0.4, 1.95)];
  const hand = new THREE.Mesh(spindleGeom(), mats); hand.position.set(0, -0.72, 0.08); arms[1].add(hand);
  fig.add(...legs, ...arms);
  return { root, fig, legs, arms, hand, kind: 'grastula' };
}

// camminata / saltelli: k = fase, amp = ampiezza, hop = saltello verticale
export function animateFigure(f, t, amp = 0.6, hop = 0.08) {
  const s = Math.sin(t);
  f.legs[0].rotation.x = s * amp; f.legs[1].rotation.x = -s * amp;
  if (f.kind !== 'stramaione' || !f.holdRope) f.arms[0].rotation.x = -s * amp * 0.7;
  if (f.kind === 'maimoni') { f.arms[1].rotation.x = s * amp * 0.5 - 0.4; f.fig.rotation.z = Math.sin(t * 0.5) * 0.12; }
  f.fig.position.y = Math.abs(Math.sin(t)) * hop;
}

// ------------------------------------------------------------ stendardo di cuoio dell'associazione
export function bannerTexture() {
  return once('bannerTex', () => {
    const W = 512, H = 400; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const gr = x.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 330);
    gr.addColorStop(0, '#b08562'); gr.addColorStop(1, '#7c5636'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,35,20' : '220,190,150'},${Math.random() * 0.08})`; x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1 + Math.random() * 3); }
    x.strokeStyle = 'rgba(50,28,14,0.6)'; x.lineWidth = 5; x.strokeRect(10, 10, W - 20, H - 20);
    x.fillStyle = '#2b1a10'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const arc = (txt, r, a0, a1, size, cy, inv) => {   // testo ad arco
      x.font = `bold ${size}px Georgia, serif`; const n = txt.length;
      for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n; x.save(); x.translate(W / 2 + Math.cos(a) * r, cy + Math.sin(a) * r); x.rotate(a + (inv ? -Math.PI / 2 : Math.PI / 2)); x.fillText(txt[i], 0, 0); x.restore(); }
    };
    arc('ASS. CULTURALE', 150, -Math.PI * 0.84, -Math.PI * 0.16, 34, 205);
    arc('MAIMONI E GRASTULA', 150, Math.PI * 0.92, Math.PI * 0.08, 30, 205, true);
    x.font = 'bold 34px Georgia, serif'; x.fillText('GADONI', W / 2, 370);
    // testa di capra nera con corna
    x.save(); x.translate(W / 2, 190); x.fillStyle = '#20140c';
    x.beginPath(); x.moveTo(-34, -30); x.quadraticCurveTo(-48, -90, -14, -112); x.quadraticCurveTo(-32, -80, -18, -34); x.fill();
    x.beginPath(); x.moveTo(34, -30); x.quadraticCurveTo(48, -90, 14, -112); x.quadraticCurveTo(32, -80, 18, -34); x.fill();
    x.beginPath(); x.moveTo(-40, -30); x.lineTo(40, -30); x.lineTo(22, 40); x.quadraticCurveTo(0, 62, -22, 40); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-40, -28); x.lineTo(-76, -14); x.lineTo(-44, -6); x.fill(); x.beginPath(); x.moveTo(40, -28); x.lineTo(76, -14); x.lineTo(44, -6); x.fill();
    x.beginPath(); x.moveTo(-10, 48); x.lineTo(10, 48); x.lineTo(0, 78); x.fill();   // barbetta
    x.fillStyle = '#b08562'; x.beginPath(); x.arc(-18, -6, 6, 0, 7); x.arc(18, -6, 6, 0, 7); x.fill();
    x.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  });
}
// stendardo appeso a due pali con traversa: piano centrato in x=0, base a terra
export function buildBanner(mats) {
  const root = new THREE.Group();
  const B = once('bannerG', () => {
  const k = new Kit(61);
  for (const s of [-1, 1]) k.add(G.cyl(0.06, 0.08, 3.6, 6), '#4a3220', { x: s * 1.3, y: 1.8 });
  k.add(G.cyl(0.04, 0.04, 2.8, 6), '#5a3c26', { y: 3.45, rz: Math.PI / 2 });
  for (const s of [-1, 1]) k.add(G.box(0.03, 0.3, 0.03), '#c8b088', { x: s * 1.0, y: 3.3 });
  const poles = k.build();
  const geo = new THREE.PlaneGeometry(2.3, 1.8, 6, 4);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.3) * 0.04 + (p.getY(i) < -0.6 ? 0.03 : 0));
  geo.computeVertexNormals();
  return { poles, geo, mat: new THREE.MeshLambertMaterial({ map: bannerTexture(), side: THREE.DoubleSide }) };
  });
  root.add(new THREE.Mesh(B.poles, mats));
  const cloth = new THREE.Mesh(B.geo, B.mat);
  cloth.position.y = 2.25; root.add(cloth); root.userData.cloth = cloth;
  return root;
}
