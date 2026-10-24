// Pezzi naturali costruiti al volo (per tratto di percorso) e paesaggi:
// pareti di roccia, versanti boscosi, muretti a secco, sponde del fiume,
// parete di travertino col muschio (piscina naturale), valle boscosa,
// guglia di roccia di Gadoni. Il rumore usa la coordinata del mondo W
// (metri lungo il percorso) cosi' due pezzi vicini combaciano.
// Convenzione dei pezzi laterali (come le case): facciata sul piano x = 0,
// esterno verso -x, strada verso +x, z da 0 a -len.
import * as THREE from 'three';
import { Kit, G, rng, fbm, noise3, rockGeom, addRock, tree, cypress, shrub, fern, grassTuft, dryWall, fence, gridSurface, addColored, LEAF, ROCK } from './common.js';

const _c = new THREE.Color(), _c2 = new THREE.Color();
const pickN = (pal, t) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)))];

// ------------------------------------------------------------------ parete di roccia (lato monte)
// o: { H0, Hamp, lean, pal, moss (0..1), seed, top: 'shrub'|'trees', foot }
export function cliffPiece(W0, len, o = {}) {
  const r = rng((Math.floor(W0 * 7) ^ (o.seed || 1)) >>> 0);
  const k = new Kit(Math.floor(W0) + 5);
  const pal = o.pal || ROCK.granite, H0 = o.H0 ?? 14, Hamp = o.Hamp ?? 8, lean = o.lean ?? 0.18, sd = o.seed || 1;
  const Hf = (W) => H0 + Hamp * fbm(W / 45, sd, 0.3, 2) + Hamp * 0.35 * noise3(W / 9, sd, 2);
  const nu = Math.max(2, Math.ceil(len / 1.1)), nv = 12;
  const surf = (u, v) => {
    const W = W0 + u * len, H = Hf(W);
    const y = v * H;
    const rough = 1.4 * (fbm(W / 5.5, y / 4.5, sd * 3, 3) + 0.45) + 0.6 * noise3(W / 1.7, y / 1.9, sd);
    let x = -0.35 - lean * y - Math.max(0, rough) * Math.min(1, y / 1.2);
    if (v === 1) x -= 3.5;                         // cima che rientra (pianoro)
    return [x, v === 1 ? H + 0.6 : y, -u * len];
  };
  const g = gridSurface(nu, nv, surf, (x, y, z) => {
    const W = W0 - z;
    const n1 = fbm(W / 7, y / 3, sd + 11, 2) * 0.5 + 0.5, n2 = noise3(W / 2.2, y / 1.6, sd + 4) * 0.5 + 0.5;
    _c.set(pickN(pal, n1));
    // venature verticali scure e macchie ocra
    if (n2 > 0.78) _c.multiplyScalar(0.72);
    if (o.ochre && n1 > 0.62 && n2 < 0.4) _c.lerp(_c2.set('#b78a52'), 0.45);
    // muschio / erba sulle cenge
    const mossT = (o.moss || 0) * (noise3(W / 4, y / 3, sd + 9) * 0.5 + 0.5);
    if (mossT > 0.42) _c.lerp(_c2.set(o.mossCol || '#5f7f36'), Math.min(1, (mossT - 0.42) * 3));
    // macchie d'acqua scure in basso (travertino)
    return _c.getHex();
  });
  addColored(k, g);
  // cespugli aggrappati e alberi in cima
  const nS = Math.round(len * (o.shrubs ?? 0.5));
  for (let i = 0; i < nS; i++) {
    const zl = -r() * len, W = W0 - zl, H = Hf(W), y = r.range(1.5, H - 1);
    const x = -0.35 - lean * y - 1.1;
    shrub(k, r, x + 0.3, y - 0.4, zl, r.range(0.5, 0.9), o.leaf || LEAF.holm);
  }
  const top = o.top || 'trees';
  for (let z = -r() * 3; z > -len; z -= r.range(2.5, 4.5)) {
    const W = W0 - z, H = Hf(W), x = -0.35 - lean * H - r.range(2.5, 5);
    if (top === 'trees' && r.chance(0.6)) tree(k, r, x, H + 0.3, z, r.range(1.1, 1.6), o.leaf || LEAF.holm);
    else shrub(k, r, x, H + 0.2, z, r.range(0.8, 1.3), o.leaf || LEAF.holm);
  }
  // piede della parete: sassi ed erba sul bordo del sentiero
  if (o.foot !== false) for (let z = -r() * 1.5; z > -len; z -= r.range(0.9, 2.2)) {
    if (r.chance(0.55)) addRock(k, r, r.range(0.1, 1.0), 0.15, z, r.range(0.25, 0.6), pal, { squash: 0.6 });
    else grassTuft(k, r, r.range(0.2, 1.1), 0, z, 1, o.grass);
  }
  return k.build({ ao: 0.28 });
}

