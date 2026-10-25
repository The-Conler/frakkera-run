// v5s11: ballerini del ballu tundu nel costume tradizionale di Gadoni (reference/gadoni/costume-gadoni.jpg)
// Donna: velo di pizzo bianco, giacca verde scuro con bordi rosso e giallo, polsini di pizzo bianco,
//        gonna rosso scuro con l'orlo verde, grembiule nero col bordo a fiori colorati.
// Uomo:  berritta nera alta, camicia bianca con il nastrino rosso, gilet nero coi bottoni d'argento,
//        giacca scura foderata di rosso, cintura di cuoio, gonnellino nero plissettato (ragas) sopra
//        i calzoni bianchi larghi, gambali neri.
// Geometrie Kit a colori per vertice (materiali condivisi), braccia e gambe su perni per il passo.
import * as THREE from 'three';
import { Kit, G, rng } from '../kit.js';

const cache = new Map();
const once = (k, f) => cache.get(k) || (cache.set(k, f()), cache.get(k));
const SKIN = ['#e7b48e', '#d9a07a', '#c98d68'];
const GREEN = '#1f3d2a', RED = '#a3182a', YEL = '#e0b32a', WHITE = '#f2efe6', LACE = '#e9e4d8';
const SKIRT = '#6a1420', BLACK = '#121212', SILVER = '#d8dbe0';
const FLOWERS = ['#e0302a', '#f0c020', '#3aa04a', '#e86a9a', '#4a8ad8', '#ff8a2a'];

