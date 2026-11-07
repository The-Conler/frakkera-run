// Utilita' condivise dai costruttori degli ambienti: rumore, rocce
// sfaccettate, alberi mediterranei (leccio, ontano, cipresso), cespugli,
// felci, muretti a secco. Tutto finisce in geometrie unite (Kit) a colori
// per vertice: pochi draw call, nessuna texture.
import * as THREE from 'three';
import { Kit, G, rng } from '../../kit.js';

export { Kit, G, rng };

// rumore a valori 3D (deterministico, continuo)
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  let v = 0;
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const w = (i ? xf : 1 - xf) * (j ? yf : 1 - yf) * (k ? zf : 1 - zf);
    v += w * hash(xi + i, yi + j, zi + k);
  }
  return v * 2 - 1;
}
export function fbm(x, y, z, oct = 3) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return s; }

const _col = new THREE.Color();
// roccia sfaccettata: icosaedro deformato dal rumore, colori a macchie
export function rockGeom(r, size, { detail = 1, squash = 0.8, rough = 0.35, seed = 0 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);   // v5s9: e' gia' non indicizzata (niente warning)
  const p = g.attributes.position; const o = seed || r() * 100;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + fbm(x * 1.3 + o, y * 1.3, z * 1.3, 2) * rough * 2;
    p.setXYZ(i, x * k * size, y * k * size * squash, z * k * size);
  }
  g.computeVertexNormals();
  return g;
}
export function addRock(k, r, x, y, z, size, cols, o = {}) {
  k.add(rockGeom(r, size, o), r.pick(cols), { x, y, z, ry: r() * 6, rx: o.tilt ? r.range(-0.3, 0.3) : 0, vary: o.vary ?? 0.22, sx: o.sx ?? 1, sy: o.sy ?? 1, sz: o.sz ?? 1 });
}

export const LEAF = {
  holm: ['#3f5f2c', '#4a6b32', '#36552a', '#557a38'],          // leccio (verde scuro)
  fresh: ['#5f9a3a', '#4f8a30', '#6fae46', '#3f7a2c', '#7fb84e'], // ontani, felci, muschio vivo
  dry: ['#8a8a4a', '#9a8f5a', '#7a7a44', '#a09060'],            // macchia secca
  pine: ['#2f4f32', '#34583a', '#2a4630'],
};
export const ROCK = {
  granite: ['#a39a8a', '#b2a893', '#8f877a', '#c2b8a3', '#9a8c74'],
  ochre: ['#b09068', '#a88458', '#9a8c74', '#c0a27a', '#8a7a62'],
  limestone: ['#d8d3c6', '#cfc8b6', '#e4dfd2', '#bfb8a6'],
  travertine: ['#8a6a4a', '#9a7a56', '#7a5a3e', '#a88a62', '#6a5038'],
  mine: ['#6f6c66', '#5e5c57', '#7d786e', '#56534e', '#857d70'],
};

