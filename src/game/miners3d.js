// =====================================================================
// v5s17: minatori di Funtana Raminosa (anni '50-'60) e lampade a muro della galleria.
// Minatore: elmetto di cuoio/latta scuro con lampada ad acetilene in ottone sul davanti,
// giacca di fustagno grigio-azzurra, fazzoletto al collo, pantaloni di tela marrone,
// scarponi. Pose: piccone in spalla, appoggiato alla pala, lanterna in mano, saluto.
// Lampada a muro: staffa di ferro, gabbia e vetro (spenta = vetro scuro, accesa = caldo).
// Geometrie Kit statiche (colori per vertice, materiali condivisi): 1 draw call a figura.
// =====================================================================
import { Kit, G, rng } from './kit.js';

const JACKETS = ['#5a6670', '#4e5a5e', '#64686a', '#57606a'];
const TROUS = ['#5a4632', '#4a3a2a', '#3e3a34'];
const SKIN = ['#c98d6a', '#b97e5c', '#d49a76'];
let cache = null;

function body(k, r) {
  const jk = r.pick(JACKETS), tr = r.pick(TROUS), sk = r.pick(SKIN);
  for (const x of [-0.15, 0.15]) { k.add(G.cyl(0.12, 0.11, 0.88, 7), tr, { x, y: 0.5, vary: 0.08 }); k.add(G.box(0.2, 0.14, 0.34), '#1c1712', { x, y: 0.07, z: 0.05 }); }
  k.add(G.cyl(0.29, 0.27, 0.3, 9), tr, { y: 1.0 });
  k.add(G.cyl(0.33, 0.29, 0.78, 9), jk, { y: 1.42, vary: 0.06 });
  k.add(G.box(0.05, 0.6, 0.04), '#2a2a2a', { y: 1.42, z: 0.32 });                      // abbottonatura
  for (const y of [1.25, 1.55]) k.add(G.box(0.16, 0.12, 0.04), jk, { x: 0.15, y, z: 0.32, vary: 0.2 }); // tasche
  k.add(G.box(0.62, 0.06, 0.5), '#3a2c1e', { y: 1.08 });                                 // cinturone
  k.add(G.cyl(0.2, 0.24, 0.12, 9), '#a8302a', { y: 1.84 });                              // fazzoletto rosso
  k.add(G.cyl(0.08, 0.09, 0.12, 7), sk, { y: 1.9 });
  k.add(G.sph(0.18, 10, 8), sk, { y: 2.08 });
  k.add(G.box(0.22, 0.05, 0.05), '#2a2018', { y: 2.0, z: 0.16 });                         // baffi
  // elmetto: calotta scura con tesa e lampada ad acetilene in ottone
  k.add(G.sph(0.22, 12, 7), '#2b2a26', { y: 2.2, sy: 0.75 });
  k.add(G.cyl(0.27, 0.27, 0.04, 14), '#2b2a26', { y: 2.15 });
  k.add(G.cyl(0.05, 0.06, 0.16, 8), '#c79a3a', { y: 2.26, z: 0.2, rx: Math.PI / 2 });
  k.add(G.cyl(0.07, 0.07, 0.03, 10), '#e8c060', { y: 2.26, z: 0.29, rx: Math.PI / 2 });
  return { jk, sk };
}
const arm = (k, c, x, y, z, rx, rz, len = 0.62) => { k.add(G.cyl(0.08, 0.075, len, 6), c, { x, y, z, rx, rz }); };

function miner(pose) {
  const k = new Kit(170 + pose), r = rng(170 + pose);
  const { jk, sk } = body(k, r);
  const wood = '#7a5530', iron = '#4a4a4c';
  if (pose === 0) {            // piccone in spalla
    arm(k, jk, 0.34, 1.62, 0.05, 0, -2.6); arm(k, jk, -0.36, 1.35, 0.0, 0, 0.1);
    k.add(G.cyl(0.035, 0.035, 1.2, 6), wood, { x: 0.36, y: 2.0, z: -0.05, rx: 0.2, rz: 0.6 });
    k.add(G.box(0.9, 0.07, 0.07), iron, { x: 0.68, y: 2.47, z: -0.15, rz: 0.6 - Math.PI / 2 + 0.3 });
  } else if (pose === 1) {     // appoggiato alla pala
    arm(k, jk, 0.33, 1.4, 0.18, -0.6, -0.2); arm(k, jk, -0.33, 1.4, 0.18, -0.6, 0.2);
    k.add(G.cyl(0.035, 0.035, 1.5, 6), wood, { x: 0, y: 0.95, z: 0.52, rx: -0.15 });
    k.add(G.box(0.3, 0.38, 0.04), iron, { x: 0, y: 0.15, z: 0.62, rx: -0.15 });
  } else if (pose === 2) {     // lanterna in mano
    arm(k, jk, 0.36, 1.35, 0.0, 0, 0.12); arm(k, jk, -0.34, 1.3, 0.12, -0.4, -0.1);
    k.add(G.cyl(0.11, 0.13, 0.26, 8), '#3a3a3a', { x: -0.36, y: 0.86, z: 0.3 });
    k.add(G.cyl(0.08, 0.08, 0.2, 8), '#ffcf70', { x: -0.36, y: 0.86, z: 0.3, unlit: true });
    k.add(G.torus(0.07, 0.015, 4, 10), '#3a3a3a', { x: -0.36, y: 1.06, z: 0.3 });
  } else {                     // saluta col braccio alzato (il braccio si anima a parte)
    arm(k, jk, -0.36, 1.35, 0.0, 0, 0.1);
    k.add(G.box(0.36, 0.3, 0.24), '#6a5a48', { x: -0.42, y: 0.15, z: 0.25 });             // cassetta
  }
  return k.build({ ao: 0.12 });
}
function waveArm() {
  const k = new Kit(179);
  k.add(G.cyl(0.08, 0.075, 0.62, 6), JACKETS[0], { y: 0.31 });
  k.add(G.sph(0.08, 8, 6), SKIN[0], { y: 0.66 });
  return k.build();
}
function wallLamp() {
  const k = new Kit(180);
  const iron = '#2e2c2a';
  k.add(G.box(0.12, 0.5, 0.3), '#5a3a22', { y: 0 });                                       // tavoletta di legno
  k.add(G.box(0.45, 0.05, 0.05), iron, { x: 0.22, y: 0.12 });                               // staffa
  k.add(G.cyl(0.015, 0.015, 0.25, 4), iron, { x: 0.42, y: 0.0 });
  k.add(G.cyl(0.11, 0.09, 0.05, 8), iron, { x: 0.42, y: 0.19 });                            // cappello
  k.add(G.cyl(0.09, 0.09, 0.05, 8), iron, { x: 0.42, y: -0.17 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; k.add(G.box(0.015, 0.34, 0.015), iron, { x: 0.42 + Math.cos(a) * 0.1, y: 0.01, z: Math.sin(a) * 0.1 }); }
  return k.build();
}
export function minerGeoms() {
  if (!cache) cache = { poses: [0, 1, 2, 3].map(miner), wave: waveArm(), lamp: wallLamp() };
  return cache;
}
export const HEADLAMP = { x: 0, y: 2.26, z: 0.32 };
export const LAMP_BULB = { x: 0.42, y: 0.01, z: 0 };