function head(k, r, skin, y) {
  k.add(G.ico(0.15, 1), skin, { y, sy: 1.18, flat: true });
  for (const x of [-0.05, 0.05]) k.add(G.box(0.03, 0.025, 0.02), '#2a1a12', { x, y: y + 0.03, z: 0.14 });
  k.add(G.box(0.06, 0.015, 0.02), '#9a4a40', { y: y - 0.07, z: 0.135 });
}
// ------------------------------------------------------------ donna
function womanBody(seed) {
  const k = new Kit(seed); const r = rng(seed); const skin = r.pick(SKIN);
  // gonna lunga rosso scuro, orlo verde
  k.add(G.cyl(0.24, 0.5, 0.95, 12), SKIRT, { y: 0.62, flat: true, vary: 0.05 });
  k.add(G.cyl(0.5, 0.52, 0.14, 12), '#2a6a3a', { y: 0.12 });
  k.add(G.cyl(0.505, 0.525, 0.03, 12), YEL, { y: 0.2 });
  // grembiule nero con bordo a fiori
  k.add(G.box(0.46, 0.8, 0.03), BLACK, { y: 0.62, z: 0.38, rx: -0.2 });
  for (let i = 0; i < 14; i++) {
    const q = i / 13, side = i % 2 ? 1 : -1;
    k.add(G.box(0.06, 0.06, 0.02), r.pick(FLOWERS), { x: side * 0.2, y: 0.27 + q * 0.68, z: 0.38 + (0.95 - q * 0.68 - 0.27) * 0.2 + 0.02, rx: -0.2 });
  }
  for (let i = 0; i < 6; i++) k.add(G.box(0.06, 0.06, 0.02), r.pick(FLOWERS), { x: -0.16 + i * 0.064, y: 0.27, z: 0.47, rx: -0.2 });
  // corpetto: camicia bianca + giacca verde scuro con bordi rosso/giallo
  k.add(G.cyl(0.2, 0.24, 0.5, 10), GREEN, { y: 1.33, flat: true });
  k.add(G.box(0.16, 0.4, 0.03), WHITE, { y: 1.36, z: 0.21 });
  for (const s of [-1, 1]) {
    k.add(G.box(0.035, 0.46, 0.03), RED, { x: s * 0.1, y: 1.34, z: 0.215 });
    k.add(G.box(0.02, 0.46, 0.03), YEL, { x: s * 0.125, y: 1.34, z: 0.214 });
  }
  k.add(G.cyl(0.25, 0.25, 0.08, 10), RED, { y: 1.1 });                                    // fascia in vita
  // velo di pizzo bianco sulla testa e sulle spalle
  head(k, r, skin, 1.78);
  k.add(G.cone(0.34, 0.6, 10), LACE, { y: 1.62, z: -0.04, flat: true });
  k.add(G.sph(0.19, 10, 7), LACE, { y: 1.84, z: -0.03, sy: 1.1 });
  k.add(G.box(0.3, 0.05, 0.04), LACE, { y: 1.95, z: 0.12 });
  return k.build({ ao: 0.12 });
}
function womanArm(seed) {
  const k = new Kit(seed);
  k.add(G.cyl(0.07, 0.065, 0.5, 6), GREEN, { y: -0.25, flat: true });
  k.add(G.box(0.03, 0.5, 0.03), RED, { y: -0.25, z: 0.065 });
  k.add(G.cyl(0.1, 0.075, 0.12, 8), LACE, { y: -0.55 });                                  // polsino di pizzo
  k.add(G.ico(0.05, 0), SKIN[0], { y: -0.65 });
  return k.build();
}
// ------------------------------------------------------------ uomo
function manBody(seed) {
  const k = new Kit(seed); const r = rng(seed); const skin = r.pick(SKIN);
  // gonnellino nero plissettato sopra i calzoni bianchi larghi
  k.add(G.cyl(0.25, 0.36, 0.32, 14), BLACK, { y: 0.98, flat: true });
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.add(G.box(0.02, 0.3, 0.03), '#262626', { x: Math.sin(a) * 0.31, y: 0.98, z: Math.cos(a) * 0.31, ry: a }); }
  k.add(G.cyl(0.25, 0.25, 0.07, 12), '#8a5a2a', { y: 1.16 });                             // cintura di cuoio
  k.add(G.box(0.1, 0.07, 0.02), '#c8a060', { y: 1.16, z: 0.25 });
  // camicia bianca, nastrino rosso, gilet nero coi bottoni d'argento, giacca scura foderata di rosso
  k.add(G.cyl(0.22, 0.25, 0.52, 10), BLACK, { y: 1.44, flat: true });
  k.add(G.box(0.14, 0.42, 0.03), WHITE, { y: 1.5, z: 0.22 });
  k.add(G.box(0.12, 0.3, 0.03), '#1a1a1a', { y: 1.4, z: 0.235 });
  for (let i = 0; i < 4; i++) k.add(G.ico(0.017, 0), SILVER, { x: (i % 2 ? 1 : -1) * 0.035, y: 1.3 + Math.floor(i / 2) * 0.09, z: 0.255 });
  for (let i = 0; i < 4; i++) k.add(G.ico(0.017, 0), SILVER, { x: (i % 2 ? 1 : -1) * 0.035, y: 1.48 + Math.floor(i / 2) * 0.07, z: 0.255 });
  k.add(G.box(0.025, 0.12, 0.02), RED, { y: 1.62, z: 0.245 });                            // nastrino rosso
  for (const s of [-1, 1]) {
    k.add(G.box(0.09, 0.62, 0.05), '#161616', { x: s * 0.16, y: 1.38, z: 0.2, rz: s * 0.08 });   // giacca aperta
    k.add(G.box(0.03, 0.6, 0.05), RED, { x: s * 0.11, y: 1.38, z: 0.215, rz: s * 0.08 });         // fodera rossa
  }
  k.add(G.box(0.2, 0.06, 0.12), WHITE, { y: 1.7, z: 0.1 });                               // colletto
  head(k, r, skin, 1.86);
  // berritta: berretto nero alto ripiegato
  k.add(G.cyl(0.155, 0.16, 0.12, 10), BLACK, { y: 2.0 });
  k.add(G.box(0.26, 0.38, 0.2), BLACK, { y: 2.22, z: -0.02, rx: -0.12 });
  k.add(G.box(0.24, 0.1, 0.22), '#0c0c0c', { y: 2.42, z: -0.09, rx: -0.45 });
  return k.build({ ao: 0.12 });
}
function manArm(seed) {
  const k = new Kit(seed);
  k.add(G.cyl(0.075, 0.07, 0.52, 6), '#161616', { y: -0.26, flat: true });
  k.add(G.cyl(0.07, 0.06, 0.06, 6), WHITE, { y: -0.55 });
  k.add(G.ico(0.05, 0), SKIN[1], { y: -0.63 });
  return k.build();
}
function manLeg() {
  const k = new Kit(77);
  k.add(G.cyl(0.13, 0.11, 0.45, 8), WHITE, { y: -0.22, flat: true });                      // calzoni bianchi larghi
  k.add(G.cyl(0.085, 0.075, 0.42, 7), BLACK, { y: -0.62 });                                // gambali neri
  k.add(G.box(0.12, 0.08, 0.24), '#0a0a0a', { y: -0.86, z: 0.05 });
  return k.build();
}
function womanLeg() {
  const k = new Kit(78);
  k.add(G.cyl(0.05, 0.045, 0.2, 6), BLACK, { y: -0.1 });
  k.add(G.box(0.1, 0.07, 0.2), '#0a0a0a', { y: -0.2, z: 0.04 });
  return k.build();
}
function limb(geom, mats, x, y) { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(new THREE.Mesh(geom, mats)); return p; }
export function buildDancer(mats, woman, v = 0) {
  const g = once((woman ? 'w' : 'm') + (v % 3), () => woman
    ? { body: womanBody(200 + v), arm: womanArm(210 + v), leg: womanLeg() }
    : { body: manBody(300 + v), arm: manArm(310 + v), leg: manLeg() });
  const root = new THREE.Group(); const fig = new THREE.Group(); root.add(fig);
  fig.add(new THREE.Mesh(g.body, mats));
  const hy = woman ? 0.24 : 0.88;
  const legs = [limb(g.leg, mats, -0.1, hy), limb(g.leg, mats, 0.1, hy)];
  const sy = woman ? 1.52 : 1.62;
  const arms = [limb(g.arm, mats, -0.26, sy), limb(g.arm, mats, 0.26, sy)];
  fig.add(...legs, ...arms);
  return { root, fig, legs, arms, woman };
}
// passo del ballu tundu: braccia allacciate ai vicini (aperte di lato e un po' in basso),
// passo laterale a tempo con il saltello sul battere
export function danceStep(d, ph, beatK) {
  const s = Math.sin(ph * Math.PI * 2);
  d.arms[0].rotation.z = -1.15; d.arms[1].rotation.z = 1.15;
  d.arms[0].rotation.x = d.arms[1].rotation.x = -0.15 + s * 0.08;
  d.legs[0].rotation.x = s * 0.35; d.legs[1].rotation.x = -s * 0.35;
  d.legs[0].rotation.z = Math.max(0, s) * 0.2; d.legs[1].rotation.z = -Math.max(0, -s) * 0.2;
  d.fig.position.y = beatK * 0.12;
  d.fig.rotation.z = s * 0.04;
}
// falo' di frakkere al centro del cerchio
export function buildBonfire(mats) {
  return once('bonfire', () => {
    const k = new Kit(91); const r = rng(91);
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; k.add(G.cyl(0.04, 0.06, 2.2, 5), r.pick(['#8a6a40', '#7a5a34', '#a07a48']), { x: Math.sin(a) * 0.32, y: 1.05, z: Math.cos(a) * 0.32, rx: Math.cos(a) * 0.14, rz: -Math.sin(a) * 0.14, vary: 0.15 }); }
    k.add(G.torus(0.36, 0.05, 5, 14), '#c8a060', { y: 0.9, rx: Math.PI / 2 });
    k.add(G.torus(0.34, 0.05, 5, 14), '#c8a060', { y: 1.5, rx: Math.PI / 2 });
    for (let i = 0; i < 10; i++) k.add(G.ico(0.18, 0), '#6a6660', { x: Math.sin(i * 0.63) * 0.7, y: 0.08, z: Math.cos(i * 0.63) * 0.7, flat: true });
    return k.build({ ao: 0.2 });
  });
}