// leccio / albero a chioma tondeggiante
export function tree(k, r, x, y, z, s = 1, leaf = LEAF.holm, trunk = '#5a4430') {
  const h = s * r.range(2.4, 3.4);
  k.add(G.cyl(0.14 * s, 0.24 * s, h, 6), trunk, { x, y: y + h / 2, z, rz: r.range(-0.15, 0.15), flat: true });
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) k.add(G.ico(s * r.range(0.9, 1.5), 1), r.pick(leaf), { x: x + r.range(-1, 1) * s, y: y + h + r.range(-0.3, 1.3) * s, z: z + r.range(-1, 1) * s, flat: true, vary: 0.25, sy: 0.85 });
}
export function cypress(k, r, x, y, z, s = 1) {
  k.add(G.cyl(0.12 * s, 0.16 * s, 1.2 * s, 5), '#4a3a28', { x, y: y + 0.6 * s, z });
  k.add(G.cone(0.9 * s, r.range(6, 8) * s, 7), r.pick(LEAF.pine), { x, y: y + 4.2 * s, z, flat: true, vary: 0.15 });
}
export function shrub(k, r, x, y, z, s = 1, leaf = LEAF.holm, flowers = 0) {
  for (let i = 0; i < 4; i++) k.add(G.ico(s * r.range(0.45, 0.75), 0), r.pick(leaf), { x: x + r.range(-0.6, 0.6) * s, y: y + r.range(0.2, 0.7) * s, z: z + r.range(-0.6, 0.6) * s, flat: true, vary: 0.25 });
  if (flowers && r.chance(flowers)) for (let i = 0; i < 5; i++) k.add(G.ico(0.09), r.pick(['#ffe36a', '#ffffff', '#e8457f', '#c84bd6']), { x: x + r.range(-0.6, 0.6) * s, y: y + r.range(0.6, 1.1) * s, z: z + r.range(-0.6, 0.6) * s, flat: true });
}
export function fern(k, r, x, y, z, s = 1) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    k.add(G.cone(0.16 * s, 1.3 * s, 3), r.pick(LEAF.fresh), { x: x + Math.cos(a) * 0.45 * s, y: y + 0.45 * s, z: z + Math.sin(a) * 0.45 * s, rx: Math.sin(a) * 1.0, rz: -Math.cos(a) * 1.0, sz: 0.35, flat: true, vary: 0.2 });
  }
}
export function grassTuft(k, r, x, y, z, s = 1, cols = ['#7f9a44', '#8aa34e', '#a8a060']) {
  for (let i = 0; i < 4; i++) k.add(G.cone(0.07 * s, r.range(0.4, 0.8) * s, 3), r.pick(cols), { x: x + r.range(-0.2, 0.2) * s, y: y + 0.25 * s, z: z + r.range(-0.2, 0.2) * s, rx: r.range(-0.4, 0.4), rz: r.range(-0.4, 0.4), flat: true });
}
// muretto a secco lungo il sentiero (asse z, da z0 a z0-len), alto h
export function dryWall(k, r, x, z0, len, h = 0.9, cols = ROCK.granite, depth = 0.8) {
  for (let y = 0.2, row = 0; y < h; y += 0.34, row++) {
    for (let z = z0 - (row % 2) * 0.3; z > z0 - len; z -= r.range(0.55, 0.85)) {
      k.add(G.box(depth * r.range(0.85, 1.05), r.range(0.26, 0.34), r.range(0.5, 0.8)), r.pick(cols), { x: x + r.range(-0.05, 0.05), y, z, ry: r.range(-0.12, 0.12), rz: r.range(-0.08, 0.08), vary: 0.18 });
    }
  }
  for (let z = z0 - 0.2; z > z0 - len; z -= 0.7) k.add(G.box(depth + 0.1, 0.18, 0.66), r.pick(cols), { x, y: h + 0.05, z, vary: 0.15 });
}
// staccionata di legno (sentiero del fiume)
export function fence(k, r, x, z0, len, col = '#7a5a3a') {
  for (let z = z0; z > z0 - len; z -= 2.2) k.add(G.cyl(0.07, 0.09, 1.3, 5), col, { x, y: 0.65, z, rz: r.range(-0.05, 0.05), vary: 0.15 });
  for (const y of [0.55, 1.1]) k.add(G.cyl(0.05, 0.05, len, 5), col, { x, y, z: z0 - len / 2, rx: Math.PI / 2, vary: 0.1 });
}
// superficie a griglia deformata (pareti e versanti): f(u,v) -> [x,y,z], col(x,y,z) -> colore
export function gridSurface(nu, nv, f, col, { flat = true } = {}) {
  const pos = [], cols = [];
  const P = []; for (let j = 0; j <= nv; j++) { const row = []; for (let i = 0; i <= nu; i++) row.push(f(i / nu, j / nv)); P.push(row); }
  const push = (p) => { pos.push(p[0], p[1], p[2]); _col.set(col(p[0], p[1], p[2])); cols.push(_col.r, _col.g, _col.b); };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
    if (!a || !b || !c || !d) continue;
    push(a); push(b); push(c); push(a); push(c); push(d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  if (flat) g.computeVertexNormals();
  return g;
}
// unisce una geometria gia' colorata dentro una Kit (gruppo illuminato)
export function addColored(k, g, unlit = false) { (unlit ? k.unlit : k.lit).push(g.index ? g.toNonIndexed() : g); return k; }
export const mix = (a, b, t) => _col.set(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))).getHex();
