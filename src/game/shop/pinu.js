// v5s7c: Pinu scolpito proceduralmente (testa deformata da sfera fitta, niente scatole):
// naso pronunciato, zigomi, arcate, occhi, rughe dipinte nei vertici, coppola, giacca, camicia,
// braccia a tubo e mani giunte sul bancone. Ombreggiatura morbida.
import * as THREE from 'three';
import { warp, paint, turned, tube, col, place, Bucket, vnoise, rng, slab } from './geo.js';

const G = (x, y, z, cx, cy, cz, sx, sy, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2 + ((z - cz) / sz) ** 2));

function head() {
  const g = new THREE.SphereGeometry(1, 64, 48);
  warp(g, (v) => {
    const { x, y, z } = v;
    // forma base: piu' alta, mandibola squadrata, nuca piena
    let sx = 0.86, sy = 1.0, sz = 0.88;
    if (y < -0.1) { sx *= 1 - (-0.1 - y) * 0.2; sz *= 1 - (-0.1 - y) * 0.12; }
    if (y > 0.5) sx *= 1 - (y - 0.5) * 0.12;
    let X = x * sx, Y = y * sy, Z = z * sz;
    const f = Math.max(0, z);   // solo davanti
    // naso: dorso lungo + punta carnosa abbassata + ali
    Z += 0.42 * G(x, y, z, 0, -0.08, 1, 0.1, 0.22, 0.5) * f + 0.22 * G(x, y, z, 0, -0.27, 1, 0.14, 0.1, 0.4) * f;
    X += 0.05 * Math.sign(x) * G(x, y, z, 0.12, -0.3, 1, 0.07, 0.06, 0.4) * f;
    // arcate sopraccigliari e fronte
    Z += 0.07 * G(x, y, z, 0.3, 0.28, 1, 0.2, 0.07, 0.5) * f + 0.07 * G(x, y, z, -0.3, 0.28, 1, 0.2, 0.07, 0.5) * f;
    // orbite incavate
    Z -= 0.09 * (G(x, y, z, 0.3, 0.13, 1, 0.13, 0.08, 0.5) + G(x, y, z, -0.3, 0.13, 1, 0.13, 0.08, 0.5)) * f;
    // zigomi alti
    Z += 0.06 * (G(x, y, z, 0.48, -0.08, 0.8, 0.12, 0.1, 0.4) + G(x, y, z, -0.48, -0.08, 0.8, 0.12, 0.1, 0.4));
    X += 0.04 * Math.sign(x) * G(Math.abs(x), y, z, 0.6, -0.08, 0.7, 0.15, 0.12, 0.4);
    // guance scavate sotto gli zigomi, solco naso-labiale
    Z -= 0.05 * (G(x, y, z, 0.42, -0.35, 0.8, 0.1, 0.12, 0.4) + G(x, y, z, -0.42, -0.35, 0.8, 0.1, 0.12, 0.4));
    // bocca e labbra sottili, mento in avanti
    Z -= 0.05 * G(x, y, z, 0, -0.5, 1, 0.24, 0.035, 0.4) * f;
    Z += 0.05 * G(x, y, z, 0, -0.78, 0.9, 0.2, 0.1, 0.4) * f;
    v.set(X, Y, Z);
  });
  g.computeVertexNormals();
  const skin = col('#d48c68'), red = col('#c8604a'), dark = col('#8a4a34'), hair = col('#e6e2da');
  paint(g, (v, o) => {
    const { x, y, z } = v;
    o.copy(skin);
    const n = vnoise(x * 9, y * 9, z * 9, 3) * 0.05; o.multiplyScalar(1 + n);
    // naso e guance arrossati, orecchie
    o.lerp(red, Math.min(0.6, 1.4 * G(x, y, z, 0, -0.25, 0.95, 0.14, 0.12, 0.3) + 0.9 * (G(x, y, z, 0.42, -0.2, 0.7, 0.14, 0.12, 0.3) + G(x, y, z, -0.42, -0.2, 0.7, 0.14, 0.12, 0.3))));
    // rughe: fronte, zampe di gallina, solco naso-labiale, sotto gli occhi
    const front = z > 0.3;
    let w = 0;
    if (front && y > 0.38 && y < 0.62) w += 0.5 * Math.max(0, Math.cos((y - 0.38) * 48)) ** 8;
    for (const s of [-1, 1]) {
      const dx = x * s - 0.52, dy = y - 0.12;
      if (dx > 0 && dx < 0.14 && z > 0.2) w += 0.4 * Math.max(0, Math.cos(Math.atan2(dy, dx) * 9)) ** 10 * (1 - dx / 0.14);
      const fold = Math.abs((x * s - 0.16) - (-(y + 0.28) * 0.55));
      if (z > 0.4 && y < -0.24 && y > -0.62 && fold < 0.022) w += 0.55 * (1 - fold / 0.022);
      if (z > 0.4 && Math.abs(y + 0.0) < 0.018 && Math.abs(x * s - 0.3) < 0.12) w += 0.35;
    }
    o.lerp(dark, Math.min(0.85, w * 1.4));
    if (front && Math.abs(y + 0.5) < 0.03 && Math.abs(x) < 0.22) o.lerp(col('#7a3a2c'), 0.7);   // bocca
    // capelli bianchi corti su tempie e nuca (sotto la coppola)
    if (y > -0.15 && y < 0.55 && (z < 0.1 || Math.abs(x) > 0.64) && !(Math.abs(x) > 0.66 && z > 0.05 && y < 0.2 && y > -0.1)) o.lerp(hair, 0.92);
  });
  return g;
}

