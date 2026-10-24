// v5s7d: Pinu rifatto sul riferimento (target2): anziano robusto, spalle larghe e tonde, un po' curvo,
// appoggiato sul bancone con gli avambracci sul telo e le mani giunte davanti. Stile low-poly a faccette
// come il riferimento (flat shading), forme organiche deformate - niente scatole.
// Origine locale: altezza del piano del tavolo, z = 0 sul bordo posteriore del tavolo (il tavolo e' verso +z).
import * as THREE from 'three';
import { warp, paint, tube, col, place, Bucket, vnoise, slab } from './geo.js';

const GS = (x, y, z, cx, cy, cz, sx, sy, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2 + ((z - cz) / sz) ** 2));
const vc = (g, hex, vary = 0.05, f = 5, seed = 5) => { const b = col(hex); return paint(g, (v, o) => { const k = 1 + vnoise(v.x * f, v.y * f, v.z * f, seed) * vary; o.setRGB(b.r * k, b.g * k, b.b * k); }); };
const blob = (r, ws, hs, o, f) => { const g = new THREE.SphereGeometry(r, ws, hs); if (f) warp(g, f); return place(g, o); };

function head() {
  // testa squadrata da anziano: mandibola larga, zigomi, arcata, guance un po' cadenti
  const g = new THREE.SphereGeometry(1, 14, 12);
  warp(g, (v) => {
    const { x, y, z } = v;
    let X = x * 0.9, Y = y * 1.12, Z = z * 0.92;
    if (y < -0.2) { X *= 1 - (-0.2 - y) * 0.15; }                 // mascella larga ma che stringe poco
    if (y < -0.75) Y = -0.84 - (y + 0.75) * 0.6;                  // mento piatto
    if (y > 0.55) X *= 0.95;
    const f = Math.max(0, z);
    Z += 0.12 * (GS(x, y, z, 0.32, 0.26, 1, 0.22, 0.1, 0.5) + GS(x, y, z, -0.32, 0.26, 1, 0.22, 0.1, 0.5)) * f;   // arcate
    Z -= 0.12 * (GS(x, y, z, 0.32, 0.1, 1, 0.16, 0.09, 0.5) + GS(x, y, z, -0.32, 0.1, 1, 0.16, 0.09, 0.5)) * f;   // orbite
    Z += 0.08 * (GS(x, y, z, 0.5, -0.1, 0.8, 0.15, 0.15, 0.5) + GS(x, y, z, -0.5, -0.1, 0.8, 0.15, 0.15, 0.5));   // zigomi
    v.set(X, Y, Z);
  });
  const skin = col('#e0956a'), warm = col('#d06a4c'), dk = col('#9a5638'), hair = col('#b8b2a8');
  paint(g, (v, o) => {
    const { x, y, z } = v; o.copy(skin).multiplyScalar(1 + vnoise(x * 4, y * 4, z * 4, 2) * 0.05);
    o.lerp(warm, 0.5 * (GS(x, y, z, 0.48, -0.25, 0.75, 0.2, 0.2, 0.4) + GS(x, y, z, -0.48, -0.25, 0.75, 0.2, 0.2, 0.4)));
    if (z > 0.4 && y > 0.42 && y < 0.6) o.lerp(dk, 0.35);                                          // ruga della fronte
    if (z > 0.5 && y < -0.2 && y > -0.62 && Math.abs(Math.abs(x) - (0.24 - (y + 0.2) * 0.25)) < 0.06) o.lerp(dk, 0.4);   // solchi naso-labiali
    if (y > -0.25 && y < 0.5 && (z < 0.15 || Math.abs(x) > 0.78)) o.lerp(hair, 0.9);                  // capelli grigi ai lati
  });
  return g;
}

