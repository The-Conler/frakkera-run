// Modelli low-poly del villaggio e degli oggetti di gioco.
// Convenzione case: facciata sul piano x = 0, strada verso +x, casa da z = 0 a z = -w.
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';

export const PAL = {
  plaster: ['#efcf9f', '#f3dcb5', '#e3ad7f', '#ecbf8f', '#f6e4c8', '#d9a27c', '#eac58f', '#f0c7a6', '#e7b48a'],
  stone: ['#b8a68c', '#a99a84', '#c2b296'],
  roof: ['#c8643c', '#b9532f', '#d6774a', '#bf5d3a'],
  shutter: ['#3f7d5b', '#3d6f9e', '#7a4a2a', '#5b8f6b', '#2f6476', '#8c3b2f'],
  glass: '#2f3d5c', lit: '#ffd682', frame: '#f1e4c9',
  door: ['#6e4426', '#5a3720', '#7c4e2b', '#3f5f7a'],
  leaf: ['#4f9a3a', '#3f8233', '#64ae46', '#377a35', '#5aa040'],
  flower: ['#e8457f', '#ff86b0', '#c84bd6', '#ffffff', '#ff6a3d', '#ffd23f'],
  iron: '#2b2a33', pot: '#c06a3f',
};

function windowAt(k, y, z, r, opts = {}) {
  const lit = r.chance(opts.litP ?? 0.3);
  k.add(G.box(0.14, 1.5, 1.15), PAL.frame, { x: 0.05, y, z });
  k.add(G.box(0.1, 1.24, 0.88), lit ? PAL.lit : PAL.glass, { x: 0.09, y, z, unlit: lit });
  k.add(G.box(0.05, 0.06, 0.88), PAL.frame, { x: 0.15, y: y + 0.05, z });
  k.add(G.box(0.05, 1.24, 0.06), PAL.frame, { x: 0.15, y, z });
  k.add(G.box(0.32, 0.12, 1.3), PAL.frame, { x: 0.12, y: y - 0.78, z });
  const sc = opts.shutter;
  const open = r.range(0.25, 0.7);
  k.add(G.box(0.08, 1.3, 0.48), sc, { x: 0.12 + Math.sin(open) * 0.24, y, z: z + 0.66 + (1 - Math.cos(open)) * 0.1, ry: -open, vary: 0.12 });
  k.add(G.box(0.08, 1.3, 0.48), sc, { x: 0.12 + Math.sin(open) * 0.24, y, z: z - 0.66 - (1 - Math.cos(open)) * 0.1, ry: open, vary: 0.12 });
  if (opts.flowers) flowerBox(k, 0.32, y - 1.0, z, r);
}
function flowerBox(k, x, y, z, r) {
  k.add(G.box(0.42, 0.34, 1.15), PAL.pot, { x, y, z, vary: 0.1 });
  for (let i = 0; i < 6; i++) k.add(G.ico(r.range(0.16, 0.24)), r.pick(PAL.leaf), { x: x + r.range(-0.1, 0.15), y: y + 0.28, z: z + r.range(-0.5, 0.5), flat: true, vary: 0.2 });
  for (let i = 0; i < 5; i++) k.add(G.ico(r.range(0.09, 0.13)), r.pick(PAL.flower), { x: x + r.range(0, 0.25), y: y + r.range(0.35, 0.55), z: z + r.range(-0.5, 0.5), flat: true });
}
function bush(k, x, y, z, s, r, flowers = 0.4) {
  for (let i = 0; i < 5; i++) k.add(G.ico(s * r.range(0.45, 0.7), 1), r.pick(PAL.leaf), { x: x + r.range(-s, s) * 0.5, y: y + r.range(0, s * 0.6), z: z + r.range(-s, s) * 0.6, flat: true, vary: 0.25 });
  if (r.chance(flowers)) for (let i = 0; i < 6; i++) k.add(G.ico(0.1), r.pick(PAL.flower), { x: x + r.range(-s, s) * 0.5, y: y + r.range(0.2, s * 0.9), z: z + r.range(-s, s) * 0.6, flat: true });
}
function lantern(k, x, y, z) {
  k.add(G.box(0.7, 0.07, 0.07), PAL.iron, { x: x - 0.35, y: y + 0.42, z });
  k.add(G.box(0.07, 0.4, 0.07), PAL.iron, { x: x - 0.68, y: y + 0.25, z });
  k.add(G.cone(0.26, 0.24, 4), PAL.iron, { x, y: y + 0.36, z, ry: Math.PI / 4 });
  k.add(G.box(0.3, 0.42, 0.3), '#ffcf6a', { x, y, z, unlit: true });
  k.add(G.box(0.36, 0.06, 0.36), PAL.iron, { x, y: y - 0.23, z });
  for (const [dx, dz] of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.15], [-0.15, -0.15]]) k.add(G.box(0.04, 0.44, 0.04), PAL.iron, { x: x + dx, y, z: z + dz });
}

