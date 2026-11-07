// v5s37: cascate di Sa Stiddiosa (target): acqua curva a strati che segue le cenge della parete, shader animato a piu' strati
// (velo dietro + filamenti veloci davanti + roccia bagnata), una cascata principale, cascate medie e rivoli sottili;
// al piede: pozza con increspature, schiuma e foschia. Leggero per il telefono: 2 draw call in tutto (acqua + effetti).
import * as THREE from 'three';
import { rng } from '../kit.js';

export const WATER_U = { uT: { value: 0 } };

// ------------------------------------------------------------------ shader comuni
const NOISE = `
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0)), f.x), f.y); }`;
const VERT = `
attribute vec2 aUV; attribute vec4 aInfo; varying vec2 vUV; varying vec4 vInfo;
#include <fog_pars_vertex>
void main() { vUV = aUV; vInfo = aInfo; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const TAIL = `
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
// acqua: aInfo = (strato 0 velo / 1 filamenti / 2 roccia bagnata, schiuma, dissolvenza, larghezza m); aUV = (traverso 0..1, metri dall'alto)
const WATER_FRAG = `
uniform float uT; varying vec2 vUV; varying vec4 vInfo;
#include <fog_pars_fragment>
${NOISE}
void main() {
  float L = vInfo.x, u = vUV.x, v = vUV.y, W = max(vInfo.w, 0.3);
  float edge = 1.0 - pow(abs(u * 2.0 - 1.0), 2.2);
  vec3 col; float a;
  if (L > 1.5) {          // roccia bagnata: velo scuro con qualche luccichio che scende
    float g = vn(vec2(u * W * 1.5, v * 0.7 - uT * 0.5));
    col = vec3(0.04, 0.06, 0.06); a = 0.5 * smoothstep(0.0, 0.9, edge) * (0.55 + 0.45 * g) * smoothstep(0.0, 2.5, v);   // sfumata in alto: niente rettangoli scuri
    float gl = smoothstep(0.86, 0.97, vn(vec2(u * W * 5.0, v * 1.6 - uT * 2.2)));
    col += vec3(0.55, 0.65, 0.66) * gl * 0.7; a = max(a, gl * 0.35 * edge);
  } else {
    float sp = L < 0.5 ? 2.6 : 5.2;     // il velo dietro scende piu' lento dei filamenti davanti
    float s1 = vn(vec2(u * W * 2.4 + 3.1 * L, v * 0.45 - uT * sp * 0.45));
    float s2 = vn(vec2(u * W * 6.5 + 7.0 * L, v * 1.5 - uT * sp * 1.5));
    float n = s1 * 0.62 + s2 * 0.38;
    float eb = smoothstep(0.0, 0.32, edge - (1.0 - n) * 0.28);     // bordi sfrangiati, non una striscia
    if (L < 0.5) { a = 0.34 + 0.4 * n; col = mix(vec3(0.42, 0.6, 0.64), vec3(0.86, 0.95, 0.97), n); }
    else { a = smoothstep(0.36, 0.72, n) * 0.85 + 0.1; col = mix(vec3(0.6, 0.76, 0.8), vec3(0.98, 1.0, 1.0), smoothstep(0.42, 0.82, n)); }
    float f = vInfo.y, fb = vn(vec2(u * W * 9.0, v * 3.2 - uT * 6.0));
    col = mix(col, vec3(1.0), f * 0.85); a = mix(a, 0.25 + 0.7 * fb, f * 0.75);
    a *= eb;
  }
  a *= vInfo.z;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
${TAIL}`;
// effetti: aInfo = (tipo 0 foschia / 1 schiuma+cerchi / 2 pozza, seme, alfa, -)
const FX_FRAG = `
uniform float uT; varying vec2 vUV; varying vec4 vInfo;
#include <fog_pars_fragment>
${NOISE}
void main() {
  float K = vInfo.x, sd = vInfo.y; vec2 q = vUV * 2.0 - 1.0; float r = length(q);
  vec3 col; float a;
  if (K < 0.5) {          // foschia: sbuffi morbidi che salgono
    float n = vn(vUV * 3.0 + vec2(sd, -uT * 0.35)) * 0.6 + vn(vUV * 7.0 + vec2(-uT * 0.2, sd - uT * 0.6)) * 0.4;
    a = pow(max(0.0, 1.0 - r * r), 1.6) * smoothstep(0.25, 0.75, n); col = vec3(0.9, 0.96, 0.97);
  } else if (K < 1.5) {   // schiuma e cerchi che si allargano
    float ring = 0.5 + 0.5 * sin((r * 7.0 - uT * 1.8 + sd) * 6.2832);
    float fo = vn(q * 5.0 + vec2(uT * 0.4, sd)) * 0.6 + vn(q * 13.0 - vec2(sd, uT * 0.9)) * 0.4;
    a = smoothstep(0.85, 0.15, r) * smoothstep(0.42, 0.72, fo) + smoothstep(0.75, 1.0, ring) * 0.35 * smoothstep(1.0, 0.35, r);
    col = mix(vec3(0.75, 0.9, 0.92), vec3(1.0), fo);
  } else {                // pozza: acqua scura verde-azzurra con riflessi
    float rip = vn(q * 6.0 + vec2(uT * 0.3, -uT * 0.25 + sd));
    a = 0.8 * smoothstep(1.0, 0.72, r); col = mix(vec3(0.03, 0.12, 0.12), vec3(0.22, 0.36, 0.36), smoothstep(0.6, 0.9, rip));
  }
  a *= vInfo.z; if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
${TAIL}`;
let waterMat = null, fxMat = null;
const mk = (frag) => new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), vertexShader: VERT, fragmentShader: frag,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
export function waterMaterial() { if (!waterMat) { waterMat = mk(WATER_FRAG); waterMat.uniforms.uT = WATER_U.uT; } return waterMat; }
export function fxMaterial() { if (!fxMat) { fxMat = mk(FX_FRAG); fxMat.uniforms.uT = WATER_U.uT; } return fxMat; }

