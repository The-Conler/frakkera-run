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
  // grandi alberi che si chinano sul sentiero (ombra in alto a sinistra, target2-fiume)
  if (o.canopy) for (let z = -r.range(0, 4); z > -len; z -= r.range(6, 9.5)) {
    const bx = -r.range(3.5, 5.5), by = hAt(bx, W0 - z) - 0.2, cx = r.range(-0.5, 1.8), cy = r.range(8.5, 11.5), dx = cx - bx, dy = cy - by;
    const L = Math.hypot(dx, dy);
    k.add(G.cyl(0.22, 0.42, L, 7), r.pick(['#5a4430', '#4e3c2a', '#66503a']), { x: bx + dx / 2, y: by + dy / 2, z, rz: -Math.atan2(dx, dy), flat: true, vary: 0.15 });
    k.add(G.cyl(0.12, 0.2, 4, 5), '#5a4430', { x: bx + dx * 0.55 - 1.2, y: by + dy * 0.6 + 1.2, z: z + 0.6, rz: 0.7, flat: true });
    for (let i = 0; i < 10; i++) k.add(G.ico(r.range(1.9, 3.1), 1), r.pick(i % 3 ? LEAF.fresh : LEAF.holm), { x: cx + r.range(-3, 2.2), y: cy + r.range(-1, 1.8), z: z + r.range(-3.2, 3.2), flat: true, vary: 0.25, sy: 0.72 });
  }
  if (o.bigFence) {        // v5s13b: staccionata rustica ben visibile a bordo sentiero (target4 cascata)
    const wc = ['#b08860', '#a07a52', '#c09868', '#8a6644'];
    for (let z = -r() * 0.5; z > -len; z -= 2.0) k.add(G.box(0.2, 1.8, 0.2), r.pick(wc), { x: 0.55, y: 0.88, z, rz: r.range(-0.06, 0.06), vary: 0.12 });
    for (const [y, t] of [[0.55, 0.14], [1.05, 0.14], [1.55, 0.16]]) k.add(G.box(0.13, t, len + 0.2), r.pick(wc), { x: 0.62, y, z: -len / 2, rz: r.range(-0.03, 0.03), vary: 0.1 });
  } else if (o.fence) fence(k, r, 0.9, 0, len);
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
  const HB = o.cliffH ?? 19, BW = o.beachW ?? 3.2, BX = o.beachX0 ?? 1.3;
  // riva: ghiaia che scende nell'acqua
  const beach = gridSurface(Math.max(2, Math.ceil(len / 2)), 3, (u, v) => [BX - v * BW, 0.05 - v * 0.75 + (v > 0 ? noise3((W0 + u * len) / 3, v, 4) * 0.12 : 0), -u * len],
    (x, y, z) => pickN(['#d8d2c4', '#cbc4b4', '#e2ddd0', '#bdb6a6'], noise3((W0 - z) / 1.3, x, 2) * 0.5 + 0.5));
  addColored(k, beach);
  for (let z = -r() * 2; z > -len; z -= r.range(1.2, 3)) { if (r.chance(0.6)) addRock(k, r, r.range(-2.5, 0.8), r.range(-0.4, 0.1), z, r.range(0.2, 0.5), ROCK.limestone, { squash: 0.55 }); else grassTuft(k, r, 1.1, 0, z, 0.9, ['#6f9a3a', '#86ad4a']); }
  // massi bianchi tondeggianti e felci tra il sentiero e l'acqua
  if (o.lush) {
    for (let z = -r() * 2; z > -len; z -= r.range(1.6, 3.2) * (o.shallow ? 1.8 : 1)) addRock(k, r, r.range(-1.2, 0.6), -0.1, z, r.range(0.5, 1.15), o.shallow ? ['#a8a090', '#c8bea8', '#b8b0a0', '#d0c4ac'] : ROCK.limestone, { squash: 0.72, rough: 0.22, detail: 0 });
    if (!o.shallow) for (let z = -r() * 2; z > -len; z -= r.range(2.2, 4)) fern(k, r, r.range(0.6, 1.2), 0.05, z, r.range(0.9, 1.4));
    if (!o.shallow) for (let i = 0; i < 2; i++) if (r.chance(0.7)) addRock(k, r, r.range(-9, -3.5), -0.7, -r.range(1, len - 1), r.range(1.4, 2.8), ROCK.limestone, { squash: 0.5, rough: 0.25 });
  }
  // v5s6 (target3-cascata): fondale basso e visibile sotto l'acqua - turchese vicino alla riva, smeraldo verso la parete,
  // sassi sul fondo e chiazze di luce (caustiche) - e cespugli tondi low-poly lungo il sentiero
  if (o.shallow) {
    const fl = gridSurface(Math.max(2, Math.ceil(len / 3)), 8, (u, v) => { const W = W0 + u * len; return [0.6 + v * (CL - 0.6), -0.45 - Math.pow(v, 0.7) * 2.1 + noise3(W / 4, v * 5, 9) * 0.12, -u * len]; },
      (x, y, z) => { const t = Math.min(1, (0.6 - x) / (0.6 - CL)); _c.set('#4cc8ae').lerp(_c2.set('#1a9a80'), Math.min(1, t * 2)).lerp(_c2.set('#0a5a48'), Math.max(0, t * 1.6 - 0.6)); _c.lerp(_c2.set('#e8f0d8'), Math.max(0, noise3((W0 - z) / 2.2, x / 2.2, 3)) * 0.25 * (1 - t)); return _c.getHex(); });
    addColored(k, fl);
    for (let i = 0; i < len * 0.9; i++) { const v = r() * r(), x = 0.2 + v * (CL - 0.6); addRock(k, r, x, -0.5 - Math.pow(v, 0.7) * 2.0, -r() * len, r.range(0.25, 0.7) * (1 + v), ['#c8c0a8', '#b8b098', '#a8a890', '#d0c8b0'], { squash: 0.5 }); }
    for (let i = 0; i < len * 0.5; i++) { const v = r() * 0.7, x = 0.3 + v * (CL - 0.6); k.add(G.box(r.range(0.6, 1.6), 0.02, r.range(0.4, 1.0)), r.pick(['#c8fff0', '#b0ffe6', '#e0fff4']), { x, y: -0.31 - v * 0.01, z: -r() * len, ry: r.range(0, 3), unlit: true }); } // caustiche a pelo d'acqua
    for (let z = -r() * 6; z > -len; z -= r.range(6, 11)) shrub(k, r, r.range(0.7, 1.2), 0.05, z, r.range(0.7, 1.0), LEAF.fresh);
  }
  // massi bianchi grandi nell'acqua
  if (!o.shallow && r.chance(0.55)) addRock(k, r, r.range(-6.5, -3.5), -0.6, -r.range(1, len - 1), r.range(1.8, 3.4), ROCK.limestone, { squash: 0.5, rough: 0.3 });
  if (!o.shallow && r.chance(0.3)) addRock(k, r, r.range(-5, -3), -0.5, -r.range(1, len - 1), r.range(1.2, 2.2), ROCK.limestone, { squash: 0.55 });
  // parete di travertino: sopra roccia bruna/ocra, sotto muschio verde
  const Hf = (W) => HB + 6 * fbm(W / 40, 3, 1, 2);
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
    if (t > (o.mossTo ?? 0.62) + (n - 0.5) * 0.3) { _c.set(pickN(ROCK.travertine, n)); if (n2 > 0.75) _c.lerp(_c2.set('#d8c8a8'), 0.5); return _c.getHex(); }
    _c.set(pickN(o.mossy ? ['#3f6e22', '#4f7f2a', '#2f5c1c', '#5f8f30', '#6fa038', '#47762a'] : ['#6faa3a', '#86b84a', '#5f9a30', '#9ac25a', '#4f8a2a', '#b8c860'], n));
    if (n2 > 0.82) _c.lerp(_c2.set('#c8d8b8'), 0.35);      // gocciolamenti chiari
    if (t < 0.08) _c.multiplyScalar(0.7);
    return _c.getHex();
  });
  addColored(k, wall);
  // alberi e arbusti in cima alla parete
  for (let z = -r() * 4; z > -len; z -= r.range(3, 6) / (o.lush ? 1.5 : 1)) { const H = Hf(W0 - z); tree(k, r, CL - r.range(3, 9), H, z, r.range(1.3, 2) * (o.lush ? 1.35 : 1), LEAF.fresh); }
  for (let z = -r() * 3; z > -len; z -= r.range(2, 4)) { const H = Hf(W0 - z); shrub(k, r, CL - r.range(1.5, 4), H - 0.5, z, r.range(0.8, 1.4), LEAF.fresh); }
  // ciuffi di muschio pendenti
  for (let i = 0; i < len * (o.lush ? 1.3 : 0.6); i++) { const zl = -r() * len, H = Hf(W0 - zl), y = r.range(2, H * (o.lush ? 0.8 : 0.6)); k.add(G.ico(r.range(0.5, 1.0) * (o.lush ? 1.4 : 1), 0), r.pick(o.mossy ? ['#4f8a2a', '#5f9a30', '#3f7424', '#7ab042'] : ['#7ab842', '#8cc450', '#6aa838']), { x: CL + 2.6 + r.range(0, 1.2), y, z: zl, sy: 1.5, flat: true, vary: 0.2 }); }
  // v5s13b: massi grandi muschiati e felci lungo la riva della piscina
  if (o.mossy) {
    for (let z = -r() * 3; z > -len; z -= r.range(2.6, 4.5)) {
      const x = r.range(-3.2, -0.6), s = r.range(0.9, 1.9);
      addRock(k, r, x, -0.35, z, s, ['#a8a090', '#9a9484', '#b8b0a0', '#8c867a'], { squash: 0.62, rough: 0.25, detail: 0 });
      k.add(G.ico(s * 0.8, 1), r.pick(['#4f7f2a', '#5f8f30', '#6b9a38']), { x: x + r.range(-0.2, 0.2), y: -0.35 + s * 0.5, z, sy: 0.35, flat: true, vary: 0.15 });
    }
    for (let z = -r() * 2; z > -len; z -= r.range(1.4, 2.6)) fern(k, r, r.range(0.2, 1.0), 0.05, z, r.range(1.0, 1.6));
  }
  // v5s13: tende di vegetazione pendente dalla cima della parete (liane/edera scura)
  if (o.mossy) for (let i = 0; i < len * 0.8; i++) { const zl = -r() * len, H = Hf(W0 - zl), h = r.range(3, 9); k.add(G.box(0.5, h, r.range(0.6, 1.4)), r.pick(['#2f5a1c', '#3f6a22', '#4a7a28']), { x: CL + 3.2 + r.range(0, 0.8), y: H - h / 2 - r.range(0, 2), z: zl, vary: 0.15 }); }
  return k.build({ ao: 0.15 });
}

