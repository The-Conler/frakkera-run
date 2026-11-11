// feat-village: vita del paese. Panni stesi della nonna (ci si abbassa), tessitrice al telaio sulla soglia,
// processione di Santa Marta (statua sulla portantina + portatori), paesani che esultano dalle finestre.
// Geometrie Kit a colori per vertice (mats2 condivisi), poche decine di pezzi l'una: leggere sul telefono.
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';
import { buildDancer } from './dance/dancers.js';
import { statueFromModel, LITTER_TOP_Y } from './santaMartaModel.js';
import { CARPET_ASPECT, loadCarpetTexture } from './tex3d.js';

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
const LINE_Y = 4.2, HALF = 6.3;           // v5s43: il filo sta in alto (l'urto resta quello della trave, non il disegno)

// filo da balcone a balcone con lenzuola, tovaglie e camicie; la nonna affacciata a sinistra
export function laundryGeom(v = 0) {
  return once('laundry43_' + v, () => {   // v5s43: filo alto, pali chiari
    const k = new Kit(410 + v), r = rng(410 + v);
    const N = 20, yAt = (t) => LINE_Y - Math.sin(t * Math.PI) * 0.28;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, x0 = -HALF - 0.5 + (HALF * 2 + 1) * t0, x1 = -HALF - 0.5 + (HALF * 2 + 1) * t1, ya = yAt(t0), yb = yAt(t1);
      k.add(G.box(Math.hypot(x1 - x0, yb - ya), 0.04, 0.04), '#e8e2d4', { x: (x0 + x1) / 2, y: (ya + yb) / 2, rz: Math.atan2(yb - ya, x1 - x0) });
    }
    const PAL = ['#d8cbb6', '#cfc3a8', '#c4b8a0', '#d2b09e', '#a8b4c0', '#d0c090'];   // v5s36: crema (niente bianco puro che sembra un placeholder)
    let x = -HALF + 0.3;
    while (x < HALF - 0.6) {
      const t = (x + HALF + 0.5) / (HALF * 2 + 1), y = yAt(t), kind = r.int(0, 3);
      if (kind <= 1) {             // lenzuolo / tovaglia: pendono dal filo alto, non una barra grigia in basso
        const w = r.range(1.1, 1.7), h = Math.min(1.35, y - 2.7), col = r.pick(PAL);
        k.add(G.box(w, h, 0.05), col, { x: x + w / 2, y: y - h / 2, rz: r.range(-0.03, 0.03) });   // v5s36: lit (unlit faceva lenzuola bianche al neon)
        if (kind === 1) for (let j = 0; j < 3; j++) k.add(G.box(w, 0.08, 0.07), '#c8283a', { x: x + w / 2, y: y - 0.25 - j * 0.3 });   // tovaglia a righe rosse
        k.add(G.box(0.05, 0.12, 0.08), '#8a6a3a', { x: x + 0.1, y: y + 0.02 }); k.add(G.box(0.05, 0.12, 0.08), '#8a6a3a', { x: x + w - 0.1, y: y + 0.02 });   // mollette
        x += w + 0.15;
      } else {                     // camicia o calze
        const col = r.pick(['#3a5a8a', '#c8a050', '#8a2a2a', '#f6f3ec']);
        k.add(G.box(0.7, 0.75, 0.05), col, { x: x + 0.35, y: y - 0.4 }); k.add(G.box(1.1, 0.22, 0.05), col, { x: x + 0.35, y: y - 0.13 });
        x += 0.95;
      }
    }
    // la nonna al balcone sinistro: scialle nero, fazzoletto in testa, cesto
    const nx = -HALF + 0.3;
    k.add(G.box(1.6, 0.14, 1.4), '#9a948a', { x: nx - 0.2, y: LINE_Y + 0.6 }); for (let i = 0; i < 6; i++) k.add(G.box(0.04, 0.8, 0.04), '#2a2d31', { x: nx + 0.55, y: LINE_Y + 1.05, z: -0.6 + i * 0.24 }); k.add(G.box(0.05, 0.06, 1.4), '#2a2d31', { x: nx + 0.55, y: LINE_Y + 1.45 });
    k.add(G.cyl(0.32, 0.42, 1.0, 8), '#1e1c1e', { x: nx + 0.1, y: LINE_Y + 1.15 });
    k.add(G.sph(0.22, 8, 6), '#e0b48e', { x: nx + 0.12, y: LINE_Y + 1.85 });
    k.add(G.cone(0.3, 0.45, 8), '#2a2628', { x: nx + 0.1, y: LINE_Y + 2.05 });
    k.add(G.box(0.12, 0.55, 0.12), '#1e1c1e', { x: nx + 0.45, y: LINE_Y + 1.55, rz: -1.0 });     // braccio verso il filo
    k.add(G.cyl(0.3, 0.22, 0.28, 8), '#a8743a', { x: nx - 0.35, y: LINE_Y + 0.8 });               // cesto dei panni
    for (const s of [-1, 1]) {
      const x = s * 6.35;
      k.add(G.cyl(0.22, 0.26, LINE_Y + 0.35, 8), '#e2c49a', { x, y: (LINE_Y + 0.35) / 2 });
      k.add(G.box(1.15, 0.36, 1.15), '#8a6240', { x, y: -0.04 });
      k.add(G.box(0.85, 0.14, 0.16), '#f3efe4', { x: s * 6.55, y: LINE_Y + 0.02 });
      k.add(G.box(0.12, 0.12, 0.12), '#f3efe4', { x: s * (HALF + 0.5), y: LINE_Y });
    }
    return k.build({ ao: 0.12 });
  });
}