// ------------------------------------------------------------------ versante boscoso (sale verso l'esterno)
// o: { Hs, dist, leaf, ground: [colori], trees (densita'), ferns, rocks, fence, wall, conifers }
export function slopePiece(W0, len, o = {}) {
  const r = rng((Math.floor(W0 * 13) ^ (o.seed || 3)) >>> 0);
  const k = new Kit(Math.floor(W0) + 9);
  const sd = o.seed || 3, Hs = o.Hs ?? 10, D = o.dist ?? 32;
  const gcol = o.ground || ['#5f7f36', '#4f6e2e', '#6b8a3c', '#7a8a4a', '#8a7a5a'];
  const hAt = (x, W) => { const t = Math.max(0, -x) / D; return Math.pow(t, 1.3) * Hs + (fbm(W / 12, x / 9, sd, 2) * 0.5 + 0.2) * 2.2 * Math.min(1, t * 4); };
  const nu = Math.max(2, Math.ceil(len / 2)), nv = 9;
  const g = gridSurface(nu, nv, (u, v) => { const W = W0 + u * len; const x = 0.6 - Math.pow(v, 1.25) * D; return [x, hAt(x, W) - (v === 0 ? 0.05 : 0), -u * len]; },
    (x, y, z) => { const W = W0 - z; return pickN(gcol, fbm(W / 6, x / 5, sd + 2, 2) * 0.5 + 0.5); });
  addColored(k, g);
  const dens = o.trees ?? 0.25;
  for (let i = 0; i < Math.round(len * dens); i++) {
    const zl = -r() * len, x = -r.range(3.5, D * 0.95), W = W0 - zl, y = hAt(x, W);
    if (o.conifers && r.chance(0.25)) cypress(k, r, x, y, zl, r.range(0.8, 1.1));
    else tree(k, r, x, y - 0.2, zl, r.range(1.1, 1.8), r.chance(0.5) ? (o.leaf || LEAF.holm) : LEAF.fresh);
  }
  for (let i = 0; i < Math.round(len * (o.ferns ?? 0.3)); i++) { const zl = -r() * len, x = -r.range(0.5, 6), y = hAt(x, W0 - zl); fern(k, r, x, y, zl, r.range(0.7, 1.2)); }
  for (let i = 0; i < Math.round(len * (o.rocks ?? 0.25)); i++) { const zl = -r() * len, x = -r.range(0.4, 9), y = hAt(x, W0 - zl); addRock(k, r, x, y + 0.1, zl, r.range(0.3, 1.1), o.rockPal || ROCK.granite, { squash: 0.7 }); }
  for (let i = 0; i < Math.round(len * 0.4); i++) { const zl = -r() * len, x = -r.range(0, 4), y = hAt(x, W0 - zl); shrub(k, r, x, y, zl, r.range(0.5, 0.9), o.leaf || LEAF.holm, o.flowers || 0); }
  if (o.fence) fence(k, r, 0.9, 0, len);
  if (o.wall) dryWall(k, r, 0.9, 0, len, o.wallH || 0.8, o.wallPal || ROCK.granite, 0.7);
  return k.build({ ao: 0.2 });
}

// ------------------------------------------------------------------ parapetto a secco sul lato valle
export function parapetPiece(W0, len, o = {}) {
  const r = rng((Math.floor(W0 * 17) ^ (o.seed || 5)) >>> 0);
  const k = new Kit(Math.floor(W0) + 3);
  dryWall(k, r, 0.75, 0, len, o.h || 0.95, o.pal || ROCK.granite, 0.75);
  // bordo erboso e qualche arbusto aggrappato oltre il muro
  for (let z = -r() * 2; z > -len; z -= r.range(1.5, 3.5)) {
    if (r.chance(0.5)) shrub(k, r, r.range(-0.8, 0), r.range(-1.5, 0.2), z, r.range(0.6, 1.1), o.leaf || LEAF.holm, 0.2);
    if (r.chance(0.35)) grassTuft(k, r, 1.3, 0, z, 1);
  }
  if (o.drop) { // scarpata che scende verso la valle
    const g = gridSurface(Math.max(2, Math.ceil(len / 2)), 4, (u, v) => { const W = W0 + u * len; return [0.3 - v * 9, -v * v * (o.drop) + fbm(W / 7, v * 3, 2, 2) * 1.2 * v, -u * len]; },
      (x, y, z) => pickN(o.dropCol || ['#6b7a3e', '#7a8a4a', '#8a7a5a', '#5f6e36'], noise3((W0 - z) / 4, x / 3, 1) * 0.5 + 0.5));
    addColored(k, g);
  }
  return k.build({ ao: 0.2 });
}

