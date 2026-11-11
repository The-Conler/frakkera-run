// =====================================================================
// v5 stage 7c: "Garag di Pinu" - ricostruzione completa sul riferimento 9:16
// reference/gadoni/target2-garage-di-pinu.jpg. Tutto e' geometria 3D fatta a mano
// (assi smussate e imbarcate, travi grezze, pietre irregolari, lastre di Voronoi,
// cesti torniti con trama di vimini, zucche tornite, tessuti drappeggiati, Pinu scolpito).
// Solo grafica: nessuna logica di gioco qui.
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { rng, vnoise, warp, rough, paint, solid, place, Bucket, plank, beam, stone, turned, tube, slab, col } from './shop/geo.js';
import { weaveTex, sardTex, tartanTex, glowTex, skyTex } from './shop/tex.js';
import { buildPinu } from './shop/pinu.js';

const X0 = 3.0, ZF = 0.35, ZB = -2.7, EAVE = 4.15, RID = 6.35, ZR = -1.1, ZE = 1.45;
const WOOD = ['#8a5430', '#7c4a28', '#965e36', '#70421f', '#a06838'];
const ROOF = ['#b07640', '#a26a36', '#bc844c', '#94602e', '#c48e56', '#a8703e'];

// cortile: celle di Voronoi da una griglia sfalsata, estruse e smussate
function pavement(b, r) {
  const pts = [];
  for (let z = -3.5, row = 0; z < 22; row++) {
    const s = 0.62 + Math.max(0, z) * 0.085;
    for (let x = -9 + (row % 2) * s * 0.5; x < 9; x += s) pts.push([x + r.range(-0.28, 0.28) * s, z + r.range(-0.25, 0.25) * s, s]);
    z += s * 0.82;
  }
  const tones = ['#e4cfaa', '#dcc39a', '#d6ba90', '#e9d7b6', '#cfb088', '#e0c8a0', '#d2b68e'];
  for (let i = 0; i < pts.length; i++) {
    const [px, pz, s] = pts[i];
    let poly = [[px - s * 1.5, pz - s * 1.5], [px + s * 1.5, pz - s * 1.5], [px + s * 1.5, pz + s * 1.5], [px - s * 1.5, pz + s * 1.5]];
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue; const [qx, qz] = pts[j]; const dx = qx - px, dz = qz - pz; if (dx * dx + dz * dz > (s * 2.6) ** 2) continue;
      const mx = (px + qx) / 2, mz = (pz + qz) / 2, out = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], c = poly[(k + 1) % poly.length];
        const da = (a[0] - mx) * dx + (a[1] - mz) * dz, dc = (c[0] - mx) * dx + (c[1] - mz) * dz;
        if (da <= 0) out.push(a);
        if ((da <= 0) !== (dc <= 0)) { const t = da / (da - dc); out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
      }
      poly = out; if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
    const gap = 0.045 + s * 0.02, shp = poly.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; const k = Math.max(0.2, (d - gap) / d); return [dx * k, -dz * k]; });
    const g = slab(shp, 0.05, Math.min(0.05, s * 0.05), 2);
    place(g, { rx: -Math.PI / 2, x: cx, z: cz, y: 0.0 });
    warp(g, (v) => { if (v.y > 0.02) v.y += vnoise(v.x * 1.3, 0, v.z * 1.3, i) * 0.025 + 0.02; });
    const base = col(r.pick(tones)), sd = i * 7;
    paint(g, (v, o) => { const k = 1 + vnoise(v.x * 2.2, 3, v.z * 2.2, sd) * 0.08 + vnoise(v.x * 9, 1, v.z * 9, sd) * 0.03; const e = v.y < 0.06 ? 0.78 : 1; o.setRGB(base.r * k * e, base.g * k * e, base.b * k * e); });
    b.add(g);
  }
  const grout = new THREE.PlaneGeometry(30, 34, 1, 1); place(grout, { rx: -Math.PI / 2, z: 9, y: 0.005 }); solid(grout, '#8a6c4c'); b.add(grout);
}