// ------------------------------------------------------------------ cascate
// faceX(y, z, half): x della faccia di roccia piu' vicina alla via (raggi orizzontali dalla via, finestra +-half lungo z)
export function makeFaceX(meshes, backX) {
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(1, 0, 0);
  for (const m of meshes) m.updateMatrixWorld(true);
  return (y, z, half) => {
    let x = backX(-z, y);
    if (meshes.length) for (const dz of [-1, -0.5, 0, 0.5, 1]) { o.set(-2, y, z + dz * half); rc.set(o, d); rc.far = 30;
      const h = rc.intersectObjects(meshes, false)[0]; if (h && h.point.x < x) x = h.point.x; }
    return x;
  };
}
// tipi: main (dalla cima), mid (da una cengia a meta'), trickle (rivolo sottile)
const FALL_MIN_X = 7.9;   // v5s42: bordo esterno del marciapiede (6.95 m) + ~1 m
const KIND = { main: { w: 4, layers: [2, 0, 1], segs: 4, half: 3.8 }, mid: { w: 2.5, layers: [2, 0, 1], segs: 3, half: 2.6 }, trickle: { w: 0.5, layers: [2, 1], segs: 2, half: 0.5 } };
export function stiddiosaFallSpecs(fallsLz, seed = 41) {
  const r = rng(seed), S = [];
  fallsLz.forEach((lz, i) => {
    const main = i % 3 === 2 || i === 2;   // 96 m e 204 m: cascate principali dalla cima
    S.push({ lz, kind: main ? 'main' : 'mid', y0: main ? 99 : r.range(18, 30), w: main ? r.range(3.6, 4.4) : r.range(2.2, 2.9) });
    // fili accanto che partono da cenge diverse: la cascata si legge a ciocche, non come un nastro unico
    S.push({ lz: lz + (r() < 0.5 ? -1 : 1) * r.range(2.2, 2.9), kind: 'mid', y0: main ? r.range(22, 32) : r.range(10, 18), w: main ? r.range(1.5, 2.0) : r.range(1.0, 1.4) });
  });
  for (let n = 0, guard = 0; n < 16 && guard < 300; guard++) {
    const lz = r.range(4, 244); if (fallsLz.some((f) => Math.abs(f - lz) < 6) || S.some((s) => Math.abs(s.lz - lz) < 4)) continue;
    S.push({ lz, kind: 'trickle', y0: r.range(9, 26), w: r.range(0.6, 1.1) }); n++;
  }
  return S;
}
export function buildFalls(faceX, specs, seed = 7) {
  const r = rng(seed), WP = [], WU = [], WI = [], FP = [], FU = [], FI = [], bases = [];
  const quadW = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) { WP.push(p[0], p[1], p[2]); WU.push(p[3], p[4]); WI.push(p[5], p[6], p[7], p[8]); } };
  const quadF = (P, info) => { const uv = [[0, 0], [1, 0], [1, 1], [0, 1]]; for (const i of [0, 1, 2, 0, 2, 3]) { FP.push(...P[i]); FU.push(...uv[i]); FI.push(...info); } };
  for (const s of specs) {
    const K = KIND[s.kind], z = -s.lz, half = Math.max(K.half, s.w * 0.6);
    // lip: la cengia piu' alta sotto y0 (dove c'e' roccia davanti)
    let y0 = Math.min(s.y0, 46); const far = 40;
    while (y0 > 4 && faceX(y0, z, half) > far) y0 -= 0.5;
    if (y0 <= 4) continue;
    // v5s37: cerca uno sbalzo sopra (faccia piu' avanti in alto) e parti 0.2 m sotto — niente bordo piatto a mezz'aria
    let lipY = y0, lipX = faceX(y0, z, half);
    for (let y = y0; y < Math.min(y0 + 10, 48); y += 0.4) {
      const xu = faceX(y + 0.4, z, half), xd = faceX(y, z, half);
      if (xu < far && xd < far && xu < xd - 0.25) { lipY = y - 0.15; lipX = xu; }   // sbalzo: la roccia sopra sporge di piu' (x minore)
    }
    // usa lo sbalzo trovato: parti 0.45 m DENTRO il volume dello sbalzo (il bordo alto resta sepolto nella roccia)
    y0 = Math.max(5, Math.min(46, lipY + 0.45));
    // percorso: cade quasi a piombo, torna verso la parete al massimo 0.45 m per m, e scivola sulle cenge che sporgono
    // in cima: acqua TUCKATA DENTRO la roccia (x maggiore) cosi' il bordo alto resta nascosto dallo sbalzo
    const step = s.kind === 'trickle' ? 1.3 : 1.0, rows = [], CREST = 3.8;
    let x = Math.max(faceX(y0, z, half), lipX) + 1.15, free = 0, foam = 0;   // +1.15 = ben dentro la cengia
    for (let y = y0, i = 0; y > 0.05; y -= step, i++) {
      const f = faceX(y, z, half) - 0.25;
      const crest = Math.max(0, 1 - (y0 - y) / CREST);   // 1 in cima -> 0 dopo CREST m
      const tuck = crest * 1.35;                          // ancora dentro la roccia vicino alla cresta
      const out = (i >= 4 && crest < 0.12) ? -0.14 * Math.min(3, i - 3) : 0;   // sporge solo dopo essere uscita dallo sbalzo
      // v5s42: l'acqua resta attaccata alla parete (al massimo 0.5 m davanti alla roccia): prima lo scarto 'out' si sommava
      // fila dopo fila e i fili d'acqua si staccavano, sospesi verso la via
      let nx = Math.max(Math.min(x + 0.45 * step, f + tuck) + out, f - 0.5);
      if (crest > 0.4) nx = Math.max(nx, faceX(y, z, half) + 0.55);   // primi metri: mai davanti alla faccia
      const contact = f + tuck <= x + 0.45 * step + 1e-3;
      if (contact && free > 1.4) foam = 1; free = contact ? 0 : free + step;
      if (nx < FALL_MIN_X) nx = FALL_MIN_X;   // v5s42: mai sopra la via/marciapiede (prima 5.7 m sotto i 3 m: la cascata copriva la corsia)
      rows.push({ x: nx, y, foam, contact, crest }); foam *= 0.55; x = nx;
    }
    rows.push({ x: Math.max(x, FALL_MIN_X), y: 0.02, foam: 1, contact: true, crest: 0 });
    for (let k = 0; k < 2; k++) for (let i = 1; i < rows.length - 1; i++) {
      if (rows[i].crest > 0.4) continue;   // non smussare la cresta tuckata
      rows[i].x = Math.min(rows[i].x, (rows[i - 1].x + 2 * rows[i].x + rows[i + 1].x) / 4 + 0.3);
    }
    const len = (y0 - 0.02);
    for (const L of K.layers) {
      const wl = s.w * (L === 2 ? 1.9 : L === 1 ? 0.75 : 1.0), dx = L === 2 ? 0.14 : L === 1 ? -0.1 : 0, zo = L === 1 ? r.range(-0.15, 0.15) * s.w : 0;
      let v = 0;
      for (let i = 0; i < rows.length - 1; i++) {
        const A = rows[i], B = rows[i + 1];
        // roccia bagnata: salta la cresta (niente rettangolo scuro che "parte" a mezz'aria)
        if (L === 2 && (y0 - A.y) < CREST * 0.7) { v += Math.hypot(A.x - B.x, A.y - B.y); continue; }
        const va = v; v += Math.hypot(A.x - B.x, A.y - B.y); const vb = v;
        // dissolvenza lunga e morbida in cima (niente rettangolo bianco): ~3.8 m, curva piu' lenta all'inizio
        const fa = Math.pow(Math.min(1, (y0 - A.y) / CREST), 1.8) * Math.min(1, A.y / 0.4 + 0.3);
        const fb = Math.pow(Math.min(1, (y0 - B.y) / CREST), 1.8) * Math.min(1, B.y / 0.4 + 0.3);
        const spa = 1 + (A.contact ? 0.22 : 0) + 0.12 * (1 - A.y / len), spb = 1 + (B.contact ? 0.22 : 0) + 0.12 * (1 - B.y / len);
        const SG = L === 2 ? Math.min(2, K.segs) : L === 1 ? Math.max(2, K.segs - 1) : K.segs;
        for (let j = 0; j < SG; j++) {
          const u0 = j / SG, u1 = (j + 1) / SG;
          const P = (R, u, sp, va_, fd) => { const c = u * 2 - 1, bul = 0.16 * wl * (1 - c * c);
            const crestN = Math.max(0, 1 - (y0 - R.y) / CREST), slim = 1 - 0.55 * crestN;
            return [R.x + dx - bul * slim, R.y, z + zo + c * wl * sp * slim / 2, u, va_, L, L === 2 ? 0 : R.foam, fd, wl * slim]; };
          quadW(P(A, u0, spa, va, fa), P(A, u1, spa, va, fa), P(B, u1, spb, vb, fb), P(B, u0, spb, vb, fb));
        }
      }
    }
    // ripiano di sorgente sotto lo sbalzo: schiuma + velo che mascherano l'attacco (niente bordo piatto leggibile)
    if (s.kind !== 'trickle') {
      const sx = rows[0].x, sy = y0 - 0.12, sw = s.w * 0.7 + 0.5, sd0 = r.range(0, 50);
      quadF([[sx - 0.2, sy, z - sw], [sx + 0.9, sy, z - sw], [sx + 0.9, sy, z + sw], [sx - 0.2, sy, z + sw]], [1, sd0, 0.85, 0]);
      // velo corto appena sotto il labbro (dissolve nella cascata)
      const hh = 1.1 + 0.5 * (s.kind === 'main' ? 1 : 0.6);
      quadW([sx + 0.2, sy, z - sw * 0.7, 0, 0, 0, 0.6, 0.55, s.w],
            [sx + 0.2, sy, z + sw * 0.7, 1, 0, 0, 0.6, 0.55, s.w],
            [sx - 0.15, sy - hh, z + sw * 0.55, 1, hh, 0, 0.2, 0.9, s.w],
            [sx - 0.15, sy - hh, z - sw * 0.55, 0, hh, 0, 0.2, 0.9, s.w]);
    }
    // al piede
    const bx = rows[rows.length - 1].x, big = s.kind === 'main' ? 1 : s.kind === 'mid' ? 0.6 : 0.25, sd = r.range(0, 50);
    if (s.kind !== 'trickle') {
      const hx = Math.max(0.5, Math.min(2.2 * big, (bx + 1.4 - 5.6) / 2)), hz = s.w * 1.3 + 0.8;   // pozza: non entra nella via (x >= 5.6)
      const cx = bx + 1.4 - hx;
      quadF([[cx - hx, 0.05, z - hz], [cx + hx, 0.05, z - hz], [cx + hx, 0.05, z + hz], [cx - hx, 0.05, z + hz]], [2, sd, 1, 0]);
      const fz = s.w * 0.9 + 0.4, fx = Math.min(hx, 1.2 * big + 0.4);
      const fl = Math.max(5.6, bx - fx * 0.3);
      quadF([[fl, 0.09, z - fz], [bx + fx, 0.09, z - fz], [bx + fx, 0.09, z + fz], [fl, 0.09, z + fz]], [1, sd, 0.95, 0]);
      for (const ry of [-0.55, 0.55]) {   // foschia: due carte incrociate al piede
        const mw = 2.2 + 2.6 * big, mh = 1.6 + 2.6 * big, c = Math.cos(ry), sn = Math.sin(ry), mx = Math.max(bx - 0.6, 5.6 + Math.abs(sn) * mw / 2);
        quadF([[mx - sn * mw / 2, 0, z - c * mw / 2], [mx + sn * mw / 2, 0, z + c * mw / 2], [mx + sn * mw / 2, mh, z + c * mw / 2], [mx - sn * mw / 2, mh, z - c * mw / 2]], [0, sd + ry, 0.55 * (0.5 + big * 0.5), 0]);
      }
      bases.push({ x: bx, z, big });
    }
    // foschia leggera dove l'acqua colpisce una cengia (solo le cascate grandi)
    if (s.kind !== 'trickle') for (const R of rows) if (R.foam > 0.99 && R.y > 3) {
      const mw = 1.4 + 1.2 * big, mh = 1.2 + big;
      quadF([[R.x - 0.4, R.y - mh * 0.45, z - mw / 2], [R.x - 0.4, R.y - mh * 0.45, z + mw / 2], [R.x - 0.4, R.y + mh * 0.55, z + mw / 2], [R.x - 0.4, R.y + mh * 0.55, z - mw / 2]], [0, sd + R.y, 0.4, 0]);
    }
  }
  const geo = (P, U, I) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(I, 4)); g.computeBoundingSphere(); return g; };
  return { water: geo(WP, WU, WI), fx: geo(FP, FU, FI), bases };
}