export function buildPinu() {
  const grp = new THREE.Group(), r = rng(31);
  const skinM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const clothB = new Bucket(), skinB = new Bucket();
  const JK = '#24252c', JK2 = '#17181d', SH = '#f2f0ea';
  const vc = (g, hex, vary = 0.04, f = 6) => { const b = col(hex); return paint(g, (v, o) => { const k = 1 + vnoise(v.x * f, v.y * f, v.z * f, 5) * vary; o.setRGB(b.r * k, b.g * k, b.b * k); }); };
  // --- testa
  const h = head(); place(h, { s: 0.118, y: 1.92, z: 0.02 }); grp.add(new THREE.Mesh(h, skinM)).castShadow = true;
  // occhi: bianco + iride scura + lucetta, palpebre
  for (const s of [-1, 1]) {
    const e = vc(new THREE.SphereGeometry(0.02, 14, 10), '#f4efe6', 0); place(e, { x: s * 0.031, y: 1.936, z: 0.1, sz: 0.55 }); skinB.add(e);
    const iris = vc(new THREE.SphereGeometry(0.0115, 12, 8), '#24160e', 0); place(iris, { x: s * 0.03, y: 1.934, z: 0.109, sz: 0.5 }); skinB.add(iris);
    const lid = vc(new THREE.SphereGeometry(0.021, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), '#b8765a', 0.02); place(lid, { x: s * 0.031, y: 1.94, z: 0.099, rx: 0.55, sz: 0.6 }); skinB.add(lid);
    // sopracciglia folte grigie
    const br = vc(tube([[s * 0.01, 1.958, 0.118], [s * 0.034, 1.966, 0.116], [s * 0.058, 1.958, 0.104]], 0.009, 8, 5), '#7a746a', 0.1); skinB.add(br);
    // orecchie
    const ear = vc(turned([[0, -0.03], [0.022, -0.025], [0.026, 0.01], [0.02, 0.03], [0, 0.034]], 10, r), '#c87e5e', 0.04); place(ear, { x: s * 0.094, y: 1.925, z: -0.005, rz: Math.PI / 2 * s, sx: 0.5, sz: 1.2 }); skinB.add(ear);
  }
  // collo
  skinB.add(vc(turned([[0.045, 0], [0.05, 0.05], [0.048, 0.1], [0.05, 0.12]], 14, r), '#c98262'), 0).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 1.72, -0.005));
  // --- coppola: calotta schiacciata che sporge avanti + visiera curva
  const cap = new THREE.SphereGeometry(0.135, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  warp(cap, (v) => { v.y *= 0.42; if (v.z > 0) { v.z *= 1.22; v.y -= v.z * 0.22; } v.x *= 0.96; });
  vc(cap, '#2e2a26', 0.08, 14); place(cap, { y: 2.0, z: -0.004, rx: 0.12 }); clothB.add(cap);
  const band = vc(turned([[0.118, 0], [0.122, 0.012], [0.12, 0.026]], 32, r), '#26221e', 0.05); place(band, { y: 1.985, rx: 0.12, sz: 1.05 }); clothB.add(band);
  const vis = new THREE.SphereGeometry(0.15, 28, 6, -0.95, 1.9, Math.PI * 0.47, Math.PI * 0.06);
  warp(vis, (v) => { v.y *= 0.5; }); vc(vis, '#221e1a', 0.05); place(vis, { y: 2.0, z: 0.03, rx: 0.32, ry: Math.PI / 2 }); clothB.add(vis);
  // --- busto: giacca a profilo tornito, schiacciata davanti/dietro
  const torso = turned([[0.001, 0.0], [0.17, 0.0], [0.205, 0.22], [0.215, 0.46], [0.205, 0.6], [0.17, 0.69], [0.07, 0.75], [0.001, 0.76]], 28, r);
  warp(torso, (v) => { v.z *= 0.62; v.x *= 1.12; if (v.y > 0.5) v.x *= 1 + (0.6 - Math.abs(v.y - 0.6)) * 0.4; });
  vc(torso, JK, 0.07, 10); place(torso, { y: 1.06 }); clothB.add(torso);
  // camicia bianca a V con colletto, e cravattina scura
  const shirt = slab([[-0.075, 0.2], [0.075, 0.2], [0.0, -0.05]], 0.01, 0.004); vc(shirt, SH, 0.03); place(shirt, { y: 1.56, z: 0.118 }); clothB.add(shirt);
  for (const s of [-1, 1]) { const c = slab([[0, 0], [s * 0.06, 0.012], [s * 0.035, -0.05]], 0.012, 0.004); vc(c, SH, 0.02); place(c, { y: 1.75, z: 0.1, rx: -0.25 }); clothB.add(c); }
  const tie = slab([[-0.016, 0.15], [0.016, 0.15], [0.022, 0.0], [0, -0.03], [-0.022, 0.0]], 0.008, 0.003); vc(tie, '#3a1418', 0.05); place(tie, { y: 1.58, z: 0.128 }); clothB.add(tie);
  // risvolti della giacca
  for (const s of [-1, 1]) { const l = slab([[0, 0], [s * 0.085, 0.02], [s * 0.1, -0.08], [s * 0.04, -0.2], [s * 0.012, -0.24]], 0.012, 0.006); vc(l, JK2, 0.05); place(l, { y: 1.75, z: 0.118, rx: -0.12 }); clothB.add(l); }
  // bottoni
  for (const y of [1.33, 1.23]) { const b = vc(new THREE.SphereGeometry(0.011, 8, 6), '#0c0c0e', 0); place(b, { y, z: 0.135, sz: 0.5 }); clothB.add(b); }
  // braccia: spalla -> gomito appoggiato sul tavolo -> polso verso il centro
  for (const s of [-1, 1]) {
    const arm = tube([[s * 0.2, 1.68, 0.0], [s * 0.25, 1.48, 0.03], [s * 0.25, 1.24, 0.1], [s * 0.2, 1.17, 0.25], [s * 0.07, 1.16, 0.34]], 0.062, 24, 10);
    warp(arm, (v) => { const t = (v.y - 1.16) / 0.46; v.x *= 1 + Math.max(0, t) * 0.05; });
    vc(arm, JK, 0.06, 12); clothB.add(arm);
    const cuff = vc(tube([[s * 0.09, 1.16, 0.34], [s * 0.055, 1.162, 0.36]], 0.045, 4, 10), SH, 0.02); clothB.add(cuff);
  }
  // mani giunte: due palmi intrecciati + dita a tubetto + pollici sopra
  for (const s of [-1, 1]) {
    const palm = new THREE.SphereGeometry(0.05, 18, 12); warp(palm, (v) => { v.y *= 0.62; v.z *= 1.15; });
    vc(palm, '#cf8664', 0.04); place(palm, { x: s * 0.028, y: 1.175, z: 0.395, ry: s * 0.7, rz: s * 0.25 }); skinB.add(palm);
    for (let f = 0; f < 4; f++) { const fz = 0.37 + f * 0.017; skinB.add(vc(tube([[s * 0.06, 1.18, fz], [s * 0.0, 1.198, fz + 0.01], [-s * 0.045, 1.185, fz + 0.004]], 0.0095, 8, 6), '#c47c5c', 0.03)); }
    skinB.add(vc(tube([[s * 0.06, 1.19, 0.42], [s * 0.035, 1.21, 0.445], [s * 0.01, 1.212, 0.455]], 0.011, 8, 6), '#cf8664', 0.03));
  }
  const cloth = new THREE.Mesh(clothB.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  const skin2 = new THREE.Mesh(skinB.build(), skinM);
  cloth.castShadow = skin2.castShadow = true; cloth.receiveShadow = skin2.receiveShadow = true;
  grp.add(cloth, skin2);
  return grp;
}