export function buildHouse(seed) {
  const r = rng(seed * 7919 + 13);
  const k = new Kit(seed);
  const w = r.pick([5.2, 6, 6.8, 7.6, 8.4]);
  const floors = r.pick([2, 2, 3, 3, 3, 4]);
  const h = 0.9 + floors * 2.7 + 0.3;
  const D = 6;
  const stoneHouse = r.chance(0.22);
  const plaster = stoneHouse ? r.pick(PAL.stone) : r.pick(PAL.plaster);
  const stone = r.pick(PAL.stone);
  const shutter = r.pick(PAL.shutter);
  k.add(G.box(D, h, w), plaster, { x: -D / 2, y: h / 2, z: -w / 2, vary: stoneHouse ? 0.0 : 0.03 });
  if (stoneHouse) { // pietre a vista
    for (let i = 0; i < 26; i++) k.add(G.box(0.08, r.range(0.25, 0.4), r.range(0.4, 0.8)), r.pick(PAL.stone), { x: 0.03, y: r.range(1, h - 0.5), z: -r.range(0.3, w - 0.3), vary: 0.15 });
  }
  k.add(G.box(0.3, 0.95, w), stone, { x: 0.02, y: 0.47, z: -w / 2, vary: 0.2 });
  for (let y = 1.2, i = 0; y < h - 0.4; y += 0.62, i++) {
    const zz = i % 2 ? 0.45 : 0.3;
    k.add(G.box(0.1, 0.5, zz * 2), stone, { x: 0.05, y, z: -zz, vary: 0.2 });
    k.add(G.box(0.1, 0.5, zz * 2), stone, { x: 0.05, y, z: -w + zz, vary: 0.2 });
  }
  k.add(G.box(0.7, 0.28, w + 0.5), '#e9dcc2', { x: 0.12, y: h, z: -w / 2 });
  // tetto a padiglione
  const rh = r.range(1.4, 2.1);
  const roofC = r.pick(PAL.roof);
  k.add(G.cone(0.5, 1, 4), roofC, { x: -D / 2 + 0.25, y: h + 0.14 + rh / 2, z: -w / 2, ry: Math.PI / 4, sx: (D + 1.3) / 0.7071, sy: rh, sz: (w + 1.0) / 0.7071, vary: 0.12, flat: true });
  for (let i = 0; i < 5; i++) k.add(G.box(0.1, 0.08, w + 0.9), '#a94a2b', { x: 0.55 - i * 0.55, y: h + 0.2 + i * (rh / 5.5), z: -w / 2 });
  if (r.chance(0.5)) k.add(G.box(0.6, 1.1, 0.6), '#d9c7a8', { x: -D / 2 - 0.5, y: h + rh * 0.7, z: -w * r.range(0.25, 0.75) });
  // aperture
  const slots = Math.max(1, Math.floor(w / 2.5));
  const sp = w / slots;
  const doorSlot = Math.floor(r() * slots);
  const lamps = [];
  for (let f = 0; f < floors; f++) {
    const yc = 0.9 + f * 2.7 + 1.35;
    const balcony = f > 0 && r.chance(0.28);
    for (let s = 0; s < slots; s++) {
      const z = -sp * (s + 0.5);
      if (f === 0 && s === doorSlot) {
        const dc = r.pick(PAL.door);
        k.add(G.box(0.16, 2.5, 1.55), stone, { x: 0.05, y: 1.25, z, vary: 0.15 });
        k.add(G.box(0.12, 2.25, 1.2), dc, { x: 0.1, y: 1.12, z, vary: 0.08 });
        k.add(G.cyl(0.6, 0.6, 0.12, 12), dc, { x: 0.1, y: 2.25, z, rz: Math.PI / 2 });
        k.add(G.box(0.5, 0.14, 1.7), stone, { x: 0.3, y: 0.07, z });
        if (r.chance(0.6)) { k.add(G.cyl(0.26, 0.2, 0.5, 8), PAL.pot, { x: 0.55, y: 0.25, z: z + 1.25 }); bush(k, 0.55, 0.7, z + 1.25, 0.6, r, 0.7); }
        continue;
      }
      if (f === 0 && r.chance(0.35)) continue;
      if (balcony && s === Math.min(slots - 1, 1)) continue;
      windowAt(k, yc, z, r, { shutter, flowers: f > 0 && r.chance(0.45), litP: 0.28 });
    }
    if (balcony) {
      const bz = -sp * (Math.min(slots - 1, 1) + 0.5);
      const by = 0.9 + f * 2.7;
      k.add(G.box(1.1, 0.2, 2.5), '#d8c8ab', { x: 0.55, y: by, z: bz });
      k.add(G.box(0.12, 2.1, 1.1), r.pick(PAL.door), { x: 0.06, y: by + 1.1, z: bz });
      for (let i = 0; i <= 8; i++) k.add(G.box(0.05, 0.85, 0.05), PAL.iron, { x: 1.05, y: by + 0.5, z: bz - 1.2 + i * 0.3 });
      k.add(G.box(0.07, 0.07, 2.5), PAL.iron, { x: 1.05, y: by + 0.95, z: bz });
      for (const side of [-1.2, 1.2]) k.add(G.box(1.0, 0.07, 0.07), PAL.iron, { x: 0.55, y: by + 0.95, z: bz + side });
      for (let i = 0; i < 3; i++) { k.add(G.cyl(0.18, 0.14, 0.32, 8), PAL.pot, { x: 0.8, y: by + 0.26, z: bz - 0.8 + i * 0.8 }); bush(k, 0.8, by + 0.6, bz - 0.8 + i * 0.8, 0.45, r, 0.8); }
    }
  }
  if (r.chance(0.55)) { const lz = -sp * (doorSlot + 0.5) + (r.chance(0.5) ? 1.1 : -1.1); lantern(k, 0.75, 3.1, lz); lamps.push({ x: 0.75, y: 3.1, z: lz }); }
  // rampicante (bouganville / edera)
  if (r.chance(0.45)) {
    const z0 = -r.range(0.4, w - 0.4);
    const top = r.range(h * 0.45, h * 0.85);
    for (let y = 0.3; y < top; y += 0.45) k.add(G.ico(r.range(0.35, 0.6), 0), r.pick(PAL.leaf), { x: 0.22, y, z: z0 + Math.sin(y * 1.3) * 0.5 + r.range(-0.3, 0.3), flat: true, vary: 0.25 });
    if (r.chance(0.6)) for (let i = 0; i < 9; i++) k.add(G.ico(0.13), r.pick(['#d6338a', '#e04f9b', '#b42f7a']), { x: 0.45, y: r.range(1, top), z: z0 + r.range(-0.6, 0.6), flat: true });
  }
  return { geom: k.build({ ao: 0.32 }), w, h, lamps };
}

