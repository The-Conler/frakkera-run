// v5s9: Pinu - si riparte dalla versione 7b (a blocchi, faccia larga e leggibile, che piaceva) e la si porta
// verso il riferimento target2: anziano un po' in carne, faccia tonda, nasone, sopracciglia e baffi grigi,
// coppola, giacca scura, camicia bianca e cravatta, appoggiato al bancone con le mani giunte.
// Blocchi smussati a faccette (come il low-poly del riferimento). Origine locale: piano del tavolo,
// z = 0 sul bordo posteriore del tavolo (il tavolo e' verso +z).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { paint, col, place, Bucket, vnoise, slab } from './geo.js';

const vc = (g, hex, vary = 0.04, f = 5) => { const b = col(hex); return paint(g, (v, o) => { const k = 1 + vnoise(v.x * f, v.y * f, v.z * f, 7) * vary; o.setRGB(b.r * k, b.g * k, b.b * k); }); };
const rb = (w, h, d, r, hex, o, vary) => vc(place(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), o), hex, vary);

export function buildPinu() {
  const grp = new THREE.Group(), B = new Bucket();
  const JK = '#3a3634', JK2 = '#2a2726', SH = '#f2efe8', SK = '#eea27a', SK2 = '#e08e66', ROSY = '#e8906c', GREY = '#a29e96', CAP = '#4a3e36';
  const add = (g) => B.add(g);
  // --- busto in carne, un po' curvo in avanti
  add(rb(1.02, 0.78, 0.6, 0.16, JK, { y: 0.3, z: -0.34, rx: 0.22 }, 0.05));
  add(rb(1.12, 0.3, 0.56, 0.14, JK, { y: 0.62, z: -0.38, rx: 0.22 }, 0.05));                 // spalle tonde
  // camicia, colletto, cravatta e risvolti sulla faccia davanti del busto
  const front = { y: 0.42, z: -0.02, rx: 0.22 };
  add(vc(place(slab([[-0.17, 0.3], [0.17, 0.3], [0.035, -0.12], [-0.035, -0.12]], 0.02, 0.006), front), SH, 0.02));
  for (const s of [-1, 1]) add(vc(place(slab([[0, 0.3], [s * 0.17, 0.33], [s * 0.1, 0.2]], 0.03, 0.006), { ...front, z: front.z + 0.012 }), SH, 0.02));
  add(vc(place(slab([[-0.035, 0.27], [0.035, 0.27], [0.05, -0.02], [0, -0.08], [-0.05, -0.02]], 0.02, 0.006), { ...front, z: front.z + 0.02 }), '#2a2224', 0.03));
  for (const s of [-1, 1]) add(vc(place(slab([[s * 0.17, 0.31], [s * 0.3, 0.3], [s * 0.26, 0.1], [s * 0.07, -0.14], [s * 0.04, -0.1]], 0.03, 0.01), { ...front, z: front.z + 0.004 }), JK2, 0.04));
  // braccia: spalla -> gomito sul telo -> avambraccio verso il centro
  for (const s of [-1, 1]) {
    add(rb(0.28, 0.5, 0.3, 0.1, JK, { x: s * 0.55, y: 0.32, z: -0.22, rz: s * 0.12, rx: -0.5 }, 0.05));
    add(rb(0.26, 0.24, 0.6, 0.1, JK, { x: s * 0.36, y: 0.12, z: 0.25, ry: s * 0.55 }, 0.05));
    add(rb(0.2, 0.17, 0.08, 0.04, SH, { x: s * 0.16, y: 0.12, z: 0.47, ry: s * 0.55 }, 0.02));    // polsini
  }
  // mani giunte: due palmi, dita intrecciate, pollici sopra
  for (const s of [-1, 1]) add(rb(0.17, 0.13, 0.22, 0.05, SK, { x: s * 0.07, y: 0.12, z: 0.58, ry: -s * 0.35 }, 0.04));
  for (let k = 0; k < 4; k++) add(rb(0.24, 0.05, 0.05, 0.02, SK2, { y: 0.19, z: 0.52 + k * 0.045, ry: (k % 2 ? 1 : -1) * 0.15 }, 0.03));
  for (const s of [-1, 1]) add(rb(0.06, 0.06, 0.16, 0.025, SK, { x: s * 0.035, y: 0.22, z: 0.64, ry: s * 0.25 }, 0.03));
  // --- collo e testa larga e tonda
  add(rb(0.26, 0.16, 0.24, 0.06, SK2, { y: 0.84, z: -0.24 }));
  const HY = 1.1, HZ = -0.18;
  add(rb(0.46, 0.5, 0.42, 0.13, SK, { y: HY, z: HZ }, 0.03));                                // testa
  add(rb(0.44, 0.18, 0.38, 0.09, SK, { y: HY - 0.2, z: HZ + 0.01 }, 0.03));                  // guance piene / mascella
  for (const s of [-1, 1]) {
    add(rb(0.1, 0.1, 0.06, 0.03, ROSY, { x: s * 0.15, y: HY - 0.07, z: HZ + 0.2 }, 0.03));   // guance rosse
    add(rb(0.06, 0.14, 0.1, 0.03, SK2, { x: s * 0.25, y: HY - 0.01, z: HZ - 0.02 }));        // orecchie
    add(rb(0.1, 0.055, 0.03, 0.012, '#f6f2ea', { x: s * 0.1, y: HY + 0.05, z: HZ + 0.21 }, 0)); // bianco degli occhi
    add(rb(0.045, 0.05, 0.03, 0.012, '#24160e', { x: s * 0.095, y: HY + 0.048, z: HZ + 0.222 }, 0)); // pupille
    add(rb(0.15, 0.05, 0.06, 0.02, GREY, { x: s * 0.1, y: HY + 0.12, z: HZ + 0.21, rz: -s * 0.12 }, 0.08)); // sopracciglia folte
    add(rb(0.04, 0.12, 0.1, 0.02, '#c8c4bc', { x: s * 0.225, y: HY + 0.06, z: HZ - 0.04 }, 0.06)); // capelli grigi alle tempie
    add(rb(0.035, 0.02, 0.02, 0.008, '#b86a4c', { x: s * 0.17, y: HY + 0.05, z: HZ + 0.205, rz: s * 0.5 }, 0)); // zampe di gallina
  }
  add(rb(0.13, 0.15, 0.13, 0.05, '#e48a62', { y: HY - 0.04, z: HZ + 0.25 }, 0.03));          // nasone tondo
  add(rb(0.09, 0.12, 0.07, 0.03, SK, { y: HY + 0.04, z: HZ + 0.21 }));                        // dorso del naso
  add(rb(0.26, 0.06, 0.07, 0.025, GREY, { y: HY - 0.13, z: HZ + 0.21 }, 0.08));                // baffi grigi
  for (const s of [-1, 1]) add(rb(0.07, 0.05, 0.06, 0.02, GREY, { x: s * 0.12, y: HY - 0.15, z: HZ + 0.19, rz: s * 0.4 }, 0.08));
  add(rb(0.14, 0.022, 0.02, 0.008, '#8a3a2c', { y: HY - 0.2, z: HZ + 0.205 }, 0));           // bocca
  for (const s of [-1, 1]) add(rb(0.04, 0.022, 0.02, 0.008, '#8a3a2c', { x: s * 0.075, y: HY - 0.19, z: HZ + 0.2, rz: -s * 0.5 }, 0));   // sorriso
  add(rb(0.3, 0.02, 0.02, 0.008, '#c47a58', { y: HY + 0.19, z: HZ + 0.205 }, 0));             // ruga in fronte
  // --- coppola grigio-bruna con visiera
  add(rb(0.6, 0.15, 0.56, 0.07, CAP, { y: HY + 0.29, z: HZ + 0.01, rx: -0.06 }, 0.06));
  add(rb(0.54, 0.06, 0.2, 0.03, '#3e342e', { y: HY + 0.235, z: HZ + 0.28, rx: 0.25 }, 0.04));
  add(rb(0.48, 0.05, 0.46, 0.02, '#3a302a', { y: HY + 0.22, z: HZ - 0.01 }, 0.04));
  const m = new THREE.Mesh(B.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
  m.castShadow = m.receiveShadow = true; grp.add(m);
  return grp;
}