// telaio verticale a bordo strada con l'ordito colorato e un tappeto a meta'; soglia scura dietro
export function loomGeom(v = 0) {
  // v5s44c: telaio orizzontale sardo (foto di Gadoni): telaio a terra in legno miele scuro
  return once('loom44c_' + v, () => {
    const k = new Kit(430 + v);
    const wood = '#7a5230', woodD = '#5a3a20', woodL = '#9a6a3c';
    const W = 1.12, L = 2.15, H = 2.02;
    for (const x of [-W / 2, W / 2]) for (const z of [-L / 2, L / 2]) k.add(G.box(0.11, H, 0.11), wood, { x, y: H / 2, z });
    k.add(G.box(W + 0.14, 0.09, 0.1), woodD, { y: H, z: L / 2 });
    k.add(G.box(W + 0.14, 0.09, 0.1), woodD, { y: H, z: -L / 2 });
    k.add(G.box(0.1, 0.09, L + 0.14), woodD, { x: -W / 2, y: H });
    k.add(G.box(0.1, 0.09, L + 0.14), woodD, { x: W / 2, y: H });
    k.add(G.box(W + 0.18, 0.1, 0.11), wood, { y: H + 0.04, z: 0.12 });   // trave delle licci
    for (const x of [-0.22, 0.22]) {
      k.add(G.cyl(0.05, 0.05, 0.07, 8), woodD, { x, y: H - 0.04, z: 0.12, rx: Math.PI / 2 });
      k.add(G.box(0.02, 0.42, 0.02), '#3a3028', { x, y: H - 0.32, z: 0.12 });
      k.add(G.box(0.32, 0.26, 0.05), '#d8cfc0', { x, y: H - 0.58, z: 0.12 });
    }
    k.add(G.cyl(0.065, 0.065, W + 0.12, 8), woodL, { y: 0.86, z: L / 2 - 0.16, rz: Math.PI / 2 });   // petto
    k.add(G.cyl(0.075, 0.075, W + 0.12, 8), woodL, { y: 0.86, z: -L / 2 + 0.16, rz: Math.PI / 2 });  // subbio
    for (let i = 0; i < 11; i++) k.add(G.box(0.012, 0.012, L - 0.42), '#f4eee4', { x: -0.42 + i * 0.084, y: 0.88, z: 0 });
    const PAT = [['#c8283a', '#f0b030', '#2a2a2a'], ['#2f6fb0', '#f3ead6', '#c8283a'], ['#2f8a4a', '#e0a52a', '#c8283a']][v % 3];
    // v5s46d (279): meta' ordito gia' tessuto a rombi, come una Sa Burra lasciata sul telaio
    k.add(G.box(0.72, 0.035, 0.55), PAT[2], { y: 0.83, z: L / 2 - 0.42 });
    for (let j = 0; j < 5; j++) k.add(G.box(0.72, 0.028, 0.07), PAT[j % 3], { y: 0.86, z: L / 2 - 0.18 - j * 0.08 });
    for (let j = 0; j < 4; j++) k.add(G.box(0.1, 0.03, 0.1), PAT[0], { y: 0.88, z: L / 2 - 0.3 - j * 0.1, x: (j % 2 ? 0.12 : -0.12) });
    k.add(G.box(0.07, 0.07, 1.35), woodD, { x: W / 2, y: 1.05, z: 0.05, rx: 0.52 });   // saetta
    k.add(G.box(W, 0.09, 0.11), wood, { y: 0.12, z: L / 2 });
    k.add(G.box(W, 0.09, 0.11), wood, { y: 0.12, z: -L / 2 });
    k.add(G.box(0.09, 0.09, L), wood, { x: -W / 2, y: 0.12 });
    k.add(G.box(0.09, 0.09, L), wood, { x: W / 2, y: 0.12 });
    const wx = -W / 2 - 0.07, wy = 0.55, wz = L / 2 - 0.16;
    k.add(G.cyl(0.26, 0.26, 0.07, 10), woodD, { x: wx, y: wy, z: wz, rz: Math.PI / 2 });
    for (let i = 0; i < 6; i++) k.add(G.box(0.035, 0.46, 0.035), woodL, { x: wx, y: wy, z: wz, rz: Math.PI / 2, rx: (i / 6) * Math.PI });
    k.add(G.cyl(0.055, 0.055, 0.11, 8), woodL, { x: wx, y: wy, z: wz, rz: Math.PI / 2 });
    k.add(G.box(0.48, 0.08, 0.52), wood, { x: 0, y: 0.42, z: L / 2 + 0.42 });   // panca
    k.add(G.box(0.07, 0.38, 0.07), woodD, { x: -0.16, y: 0.19, z: L / 2 + 0.28 });
    k.add(G.box(0.07, 0.38, 0.07), woodD, { x: 0.16, y: 0.19, z: L / 2 + 0.56 });
    k.add(G.cyl(0.26, 0.2, 0.28, 8), '#a8743a', { x: -0.45, y: 0.16, z: L / 2 + 0.15 });
    for (let i = 0; i < 4; i++) k.add(G.sph(0.1, 6, 5), PAT[i % 3], { x: -0.45 + (i % 2) * 0.1 - 0.05, y: 0.34, z: L / 2 + 0.15 + (i > 1 ? 0.08 : -0.08) });
    return k.build({ ao: 0.14 });
  });
}
export function buildWeaver(mats, v = 0) {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(loomGeom(v), mats));
  const d = buildDancer(mats, true, v % 3); d.root.position.set(0, 0.42, 1.48); d.root.rotation.y = Math.PI; d.root.scale.setScalar(1.3);
  root.add(d.root);
  return { root, fig: d };
}
export function animateWeaver(w, t, k) {     // k: 0 = tesse, 1 = lancia il tappeto (braccio in alto)
  const a = w.fig.arms, s = Math.sin(t * 5);
  a[0].rotation.x = -0.9 + s * 0.25 * (1 - k); a[1].rotation.x = -0.9 - s * 0.25 * (1 - k);
  a[1].rotation.z = 0.15 + k * 2.4; a[1].rotation.x += k * 0.9;
}