// giardino con albero tra le case
export function buildGarden(seed) {
  const r = rng(seed * 104729 + 7);
  const k = new Kit(seed + 99);
  const w = r.pick([3.6, 4.4, 5.2]);
  k.add(G.box(6, 4.2, w), r.pick(PAL.plaster), { x: -6.5, y: 2.1, z: -w / 2 });
  for (let z = -0.3; z > -w; z -= 0.62) k.add(G.dode(0.36), r.pick(PAL.stone), { x: 0.1, y: 0.32, z: z + r.range(-0.1, 0.1), sy: 0.75, flat: true, vary: 0.25 });
  for (let z = -0.6; z > -w + 0.3; z -= 0.7) k.add(G.dode(0.32), r.pick(PAL.stone), { x: 0.1, y: 0.78, z, sy: 0.75, flat: true, vary: 0.25 });
  const tz = -w / 2;
  k.add(G.cyl(0.2, 0.32, 3.4, 7), '#6b4a2f', { x: -1.6, y: 1.7, z: tz, flat: true });
  const big = r.pick([2.1, 2.4, 2.7]);
  for (let i = 0; i < 6; i++) k.add(G.ico(big * r.range(0.55, 0.85), 1), r.pick(PAL.leaf), { x: -1.6 + r.range(-1, 1.1), y: 3.8 + r.range(-0.4, 1.4), z: tz + r.range(-1.2, 1.2), flat: true, vary: 0.22 });
  if (r.chance(0.5)) for (let i = 0; i < 6; i++) k.add(G.ico(0.18), r.pick(['#ff9a2a', '#ffcf3a']), { x: -1.6 + r.range(-1.4, 1.4), y: 3.6 + r.range(0, 1.6), z: tz + r.range(-1.5, 1.5), flat: true });
  bush(k, -0.5, 1.0, -0.6, 1.0, r, 0.8);
  bush(k, -0.5, 1.0, -w + 0.6, 1.0, r, 0.6);
  return { geom: k.build({ ao: 0.25 }), w, h: 6, lamps: [] };
}

