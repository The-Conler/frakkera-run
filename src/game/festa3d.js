// v5s21: festa a Gadoni. Bancarelle (pane, formaggio, cesti, dolci) con tendone a strisce,
// festoni di bandierine con le lampadine tesi sopra la strada, folla in costume che applaude.
// Geometrie Kit a colori per vertice (materiali condivisi mats2: [lit, unlit]).
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';
import { buildDancer } from './dance/dancers.js';

const cache = {};
const CANOPY = [['#c8283a', '#f3ead6'], ['#e0a52a', '#f3ead6'], ['#2f6fb0', '#f3ead6'], ['#2f8a4a', '#f6e7c4']];
// bancarella sul lato destro (+x); il lato sinistro si ottiene specchiando x
export function stallGeom(v = 0) {
  const key = 'stall' + v; if (cache[key]) return cache[key];
  const k = new Kit(210 + v), r = rng(210 + v), wood = ['#6b4429', '#7a5232', '#5a3a22'];
  for (const x of [-0.85, 0.85]) for (const z of [-1.25, 1.25]) k.add(G.box(0.1, x < 0 ? 2.2 : 2.6, 0.1), r.pick(wood), { x, y: (x < 0 ? 2.2 : 2.6) / 2, z });
  k.add(G.box(1.9, 0.12, 2.7), '#8a5a34', { y: 0.92 });                                     // banco
  k.add(G.box(1.95, 0.55, 2.75), '#efe6d2', { x: -0.02, y: 0.62, vary: 0.04 });               // tovaglia
  k.add(G.box(0.04, 0.12, 2.75), CANOPY[v % 4][0], { x: -0.99, y: 0.38 });                    // orlo colorato
  const [c1, c2] = CANOPY[v % 4];
  for (let i = 0; i < 7; i++) k.add(G.box(2.2, 0.06, 0.42), i % 2 ? c2 : c1, { y: 2.42, z: -1.26 + i * 0.42, rz: 0.2 });   // tendone a strisce
  for (let i = 0; i < 7; i++) k.add(G.box(0.05, 0.26, 0.42), i % 2 ? c2 : c1, { x: -1.08, y: 2.1, z: -1.26 + i * 0.42 });  // mantovana
  // merce
  for (let i = 0; i < 6; i++) {
    const z = -1.0 + i * 0.4, x = r.range(-0.4, 0.4);
    if (v === 0) { for (let j = 0; j < 3; j++) k.add(G.cyl(0.22, 0.22, 0.03, 10), '#e8c98a', { x, y: 1.0 + j * 0.035, z, vary: 0.08 }); k.add(G.sph(0.13, 8, 6), '#c9873e', { x: x + 0.3, y: 1.06, z, sy: 0.7 }); }   // pane carasau e coccoi
    else if (v === 1) { k.add(G.cyl(0.2, 0.2, 0.16, 10), '#e9cf7a', { x, y: 1.06, z, vary: 0.06 }); k.add(G.cyl(0.2, 0.2, 0.02, 10), '#b8923e', { x, y: 1.15, z }); }   // pecorino
    else if (v === 2) { k.add(G.cyl(0.2, 0.16, 0.16, 8), '#a8743a', { x, y: 1.06, z, flat: true }); for (let j = 0; j < 3; j++) k.add(G.sph(0.07, 6, 5), r.pick(['#d84a2a', '#f0b030', '#7aa83a']), { x: x + r.range(-0.08, 0.08), y: 1.18, z: z + r.range(-0.08, 0.08) }); }   // cesti di frutta
    else { for (let j = 0; j < 4; j++) k.add(G.box(0.1, 0.06, 0.1), r.pick(['#f6efe2', '#e8b0c0', '#d6a050', '#f2d27a']), { x: x + r.range(-0.15, 0.15), y: 1.02, z: z + r.range(-0.12, 0.12) }); }   // dolci (copuletas, papassinos)
  }
  k.add(G.box(0.5, 0.3, 0.04), '#f3ead6', { x: -1.0, y: 1.95, z: 0, ry: 0 });               // cartello
  for (let i = 0; i < 5; i++) k.add(G.sph(0.06, 6, 5), '#ffd98a', { x: -1.08, y: 2.0, z: -1.1 + i * 0.55, unlit: true });   // lampadine sotto il tendone
  return (cache[key] = k.build({ ao: 0.12 }));
}
// festone sopra la strada: corda con bandierine e lampadine, larghezza w (unita')
export function festoonGeom(v = 0, w = 13.4, y0 = 10.2) {
  const key = 'fest' + v; if (cache[key]) return cache[key];
  const k = new Kit(230 + v);
  const PAL = [['#c8283a', '#f0b030', '#2f6fb0', '#2f8a4a', '#f3ead6'], ['#e0a52a', '#c8283a', '#f3ead6'], ['#2f6fb0', '#f3ead6', '#c8283a', '#f0b030']][v % 3];
  const N = 22, yAt = (t) => y0 - Math.sin(t * Math.PI) * 0.7;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, x0 = -w / 2 + w * t0, x1 = -w / 2 + w * t1, ya = yAt(t0), yb = yAt(t1);
    const len = Math.hypot(x1 - x0, yb - ya);
    k.add(G.box(len, 0.035, 0.035), '#3a2a1a', { x: (x0 + x1) / 2, y: (ya + yb) / 2, rz: Math.atan2(yb - ya, x1 - x0) });
    // v5s37b: niente bandierine, solo lampadine (luci di Natale)
    k.add(G.sph(0.08, 6, 5), '#ffe2a0', { x: (x0 + x1) / 2, y: (ya + yb) / 2 - 0.06, unlit: true });
    k.add(G.sph(0.08, 6, 5), '#ffe2a0', { x: x0, y: ya - 0.06, unlit: true });                            // lampadina
  }
  for (const sx of [-1, 1]) { k.add(G.cyl(0.09, 0.12, y0 + 0.4, 6), '#5a4330', { x: sx * (w / 2 + 0.05), y: (y0 + 0.4) / 2, flat: true }); k.add(G.box(0.2, 0.08, 0.2), '#3a2a1e', { x: sx * (w / 2 + 0.05), y: y0 + 0.42 }); }   // v5s27p: pali alle due estremita'
  return (cache[key] = k.build());
}
// gruppo di folla in costume sul marciapiede (figure dei ballerini, braccia che applaudono)
export function buildCrowd(mats, n = 4, v = 0) {
  const root = new THREE.Group(), figs = [], r = rng(240 + v);
  for (let i = 0; i < n; i++) {
    const d = buildDancer(mats, (i + v) % 2 === 1, (v + i) % 3, 'lo');
    d.root.position.set(r.range(-0.35, 0.35) + (i % 2) * 0.5, 0, -1.2 + i * (2.4 / Math.max(1, n - 1)) + r.range(-0.15, 0.15));
    d.root.scale.setScalar(1.45 + r.range(-0.08, 0.08));
    d.ph = r.range(0, 6.28);
    root.add(d.root); figs.push(d);
  }
  return { root, figs };
}
// t: tempo, k: 0 = a riposo (dondola), 1 = applauso / esultanza (braccia in alto, saltelli)
export function animateCrowd(c, t, k) {
  for (const d of c.figs) {
    const s = Math.sin(t * (k > 0 ? 14 : 2.2) + d.ph);
    const up = k * (2.6 + s * 0.25);
    d.arms[0].rotation.z = -0.15 - up * 0.95; d.arms[1].rotation.z = 0.15 + up * 0.95;
    d.arms[0].rotation.x = d.arms[1].rotation.x = -0.2 * k;
    d.fig.position.y = k * Math.max(0, s) * 0.22;
    d.fig.rotation.z = (1 - k) * s * 0.04;
  }
}