// processione: portantina + statua di Santa Marta (GLB v5s38, fallback Kit), 4 portatori e il prete davanti
// statueGeom = fallback Kit (cono crema) se la GLB non e' pronta
export function statueGeom() {
  return once('statue', () => {
    const k = new Kit(450);
    k.add(G.box(1.5, 0.18, 2.1), '#6b3a1e', { y: 1.35 });                        // portantina
    k.add(G.box(1.6, 0.1, 2.2), '#d9b44a', { y: 1.47 });                         // bordo dorato
    for (const z of [-1.5, 1.5]) for (const x of [-0.55, 0.55]) k.add(G.box(0.1, 0.1, 0.9), '#5a3220', { x, y: 1.35, z: z * 0.95 });   // stanghe
    k.add(G.box(1.0, 0.35, 1.0), '#efe6d2', { y: 1.7 });                         // basamento
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.add(G.ico(0.14, 0), ['#ffffff', '#f2e65a', '#e8506a'][i % 3], { x: Math.cos(a) * 0.62, y: 1.62, z: Math.sin(a) * 0.82, flat: true }); }   // fiori
    k.add(G.cyl(0.25, 0.5, 1.5, 10), '#f3ead6', { y: 2.6 });                     // veste chiara
    k.add(G.cyl(0.3, 0.55, 1.35, 10), '#2f5fa0', { y: 2.55, z: -0.04, sz: 0.85 });   // manto azzurro
    k.add(G.sph(0.2, 10, 8), '#e9c9a8', { y: 3.5 });                              // volto
    k.add(G.cone(0.26, 0.55, 10), '#f3ead6', { y: 3.6, z: -0.03 });               // velo
    k.add(G.box(0.08, 0.5, 0.08), '#d9b44a', { x: 0.32, y: 2.85, z: 0.18 });      // aspersorio
    k.add(new THREE.TorusGeometry(0.34, 0.035, 5, 18), '#ffd86a', { y: 3.62, z: -0.15, unlit: true });   // aureola
    k.add(G.box(0.05, 0.9, 0.05), '#d9b44a', { x: -0.4, y: 2.6, z: 0.2 });        // croce in mano
    k.add(G.box(0.3, 0.05, 0.05), '#d9b44a', { x: -0.4, y: 2.85, z: 0.2 });
    return k.build({ ao: 0.12 });
  });
}
// v5s38: portantina Kit (senza la figura a cono) — i piedi della GLB poggiano sul bordo dorato
export function litterGeom() {
  return once('litter38', () => {
    const k = new Kit(451);
    k.add(G.box(1.5, 0.18, 2.1), '#6b3a1e', { y: 1.35 });                        // portantina
    k.add(G.box(1.6, 0.1, 2.2), '#d9b44a', { y: 1.47 });                         // bordo dorato
    for (const z of [-1.5, 1.5]) for (const x of [-0.55, 0.55]) k.add(G.box(0.1, 0.1, 0.9), '#5a3220', { x, y: 1.35, z: z * 0.95 });   // stanghe
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.add(G.ico(0.14, 0), ['#ffffff', '#f2e65a', '#e8506a'][i % 3], { x: Math.cos(a) * 0.62, y: 1.62, z: Math.sin(a) * 0.82, flat: true }); }   // fiori
    return k.build({ ao: 0.12 });
  });
}
// v5s44f: il corteo viene VERSO chi corre: le figure guardano +z (la camera); il prete con lo stendardo apre (z +2.9)
const PROC_FACE = 0;
export function buildProcession(mats, v = 0) {
  const root = new THREE.Group(), figs = [];
  // Group named `statue` so animateProcession can bob position.y / rotation.z
  const statue = new THREE.Group(); statue.name = 'statue';
  const glb = statueFromModel();
  if (glb) {
    statue.add(new THREE.Mesh(litterGeom(), mats));
    glb.position.y = LITTER_TOP_Y;   // base GLB a y=0 → piedi sul bordo dorato
    statue.add(glb);
  } else {
    statue.add(new THREE.Mesh(statueGeom(), mats));   // fallback Kit (cono + manto)
  }
  root.add(statue);
  for (const [x, z] of [[-0.75, -1.4], [0.75, -1.4], [-0.75, 1.4], [0.75, 1.4]]) {
    const d = buildDancer(mats, false, (figs.length + v) % 3); d.root.position.set(x, 0, z); d.root.rotation.y = PROC_FACE; d.ph = figs.length * 1.6;
    d.role = 'bearer'; root.add(d.root); figs.push(d);
  }
  // davanti (verso chi arriva): il prete con lo stendardo e due donne col cero
  const pr = buildDancer(mats, false, 2); pr.root.position.set(0, 0, 2.9); pr.root.rotation.y = PROC_FACE; pr.ph = 0.5; pr.role = 'priest'; root.add(pr.root); figs.push(pr);
  const ban = new Kit(460); ban.add(G.box(0.06, 3.2, 0.06), '#5a3220', { y: 1.6 }); ban.add(G.box(0.9, 1.1, 0.04), '#8a1e2a', { y: 2.7 }); ban.add(G.box(0.5, 0.06, 0.05), '#d9b44a', { y: 2.7, z: 0.03 }); ban.add(G.box(0.06, 0.5, 0.05), '#d9b44a', { y: 2.7, z: 0.03 }); ban.add(G.box(0.5, 0.06, 0.05), '#d9b44a', { y: 2.7, z: -0.03 }); ban.add(G.box(0.06, 0.5, 0.05), '#d9b44a', { y: 2.7, z: -0.03 });
  const bm = new THREE.Mesh(once('banner', () => ban.build()), mats); bm.position.set(0.45, 0, 0); pr.root.add(bm);
  for (const x of [-0.6, 0.6]) {
    const w = buildDancer(mats, true, (x > 0 ? 1 : 0)); w.root.position.set(x, 0, -2.9); w.root.rotation.y = PROC_FACE; w.ph = x * 3; w.role = 'candle'; root.add(w.root); figs.push(w);
  }
  const lanterns = [];
  const glass = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
  for (const x of [-0.55, 0.55]) {
    const L = new THREE.Group();
    L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.28, 6), glass));
    L.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.02), new THREE.MeshLambertMaterial({ color: '#3a2a1a' })));
    L.position.set(x, 1.55, -2.7);
    root.add(L); lanterns.push(L);
  }
  root.scale.setScalar(1.25);
  return { root, figs, statue, lanterns };
}
export function animateProcession(p, t) {
  // passo vero, sempre: gambe in opposizione, busto che sale sul battere. Mai fermi, mai a T.
  const step = t * 5.4;
  for (const d of p.figs) {
    const s = Math.sin(step + (d.ph || 0));
    d.root.rotation.y = PROC_FACE;
    if (d.legs && d.legs[0] && d.legs[1]) {
      d.legs[0].rotation.x = s * 0.85;
      d.legs[1].rotation.x = -s * 0.85;
      d.legs[0].rotation.z = Math.max(0, s) * 0.08;
      d.legs[1].rotation.z = -Math.max(0, -s) * 0.08;
    }
    if (d.fig) d.fig.position.y = Math.max(0, Math.abs(s) - 0.15) * 0.09;
    if (d.arms && d.arms[0] && d.arms[1]) {
      if (d.role === 'bearer') {
        d.arms[0].rotation.x = -1.05 + s * 0.08; d.arms[1].rotation.x = -1.05 - s * 0.08;
        d.arms[0].rotation.z = 0.18; d.arms[1].rotation.z = -0.18;
      } else if (d.role === 'candle') {
        d.arms[0].rotation.x = -s * 0.45; d.arms[1].rotation.x = -0.9;
        d.arms[0].rotation.z = 0.08; d.arms[1].rotation.z = -0.12;
      } else {
        d.arms[0].rotation.x = -s * 0.65; d.arms[1].rotation.x = s * 0.65;
        d.arms[0].rotation.z = 0.12; d.arms[1].rotation.z = -0.12;
      }
    }
  }
  p.statue.position.y = Math.abs(Math.sin(step)) * 0.06; p.statue.rotation.z = Math.sin(step * 0.5) * 0.025;
  // v5s46d (277): i ceri dondolano e la lanterna illumina la via
  if (p.lanterns) for (const L of p.lanterns) { L.rotation.z = Math.sin(t * 2.4 + L.position.x * 4) * 0.22; const g = L.children[0]; if (g && g.material) g.material.color.setRGB(1, 0.75 + Math.sin(t * 13 + L.position.x) * 0.12, 0.45); }
}