// festone di bandierine attraverso la strada (x da -L a +L)
export function buildBanner(seed, L) {
  const r = rng(seed * 31 + 5);
  const k = new Kit(seed);
  const cols = r.chance(0.5) ? ['#7a3b8f', '#c0392b', '#e8b63a', '#f3e6c8'] : ['#c0392b', '#e8b63a', '#7a3b8f', '#3d6f9e'];
  const sag = r.range(0.4, 0.75);
  const yAt = (x) => -sag * (1 - (x / L) * (x / L));
  const N = 14;
  for (let i = 0; i < N; i++) {
    const x0 = -L + (2 * L * i) / N, x1 = -L + (2 * L * (i + 1)) / N;
    const y0 = yAt(x0), y1 = yAt(x1);
    const len = Math.hypot(x1 - x0, y1 - y0);
    k.add(G.cyl(0.025, 0.025, len, 4), '#3a3030', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2 });
  }
  let i = 0;
  for (let x = -L + 0.6; x < L - 0.4; x += 0.85, i++) {
    k.add(G.cone(0.34, 0.75, 3), cols[i % cols.length], { x, y: yAt(x) - 0.4, rx: Math.PI, sz: 0.12, vary: 0.05 });
  }
  if (r.chance(0.7)) { // drappi verticali vicino alle facciate (fuori dal percorso della camera)
    const c = r.pick(['#6d2f86', '#a8243a']);
    for (const sx of [-1, 1]) {
      if (sx === 1 && r.chance(0.4)) continue;
      const x = sx * (L - 1.0);
      k.add(G.box(1.1, 2.4, 0.06), c, { x, y: yAt(x) - 1.3 });
      k.add(G.box(1.1, 0.16, 0.08), '#e8b63a', { x, y: yAt(x) - 0.2 });
      k.add(G.box(1.1, 0.1, 0.08), '#e8b63a', { x, y: yAt(x) - 2.3 });
      k.add(G.cone(0.55, 0.45, 3), c, { x, y: yAt(x) - 2.7, rx: Math.PI, sz: 0.08 });
    }
  }
  return k.build();
}