// cesto: corpo tornito (trama di vimini in texture + rilievo), bordo a treccia, manico
function basket(tb, wb, r, x, y, z, s, o = {}) {
  const prof = o.prof || [[0.001, 0], [0.18, 0], [0.24, 0.04], [0.29, 0.18], [0.31, 0.32], [0.3, 0.36]];
  const body = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a * s, b * s)), 20);
  rough(body, 0.006 * s, 6, Math.floor(r() * 1e6)); body.computeVertexNormals();
  place(body, { x, y, z, ry: r.range(0, 6) }); tb.push(body);
  const top = prof[prof.length - 1], R = top[0] * s, H = top[1] * s, pts = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push([x + Math.cos(a) * R, y + H + Math.sin(a * 9) * 0.006 * s, z + Math.sin(a) * R]); }
  pts.pop(); const rim = tube(pts, 0.028 * s, 48, 6, true); solid(rim, '#8a5a2c', 0.12, 4, 20); wb.add(rim);
  if (o.handle !== false) {
    const a0 = r.range(0, Math.PI), cx = Math.cos(a0) * R * 0.92, cz = Math.sin(a0) * R * 0.92;
    const hd = tube([[x + cx, y + H, z + cz], [x + cx * 0.6, y + H + R * 0.75, z + cz * 0.6], [x, y + H + R * 0.95, z], [x - cx * 0.6, y + H + R * 0.75, z - cz * 0.6], [x - cx, y + H, z - cz]], 0.024 * s, 20, 6);
    solid(hd, '#8a5a2c', 0.12, 4, 20); wb.add(hd);
  }
}
// zucca appesa (cucuzza/lampada): profilo tornito a pera con collo, picciolo e cordino
function gourd(gb, wb, r, x, yTop, z, s, L) {
  wb.add(solid(tube([[x, yTop, z], [x + r.range(-0.01, 0.01), yTop - L * 0.5, z], [x, yTop - L, z]], 0.008, 4, 4), '#2a1c12'));
  const p = [[0.001, -0.62], [0.05, -0.61], [0.12, -0.575], [0.18, -0.5], [0.21, -0.4], [0.2, -0.3], [0.16, -0.21], [0.1, -0.13], [0.05, -0.06], [0.04, 0]].map(([a, b]) => [a * s, b * s]);
  const g = new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), 14);
  warp(g, (v) => { v.x *= 1 + vnoise(v.y * 9, 0, 1, x * 9) * 0.06; v.z *= 1 + vnoise(v.y * 9, 1, 0, z * 9) * 0.06; });
  g.computeVertexNormals();
  const a = col(r.pick(['#e8823a', '#dc7230', '#f0904a'])), dk = col('#a8481c');
  paint(g, (v, o) => { const t = Math.min(1, Math.max(0, -v.y / (0.62 * s))); o.copy(dk).lerp(a, 0.35 + 0.65 * Math.sin(Math.PI * t) ); const k = 1 + vnoise(Math.atan2(v.x, v.z) * 3, v.y * 20, 0, 9) * 0.06; o.multiplyScalar(k); });
  place(g, { x, y: yTop - L - 0.04 * s, z, rz: r.range(-0.06, 0.06) }); gb.add(g);
  gb.add(solid(place(turned([[0.001, 0.07], [0.02, 0.05], [0.035, 0.0], [0.03, -0.02]], 8, r), { x, y: yTop - L - 0.04 * s, z, s }), '#7a3a18'));
}
// telo drappeggiato su un volume: piano superiore + gonne con pieghe sinusoidali
function drape(w, d, h, tex, opt = {}) {
  const grp = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
  const top = new THREE.PlaneGeometry(w, d, 12, 6); place(top, { rx: -Math.PI / 2 }); warp(top, (v) => { v.y += vnoise(v.x * 3, 0, v.z * 3, 2) * 0.006; });
  const sides = [[w, 0, d / 2, 0], [w, 0, -d / 2, Math.PI], [d, w / 2, 0, Math.PI / 2], [d, -w / 2, 0, -Math.PI / 2]];
  const parts = [top];
  for (const [len, sx, sz, ry] of sides) {
    const g = new THREE.PlaneGeometry(len, h, Math.round(len * 14), 8);
    warp(g, (v) => { const t = (h / 2 - v.y) / h; const fold = Math.sin(v.x * (opt.freq || 9) + Math.sin(v.x * 2.3) * 2) * 0.03 * t + t * t * (opt.flare ?? 0.06); v.z += fold; v.y -= h / 2; v.x *= 1 + t * 0.015; });
    place(g, { x: sx, z: sz, ry }); parts.push(g);
  }
  for (const g of parts) { g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
  return grp;
}

export function buildShopRoom() {
  const scene = new THREE.Scene();
  scene.background = skyTex();
  scene.fog = new THREE.Fog('#c8dcea', 26, 70);
  const r = rng(2026);
  const M = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, flatShading: o.flat ?? true, ...o.extra });
  const B = { wood: new Bucket(), stone: new Bucket(), smooth: new Bucket(), leaf: new Bucket(), wicker: new Bucket(), gourd: new Bucket(), floor: new Bucket(), plaster: new Bucket() };

  // ------------------------------------------------ cortile e muretti
  pavement(B.floor, r);
  const wall = (x0, z0, z1, h, side) => {
    for (let z = z0; z < z1;) {
      const d = r.range(0.55, 0.85); let y = 0;
      while (y < h) { const hh = r.range(0.38, 0.55), ww = r.range(0.7, 0.95); B.stone.add(place(stone(ww, hh, d, r.pick(['#d8ccb6', '#cdbfa6', '#e2d6c2', '#c4b498', '#d4c4a8']), r, 0.12), { x: x0 + side * r.range(-0.05, 0.08), y: y + hh / 2, z: z + d / 2 + r.range(-0.05, 0.05), ry: r.range(-0.12, 0.12) })); y += hh * 0.92; }
      z += d * 0.95;
    }
  };
  for (const s of [-1, 1]) {
    wall(s * (X0 + 0.55), 1.0, 4.8, 1.35, s); wall(s * (X0 + 0.7), -2.9, 1.0, 1.0, s); wall(s * (X0 + 1.2), 4.8, 9, 1.1, s);
    B.stone.add(place(stone(1.0, 0.75, 0.95, '#d6cab4', r, 0.08), { x: s * X0, y: 0.37, z: ZF }));                 // base del palo
    B.stone.add(place(stone(0.82, 0.22, 0.8, '#cbbda4', r, 0.06), { x: s * X0, y: 0.84, z: ZF }));
  }
  // ------------------------------------------------ struttura di legno
  for (const s of [-1, 1]) {
    B.wood.add(place(beam(0.44, 0.44, EAVE - 0.9, WOOD[0], r), { x: s * X0, y: 0.92 + (EAVE - 0.9) / 2, z: ZF, rx: Math.PI / 2, ry: r.range(-0.1, 0.1) }));
    B.wood.add(place(beam(0.36, 0.36, EAVE, WOOD[3], r), { x: s * X0, y: EAVE / 2, z: ZB + 0.25, rx: Math.PI / 2 }));
    B.wood.add(place(beam(0.16, 0.18, 1.25, WOOD[2], r), { x: s * (X0 - 0.45), y: EAVE - 0.55, z: ZF + 0.02, rx: Math.PI / 2, rz: -s * 0.78, order: 'ZXY' }));  // saette
    B.wood.add(place(beam(0.34, 0.34, 3.9, WOOD[1], r), { x: s * X0, y: EAVE - 0.08, z: (ZF + ZB) / 2 }));      // correnti laterali
  }
  B.wood.add(place(beam(0.3, 0.3, EAVE, WOOD[3], r), { x: -1.25, y: EAVE / 2, z: ZB + 0.2, rx: Math.PI / 2 }));
  B.wood.add(place(beam(0.46, 0.46, 7.3, WOOD[0], r), { y: EAVE, z: ZF, ry: Math.PI / 2 }));
  B.wood.add(place(beam(0.24, 0.26, 6.6, WOOD[3], r), { y: EAVE - 0.42, z: ZF + 0.04, ry: Math.PI / 2 }));
  B.wood.add(place(beam(0.3, 0.3, 6.6, WOOD[1], r), { y: EAVE - 0.3, z: -1.15, ry: Math.PI / 2 }));
  B.wood.add(place(beam(0.34, 0.34, 6.6, WOOD[0], r), { y: EAVE, z: ZB + 0.25, ry: Math.PI / 2 }));
  for (let x = -3.1; x <= 3.15; x += 0.78) B.wood.add(place(beam(0.18, 0.2, 1.0, WOOD[2], r), { x: x + r.range(-0.05, 0.05), y: EAVE + 0.28, z: ZF + 0.6, rx: 0.75 }));   // teste dei travetti
  // tetto: assi spesse irregolari, sporgenza sfrangiata, doppio strato
  const run = ZE - ZR, rise = RID - EAVE - 0.3, ang = Math.atan2(rise, run), len = Math.hypot(run, rise);
  for (let x = -3.85; x < 3.9;) {
    const w = r.range(0.34, 0.52), l = len + r.range(0.0, 0.45), th = r.range(0.11, 0.16);
    const g = plank(w - 0.02, th, l, r.pick(ROOF), r, { bend: 0.05, rough: 0.018, endDark: 0.35 });
    const off = r.range(-0.15, 0.2);
    place(g, { x: x + w / 2, y: (RID + EAVE + 0.3) / 2 + r.range(-0.02, 0.03) + Math.sin(ang) * off * 0.5, z: (ZR + ZE) / 2 + Math.cos(ang) * off * 0.5, rx: ang + r.range(-0.03, 0.03), rz: r.range(-0.05, 0.05) });
    B.wood.add(g);
    if (r() < 0.55) B.wood.add(place(plank(r.range(0.2, 0.3), 0.08, len * 0.6, r.pick(ROOF), r), { x: x + w * r.range(0.2, 0.8), y: (RID + EAVE + 0.3) / 2 + 0.1 + 0.3 * Math.sin(ang), z: (ZR + ZE) / 2 - 0.25, rx: ang }));
    x += w;
  }
  for (let x = -3.6; x < 3.7; x += 0.45) B.wood.add(place(plank(0.44, 0.1, 2.4, r.pick(ROOF), r), { x, y: RID - 0.6, z: ZR - 1.0, rx: -0.6 }));   // falda dietro
  B.wood.add(place(beam(0.26, 0.3, 7.8, WOOD[3], r), { y: RID - 0.02, z: ZR - 0.02, ry: Math.PI / 2 }));
  for (let x = -3.3; x <= 3.4; x += 1.1) B.wood.add(place(beam(0.16, 0.2, len, WOOD[1], r), { x, y: (RID + EAVE) / 2 + 0.02, z: (ZR + ZE) / 2 - 0.12, rx: ang }));
  const ceil = new THREE.PlaneGeometry(6.6, 3.4, 8, 4); place(ceil, { rx: Math.PI / 2, y: EAVE + 0.2, z: (ZF + ZB) / 2 }); solid(ceil, '#5a3820', 0.1, 3, 2); B.wood.add(ceil);
  // ------------------------------------------------ muro di fondo intonacato + taglieri
  const wallG = new THREE.PlaneGeometry(6.2, EAVE, 30, 20); warp(wallG, (v) => { v.z += vnoise(v.x * 2, v.y * 2, 0, 4) * 0.03; });
  const cream = col('#f6d6a2'); paint(wallG, (v, o) => { const k = 1 + vnoise(v.x * 1.5, v.y * 1.5, 0, 7) * 0.05 + vnoise(v.x * 7, v.y * 7, 0, 2) * 0.02; o.setRGB(cream.r * k, cream.g * k, cream.b * k * 0.98); });
  place(wallG, { y: EAVE / 2, z: ZB + 0.08 }); B.plaster.add(wallG);
  B.stone.add(place(stone(6.2, 0.3, 0.3, '#bfa888', r, 0.04), { y: 0.14, z: ZB + 0.15 }));
  for (let i = 0; i < 9; i++) {
    const x = -0.85 + i * 0.44 + r.range(-0.04, 0.04), h = r.range(0.55, 0.98), w = r.range(0.28, 0.38);
    if (x > 2.0) break;
    const hw = w * 0.22, hl = 0.16, R = w * 0.12;
    const shp = [[-w / 2 + R, 0], [w / 2 - R, 0], [w / 2, R], [w / 2, h - R], [w / 2 - R, h], [hw, h], [hw, h + hl], [hw * 0.6, h + hl + 0.05], [-hw * 0.6, h + hl + 0.05], [-hw, h + hl], [-hw, h], [-w / 2 + R, h], [-w / 2, h - R], [-w / 2, R]];
    const g = slab(shp, 0.035, 0.012, 1); place(g, { x, y: 3.25 - h - hl, z: ZB + 0.14, rz: r.range(-0.04, 0.04) });
    const bc = col(r.pick(['#8a5832', '#7a4a28', '#9a6638', '#6c4022'])), sd = i * 13; paint(g, (v, o) => { const k = 1 + Math.sin(v.y * 40 + vnoise(v.x * 9, v.y * 3, 0, sd) * 4) * 0.05; o.setRGB(bc.r * k, bc.g * k, bc.b * k); });
    B.wood.add(g);
    B.smooth.add(solid(place(new THREE.TorusGeometry(0.025, 0.006, 4, 8), { x, y: 3.28, z: ZB + 0.16 }), '#2a1c12'));
  }
  // ------------------------------------------------ sinistra: scaffali con cesti, cassa col tappeto, cesti a terra, arcolaio
  const tb = [];
  for (const y of [1.45, 2.15, 2.85]) { B.wood.add(place(plank(0.48, 0.07, 1.15, WOOD[2], r), { x: -2.1, y, z: ZB + 0.38, ry: Math.PI / 2 })); B.wood.add(place(beam(0.07, 0.24, 0.4, WOOD[3], r), { x: -2.1, y: y - 0.14, z: ZB + 0.32 })); }
  basket(tb, B.wicker, r, -2.1, 1.49, ZB + 0.4, 1.15); basket(tb, B.wicker, r, -2.1, 2.19, ZB + 0.4, 1.0, { prof: [[0.001, 0], [0.16, 0], [0.26, 0.08], [0.3, 0.26], [0.29, 0.3]] }); basket(tb, B.wicker, r, -2.05, 2.89, ZB + 0.4, 0.9);
  basket(tb, B.wicker, r, -2.55, 0, 0.45, 1.75, { handle: false, prof: [[0.001, 0], [0.2, 0], [0.26, 0.05], [0.3, 0.3], [0.31, 0.45], [0.3, 0.48]] });
  basket(tb, B.wicker, r, -1.75, 0, 0.6, 1.5, { handle: false, prof: [[0.001, 0], [0.22, 0], [0.28, 0.05], [0.3, 0.22], [0.31, 0.3]] });
  basket(tb, B.wicker, r, -0.95, 0, -0.2, 1.3, { handle: false, prof: [[0.001, 0], [0.2, 0], [0.26, 0.05], [0.29, 0.25], [0.3, 0.3]] });
  basket(tb, B.wicker, r, -0.75, 0.72, -1.25, 0.8); basket(tb, B.wicker, r, -1.35, 1.3, -1.55, 0.75);
  // sgabello
  B.wood.add(place(plank(0.55, 0.07, 0.55, WOOD[2], r), { x: -0.75, y: 0.68, z: -1.25 }));
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) B.wood.add(place(beam(0.06, 0.06, 0.66, WOOD[3], r), { x: -0.75 + dx, y: 0.33, z: -1.25 + dz, rx: Math.PI / 2 }));
  // arcolaio: ruota con raggi, montanti torniti, base
  const wx = -1.3, wz = -1.75;
  const ringPts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; ringPts.push([wx + Math.cos(a) * 0.36 * 0.6, 1.55 + Math.sin(a) * 0.36, wz + Math.cos(a) * 0.36 * 0.8]); }
  B.smooth.add(solid(tube(ringPts, 0.03, 40, 6, true), WOOD[1], 0.1));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; B.smooth.add(solid(tube([[wx + Math.cos(a) * 0.216, 1.55 + Math.sin(a) * 0.36, wz + Math.cos(a) * 0.288], [wx - Math.cos(a) * 0.216, 1.55 - Math.sin(a) * 0.36, wz - Math.cos(a) * 0.288]], 0.012, 2, 4), WOOD[2])); }
  for (const [dx, dz, tilt] of [[-0.25, 0.1, 0.12], [0.25, -0.1, -0.12]]) B.smooth.add(solid(place(turned([[0.04, 0], [0.03, 0.2], [0.045, 0.35], [0.025, 0.6], [0.035, 0.9], [0.02, 1.35], [0.03, 1.5]], 8, r), { x: wx + dx, z: wz + dz, rz: tilt }), WOOD[2]));
  B.smooth.add(solid(tube([[wx - 0.6, 0.12, wz + 0.25], [wx + 0.6, 0.12, wz - 0.25]], 0.05, 2, 6), WOOD[3]));
  B.smooth.add(solid(tube([[wx - 0.1, 1.2, wz + 0.5], [wx + 0.45, 0.7, wz + 0.4], [wx + 0.7, 0.05, wz + 0.35]], 0.025, 8, 5), WOOD[1]));   // pedale/braccio
  // ------------------------------------------------ destra: cassette di frutta, graticcio
  for (let i = 0; i < 3; i++) for (let j = 0; j < (i < 2 ? 2 : 1); j++) {
    const cx = 2.35 + r.range(-0.04, 0.04), cz = -1.45 - j * 0.66, cy = i * 0.46;
    for (let k = 0; k < 3; k++) for (const sgn of [-1, 1]) B.wood.add(place(plank(0.88, 0.12, 0.03, r.pick(WOOD), r, { bend: 0 }), { x: cx, y: cy + 0.08 + k * 0.14, z: cz + sgn * 0.29, rz: Math.PI / 2, ry: Math.PI / 2, order: 'YXZ', rx: 0 }));
    for (let k = 0; k < 3; k++) for (const sgn of [-1, 1]) B.wood.add(place(plank(0.03, 0.12, 0.58, r.pick(WOOD), r, { bend: 0 }), { x: cx + sgn * 0.43, y: cy + 0.08 + k * 0.14, z: cz }));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.wood.add(place(beam(0.05, 0.05, 0.44, WOOD[3], r), { x: cx + sx * 0.42, y: cy + 0.22, z: cz + sz * 0.28, rx: Math.PI / 2 }));
  }
  const fruit = new Bucket();
  for (let i = 0; i < 14; i++) { const g = new THREE.IcosahedronGeometry(r.range(0.07, 0.09), 2); rough(g, 0.008, 9, i); warp(g, (v) => { v.y *= 0.9; }); g.computeVertexNormals(); solid(g, r.pick(['#c41a26', '#d82a34', '#a8121e', '#e03a3a']), 0.1, i, 14); fruit.add(place(g, { x: 2.35 + r.range(-0.32, 0.32), y: 0.98 + r.range(0, 0.05), z: -1.45 + r.range(-0.2, 0.2) })); }
  for (let i = 0; i < 5; i++) B.wood.add(place(plank(0.9, 0.06, 0.08, WOOD[1], r), { x: 2.4, y: 1.95 + i * 0.22, z: ZB + 0.25 }));
  for (const sx of [-0.4, 0.4]) B.wood.add(place(beam(0.06, 0.06, 1.0, WOOD[3], r), { x: 2.4 + sx, y: 2.38, z: ZB + 0.28, rx: Math.PI / 2 }));
  // ------------------------------------------------ bancone: telaio + telo scozzese drappeggiato, piramide di legno
  const TX = 0.7, TZ = -0.45, TW = 3.3, TD = 1.25, TH = 1.08;
  B.wood.add(place(plank(TW, 0.08, TD, WOOD[2], r), { x: TX, y: TH - 0.04, z: TZ, ry: 0 }));
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) B.wood.add(place(beam(0.12, 0.12, TH, WOOD[3], r), { x: TX + dx * (TW / 2 - 0.12), y: TH / 2, z: TZ + dz * (TD / 2 - 0.1), rx: Math.PI / 2 }));
  B.wood.add(place(beam(0.1, 0.1, TW - 0.3, WOOD[3], r), { x: TX, y: 0.2, z: TZ + TD / 2 - 0.1, ry: Math.PI / 2 }));
  const tab = drape(TW + 0.06, TD + 0.06, 0.82, tartanTex(), { freq: 7, flare: 0.05 }); tab.position.set(TX, TH + 0.01, TZ); scene.add(tab);
  for (let i = 0; i < 7; i++) { const w = 0.7 - i * 0.095; const g = plank(w, 0.1, w * 0.8, i % 2 ? '#c8945a' : '#a8743e', r, { bend: 0, twist: 0, taper: 0 }); B.wood.add(place(g, { x: TX + 1.15, y: TH + 0.06 + i * 0.1, z: TZ - 0.15, ry: 0.2 + i * 0.03 })); }
  B.smooth.add(solid(place(turned([[0.04, 0], [0.05, 0.05], [0.02, 0.12], [0.03, 0.17], [0.001, 0.24]], 10, r), { x: TX + 1.15, y: TH + 0.76, z: TZ - 0.15 }), '#8a5a2a'));
  B.wood.add(place(plank(0.42, 0.13, 0.3, '#c49058', r), { x: TX - 1.15, y: TH + 0.08, z: TZ + 0.05, ry: 0.15 }));
  // v5s46d (280): calendario, radio e attrezzi appesi, oltre al bancone e agli scaffali
  B.plaster.add(place(plank(0.42, 0.55, 0.02, '#f6efe2', r), { x: -2.4, y: 2.15, z: ZB + 0.16 }));
  B.wood.add(place(plank(0.28, 0.28, 0.02, '#c8283a', r), { x: -2.4, y: 2.28, z: ZB + 0.18 }));
  B.wood.add(place(plank(0.46, 0.28, 0.18, '#2a2420', r), { x: TX - 0.4, y: TH + 0.2, z: TZ + 0.15 }));
  B.smooth.add(solid(place(turned([[0.001, 0], [0.08, 0], [0.08, 0.02], [0.001, 0.02]], 10, r), { x: TX - 0.22, y: TH + 0.36, z: TZ + 0.22 }), '#c8b070'));
  B.wood.add(place(beam(0.04, 0.04, 0.7, WOOD[3], r), { x: 2.55, y: 1.7, z: ZB + 0.2, rx: 0.4 }));
  B.smooth.add(solid(place(new THREE.BoxGeometry(0.22, 0.06, 0.06), { x: 2.7, y: 1.95, z: ZB + 0.22, rz: 0.3 }), '#4a4a4c'));
  B.wood.add(place(plank(0.46, 0.04, 0.34, '#8a5a2a', r), { x: TX - 1.15, y: TH + 0.16, z: TZ + 0.05, ry: 0.15 }));
  // cassa coperta dal tappeto sardo a sinistra
  B.wood.add(place(plank(1.45, 0.95, 0.85, WOOD[3], r), { x: -2.05, y: 0.47, z: -0.95 }));
  const rug = drape(1.55, 0.95, 0.85, sardTex('#a8182a', '#f1e4c8', 512, 256, [1, 1]), { freq: 11, flare: 0.03 }); rug.position.set(-2.05, 0.97, -0.95); scene.add(rug);
  // stendardo sardo appeso al palo sinistro
  const banTex = sardTex('#b0162a', '#f3e6cc', 128, 384);
  const banG = new THREE.PlaneGeometry(0.62, 1.7, 8, 16); warp(banG, (v) => { v.z += Math.sin(v.y * 3 + v.x * 2) * 0.025 + (0.85 - v.y) * 0.02; });
  banG.computeVertexNormals();
  const ban = new THREE.Mesh(banG, new THREE.MeshStandardMaterial({ map: banTex, roughness: 0.95, side: THREE.DoubleSide })); ban.position.set(-X0 + 0.55, 2.75, ZF + 0.28); ban.castShadow = true; scene.add(ban);
  B.smooth.add(solid(tube([[-X0 + 0.15, 3.62, ZF + 0.28], [-X0 + 0.95, 3.62, ZF + 0.28]], 0.022, 2, 6), '#4a2c18'));
  // ------------------------------------------------ zucche appese
  for (const [x, z, s, L] of [[-1.75, 0.1, 1.0, 0.5], [-1.25, -0.25, 0.85, 0.62], [-0.85, 0.15, 1.15, 0.45], [-0.2, -0.3, 0.9, 0.6], [1.55, 0.2, 1.2, 0.4], [2.1, -0.6, 0.8, 0.55], [2.55, 0.1, 1.05, 0.95], [-1.95, -1.3, 0.6, 0.3]]) gourd(B.gourd, B.smooth, r, x, EAVE - 0.22, z, s, L);
  // ------------------------------------------------ lanterne sui pali davanti
  const lights = [], glow = new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glass = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb648', emissiveIntensity: 2.2, roughness: 0.4 });
  const iron = new Bucket();
  for (const s of [-1, 1]) {
    const lx = s * (X0 + 0.48), ly = 3.35, lz = ZF + 0.08;
    iron.add(solid(tube([[s * (X0 + 0.2), ly + 0.62, lz], [s * (X0 + 0.42), ly + 0.66, lz], [lx, ly + 0.55, lz], [lx, ly + 0.42, lz]], 0.018, 12, 5), '#1e1612'));
    const cage = turned([[0.001, -0.3], [0.1, -0.3], [0.13, -0.24], [0.12, -0.2], [0.16, 0.18], [0.12, 0.22], [0.15, 0.26], [0.05, 0.38], [0.02, 0.42]], 4, r);
    place(cage, { x: lx, y: ly, z: lz, ry: Math.PI / 4 });
    // gabbia: solo i montanti (filo) + tetto e base piene
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; iron.add(solid(tube([[lx + Math.cos(a) * 0.12, ly - 0.22, lz + Math.sin(a) * 0.12], [lx + Math.cos(a) * 0.155, ly + 0.18, lz + Math.sin(a) * 0.155]], 0.012, 2, 4), '#1e1612')); }
    iron.add(solid(place(turned([[0.001, 0], [0.18, 0], [0.12, 0.08], [0.05, 0.16], [0.02, 0.2]], 4, r), { x: lx, y: ly + 0.2, z: lz, ry: Math.PI / 4 }), '#241a14'));
    iron.add(solid(place(turned([[0.001, 0], [0.14, 0], [0.13, 0.06], [0.001, 0.07]], 4, r), { x: lx, y: ly - 0.28, z: lz, ry: Math.PI / 4 }), '#241a14'));
    const gl = new THREE.Mesh(place(turned([[0.001, -0.22], [0.11, -0.22], [0.145, 0.18], [0.001, 0.18]], 4, r), { ry: Math.PI / 4 }), glass); gl.position.set(lx, ly, lz); scene.add(gl);
    const sp = new THREE.Sprite(glow); sp.scale.set(1.1, 1.1, 1); sp.position.set(lx, ly, lz + 0.05); scene.add(sp);
    const pl = new THREE.PointLight('#ffa44a', 4.5, 4.5, 1.6); pl.position.set(lx, ly - 0.05, lz + 0.25); scene.add(pl); lights.push(pl);
  }
  // ------------------------------------------------ fuori: alberi low-poly, casa di pietra, nuvole
  const tree = (x, z, h, s, lean = 0) => {
    B.smooth.add(solid(tube([[x, 0, z], [x + lean * 0.3, h * 0.5, z], [x + lean, h, z]], 0.16 * s, 8, 7), '#6a4a30', 0.1));
    for (const [dx, dy, dz, rr] of [[0, 0.3, 0, 1.25], [-0.8, -0.25, 0.3, 0.95], [0.85, -0.15, -0.2, 1.0], [0.15, 1.05, -0.1, 0.9], [-0.3, 0.5, 0.6, 0.8]]) {
      const g = new THREE.IcosahedronGeometry(rr * s, 1); rough(g, 0.12 * s, 1.2, Math.floor(x * 100 + dx * 10));
      const gc = col(r.pick(['#4c8c2c', '#5c9e36', '#447e28', '#68ac3e'])); paint(g, (v, o) => { const k = 0.85 + Math.max(0, (v.y) / (rr * s)) * 0.25 + vnoise(v.x * 3, v.y * 3, v.z * 3, 3) * 0.06; o.setRGB(gc.r * k, gc.g * k, gc.b * k); });
      B.leaf.add(place(g, { x: x + lean + dx * s, y: h + dy * s, z: z + dz * s }));
    }
  };
  tree(-4.9, -3.4, 5.2, 1.55, 0.3); tree(-5.3, -0.6, 2.8, 1.05); tree(4.4, -5.2, 6.6, 1.45, -0.3); tree(5.6, -2.4, 3.0, 1.0);
  for (let y = 0; y < 10; y += 0.5) for (let x = 0; x < 3.2; x += 0.72) B.stone.add(place(stone(0.7, 0.46, 0.5, r.pick(['#d8b894', '#cfae88', '#e0c4a0', '#c4a07a', '#d6b48c']), r, 0.08), { x: 5.0 + x + ((y / 0.5) % 2) * 0.34, y: y + 0.24, z: -4.3 }));
  for (let i = 0; i < 9; i++) B.smooth.add(solid(place(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 8, 1, true, 0, Math.PI), { x: 5.1 + i * 0.3, y: 10.3, z: -4.6, rx: Math.PI / 2 - 0.35, rz: Math.PI / 2 }), '#b4523a', 0.08));
  const cloud = new Bucket(); for (const [x, y, z, s] of [[-5.6, 9.6, -12, 1.6], [-4.0, 9.9, -12, 1.2], [-7.0, 9.4, -12, 1.1], [7.5, 11.6, -16, 1.0], [8.6, 11.3, -16, 0.8]]) { const g = new THREE.IcosahedronGeometry(s, 1); rough(g, 0.1, 1, s * 10); warp(g, (v) => { v.y *= 0.55; }); g.computeVertexNormals(); cloud.add(solid(place(g, { x, y, z }), '#ffffff')); }

  // ------------------------------------------------ mesh
  const add = (geo, mat, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m; };
  add(B.floor.build(), M(), false, true);
  add(B.stone.build(), M());
  add(B.wood.build(), M());
  add(B.plaster.build(), M({ flat: false }), false, true);
  add(B.smooth.build(), M({ flat: false }));
  add(B.leaf.build(), M());
  add(B.wicker.build(), M({ flat: false }));
  add(B.gourd.build(), M({ flat: false, extra: { emissive: new THREE.Color('#ff6a20'), emissiveIntensity: 0.12 } }));
  add(iron.build(), M({ flat: false }));
  add(fruit.build(), M({ flat: false, extra: { roughness: 0.45 } }));
  add(cloud.build(), new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);
  const wt = weaveTex(), wm = new THREE.MeshStandardMaterial({ map: wt, bumpMap: wt, bumpScale: 1.5, roughness: 0.9, side: THREE.DoubleSide });
  for (const g of tb) add(g, wm);
  const pinu = buildPinu(); pinu.position.set(TX + 0.02, TH + 0.075, TZ - TD / 2 - 0.02); pinu.scale.setScalar(1.22); scene.add(pinu);

  // ------------------------------------------------ luci: sole del tardo pomeriggio, cielo, rimbalzo caldo
  scene.add(new THREE.HemisphereLight('#ffe6c4', '#b07840', 1.1));
  const amb = new THREE.AmbientLight('#ffe0bc', 0.35); scene.add(amb);
  const sun = new THREE.DirectionalLight('#ffb466', 3.6);
  sun.position.set(-8, 10, 7); sun.target.position.set(0.5, 0, -0.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 9, bottom: -7, near: 1, far: 34 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const bounce = new THREE.PointLight('#ffb878', 2.2, 7, 1.4); bounce.position.set(0.5, 0.4, 1.4); scene.add(bounce);   // luce rimbalzata dal selciato
  const inner = new THREE.PointLight('#ffd49a', 5.0, 7, 1.3); inner.position.set(0.4, 3.0, 0.2); scene.add(inner);
  // v5s11b: luce calda di lato su Pinu (come nel riferimento: faccia e mani modellate da sinistra)
  const key = new THREE.SpotLight('#ffb870', 9, 6, 0.55, 0.6, 1.2);
  key.position.set(TX - 1.9, TH + 2.1, TZ - TD / 2 + 1.5); key.target.position.set(TX, TH + 0.9, TZ - TD / 2 - 0.2); scene.add(key, key.target);

  const camera = new THREE.PerspectiveCamera(55, 0.5625, 0.1, 90);
  // punti che devono restare dentro l'inquadratura (tetto con gronde, pali, lanterne, piede della bancarella)
  const FIT = [[-3.2, RID + 0.1, ZR, 0.04], [3.2, RID + 0.1, ZR, 0.04], [-(X0 + 0.48), 3.3, ZF, 0.005], [X0 + 0.48, 3.3, ZF, 0.005]];
  const FOOT = [0, 0, ZF + 0.9];
  let composer = null, ao = null, cw = 0, ch = 0, t = 0, nodT = 0, aoFailed = false;
  // inquadratura: camera centrata e un po' alta che guarda leggermente in giu' (si vede la falda del tetto
  // come nel riferimento). Per ogni distanza si cerca l'altezza che mette il piede della bancarella sul bordo
  // del pannello, poi si controlla che tetto e lanterne stiano nella fascia libera.
  const _p = new THREE.Vector3(), PITCH = THREE.MathUtils.degToRad(9);
  const setCam = (zc, cy) => { camera.position.set(0.1, cy, zc); camera.rotation.set(-PITCH, 0, 0); camera.updateMatrixWorld(); };
  const proj = (x, y, z) => { _p.set(x, y, z).project(camera); return [(_p.x + 1) / 2, (1 - _p.y) / 2]; };
  const fit = (aspect, ui) => {
    camera.fov = 52; camera.aspect = aspect; camera.updateProjectionMatrix();
    const sBot = 1 - ui.bottom - 0.01, sTop = ui.top + 0.01;
    for (let zc = 6; zc < 40; zc += 0.1) {
      let lo = -5, hi = 15;
      for (let k = 0; k < 24; k++) { const cy = (lo + hi) / 2; setCam(zc, cy); if (proj(...FOOT)[1] > sBot) hi = cy; else lo = cy; }
      setCam(zc, (lo + hi) / 2);
      let ok = true;
      for (const [x, y, z, m] of FIT) { const [sx, sy] = proj(x, y, z); if (sy < sTop || sx < m || sx > 1 - m) { ok = false; break; } }
      if (ok) return;
    }
  };
  const room = {
    scene, camera, pinu,
    nod() { nodT = 0.6; },
    update(dt, aspect, ui = { top: 0.1, bottom: 0.34 }) {
      t += dt; fit(aspect, ui);
      if (room.debugCam) { const d = room.debugCam; camera.position.set(d[0], d[1], d[2]); camera.lookAt(d[3], d[4], d[5]); camera.fov = d[6] || 30; camera.updateProjectionMatrix(); }   // solo test/screenshot
      pinu.position.y = TH + 0.075 + Math.sin(t * 1.6) * 0.006;
      pinu.rotation.y = Math.sin(t * 0.5) * 0.04;
      if (nodT > 0) { nodT = Math.max(0, nodT - dt); pinu.rotation.x = Math.sin((0.6 - nodT) / 0.6 * Math.PI * 2) * 0.05; } else pinu.rotation.x = 0;
      for (const [i, l] of lights.entries()) l.intensity = 4.5 + Math.sin(t * 7 + i * 2) * 0.25 + Math.sin(t * 13 + i) * 0.15;
    },
    // render con GTAO (occlusione ambientale) a meta' risoluzione; se non va, render semplice
    render(renderer, sz) {
      const ex = renderer.toneMappingExposure; renderer.toneMappingExposure = 1.2;
      if (!aoFailed) {
        try {
          const pr = renderer.getPixelRatio(), w = Math.round(sz.x * pr), h = Math.round(sz.y * pr);
          if (!composer) {
            composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
            ao = new GTAOPass(scene, camera, w, h); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.85;
            ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
            ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
            composer.addPass(ao); composer.addPass(new OutputPass());
          }
          if (w !== cw || h !== ch) { cw = w; ch = h; composer.setPixelRatio(1); composer.setSize(w, h); }
          composer.render();
        } catch (e) { aoFailed = true; console.warn('shop AO off', e); renderer.render(scene, camera); }
      } else renderer.render(scene, camera);
      renderer.toneMappingExposure = ex;
    },
  };
  return room;
}