// ------------------------------------------------------------------ sponda rocciosa che scende al fiume (viadotto)
// v5s6: isolotto di rocce con tronco caduto in mezzo alla piscina
export function isletGeometry(seed) {
  const k = new Kit(seed); const r = rng(seed);
  const pal = ['#a8a090', '#c8bea8', '#b8b0a0', '#d0c4ac', '#9a9284'];
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r.range(0, 2.6); addRock(k, r, Math.cos(a) * d, -0.2, Math.sin(a) * d * 0.7, r.range(0.7, 1.5), pal, { squash: 0.6, detail: 0 }); }
  k.add(G.cyl(0.32, 0.4, 5.5, 8), '#6b5038', { x: 0.4, y: 1.0, z: 0.2, rz: Math.PI / 2 - 0.25, ry: 0.5, flat: true });
  k.add(G.cyl(0.26, 0.26, 2.2, 7), '#5a4430', { x: -0.6, y: 2.0, z: -0.3, rz: 0.2, flat: true });
  for (let i = 0; i < 6; i++) shrub(k, r, r.range(-2, 2), 0.4, r.range(-1.2, 1.2), r.range(0.7, 1.1), LEAF.fresh);
  return k.build({ ao: 0.2 });
}

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
// v5s27: pinnacolo calcareo altissimo e slanciato (foto dell'utente): roccia grigio-beige calda,
// fessure verticali profonde, cenge orizzontali a gradini con ciuffi di macchia e muschio,
// cima frastagliata a piu' punte, base piu' larga e cespugliosa con massi.
export function buildPinnacle(seed = 3) {
  // v5s27f: monolite ricostruito da zero: piu' colonne di roccia fuse insieme (sezioni poligonali irregolari, facce larghe,
  // fessure verticali profonde), due punte frastagliate di altezza diversa, fusto che resta spesso, piede largo con speroni.
  // Low-poly a facce piatte irregolari; niente anelli: le quote di ogni vertice sono sfalsate.
  const k = new Kit(seed);
  const r = rng(seed * 7 + 11);
  const base = -48;
  const dark = new Map(); const key = (x, y, z) => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
  const pal = ['#cdb595', '#bca486', '#d8c2a0', '#b09a7e', '#c6ad8d', '#a8957f', '#dcc8a6', '#b9a085'];
  // colonne: x, z, raggio, altezza, inclinazione in cima (dx, dz), quota di inizio della cima frastagliata
  const COLS = [
    { x: 0.0, z: 0.0, r: 5.6, h: 106, lx: -1.2, lz: 0.4, top: 0.86 },   // punta piu' alta
    { x: 4.6, z: 1.2, r: 4.6, h: 93, lx: 2.2, lz: -0.6, top: 0.84 },    // seconda punta, staccata
    { x: -3.4, z: 2.4, r: 4.2, h: 74, lx: -0.6, lz: 0.8, top: 0.8 },
    { x: 1.6, z: -3.4, r: 4.8, h: 84, lx: 0.4, lz: -0.8, top: 0.82 },
    { x: -2.4, z: -2.6, r: 4.4, h: 62, lx: -0.4, lz: -0.4, top: 0.78 },
    { x: -6.2, z: -1.0, r: 5.8, h: 40, lx: -0.8, lz: 0, top: 0.7 },     // speroni del piede
    { x: 6.4, z: -3.8, r: 5.2, h: 34, lx: 0.8, lz: -0.4, top: 0.68 },
    { x: 1.0, z: 5.6, r: 5.0, h: 30, lx: 0, lz: 0.8, top: 0.66 },
  ];
  const allP = []; // v5s27g: punti della superficie dove posare i blocchi
  const surf = []; // per la vegetazione: punti delle fessure e delle cenge
  COLS.forEach((C, ci) => {
    const K = 6 + Math.floor(r() * 3), NV = Math.max(10, Math.round(C.h / 4));
    const corners = [];
    for (let i = 0; i < K; i++) corners.push({ a: (i + r.range(-0.3, 0.3)) / K * Math.PI * 2, rho: r.range(0.72, 1.18), crack: r() < 0.45 ? r.range(0.22, 0.42) : r.range(0, 0.08), tip: r.range(0.9, 1.0) });
    const NU = K * 2;
    const g = gridSurface(NU, NV, (u, v) => {
      const jj = Math.round(u * NU) % NU, ci0 = Math.floor(jj / 2), odd = jj % 2 === 1;
      const A = corners[ci0], B = corners[(ci0 + 1) % K];
      const t = v;
      // sagoma verticale: piede allargato, fusto quasi dritto e spesso, cima frastagliata (ogni spigolo con la sua quota)
      const flare = 1 + 0.35 * Math.max(0, 1 - t / 0.12);
      const tipT = (odd ? (A.tip + B.tip) / 2 - 0.04 : A.tip);
      const topK = t <= C.top ? 1 : Math.max(0.08, 1 - ((t - C.top) / (tipT - C.top + 1e-3)) * 0.9);
      let px, pz;
      const ca = (a, rho) => [Math.cos(a) * rho, Math.sin(a) * rho];
      if (!odd) { [px, pz] = ca(A.a, A.rho); }
      else { let bA = B.a; if (bA < A.a) bA += Math.PI * 2; const [x1, z1] = ca(A.a, A.rho), [x2, z2] = ca(bA, B.rho); px = (x1 + x2) / 2; pz = (z1 + z2) / 2; const s = 1 - A.crack; px *= s; pz *= s; }
      const R = 1.15 * C.r * flare * Math.min(1, topK) * (1 - 0.06 * t);
      const lean = Math.pow(t, 2);
      let x = C.x + px * R + C.lx * lean, z = C.z + pz * R + C.lz * lean;
      let y = base + Math.min(t, tipT) / tipT * C.h * (v === 1 ? 1 : 1);
      if (v === 1) y = base + C.h * (odd ? r.range(0.93, 0.98) : A.tip);
      if (v > 0 && v < 1) y += r.range(-0.45, 0.45) * (C.h / NV);   // quote sfalsate: niente anelli
      // spostamento irregolare dei vertici
      const nx = noise3(x / 6 + ci, y / 11, z / 6), nz = noise3(z / 6 - ci, y / 11, x / 6 + 3);
      x += nx * 1.1 * Math.min(1, topK + 0.3); z += nz * 1.1 * Math.min(1, topK + 0.3);
      if (v === 0) y = base - 2;
      const d = odd && A.crack > 0.2 ? 0.5 : odd ? 0.85 : 1;
      dark.set(key(x, y, z), d);
      if (odd && A.crack > 0.2 && t > 0.2 && t < C.top) surf.push([x, y, z, t * C.h / 106, ci]);
      if (!odd && r() < 0.12 && t > 0.15 && t < C.top) surf.push([x, y, z, t * C.h / 106, ci]);
      if (v > 0) allP.push([x, y, z, t, C.x + C.lx * lean, C.z + C.lz * lean, R, C.h]);
      return [x, y, z];
    }, (x, y, z) => {
      const n = noise3(x / 7 + ci * 3.1, y / 13, z / 7) * 0.5 + 0.5, n2 = noise3(x / 2.2, y / 3.5, z / 2.2) * 0.5 + 0.5;
      _c.set(pickN(pal, Math.min(0.999, Math.max(0, n * 0.8 + n2 * 0.3 - 0.05))));
      if (n2 > 0.72) _c.lerp(_c2.set('#9a7a58'), 0.3);                     // vene brune
      _c.multiplyScalar(dark.get(key(x, y, z)) ?? 1);                       // ombra nelle fessure
      _c.multiplyScalar(0.5);   // v5s27g: il nucleo resta scuro: si vede solo nelle fughe tra i blocchi
      const t = (y - base) / 106; if (t < 0.08) _c.lerp(_c2.set('#5a5a3c'), 0.35 * (1 - t / 0.08));
      return _c.getHex();
    });
    addColored(k, g);
  });
  // v5s27g: superficie fatta di tanti blocchi di roccia squadrati e irregolari (voxel ma organici), colore per blocco
  { const pal2 = ['#d6bf9c', '#c8ae8a', '#bfa889', '#e0cba8', '#b39c80', '#a8998a', '#cbb79a', '#9f8f7c', '#d9c4a2', '#b8a58e'];
    for (const [x, y, z, t, cx, cz, R, h] of allP) {
      if (r() < 0.3) continue;
      const nx = x - cx, nz = z - cz, nl = Math.hypot(nx, nz) || 1, ux = nx / nl, uz = nz / nl;
      const n = 1 + (R > 4.5 && r() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const sz = r.range(1.3, 2.6) * Math.max(0.55, Math.min(1, R / 5)), out = r.range(0.0, 0.45) * sz;
        const yy = y + r.range(-1.6, 1.6), ox = r.range(-1, 1) * 1.2, oz = r.range(-1, 1) * 1.2;
        const n2 = noise3(x / 5, yy / 7, z / 5) * 0.5 + 0.5;
        k.add(G.box(sz * r.range(0.8, 1.35), sz * r.range(0.65, 1.25), sz * r.range(0.8, 1.3)), pickN(pal2, Math.min(0.999, Math.max(0, n2 * 0.6 + r() * 0.5))),
          { x: x + ux * out + ox * -uz, y: yy, z: z + uz * out + ox * ux + oz * 0.2, ry: Math.atan2(ux, uz) + r.range(-0.35, 0.35), rx: r.range(-0.25, 0.25), rz: r.range(-0.25, 0.25), vary: 0.12 });
      }
    } }
  // vegetazione: macchie irregolari nate da fessure e cenge, piu' grandi a meta'-alto, poche isolate in basso
  const leaf = ['#4f7a2a', '#5f8a30', '#6b9a38', '#3f6a26', '#7aa040', '#567f2c'];
  const pickS = (lo, hi) => { for (let n = 0; n < 40; n++) { const p = surf[Math.floor(r() * surf.length)]; if (p[3] >= lo && p[3] <= hi) return p; } return null; };
  const clump = (p, n, s0) => { for (let i = 0; i < n; i++) { const s = s0 * r.range(0.45, 1.1), ox = r.range(-1, 1) * s0, oy = r.range(-0.6, 0.8) * s0, oz = r.range(-1, 1) * s0;
    k.add(G.ico(s, 0), r.pick(leaf), { x: p[0] + ox, y: p[1] + oy, z: p[2] + oz, flat: true, sy: r.range(0.6, 0.85), ry: r() * 6, vary: 0.2 }); } };
  for (let i = 0; i < 34; i++) { const p = pickS(0.38, 0.88); if (p) clump(p, 5 + Math.floor(r() * 8), r.range(1.5, 2.6)); }   // macchie grandi
  for (let i = 0; i < 16; i++) { const p = pickS(0.25, 0.9); if (p) clump(p, 1 + Math.floor(r() * 3), r.range(0.8, 1.4)); }    // ciuffi piccoli sparsi
  for (let i = 0; i < 7; i++) { const p = pickS(0.06, 0.3); if (p) clump(p, 1 + Math.floor(r() * 2), r.range(0.8, 1.4)); }      // pochi cespugli isolati in basso
  // piede: massi di frana e boscaglia (riva)
  for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, rr = r.range(8, 14); addRock(k, r, Math.cos(a) * rr, base + r.range(0, 3), Math.sin(a) * rr * 0.85, r.range(2, 4), ['#a99b86', '#9c8f7b', '#b8aa94'], { squash: 0.7, tilt: true }); }
  for (let i = 0; i < 36; i++) { const a = r() * Math.PI * 2, rr = r.range(10, 22); k.add(G.ico(r.range(1.6, 3.2), 0), r.pick(['#2c4626', '#36522c', '#3f5e30', '#4a6a36']), { x: Math.cos(a) * rr, y: base + r.range(2, 7), z: Math.sin(a) * rr, flat: true, sy: 0.8, vary: 0.2 }); }
  return k.build();
}

// ------------------------------------------------------------------ cascatelle e gocciolamenti (materiale animato a parte)
export function waterfallGeometry(h, w) {
  const g = new THREE.PlaneGeometry(w, h, 1, 6); g.translate(0, -h / 2, 0); return g;
}