// ------------------------------------------------------------------ sponda del fiume + parete di travertino (piscina naturale)
// riva di ghiaia chiara, massi bianchi nell'acqua, parete di roccia bruna con
// la "tenda" di muschio verde brillante e gocciolamenti (come nella foto)
export function poolBankPiece(W0, len, o = {}) {
  const r = rng((Math.floor(W0 * 19) ^ 77) >>> 0);
  const k = new Kit(Math.floor(W0) + 21);
  const CL = o.cliffX ?? -9;        // distanza della parete dalla facciata (vicina: entra nell'inquadratura)
  // riva: ghiaia che scende nell'acqua
  const beach = gridSurface(Math.max(2, Math.ceil(len / 2)), 3, (u, v) => [1.3 - v * 3.2, 0.05 - v * 0.75 + (v > 0 ? noise3((W0 + u * len) / 3, v, 4) * 0.12 : 0), -u * len],
    (x, y, z) => pickN(['#d8d2c4', '#cbc4b4', '#e2ddd0', '#bdb6a6'], noise3((W0 - z) / 1.3, x, 2) * 0.5 + 0.5));
  addColored(k, beach);
  for (let z = -r() * 2; z > -len; z -= r.range(1.2, 3)) { if (r.chance(0.6)) addRock(k, r, r.range(-2.5, 0.8), r.range(-0.4, 0.1), z, r.range(0.2, 0.5), ROCK.limestone, { squash: 0.55 }); else grassTuft(k, r, 1.1, 0, z, 0.9, ['#6f9a3a', '#86ad4a']); }
  // massi bianchi grandi nell'acqua
  if (r.chance(0.55)) addRock(k, r, r.range(-6.5, -3.5), -0.6, -r.range(1, len - 1), r.range(1.8, 3.4), ROCK.limestone, { squash: 0.5, rough: 0.3 });
  if (r.chance(0.3)) addRock(k, r, r.range(-5, -3), -0.5, -r.range(1, len - 1), r.range(1.2, 2.2), ROCK.limestone, { squash: 0.55 });
  // parete di travertino: sopra roccia bruna/ocra, sotto muschio verde
  const Hf = (W) => 19 + 6 * fbm(W / 40, 3, 1, 2);
  const nu = Math.max(2, Math.ceil(len / 1.2)), nv = 14;
  const wall = gridSurface(nu, nv, (u, v) => {
    const W = W0 + u * len, H = Hf(W), y = -0.6 + v * (H + 0.6);
    const bulge = 2.2 * Math.max(0, fbm(W / 6, y / 5, 7, 3) + 0.35) + 1.2 * Math.sin(y / H * Math.PI) * (noise3(W / 9, 2, 3) * 0.5 + 0.5);
    let x = CL + bulge * 0.9 - (v > 0.9 ? 4 : 0);
    // la tenda di muschio sporge in basso a "cuscini"
    if (y < H * 0.55) x += 1.4 * Math.max(0, noise3(W / 3.2, y / 2.6, 5));
    return [x, v === 1 ? H + 0.8 : y, -u * len];
  }, (x, y, z) => {
    const W = W0 - z, H = Hf(W), t = y / H;
    const n = noise3(W / 3, y / 2.2, 8) * 0.5 + 0.5, n2 = noise3(W / 1.1, y / 4, 2) * 0.5 + 0.5;
    if (t > 0.62 + (n - 0.5) * 0.3) { _c.set(pickN(ROCK.travertine, n)); if (n2 > 0.75) _c.lerp(_c2.set('#d8c8a8'), 0.5); return _c.getHex(); }
    _c.set(pickN(['#6faa3a', '#86b84a', '#5f9a30', '#9ac25a', '#4f8a2a', '#b8c860'], n));
    if (n2 > 0.82) _c.lerp(_c2.set('#c8d8b8'), 0.35);      // gocciolamenti chiari
    if (t < 0.08) _c.multiplyScalar(0.7);
    return _c.getHex();
  });
  addColored(k, wall);
  // alberi e arbusti in cima alla parete
  for (let z = -r() * 4; z > -len; z -= r.range(3, 6)) { const H = Hf(W0 - z); tree(k, r, CL - r.range(5, 9), H, z, r.range(1.3, 2), LEAF.fresh); }
  for (let z = -r() * 3; z > -len; z -= r.range(2, 4)) { const H = Hf(W0 - z); shrub(k, r, CL - r.range(1.5, 4), H - 0.5, z, r.range(0.8, 1.4), LEAF.fresh); }
  // ciuffi di muschio pendenti
  for (let i = 0; i < len * 0.6; i++) { const zl = -r() * len, H = Hf(W0 - zl), y = r.range(2, H * 0.6); k.add(G.ico(r.range(0.5, 1.0), 0), r.pick(['#7ab842', '#8cc450', '#6aa838']), { x: CL + 2.6 + r.range(0, 1.2), y, z: zl, sy: 1.5, flat: true, vary: 0.2 }); }
  return k.build({ ao: 0.15 });
}