export function buildPinu() {
  const grp = new THREE.Group();
  const jacket = new Bucket(), skin = new Bucket(), misc = new Bucket();
  const JK = '#3c3836', JK2 = '#2a2726', SH = '#efece4', SK = '#e3925f', SK2 = '#cf805a';
  // --- busto curvo in avanti, spalle larghe e tonde
  jacket.add(vc(blob(1, 12, 10, { x: 0, y: 0.16, z: -0.34, sx: 0.56, sy: 0.56, sz: 0.36, rx: 0.32 }, (v) => { if (v.y > 0.3) v.x *= 1 + (v.y - 0.3) * 0.2; if (v.y > 0.6) v.y = 0.6 + (v.y - 0.6) * 0.5 - Math.abs(v.x) * 0.25; }), JK, 0.06));
  for (const s of [-1, 1]) jacket.add(vc(blob(0.17, 9, 7, { x: s * 0.46, y: 0.42, z: -0.3, sx: 1.1, sy: 0.8 }), JK, 0.06));
  // risvolti, camicia, colletto, cravatta
  for (const s of [-1, 1]) { const l = slab([[s * 0.08, 0], [s * 0.2, 0.0], [s * 0.24, -0.12], [s * 0.12, -0.42], [s * 0.04, -0.4]], 0.03, 0.012); jacket.add(vc(place(l, { y: 0.6, z: 0.13, rx: 0.42 }), JK2, 0.05)); }
  misc.add(vc(place(slab([[-0.13, 0.0], [0.13, 0.0], [0.025, -0.36], [-0.025, -0.36]], 0.02, 0.008), { y: 0.62, z: 0.11, rx: 0.42 }), SH, 0.02));
  for (const s of [-1, 1]) misc.add(vc(place(slab([[0, 0], [s * 0.12, 0.03], [s * 0.07, -0.08]], 0.025, 0.008), { y: 0.65, z: 0.06, rx: 0.2 }), SH, 0.02));
  misc.add(vc(place(slab([[-0.03, 0], [0.03, 0], [0.04, -0.22], [0, -0.27], [-0.04, -0.22]], 0.02, 0.006), { y: 0.6, z: 0.14, rx: 0.42 }), '#2a2224', 0.04));
  // --- braccia: spalla -> gomito sul telo -> polso davanti, mani giunte
  for (const s of [-1, 1]) {
    jacket.add(vc(tube([[s * 0.5, 0.42, -0.3], [s * 0.58, 0.22, -0.12], [s * 0.54, 0.11, 0.12]], 0.135, 8, 7), JK, 0.06));
    jacket.add(vc(tube([[s * 0.54, 0.11, 0.12], [s * 0.4, 0.11, 0.34], [s * 0.15, 0.12, 0.5]], 0.12, 8, 7), JK, 0.06));
    jacket.add(vc(blob(0.14, 8, 6, { x: s * 0.54, y: 0.12, z: 0.1, sy: 0.85 }), JK, 0.05));       // gomito
    misc.add(vc(tube([[s * 0.17, 0.12, 0.5], [s * 0.12, 0.12, 0.53]], 0.1, 2, 8), SH, 0.02));        // polsini
  }
  // mani: due palmi che si stringono, dita intrecciate a gobbe, pollici sopra
  for (const s of [-1, 1]) skin.add(vc(blob(0.1, 8, 6, { x: s * 0.055, y: 0.12, z: 0.6, sx: 0.9, sy: 0.75, sz: 1.15, ry: -s * 0.5 }), SK, 0.05));
  for (let k = 0; k < 4; k++) { const s = k % 2 ? 1 : -1; skin.add(vc(blob(0.04, 6, 5, { x: s * 0.02, y: 0.19, z: 0.55 + k * 0.035, sx: 2.2, sy: 0.8 }), SK2, 0.04)); }
  for (const s of [-1, 1]) skin.add(vc(tube([[s * 0.08, 0.17, 0.62], [s * 0.04, 0.21, 0.68], [s * 0.01, 0.21, 0.7]], 0.03, 4, 6), SK, 0.04));
  // --- collo e testa (un po' in avanti per la schiena curva)
  skin.add(vc(blob(0.12, 8, 6, { x: 0, y: 0.7, z: -0.1, sy: 0.9 }), SK2, 0.04));
  const H = { x: 0, y: 1.0, z: -0.04, s: 0.255 };
  skin.add(place(head(), { x: H.x, y: H.y, z: H.z, s: H.s }));
  const hx = (x) => x * H.s, hy = (y) => H.y + y * H.s, hz = (z) => H.z + z * H.s;
  // naso tondo e carnoso
  skin.add(vc(blob(0.066, 8, 6, { x: 0, y: hy(-0.18), z: hz(1.02), sx: 0.9, sy: 1.0, sz: 0.9 }), '#d6805a', 0.03));
  skin.add(vc(blob(0.04, 6, 5, { x: 0, y: hy(0.02), z: hz(0.95), sx: 0.7, sy: 1.6, sz: 0.8 }), SK, 0.03));
  for (const s of [-1, 1]) skin.add(vc(blob(0.026, 6, 4, { x: s * 0.04, y: hy(-0.24), z: hz(0.93) }), '#d07a56', 0.03));
  // occhi con il bianco, iride scura, palpebra; sopracciglia grigie folte; orecchie
  for (const s of [-1, 1]) {
    misc.add(vc(blob(0.04, 8, 6, { x: s * hx(0.32), y: hy(0.1), z: hz(0.84), sx: 1.25, sy: 0.75, sz: 0.5 }), '#f4f0e8', 0));
    misc.add(vc(blob(0.023, 8, 6, { x: s * hx(0.31), y: hy(0.09), z: hz(0.9), sz: 0.5 }), '#2a1c14', 0));
    skin.add(vc(blob(0.048, 8, 5, { x: s * hx(0.32), y: hy(0.17), z: hz(0.84), sx: 1.25, sy: 0.45, sz: 0.55 }), '#c87656', 0.03));
    misc.add(vc(tube([[s * hx(0.12), hy(0.29), hz(1.0)], [s * hx(0.32), hy(0.33), hz(0.98)], [s * hx(0.52), hy(0.27), hz(0.86)]], 0.028, 4, 5), '#8e8a84', 0.08));
    skin.add(vc(blob(0.06, 7, 5, { x: s * hx(0.93), y: hy(0.02), z: hz(0.0), sx: 0.45, sy: 1.25, sz: 0.8 }), SK2, 0.04));
  }
  // baffi grigi e bocca che sorride appena
  misc.add(vc(tube([[-hx(0.32), hy(-0.42), hz(0.86)], [-hx(0.12), hy(-0.33), hz(0.98)], [0, hy(-0.34), hz(1.0)], [hx(0.12), hy(-0.33), hz(0.98)], [hx(0.32), hy(-0.42), hz(0.86)]], 0.032, 10, 6), '#a8a49c', 0.08));
  misc.add(vc(tube([[-hx(0.2), hy(-0.5), hz(0.9)], [0, hy(-0.54), hz(0.95)], [hx(0.2), hy(-0.5), hz(0.9)]], 0.012, 6, 4), '#7a3a2c', 0.02));
  // --- coppola grigio-bruna con visiera
  const cap = new THREE.SphereGeometry(0.29, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  warp(cap, (v) => { v.y *= 0.42; if (v.z > 0) { v.z *= 1.18; v.y -= v.z * 0.15; } });
  misc.add(vc(place(cap, { x: 0, y: hy(0.7), z: hz(-0.05), rx: 0.1 }), '#4a3e36', 0.07, 8));
  misc.add(vc(place(new THREE.CylinderGeometry(0.265, 0.27, 0.06, 12, 1, true), { x: 0, y: hy(0.66), z: hz(-0.05), rx: 0.1 }), '#3e342e', 0.05));
  const vis = new THREE.SphereGeometry(0.31, 12, 3, -0.9, 1.8, Math.PI * 0.46, Math.PI * 0.08);
  warp(vis, (v) => { v.y *= 0.4; });
  misc.add(vc(place(vis, { x: 0, y: hy(0.73), z: hz(0.15), rx: 0.28, ry: Math.PI / 2 }), '#3a302a', 0.05));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  for (const b of [jacket, skin, misc]) { const m = new THREE.Mesh(b.build(), mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
  return grp;
}