// paesani affacciati: figura con un davanzale/balcone sotto, per i lati della via
export function sillGeom() {
  return once('sill', () => { const k = new Kit(470); k.add(G.box(0.9, 0.12, 1.6), '#9a948a', { x: -0.35 }); k.add(G.box(0.05, 0.75, 1.6), '#2a2d31', { x: -0.78, y: 0.4 }); for (let i = 0; i < 6; i++) k.add(G.box(0.04, 0.7, 0.04), '#2a2d31', { x: -0.78, y: 0.38, z: -0.7 + i * 0.28 }); return k.build(); });
}
export function buildWindowFan(mats, woman, v) {
  const root = new THREE.Group(); root.add(new THREE.Mesh(sillGeom(), mats));
  const d = buildDancer(mats, woman, v, 'lo'); d.root.position.set(-0.15, -0.9, 0); d.root.rotation.y = -Math.PI / 2; d.root.scale.setScalar(1.25); root.add(d.root);
  return { root, d };
}

// v5s44c: albero di Natale avvolto in Sa Burra (decoro, niente collisione), nella piazzetta a sinistra
export function buildBurraTree(tex) {
  const g = new THREE.Group(); g.name = 'burraTree';
  const H = 9.2, R = 1.52;   // ~3 volte piu' alto che largo, 8-10 m
  // v5s45 (14): il vero tessuto Sa Burra (stessa foto della passatoia di Santa Marta) avvolto a fasce:
  // ogni fascia e' alta un tappeto e lo ripete intorno al cono senza stirarlo (motivi leggibili).
  // v5s46b: tessuto continuo tutto intorno: si usa solo la parte tessuta del tappeto (senza frange ne' bordo chiaro),
  // ripetuta senza giunzioni; prima le frange trasparenti lasciavano una striscia grigia dalla base alla punta.
  const CROP = [86 / 860, 774 / 860], NB = 5, bandH = H / NB, tileW = bandH * CARPET_ASPECT * (CROP[1] - CROP[0]);
  const under = new THREE.Mesh(new THREE.ConeGeometry(R * 0.985, H, 18, 1, true), new THREE.MeshLambertMaterial({ color: '#efe4cc' }));
  under.position.y = 0.62 + H / 2; g.add(under);   // lana color crema sotto le frange trasparenti (niente buchi)
  const map = loadCarpetTexture(0, 4);   // istanza propria (la ripetizione non tocca i tappeti raccoglibili)
  map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping; map.colorSpace = THREE.SRGBColorSpace;
  const cropTo = (img) => {   // ritaglio in una tela: la ripetizione avviene dentro il tessuto, senza frange
    const c = document.createElement('canvas'), sx = Math.round(img.width * CROP[0]), sw = Math.round(img.width * (CROP[1] - CROP[0]));
    c.width = sw; c.height = img.height; c.getContext('2d').drawImage(img, sx, 0, sw, img.height, 0, 0, sw, img.height);
    map.dispose(); map.image = c; map.needsUpdate = true;   // dispose: la tela e' piu' stretta della foto, senza riallocare restava una striscia della vecchia immagine (frange grigie)
  };
  if (typeof document !== 'undefined') { const iv = setInterval(() => { if (map.userData.official && map.image && map.image.width) { clearInterval(iv); try { cropTo(map.image); } catch (e) { /* resta il tappeto intero */ } } }, 200); setTimeout(() => clearInterval(iv), 60000); }
  const fab = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, emissive: '#5a5048', emissiveMap: map });   // un po' di luce propria: i motivi si leggono anche di notte
  g.userData.burraMat = fab; g.userData.burraTiles = [];
  for (let i = 0; i < NB; i++) {
    const t0 = i / NB, t1 = (i + 1) / NB, r0 = R * (1 - t0) * 1.012, r1 = R * (1 - t1) * 1.012;
    const n = Math.max(1, Math.round((Math.PI * (r0 + r1)) / tileW));   // ripetizioni intorno alla fascia
    const geo = new THREE.CylinderGeometry(r1, r0, bandH, 24, 1, true);
    const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * n);
    const m = new THREE.Mesh(geo, fab); m.position.y = 0.62 + (t0 + t1) / 2 * H; g.add(m); g.userData.burraTiles.push(n);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.7, 8), new THREE.MeshLambertMaterial({ color: '#5a3a22' }));
  pole.position.y = 0.35; g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.28, 12), new THREE.MeshLambertMaterial({ color: '#9a958c' }));
  base.position.y = 0.12; g.add(base);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 7), new THREE.MeshLambertMaterial({ color: '#c0c6ce', emissive: '#8890a0', emissiveIntensity: 0.25 }));
  tip.position.y = 0.62 + H + 0.22; g.add(tip);
  // fili di lucine a festoni (pochi punti emissivi, leggeri sul telefono)
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe9a0' });
  const glowW = new THREE.MeshBasicMaterial({ color: '#fff6e0' });
  const sph = new THREE.SphereGeometry(0.055, 5, 4);
  for (let ring = 0; ring < 4; ring++) {
    const y0 = 1.6 + ring * 1.7, n = 10 - ring;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.35, sag = Math.sin((i / n) * Math.PI * 2) * 0.12, y = y0 - sag;
      // v5s46b: ogni lucina appoggiata sul tessuto (raggio del cono a quella altezza + meta' lampadina), niente lucine sospese
      const rr = R * (1 - (y - 0.62) / H) * 1.012 + 0.035;
      const m = new THREE.Mesh(sph, i % 2 ? glow : glowW);
      m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      g.add(m);
    }
  }
  return g;
}