// ------------------------------------------------------------------ sponda rocciosa che scende al fiume (viadotto)
export function riverDropPiece(W0, len, o = {}) {
  const r = rng((Math.floor(W0 * 23) ^ 91) >>> 0);
  const k = new Kit(Math.floor(W0) + 31);
  const depth = o.depth ?? 4;
  dryWall(k, r, 0.75, 0, len, 0.9, ROCK.granite, 0.75);
  const g = gridSurface(Math.max(2, Math.ceil(len / 1.5)), 6, (u, v) => { const W = W0 + u * len; return [0.3 - v * 7, -Math.pow(v, 0.8) * (depth + 0.6) + noise3(W / 3, v * 4, 3) * 0.5 * v, -u * len]; },
    (x, y, z) => pickN(['#8f877a', '#a39a8a', '#7a7468', '#6b7a3e', '#b2a893'], noise3((W0 - z) / 2.5, x / 2, 6) * 0.5 + 0.5));
  addColored(k, g);
  for (let z = -r() * 2; z > -len; z -= r.range(1.2, 2.6)) addRock(k, r, r.range(-8, -3), -depth + r.range(-0.2, 0.8), z, r.range(0.6, 1.8), ROCK.granite, { squash: 0.6 });
  for (let z = -r() * 2; z > -len; z -= r.range(2, 4)) shrub(k, r, r.range(-3, -0.5), -r.range(0.5, 2.5), z, r.range(0.6, 1.0), LEAF.holm, 0.15);
  return k.build({ ao: 0.2 });
}

// ------------------------------------------------------------------ valle boscosa (paesaggio lontano)
// o: { side: 1 (destra) | -1, x0, floorY, far (larghezza), mtnH, len, river }
export function valleyTerrain(W0, len, o = {}) {
  const r = rng(o.seed || 7);
  const k = new Kit(o.seed || 7);
  const s = o.side ?? 1, x0 = o.x0 ?? 9, F = o.floorY ?? -45, X1 = o.far ?? 320, M = o.mtnH ?? 70, sd = o.seed || 7;
  const prof = (x, W) => {
    const d = x - x0;
    let y;
    if (d < (o.dropW ?? 26)) { const t = d / (o.dropW ?? 26); y = (o.topY ?? -1) + (F - (o.topY ?? -1)) * Math.pow(t, 0.7); }
    else if (d < (o.floorW ?? 150)) y = F + 6 * fbm(W / 30, d / 25, sd, 2);
    else { const t = (d - (o.floorW ?? 150)) / (X1 - x0 - (o.floorW ?? 150)); y = F + (M - F) * Math.pow(Math.min(1, t), 0.8) + 14 * fbm(W / 60, d / 40, sd + 3, 3) * t; }
    return y;
  };
  const xs = []; for (let i = 0; i <= 34; i++) xs.push(x0 + Math.pow(i / 34, 1.6) * (X1 - x0));
  const nv = Math.ceil(len / 6);
  const g = gridSurface(xs.length - 1, nv, (u, v) => { const x = xs[Math.round(u * (xs.length - 1))], W = W0 + v * len; return [s * x, prof(x, W), -W]; },
    (x, y, z) => {
      const W = -z, n = fbm(W / 18, x / 14, sd + 5, 2) * 0.5 + 0.5;
      _c.set(pickN(['#2f4a26', '#3a5a2c', '#456a32', '#506f36', '#5e7a3c'], n));
      if (noise3(W / 9, x / 7, sd) > 0.45 && y > F + 8) _c.lerp(_c2.set('#9a9284'), 0.6);   // affioramenti di roccia
      return _c.getHex();
    });
  if (s < 0) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ax, ay, az); } g.computeVertexNormals(); }
  addColored(k, g);
  // chiome degli alberi (macchia mediterranea fitta sui versanti)
  const n = o.trees ?? 520;
  for (let i = 0; i < n; i++) {
    const x = x0 + 6 + Math.pow(r(), 1.3) * (X1 - x0 - 30), W = W0 + r() * len, y = prof(x, W);
    k.add(G.ico(r.range(1.6, 3.4), 0), r.pick(['#2c4626', '#36522c', '#3f5e30', '#2a4022', '#4a6a36']), { x: s * x, y: y + 1.2, z: -W, sy: 0.8, flat: true, vary: 0.2 });
  }
  return k.build();
}

