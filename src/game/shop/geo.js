// v5s7c: geometrie "fatte a mano" per il Garag di Pinu: niente primitive nude.
// Ogni pezzo nasce suddiviso, smussato e poi deformato con un rumore deterministico
// legato alla posizione (cosi' i vertici condivisi restano attaccati).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) { let s = seed >>> 0 || 1; const f = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); f.range = (a, b) => a + (b - a) * f(); f.pick = (a) => a[Math.floor(f() * a.length) % a.length]; return f; }
function hash3(x, y, z, s) { let h = Math.imul(Math.round(x * 997) ^ Math.imul(Math.round(y * 991), 73856093) ^ Math.imul(Math.round(z * 983), 19349663) ^ s, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
// rumore liscio a valori (trilineare)
export function vnoise(x, y, z, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (a, b, c) => hash3(xi + a, yi + b, zi + c, s);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w) * 2 - 1;
}
const _c = new THREE.Color(), _c2 = new THREE.Color();
export const col = (h) => new THREE.Color(h);

// deforma: f(v: Vector3, i) modifica v in place
export function warp(g, f) { const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v, i); p.setXYZ(i, v.x, v.y, v.z); } return g; }
export function rough(g, amt, freq = 3, seed = 1) {
  return warp(g, (v) => { const n = vnoise(v.x * freq + 11, v.y * freq + 7, v.z * freq + 3, seed); const m = vnoise(v.x * freq + 41, v.y * freq + 13, v.z * freq + 29, seed + 5); const o = vnoise(v.x * freq + 71, v.y * freq + 53, v.z * freq + 17, seed + 9); v.x += n * amt; v.y += m * amt; v.z += o * amt; });
}
// colora i vertici: fc(pos, out:Color)
export function paint(g, fc) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fc(v, _c, i); c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
export function solid(g, hex, vary = 0, seed = 1, freq = 2) { const b = col(hex); return paint(g, (v, o) => { const k = 1 + vnoise(v.x * freq, v.y * freq, v.z * freq, seed) * vary; o.setRGB(b.r * k, b.g * k, b.b * k); }); }
export function place(g, o = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ')), new THREE.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
  g.applyMatrix4(m); return g;
}
// bucket: unisce tante geometrie per un solo materiale
export class Bucket {
  constructor() { this.list = []; }
  add(g) { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); this.list.push(g); return g; }
  build() { const g = mergeGeometries(this.list); g.computeBoundingSphere(); return g; }
}
// asse di legno: smussata, leggermente imbarcata, venatura nei colori, testa piu' scura
export function plank(w, h, l, hex, r, o = {}) {
  const g = new RoundedBoxGeometry(w, h, l, 2, Math.min(w, h) * 0.22);
  const seg = Math.max(2, Math.round(l / 0.25));
  let g2 = subdivAlong(g, seg);
  const bend = (o.bend ?? 0.04) * r.range(-1, 1), twist = (o.twist ?? 0.05) * r.range(-1, 1), taper = o.taper ?? r.range(0, 0.12);
  warp(g2, (v) => { const t = v.z / l; v.y += bend * (1 - 4 * t * t) * l * 0.15; const a = twist * t; const x = v.x, y = v.y; v.x = x * Math.cos(a) - y * Math.sin(a); v.y = x * Math.sin(a) + y * Math.cos(a); v.x *= 1 - taper * (t + 0.5); });
  rough(g2, (o.rough ?? 0.012) * Math.max(0.5, w * 3), 6, Math.floor(r() * 1e6));
  const b = col(hex), seed = Math.floor(r() * 1e6), dk = o.endDark ?? 0.25;
  paint(g2, (v, out) => { const t = Math.abs(v.z / l) * 2; const grain = Math.sin(v.z * 9 + vnoise(v.x * 8, v.y * 8, v.z * 1.5, seed) * 6) * 0.06 + vnoise(v.x * 3, v.y * 3, v.z * 3, seed + 1) * 0.08; const k = (1 + grain) * (1 - dk * Math.max(0, t - 0.86) * 6); out.setRGB(b.r * k, b.g * k, b.b * k); });
  return g2;
}
// trave/palo grezzo: come un'asse ma con spigoli piu' mangiati e nodi
export function beam(w, h, l, hex, r, o = {}) { return plank(w, h, l, hex, r, { rough: 0.02, bend: 0.02, twist: 0.03, taper: 0.03, endDark: 0.3, ...o }); }
// spezza i lati lunghi (lungo z) per poter piegare il pezzo
function subdivAlong(g, n) {
  g = g.index ? g.toNonIndexed() : g;
  // ri-campiona: tre.js RoundedBox ha gia' vertici solo vicino agli spigoli; aggiungiamo tagli lungo z
  const p = g.attributes.position; const out = [];
  const tri = (a, b, c) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  g.computeBoundingBox(); const z0 = g.boundingBox.min.z, z1 = g.boundingBox.max.z;
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    const span = Math.max(A.z, B.z, C.z) - Math.min(A.z, B.z, C.z);
    const k = Math.max(1, Math.round(span / ((z1 - z0) / n)));
    splitTri(A.clone(), B.clone(), C.clone(), k, tri);
  }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); ng.computeVertexNormals(); return ng;
}
function splitTri(a, b, c, k, emit) {
  if (k <= 1) { emit(a, b, c); return; }
  // suddivisione baricentrica uniforme k x k
  const P = (i, j) => new THREE.Vector3().addScaledVector(a, (k - i - j) / k).addScaledVector(b, i / k).addScaledVector(c, j / k);
  for (let i = 0; i < k; i++) for (let j = 0; j < k - i; j++) { emit(P(i, j), P(i + 1, j), P(i, j + 1)); if (i + j < k - 1) emit(P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)); }
}
// pietra: blocco smussato e molto irregolare
export function stone(w, h, d, hex, r, amt = 0.08) {
  let g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.28);
  g = mergeVertices(g.toNonIndexed().deleteAttribute('uv').deleteAttribute('normal'), 1e-4);
  rough(g, amt * Math.min(w, h, d) * 2.2, 1.6, Math.floor(r() * 1e6));
  g = g.toNonIndexed(); g.computeVertexNormals();
  const b = col(hex), s = Math.floor(r() * 1e6);
  return paint(g, (v, o) => { const k = 1 + vnoise(v.x * 5, v.y * 5, v.z * 5, s) * 0.09 + vnoise(v.x * 17, v.y * 17, v.z * 17, s + 3) * 0.04; o.setRGB(b.r * k, b.g * k, b.b * k * 0.98); });
}
// tornito: profilo [[r,y],...] -> lathe con un po' di irregolarita'
export function turned(profile, seg, r, amt = 0) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  if (amt) rough(g, amt, 4, Math.floor(r() * 1e6));
  g.computeVertexNormals(); return g;
}
// tubo lungo una curva di punti
export function tube(pts, rad, seg = 16, rs = 6, closed = false) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed), seg, rad, rs, closed); }
// poligono estruso smussato (lastre, taglieri, risvolti)
export function slab(pts, depth, bevel, segs = 1) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: segs, curveSegments: 6 });
}
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