// v5s46d (251, 280): facciata del Garag di Pinu sul marciapiede destro, all'inizio del paese.
// Convenzione case: facciata su x = 0 (verso la via), corpo verso -x, da z = 0 a z = -w.
// Porta a due ante socchiusa, insegna, bancone visibile, scaffali, attrezzi, calendario, radio.
export function buildPinuFacade() {
  const k = new Kit(251), r = rng(251);
  const w = 11.2, D = 5.4, H = 4.6;
  const plaster = '#e7c9a2', stone = '#b7a48c', wood = '#6b4428', woodD = '#4a2e1c';
  k.add(G.box(D, H, w), plaster, { x: -D / 2, y: H / 2, z: -w / 2, vary: 0.04 });
  k.add(G.box(0.28, 0.7, w), stone, { x: 0.02, y: 0.35, z: -w / 2, vary: 0.12 });
  k.add(G.box(D + 0.8, 0.28, w + 0.5), '#c45a32', { x: -D / 2 + 0.3, y: H + 0.35, z: -w / 2, rz: -0.18 });
  k.add(G.box(D + 0.5, 0.16, w + 0.3), '#a84828', { x: -D / 2 + 0.15, y: H + 0.62, z: -w / 2, rz: -0.18 });
  // portone da garage, ante di legno socchiuse verso l'interno (si vede il bancone)
  const dw = 3.4, dh = 3.1;
  k.add(G.box(0.22, dh + 0.3, dw + 0.5), stone, { x: 0.04, y: (dh + 0.3) / 2, z: -w / 2 });
  for (const s of [-1, 1]) {
    k.add(G.box(0.1, dh, dw / 2 - 0.08), wood, { x: -0.35, y: dh / 2, z: -w / 2 + s * (dw / 4), ry: s * 0.55 });
    for (let i = 0; i < 3; i++) k.add(G.box(0.04, 0.08, dw / 2 - 0.3), woodD, { x: -0.42, y: 0.6 + i * 0.85, z: -w / 2 + s * (dw / 4), ry: s * 0.55 });
  }
  // insegna (il testo vero e' il banner HTML proiettato qui)
  k.add(G.box(0.12, 0.7, 3.6), '#3a2418', { x: 0.16, y: 3.55, z: -w / 2 });
  k.add(G.box(0.08, 0.52, 3.3), '#f3e2b8', { x: 0.22, y: 3.55, z: -w / 2 });
  k.add(G.box(0.04, 0.08, 2.4), '#8a1e2a', { x: 0.26, y: 3.62, z: -w / 2 });
  k.add(G.box(0.04, 0.08, 1.6), '#1f4a32', { x: 0.26, y: 3.46, z: -w / 2 });
  // finestre ai lati, una socchiusa, gatto sul davanzale, gabbia, brocche
  for (const z of [-1.5, -w + 1.5]) {
    k.add(G.box(0.12, 1.3, 1.15), '#f1e4c9', { x: 0.06, y: 2.5, z });
    k.add(G.box(0.08, 1.05, 0.85), z < -w / 2 ? '#ffd682' : '#2f3d5c', { x: 0.1, y: 2.5, z, unlit: z < -w / 2 });
  }
  k.add(G.box(0.08, 1.15, 0.42), '#3f7d5b', { x: 0.2, y: 2.5, z: -1.15, ry: 0.7 });
  k.add(G.box(0.22, 0.16, 0.7), '#c06a3f', { x: 0.28, y: 1.85, z: -w + 1.5 });
  k.add(G.box(0.28, 0.16, 0.16), '#3a322c', { x: 0.42, y: 2.05, z: -w + 1.35 });
  k.add(G.sph(0.11, 6, 5), '#e8c8a0', { x: 0.42, y: 2.22, z: -w + 1.35 });
  k.add(G.box(0.16, 0.22, 0.16), '#c8a050', { x: 0.38, y: 2.15, z: -1.7 });
  for (const o of [-0.06, 0.06]) k.add(G.box(0.02, 0.2, 0.02), '#2a2418', { x: 0.46, y: 2.2, z: -1.7 + o });
  for (const [zz, h] of [[-2.6, 0.55], [-3.1, 0.4], [-3.5, 0.7]]) {
    k.add(G.cyl(0.16, 0.2, h, 8), '#8a5a32', { x: 0.45, y: h / 2, z: zz });
    k.add(G.cyl(0.22, 0.16, 0.08, 8), '#6a4424', { x: 0.45, y: h, z: zz });
  }
  // interno visibile dalla via: bancone, scaffali, attrezzi, calendario, radio
  k.add(G.box(1.4, 0.9, 2.4), wood, { x: -1.6, y: 0.5, z: -w / 2 });
  k.add(G.box(1.5, 0.08, 2.5), '#c49058', { x: -1.6, y: 0.98, z: -w / 2 });
  for (const y of [1.7, 2.5, 3.3]) {
    k.add(G.box(0.45, 0.08, 3.2), woodD, { x: -D + 0.35, y, z: -w / 2 });
    for (let i = 0; i < 4; i++) k.add(G.box(0.28, 0.32, 0.28), r.pick(['#a8182a', '#2f6a38', '#c8a24a', '#3a4a6a']), { x: -D + 0.55, y: y + 0.22, z: -w / 2 - 1.2 + i * 0.7 });
  }
  k.add(G.box(0.08, 1.1, 0.08), wood, { x: -2.4, y: 1.5, z: -w / 2 + 1.6, rz: 0.4 });
  k.add(G.box(0.28, 0.08, 0.08), '#4a4a4c', { x: -2.15, y: 2.05, z: -w / 2 + 1.6, rz: 0.4 });
  k.add(G.box(0.35, 0.5, 0.04), '#f6efe0', { x: -D + 0.2, y: 2.3, z: -w / 2 - 2.2 });
  k.add(G.box(0.28, 0.28, 0.02), '#c8283a', { x: -D + 0.22, y: 2.55, z: -w / 2 - 2.2 });
  k.add(G.box(0.42, 0.28, 0.22), '#2a2420', { x: -1.15, y: 1.2, z: -w / 2 + 0.7 });
  k.add(G.cyl(0.1, 0.1, 0.04, 8), '#c8b070', { x: -0.95, y: 1.2, z: -w / 2 + 0.82, rz: Math.PI / 2 });
  k.add(G.box(0.5, 0.08, 0.08), '#2a2420', { x: 0.15, y: 2.05, z: -2.2 });
  k.add(G.box(0.08, 0.35, 0.08), '#2a2420', { x: 0.38, y: 1.9, z: -2.2 });
  return k.build({ ao: 0.28 });
}