// ------------------------------------------------------------------ la guglia di roccia di Gadoni
// colonna slanciata e isolata che sale dal bosco: parte bassa piu' larga,
// "collo" a meta' con cengia erbosa, testa stretta e frastagliata; roccia
// grigio chiaro con macchie ocra e licheni, ciuffi verdi sulle cenge.
export function buildPinnacle(seed = 3) {
  const k = new Kit(seed);
  const r = rng(seed);
  const H = 100, base = -48;                       // dalla valle fino a ~52 m sopra il sentiero
  const NR = 18, NV = 46;
  // raggio in funzione dell'altezza (profilo della foto)
  const R = (t) => {
    if (t < 0.12) return 9.5 - t * 12;            // base nel bosco
    if (t < 0.55) return 8.1 - (t - 0.12) * 2.5;    // fusto
    if (t < 0.64) return 7.0 - (t - 0.55) * 22;     // spalla con la cengia
    if (t < 0.7) return 5.0;
    if (t < 0.93) return 5.0 - (t - 0.7) * 6;       // testa
    return Math.max(0.6, 3.6 - (t - 0.93) * 40);
  };
  const g = gridSurface(NR, NV, (u, v) => {
    const a = -u * Math.PI * 2, t = v, y = base + t * H;
    const rr = R(t) * (1 + 0.22 * fbm(Math.cos(a) * 2, t * 9, Math.sin(a) * 2 + seed, 3) + 0.08 * noise3(a * 3, t * 30, 1));
    const ex = 1.0, ez = 0.72;                                  // sezione ellittica
    const fl = (v === 0 || v === 1) ? 0 : 1;
    return [Math.cos(a) * rr * ex * fl, y, Math.sin(a) * rr * ez * fl];
  }, (x, y, z) => {
    const t = (y - base) / H, n = noise3(x / 3, y / 5, z / 3) * 0.5 + 0.5, n2 = noise3(x / 1.2, y / 9, z / 1.2) * 0.5 + 0.5;
    _c.set(pickN(['#b8b2a4', '#a8a294', '#c4beb0', '#9a9486', '#d0cabc'], n));
    if (n2 > 0.66) _c.lerp(_c2.set('#b58a58'), 0.45);           // ossidi ocra
    if (n2 < 0.18) _c.multiplyScalar(0.7);                      // fessure verticali
    if ((t > 0.57 && t < 0.66) || (t > 0.38 && t < 0.42 && n > 0.6)) _c.lerp(_c2.set('#6f8a3a'), 0.7);  // cenge con erba
    if (t < 0.1) _c.lerp(_c2.set('#4a5a34'), 0.5);
    return _c.getHex();
  });
  addColored(k, g);
  // ciuffi d'erba e arbusti sulle cenge (come nella foto, a meta' altezza)
  for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, t = r.range(0.56, 0.66); k.add(G.ico(r.range(0.8, 1.6), 0), r.pick(['#6f8a3a', '#7f9a44', '#5d7a32', '#8aa34e']), { x: Math.cos(a) * R(t) * 0.95, y: base + t * H, z: Math.sin(a) * R(t) * 0.7, flat: true, vary: 0.2, sy: 0.7 }); }
  for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, t = r.range(0.85, 0.95); k.add(G.ico(r.range(0.5, 0.9), 0), r.pick(['#6f8a3a', '#7f9a44']), { x: Math.cos(a) * R(t), y: base + t * H, z: Math.sin(a) * R(t) * 0.7, flat: true }); }
  for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, rr = r.range(9, 22); k.add(G.ico(r.range(2, 3.5), 0), r.pick(['#2c4626', '#36522c', '#3f5e30']), { x: Math.cos(a) * rr, y: base + r.range(2, 9), z: Math.sin(a) * rr, flat: true, sy: 0.8 }); }
  return k.build();
}

// ------------------------------------------------------------------ cascatelle e gocciolamenti (materiale animato a parte)
export function waterfallGeometry(h, w) {
  const g = new THREE.PlaneGeometry(w, h, 1, 6); g.translate(0, -h / 2, 0); return g;
}
