// feat-village: vita del paese. Panni stesi della nonna (ci si abbassa), tessitrice al telaio sulla soglia,
// processione di Santa Marta (statua sulla portantina + portatori), paesani che esultano dalle finestre.
// Geometrie Kit a colori per vertice (mats2 condivisi), poche decine di pezzi l'una: leggere sul telefono.
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';
import { buildDancer } from './dance/dancers.js';

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
const LINE_Y = 2.25, HALF = 6.3;          // come la trave (biomes/builders/skins.js): stessa altezza per abbassarsi

// filo da balcone a balcone con lenzuola, tovaglie e camicie; la nonna affacciata a sinistra
export function laundryGeom(v = 0) {
  return once('laundry36_' + v, () => {   // v5s36: nuovo cache key (palette + lit)
    const k = new Kit(410 + v), r = rng(410 + v);
    const N = 20, yAt = (t) => LINE_Y + 1.25 - Math.sin(t * Math.PI) * 0.35;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, x0 = -HALF - 0.5 + (HALF * 2 + 1) * t0, x1 = -HALF - 0.5 + (HALF * 2 + 1) * t1, ya = yAt(t0), yb = yAt(t1);
      k.add(G.box(Math.hypot(x1 - x0, yb - ya), 0.04, 0.04), '#e8e2d4', { x: (x0 + x1) / 2, y: (ya + yb) / 2, rz: Math.atan2(yb - ya, x1 - x0) });
    }
    const PAL = ['#d8cbb6', '#cfc3a8', '#c4b8a0', '#d2b09e', '#a8b4c0', '#d0c090'];   // v5s36: crema (niente bianco puro che sembra un placeholder)
    let x = -HALF + 0.3;
    while (x < HALF - 0.6) {
      const t = (x + HALF + 0.5) / (HALF * 2 + 1), y = yAt(t), kind = r.int(0, 3);
      if (kind <= 1) {             // lenzuolo / tovaglia: lungo fino quasi all'altezza della trave
        const w = r.range(1.1, 1.7), h = y - LINE_Y + 0.05, col = r.pick(PAL);
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
    for (const s of [-1, 1]) k.add(G.box(0.12, 0.12, 0.12), '#2a2d31', { x: s * (HALF + 0.5), y: LINE_Y + 1.25 });   // ganci al muro
    return k.build({ ao: 0.12 });
  });
}

// telaio verticale a bordo strada con l'ordito colorato e un tappeto a meta'; soglia scura dietro
export function loomGeom(v = 0) {
  return once('loom' + v, () => {
    const k = new Kit(430 + v), wood = '#6b4429';
    k.add(G.box(0.25, 3.4, 2.8), '#2a2220', { x: 0.9, y: 1.7 });                 // vano della porta
    k.add(G.box(0.3, 0.3, 3.3), '#c2b6a2', { x: 0.85, y: 3.5 });                 // architrave chiaro
    for (const z of [-0.9, 0.9]) k.add(G.box(0.14, 2.2, 0.14), wood, { x: 0, y: 1.1, z });
    for (const y of [0.35, 2.1]) k.add(G.cyl(0.07, 0.07, 1.95, 6), '#8a5a34', { y, rx: Math.PI / 2 });
    const PAT = [['#c8283a', '#f0b030', '#2a2a2a'], ['#2f6fb0', '#f3ead6', '#c8283a'], ['#2f8a4a', '#e0a52a', '#c8283a']][v % 3];
    for (let i = 0; i < 12; i++) k.add(G.box(0.03, 1.6, 0.08), '#efe6d2', { x: -0.02, y: 1.25, z: -0.75 + i * 0.136 });   // ordito
    for (let j = 0; j < 6; j++) k.add(G.box(0.05, 0.14, 1.65), PAT[j % 3], { x: -0.04, y: 0.5 + j * 0.14 });   // tessuto fatto (righe)
    for (let j = 0; j < 3; j++) k.add(G.box(0.06, 0.08, 0.3), PAT[(j + 1) % 3], { x: -0.06, y: 0.6 + j * 0.28, z: -0.2 + j * 0.2, rz: 0.0 });   // rombi
    k.add(G.box(0.5, 0.45, 0.5), wood, { x: -0.6, y: 0.22, z: 0.2 });           // sgabello
    // cesto di gomitoli
    k.add(G.cyl(0.28, 0.22, 0.3, 8), '#a8743a', { x: -0.3, y: 0.15, z: 1.3 });
    for (let i = 0; i < 4; i++) k.add(G.sph(0.11, 6, 5), PAT[i % 3], { x: -0.3 + (i % 2) * 0.12 - 0.06, y: 0.34, z: 1.3 + (i > 1 ? 0.1 : -0.1) });
    return k.build({ ao: 0.12 });
  });
}
export function buildWeaver(mats, v = 0) {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(loomGeom(v), mats));
  const d = buildDancer(mats, true, v % 3); d.root.position.set(-0.6, 0.15, 0.2); d.root.rotation.y = Math.PI / 2; d.root.scale.setScalar(1.3);
  root.add(d.root);
  return { root, fig: d };
}
export function animateWeaver(w, t, k) {     // k: 0 = tesse, 1 = lancia il tappeto (braccio in alto)
  const a = w.fig.arms, s = Math.sin(t * 5);
  a[0].rotation.x = -0.9 + s * 0.25 * (1 - k); a[1].rotation.x = -0.9 - s * 0.25 * (1 - k);
  a[1].rotation.z = 0.15 + k * 2.4; a[1].rotation.x += k * 0.9;
}

