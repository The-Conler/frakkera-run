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
  const k = new Kit(seed);
  const r = rng(seed);
  const H = 72, base = -9;   // v5s27b: ago slanciato (~6x piu' alto che largo) che parte dalla riva dell'acqua
  const NR = 48, NV = 84;
  const frac = (x) => x - Math.floor(x);
  const R0 = (t) => {
    if (t < 0.12) return 9.5 - t * 32;             // piede largo di massi
    if (t < 0.84) return 5.7 - (t - 0.12) * 2.2;    // fusto slanciato, quasi dritto
    return Math.max(1.2, 4.1 - (t - 0.84) * 18);    // testa stretta e frastagliata
  };
  const LED = 13;                                    // numero di cenge
  const band = (t, a) => frac(t * LED + 0.35 * fbm(Math.cos(a) * 1.3, t * 2, Math.sin(a) * 1.3 + seed, 2));
  const crack = (a, t) => Math.abs(Math.sin(a * 6.5 + 2.2 * fbm(t * 3, seed, a, 2)));
  const radius = (a, t) => {
    const jag = band(t, a);
    let rr = R0(t) * (1 + 0.16 * fbm(Math.cos(a) * 2, t * 7, Math.sin(a) * 2 + seed, 3));
    rr *= 1 + 0.2 * (1 - jag) - 0.06;               // ogni cengia sporge e sopra rientra
    rr *= 0.66 + 0.42 * Math.pow(crack(a, t), 0.4); // colonne e solchi verticali
    if (t > 0.88) rr *= 0.35 + 0.8 * Math.max(0, Math.sin(a * 4 + seed + t * 5)); // punte multiple in cima
    return rr;
  };
  const g = gridSurface(NR, NV, (u, v) => {
    const a = -u * Math.PI * 2, t = v, y = base + t * H + (v === 1 ? 1.5 + 5 * Math.max(0, Math.sin(a * 4 + seed)) * (0.5 + 0.5 * Math.abs(Math.sin(a * 7))) : 0);
    const fl = v === 0 ? 0 : v === 1 ? 0.3 : 1;
    const rr = radius(a, t);
    const lean = Math.sin(t * 2.2) * 1.4;               // leggera curva come nella foto
    return [Math.cos(a) * rr * fl + lean, y, Math.sin(a) * rr * 0.78 * fl];
  }, (x, y, z) => {
    const t = (y - base) / H, a = Math.atan2(z / 0.78, x);
    const n = noise3(x / 2.5, y / 4, z / 2.5) * 0.5 + 0.5, n2 = noise3(x / 1.1, y / 7, z / 1.1) * 0.5 + 0.5;
    _c.set(pickN(['#cbbba0', '#d8c8ac', '#bfae93', '#e2d3b6', '#b2a185'], n));   // calcare caldo grigio-beige
    if (n2 > 0.7) _c.lerp(_c2.set('#b8946a'), 0.35);          // ossidi
    const cr = crack(a, t);
    if (cr < 0.22) _c.multiplyScalar(0.6 + cr);              // fessure scure
    const jag = band(t, a);
    if (jag > 0.93 && n > 0.62 && t < 0.9) _c.lerp(_c2.set('#7d8a4a'), 0.35);
    if (jag < 0.1) _c.multiplyScalar(0.88);                // ombra sotto la cengia   // muschio sulla cengia
    if (t < 0.07) _c.lerp(_c2.set('#4a5a34'), 0.45);
    return _c.getHex();
  });
  addColored(k, g);
  // macchia e muschio sulle cenge, a tutte le altezze (piu' fitta in basso)
  const leaf = ['#5a8a2e', '#6b9a36', '#4a7a2a', '#7aaa40', '#8ab84e', '#3f6a2a'];
  // v5s27b: ciuffi a macchie irregolari (non ad anelli), aggrappati alle cenge: piu' fitti in basso
  for (let p = 0; p < 62; p++) {
    const t0 = Math.min(0.86, Math.pow(r(), 1.5) * 0.84 + 0.05), a0 = r() * Math.PI * 2, n = 3 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const t = Math.max(0.03, Math.min(0.88, t0 + r.range(-0.035, 0.035))), a = a0 + r.range(-0.45, 0.45);
      const rr = radius(a, t) * 0.97, lean = Math.sin(t * 2.2) * 1.4, y = base + t * H;
      const s = r.range(0.9, 1.8) * (t < 0.3 ? 1.35 : 1);
      for (let j = 0; j < 2; j++) k.add(G.ico(s * r.range(0.6, 1.0), 0), r.pick(leaf), { x: Math.cos(a) * rr + lean + r.range(-0.4, 0.4), y: y + r.range(-0.3, 0.5) * s, z: Math.sin(a) * rr * 0.78 + r.range(-0.4, 0.4), flat: true, vary: 0.22, sy: 0.7 });
    }
  }
  // v5s27b: testa a piu' punte (come nella foto): guglie strette e storte attorno alla cima
  { const tT = 0.9, yT = base + tT * H, lT = Math.sin(tT * 2.2) * 1.4;
    for (const [dx, dz, h, w] of [[-0.9, 0.3, 9, 1.5], [0.8, -0.4, 7, 1.3], [0.2, 0.9, 5.5, 1.1], [1.3, 0.6, 4.5, 1.0], [-0.4, -0.9, 6, 1.2]])
      k.add(G.cyl(w * 0.2, w, h, 5), r.pick(['#cbbba0', '#bfae93', '#d8c8ac']), { x: lT + dx, y: yT + h / 2 - 0.5, z: dz, rz: r.range(-0.12, 0.12), rx: r.range(-0.12, 0.12), flat: true, vary: 0.08 }); }
  // base: massi e boscaglia folta (riva)
  for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, rr = r.range(7, 12); addRock(k, r, Math.cos(a) * rr, base + r.range(1, 4), Math.sin(a) * rr * 0.85, r.range(1.8, 3.6), ['#a99b86', '#9c8f7b', '#b8aa94'], { squash: 0.7, tilt: true }); }
  for (let i = 0; i < 46; i++) { const a = Math.PI * r.range(0.45, 1.55), rr = r.range(8, 16); /* v5s27b: solo dal lato lontano dal sentiero */ k.add(G.ico(r.range(1.6, 3.2), 0), r.pick(['#2c4626', '#36522c', '#3f5e30', '#4a6a36']), { x: Math.cos(a) * rr, y: base + r.range(2, 8), z: Math.sin(a) * rr, flat: true, sy: 0.8, vary: 0.2 }); }
  return k.build();
}

// ------------------------------------------------------------------ cascatelle e gocciolamenti (materiale animato a parte)
export function waterfallGeometry(h, w) {
  const g = new THREE.PlaneGeometry(w, h, 1, 6); g.translate(0, -h / 2, 0); return g;
}