// ---------------------------------------------------------------- oggetti di gioco
export function barrelGeometry(H = 1.8, R0 = 0.62, bulge = 0.16) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(R0 + bulge * Math.sin(Math.PI * t), t * H)); }
  const body = new THREE.LatheGeometry(pts, 18);
  const lid = new THREE.CircleGeometry(R0 + 0.01, 18).rotateX(-Math.PI / 2).translate(0, H - 0.04, 0);
  const hoops = [];
  for (const t of [0.07, 0.27, 0.73, 0.93]) {
    const rr = R0 + bulge * Math.sin(Math.PI * t) + 0.02;
    hoops.push(new THREE.TorusGeometry(rr, 0.055, 5, 22).rotateX(Math.PI / 2).translate(0, t * H, 0));
  }
  return { body, lid, hoops, H };
}

export function buildStoneWall(seed) {
  const r = rng(seed * 17 + 3);
  const k = new Kit(seed);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6 - (row === 2 ? 1 : 0); i++) {
      const x = -1.15 + i * 0.46 + (row % 2) * 0.23;
      k.add(G.dode(r.range(0.3, 0.38)), r.pick(['#a59f96', '#8f8a83', '#b8b1a6', '#9a8f80', '#c2b8a8']), { x, y: 0.28 + row * 0.42, z: r.range(-0.1, 0.1), sy: 0.72, sz: 1.1, rx: r() * 3, ry: r() * 3, flat: true, vary: 0.2 });
    }
  }
  for (let i = 0; i < 5; i++) k.add(G.ico(0.2, 0), r.pick(PAL.leaf), { x: r.range(-1, 1), y: 1.3, z: r.range(-0.2, 0.2), flat: true });
  return k.build({ ao: 0.3 });
}

export function buildGoat() {
  const k = new Kit(42);
  const W = '#f2ede3', B = '#7d5b3c';
  k.add(G.box(1.35, 0.72, 0.68), W, { y: 1.0, vary: 0.05 });
  k.add(G.box(0.55, 0.5, 0.7), B, { x: -0.25, y: 1.12, vary: 0.05 });
  k.add(G.box(0.36, 0.5, 0.36), W, { x: 0.78, y: 1.35, rz: -0.35 });
  k.add(G.box(0.42, 0.36, 0.38), W, { x: 0.98, y: 1.52 });
  k.add(G.box(0.22, 0.2, 0.3), '#e8c0b0', { x: 1.2, y: 1.45 });
  k.add(G.box(0.12, 0.25, 0.1), '#d8d0c2', { x: 1.12, y: 1.2 });
  for (const z of [-0.12, 0.12]) {
    k.add(G.cone(0.07, 0.5, 5), '#4a423c', { x: 0.88, y: 1.85, z, rz: 0.6 });
    k.add(G.box(0.08, 0.1, 0.3), W, { x: 0.9, y: 1.62, z: z * 2.6, rx: z > 0 ? 0.6 : -0.6 });
    k.add(G.sph(0.04, 5, 4), '#201a18', { x: 1.12, y: 1.6, z: z * 1.3 });
  }
  k.add(G.box(0.12, 0.25, 0.12), W, { x: -0.72, y: 1.3, rz: 0.6 });
  for (const [x, z] of [[0.5, 0.22], [0.5, -0.22], [-0.5, 0.22], [-0.5, -0.22]]) {
    k.add(G.box(0.15, 0.68, 0.15), x > 0 ? W : B, { x, y: 0.34, z });
    k.add(G.box(0.16, 0.12, 0.16), '#3a302a', { x, y: 0.06, z });
  }
  return k.build();
}

