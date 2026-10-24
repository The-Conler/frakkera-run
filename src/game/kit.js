// Costruzione di modelli low-poly "cartoon" come UNA geometria unita con
// colori per vertice (pochi draw call). Gruppo 0 = illuminato (Lambert),
// gruppo 1 = sempre acceso (finestre illuminate, vetri delle lanterne).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a0, b0) => a0 + f() * (b0 - a0);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.int = (n) => (f.lastInt = Math.floor(f() * n));
  return f;
}

export class Kit {
  static lodMin = 0;
  constructor(seed = 1) { this.lit = []; this.unlit = []; this.r = rng(seed); }
  // o: {x,y,z,rx,ry,rz,sx,sy,sz,vary,flat,unlit,ao}
  add(geom, color, o = {}) {
    // versione lontana (LOD) dei pezzi ai lati: si saltano i dettagli piu' piccoli di Kit.lodMin (m di raggio)
    if (Kit.lodMin > 0) {
      if (!geom.boundingSphere) geom.computeBoundingSphere();
      if (geom.boundingSphere.radius * Math.max(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1) < Kit.lodMin) { geom.dispose?.(); return this; }
    }
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (o.flat) g.computeVertexNormals();
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    const vary = o.vary || 0;
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (this.r() - 0.5) * vary;
      for (let j = 0; j < 3 && i + j < n; j++) {
        col[(i + j) * 3] = _c.r * k; col[(i + j) * 3 + 1] = _c.g * k; col[(i + j) * 3 + 2] = _c.b * k;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (o.unlit ? this.unlit : this.lit).push(g);
    geom.dispose?.();
    return this;
  }
  // occlusione finta: scurisce i vertici vicini al suolo
  build({ ao = 0 } = {}) {
    const groups = [];
    const lit = this.lit.length ? mergeGeometries(this.lit) : null;
    if (lit && ao > 0) {
      const p = lit.attributes.position, c = lit.attributes.color;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 1 - ao * Math.max(0, 1 - y / 1.6);
        c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
      }
    }
    if (lit) groups.push(lit);
    const un = this.unlit.length ? mergeGeometries(this.unlit) : null;
    let out;
    if (lit && un) out = mergeGeometries([lit, un], true);
    else {
      out = lit || un;
      out.clearGroups();
      out.addGroup(0, out.attributes.position.count, lit ? 0 : 1);
    }
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  }
}

export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dode: (r) => new THREE.DodecahedronGeometry(r, 0),
  sph: (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h),
  torus: (r, t, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts),
};