// processione: portantina con la statua di Santa Marta (manto, aureola, fiori), 4 portatori e il prete davanti
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
export function buildProcession(mats, v = 0) {
  const root = new THREE.Group(), figs = [];
  const st = new THREE.Mesh(statueGeom(), mats); root.add(st);
  for (const [x, z] of [[-0.75, -1.4], [0.75, -1.4], [-0.75, 1.4], [0.75, 1.4]]) {
    const d = buildDancer(mats, false, (figs.length + v) % 3); d.root.position.set(x, 0, z); d.root.rotation.y = Math.PI; d.ph = figs.length * 1.6;
    d.arms[0].rotation.x = d.arms[1].rotation.x = -2.6; root.add(d.root); figs.push(d);
  }
  // davanti (verso chi arriva): il prete con lo stendardo e due donne col cero
  const pr = buildDancer(mats, false, 2); pr.root.position.set(0, 0, 2.9); pr.root.rotation.y = Math.PI; pr.ph = 0.5; root.add(pr.root); figs.push(pr);
  const ban = new Kit(460); ban.add(G.box(0.06, 3.2, 0.06), '#5a3220', { y: 1.6 }); ban.add(G.box(0.9, 1.1, 0.04), '#8a1e2a', { y: 2.7 }); ban.add(G.box(0.5, 0.06, 0.05), '#d9b44a', { y: 2.7, z: 0.03 }); ban.add(G.box(0.06, 0.5, 0.05), '#d9b44a', { y: 2.7, z: 0.03 });
  const bm = new THREE.Mesh(once('banner', () => ban.build()), mats); bm.position.set(0.45, 0, 2.9); root.add(bm);
  for (const x of [-0.6, 0.6]) {
    const w = buildDancer(mats, true, (x > 0 ? 1 : 0)); w.root.position.set(x, 0, -2.9); w.root.rotation.y = Math.PI; w.ph = x * 3; root.add(w.root); figs.push(w);
    w.arms[1].rotation.x = -1.3;
  }
  root.scale.setScalar(1.25);
  return { root, figs, statue: st };
}
export function animateProcession(p, t) {
  for (const d of p.figs) { const s = Math.sin(t * 3.2 + (d.ph || 0)); d.legs[0].rotation.x = s * 0.35; d.legs[1].rotation.x = -s * 0.35; d.fig.position.y = Math.abs(s) * 0.04; }
  p.statue.position.y = Math.abs(Math.sin(t * 3.2)) * 0.05; p.statue.rotation.z = Math.sin(t * 1.6) * 0.02;
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