function stalkBundle(k, r, cols, n, rad, len, tip) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const rr = rad * (i === 0 ? 0 : r.range(0.5, 1));
    k.add(G.cyl(0.05, 0.065, len, 5), r.pick(cols), { x: Math.cos(a) * rr, y: len / 2 + r.range(-0.08, 0.08), z: Math.sin(a) * rr, rz: r.range(-0.08, 0.08) });
    tip(Math.cos(a) * rr, len, Math.sin(a) * rr);
  }
}
export function buildAsphodel() {
  const r = rng(77); const k = new Kit(77);
  stalkBundle(k, r, ['#c9b27a', '#b89c62', '#d9c690', '#a99060'], 9, 0.2, 1.7, (x, y, z) => {
    for (let j = 0; j < 3; j++) k.add(G.ico(0.1), j ? '#fbf6ee' : '#f2c6d2', { x: x + r.range(-0.1, 0.1), y: y - 0.05 - j * 0.16, z: z + r.range(-0.1, 0.1), flat: true });
  });
  for (const y of [0.45, 1.0]) k.add(G.torus(0.24, 0.05, 5, 12), '#8a3a26', { y, rx: Math.PI / 2 });
  return k.build();
}
export function buildFerula() {
  const r = rng(91); const k = new Kit(91);
  stalkBundle(k, r, ['#a3b864', '#87a04a', '#b9c97a'], 7, 0.24, 1.9, (x, y, z) => {
    for (let j = 0; j < 4; j++) k.add(G.sph(0.09, 5, 4), j % 2 ? '#f5d53a' : '#e8b92a', { x: x + r.range(-0.14, 0.14), y: y + r.range(0, 0.12), z: z + r.range(-0.14, 0.14) });
  });
  for (const y of [0.5, 1.15]) k.add(G.torus(0.27, 0.05, 5, 12), '#8a3a26', { y, rx: Math.PI / 2 });
  return k.build();
}

export function buildPistol() {
  const k = new Kit(5);
  const steel = '#5a5f6c', wood = '#8f552a', brass = '#e2b346';
  k.add(G.cyl(0.08, 0.09, 1.25, 10), steel, { x: 0.35, y: 0.32, rz: Math.PI / 2 });
  k.add(G.cyl(0.11, 0.11, 0.08, 10), brass, { x: 0.96, y: 0.32, rz: Math.PI / 2 });
  k.add(G.box(1.0, 0.14, 0.18), wood, { x: 0.25, y: 0.2 });
  k.add(G.box(0.35, 0.24, 0.2), steel, { x: -0.3, y: 0.32 });
  k.add(G.box(0.08, 0.2, 0.08), steel, { x: -0.38, y: 0.5, rz: -0.5 });
  k.add(G.box(0.56, 0.24, 0.22), wood, { x: -0.6, y: 0.06, rz: 0.75 });
  k.add(G.box(0.26, 0.28, 0.25), brass, { x: -0.84, y: -0.18, rz: 0.75 });
  for (const x of [0.1, 0.6]) k.add(G.cyl(0.1, 0.1, 0.06, 8), brass, { x, y: 0.28, rz: Math.PI / 2 });
  k.add(G.torus(0.12, 0.025, 4, 10), brass, { x: -0.15, y: 0.02 });
  return k.build();
}

// angolo di casa che sporge nella corsia (len = lunghezza in unita' 3D)
export function buildNarrow(seed, len, width) {
  const r = rng(seed);
  const k = new Kit(seed);
  const h = r.pick([6.2, 7.0]);
  const plaster = r.pick(PAL.plaster), stone = r.pick(PAL.stone), shutter = r.pick(PAL.shutter);
  // facciata verso la strada sul piano x = 0, corpo verso -x
  k.add(G.box(width, h, len), plaster, { x: -width / 2, y: h / 2, z: -len / 2 });
  k.add(G.box(0.3, 0.95, len), stone, { x: 0.02, y: 0.47, z: -len / 2, vary: 0.2 });
  k.add(G.box(width + 0.3, 0.95, 0.3), stone, { x: -width / 2, y: 0.47, z: 0.02, vary: 0.2 });
  for (let y = 1.2, i = 0; y < h - 0.4; y += 0.62, i++) {
    const zz = i % 2 ? 0.45 : 0.3;
    k.add(G.box(0.1, 0.5, zz * 2), stone, { x: 0.05, y, z: -zz, vary: 0.2 });
    k.add(G.box(zz * 2, 0.5, 0.1), stone, { x: -zz, y, z: 0.05, vary: 0.2 });
  }
  k.add(G.cone(0.5, 1, 4), r.pick(PAL.roof), { x: -width / 2, y: h + 0.8, z: -len / 2, ry: Math.PI / 4, sx: (width + 1) / 0.7071, sy: 1.6, sz: (len + 1) / 0.7071, flat: true, vary: 0.1 });
  k.add(G.box(0.6, 0.25, len + 0.4), '#e9dcc2', { x: 0.1, y: h, z: -len / 2 });
  const n = Math.max(1, Math.floor(len / 2.8));
  for (let i = 0; i < n; i++) for (let f = 0; f < 2; f++) windowAt(k, 2.2 + f * 2.7, -len * (i + 0.5) / n, r, { shutter, flowers: f === 1 && r.chance(0.5) });
  // fronte verso la camera: finestra
  return k.build({ ao: 0.32 });
}

// colline e villaggio lontano (senza nebbia: colori gia' "atmosferici")
export function buildFar() {
  const r = rng(2026);
  const k = new Kit(2026);
  // colline
  const hills = [
    [-90, -60, 70, 26, '#6a5f9a'], [40, -70, 80, 30, '#5f5a92'], [140, -40, 70, 22, '#6b62a0'], [-170, -30, 80, 20, '#6a64a2'],
    [-40, -10, 60, 16, '#7f7aa8'], [70, -5, 55, 14, '#8a7fae'],
  ];
  for (const [x, z, s, hh, c] of hills) k.add(G.ico(1, 1), c, { x, y: -4, z, sx: s, sy: hh, sz: s * 0.6, flat: true, vary: 0.08 });
  // collina del paese con case
  k.add(G.ico(1, 1), '#8f8a7a', { x: 6, y: -6, z: 4, sx: 46, sy: 16, sz: 30, flat: true, vary: 0.06 });
  for (let i = 0; i < 46; i++) {
    const a = r.range(-1.3, 1.3), d = r.range(0.2, 0.95);
    const x = 6 + Math.sin(a) * 40 * d, z = 4 + Math.cos(a) * 14 * d;
    const y = 10 * (1 - d * d * 0.9) - 2;
    const w = r.range(2.2, 4), hh = r.range(2, 3.6);
    k.add(G.box(w, hh, w * 0.8), r.pick(['#e8c9a2', '#e2b28a', '#f0d8b8', '#d9b89a', '#cfa889']), { x, y: y + hh / 2, z });
    k.add(G.cone(w * 0.78, 1.2, 4), r.pick(['#b95a3c', '#c76b45', '#a9503a']), { x, y: y + hh + 0.6, z, ry: Math.PI / 4, sz: 0.8 });
  }
  // campanile e chiesa
  k.add(G.box(9, 6, 7), '#e6cba6', { x: -3, y: 9, z: 18 });
  k.add(G.cone(6.6, 3, 4), '#b5583a', { x: -3, y: 13.5, z: 18, ry: Math.PI / 4, sz: 0.8 });
  k.add(G.box(3.2, 16, 3.2), '#dcc09c', { x: 3.5, y: 12, z: 18 });
  k.add(G.box(3.6, 0.5, 3.6), '#c9ab86', { x: 3.5, y: 15, z: 18 });
  k.add(G.box(1.2, 2, 0.4), '#5a4030', { x: 3.5, y: 17.4, z: 19.5 });
  k.add(G.cone(2.4, 4, 4), '#b5583a', { x: 3.5, y: 22, z: 18, ry: Math.PI / 4 });
  // cipressi e alberi
  for (let i = 0; i < 16; i++) k.add(G.cone(1.1, r.range(5, 8), 6), r.pick(['#3f6b45', '#4d7a4a', '#365e40']), { x: r.range(-60, 60), y: r.range(2, 8), z: r.range(-6, 20), flat: true });
  return k.build();
}
