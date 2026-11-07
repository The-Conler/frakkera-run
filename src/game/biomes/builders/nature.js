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
  // v5s27q: parete piena (non un foglio): pianoro in cima che va indietro, scarpata dietro fino a terra e fianchi chiusi ai capi
  if (o.solid) {
    const D = o.solid, xt = (W) => -0.35 - lean * Hf(W) - 3.5, sc = () => pickN(pal, 0.4), tc = (x, y, z) => pickN(['#6b6a48', '#7a7656', '#5f6a40', '#8a8468'], fbm((W0 - z) / 6, x / 5, sd + 7, 2) * 0.5 + 0.5);
    const both = (f, col) => { for (const rev of [false, true]) addColored(k, gridSurface(Math.max(2, Math.ceil(len / 3)), 2, (u, v) => f(rev ? 1 - u : u, v), col)); };
    both((u, v) => { const W = W0 + u * len; return [xt(W) - v * D, Hf(W) + 0.6 - v * v * 3, -u * len]; }, tc);                              // pianoro
    both((u, v) => { const W = W0 + u * len; return [xt(W) - D - v * 8, Hf(W) - 2.4 - v * (Hf(W) + 30), -u * len]; }, sc);                  // scarpata dietro
    for (const e of [0, 1]) for (const rev of [false, true]) addColored(k, gridSurface(6, 4, (u0, v) => { const u = rev ? 1 - u0 : u0, W = W0 + e * len, H = Hf(W);
      const x0 = -0.35 - lean * v * H - 1.2, x1 = xt(W) - D - 8 * v; return [x0 + (x1 - x0) * u, v * H + (1 - v) * (u > 0.9 ? -30 : 0), -e * len]; }, sc));   // fianchi
  }
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
  // v5s27q: gonna di roccia/terra sotto il bordo esterno e ai due capi (il pendio non resta piu' sospeso sopra la valle
  // della roccia: da lontano si vedeva il piano inclinato tagliato e il vuoto sotto)
  if (o.skirt) {
    const B = o.skirt, sc = (x, y) => pickN(['#c4d080', '#b4c470', '#c8bc8c', '#a8c068'], fbm(x / 7, y / 6, sd + 4, 2) * 0.5 + 0.5);
    const wall = (f, revs = [false, true]) => { for (const rev of revs) addColored(k, gridSurface(8, 3, (u, v) => f(rev ? 1 - u : u, v), sc)); };
    // scarpate inclinate (non pareti verticali: cosi' prendono la luce del cielo e sembrano un versante naturale)
    wall((u, v) => { const W = W0 + u * len, x = 0.6 - D, h = hAt(x, W); return [x - (h - B) * 1.6 * v, h + (B - h) * v, -u * len]; });   // v5s29: scarpata piu' dolce, prende piu' luce
    for (const e of [0, 1]) wall((u, v) => { const W = W0 + e * len, x = 0.6 - Math.pow(u, 1.25) * D, h = hAt(x, W) - 0.05, dy = (h - B) * v * Math.min(1, u * 6); return [x, h - dy, -e * len + (e ? -1 : 1) * dy * 0.9]; }, [e === 1]);
  }
  // v5s39: esclusione impronte case (footprints: {minW,maxW,minX,maxX} in W assoluti / x locale pezzo)
  const fps = o.footprints || [];
  const hitsFoot = (x, zl, rad) => {
    if (!fps.length) return false;
    const W = W0 - zl;
    for (const f of fps) {
      if (W + rad < f.minW || W - rad > f.maxW) continue;
      if (x + rad < f.minX || x - rad > f.maxX) continue;
      return true;
    }
    return false;
  };
  const dens = o.trees ?? 0.25;
  for (let i = 0; i < Math.round(len * dens); i++) {
    let zl, x, W, y, placed = false;
    for (let t = 0; t < 10 && !placed; t++) {
      zl = -r() * len; x = -r.range(3.5, D * 0.95); W = W0 - zl; y = hAt(x, W);
      const sGuess = 1.5;
      if (hitsFoot(x, zl, sGuess * 1.85)) continue;
      if (o.conifers && r.chance(0.25)) cypress(k, r, x, y, zl, r.range(0.8, 1.1));
      else tree(k, r, x, y - 0.2, zl, r.range(1.1, 1.8), r.chance(0.5) ? (o.leaf || LEAF.holm) : LEAF.fresh);
      placed = true;
    }
  }
  for (let i = 0; i < Math.round(len * (o.ferns ?? 0.3)); i++) { const zl = -r() * len, x = -r.range(0.5, 6), y = hAt(x, W0 - zl); if (hitsFoot(x, zl, 0.9)) continue; fern(k, r, x, y, zl, r.range(0.7, 1.2)); }
  for (let i = 0; i < Math.round(len * (o.rocks ?? 0.25)); i++) { const zl = -r() * len, x = -r.range(0.4, 9), y = hAt(x, W0 - zl); addRock(k, r, x, y + 0.1, zl, r.range(0.3, 1.1), o.rockPal || ROCK.granite, { squash: 0.7 }); }
  for (let i = 0; i < Math.round(len * 0.4); i++) {
    let zl, x, y, placed = false;
    for (let t = 0; t < 8 && !placed; t++) {
      zl = -r() * len; x = -r.range(0, 4); y = hAt(x, W0 - zl);
      const s = r.range(0.5, 0.9);
      if (hitsFoot(x, zl, s * 1.7)) continue;
      shrub(k, r, x, y, zl, s, o.leaf || LEAF.holm, o.flowers || 0);
      placed = true;
    }
  }
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
    else { const t = (d - (o.floorW ?? 150)) / (X1 - x0 - (o.floorW ?? 150)); y = F + (M - F) * Math.pow(Math.min(1, t), 0.8) + 14 * fbm(W / 60, d / 40, sd + 3, 3) * t + (o.relief ? o.relief * (Math.abs(fbm(W / 70, d / 55, sd + 21, 3)) * 1.6 - 0.35) * Math.min(1, t * 1.5) : 0); }   // v5s29: creste e valloni (niente fondale piatto)
    if (o.rise) {   // v5s34: il fondovalle risale fino al livello del fiume dell'ambiente dopo (prima sotto la riva si vedeva il vuoto)
      const [w0, w1, ry] = o.rise, tw = Math.min(1, Math.max(0, (W - w0) / (w1 - w0))), kx = 1 - Math.min(1, Math.max(0, (d - (o.floorW ?? 150)) / 45));
      const k = tw * tw * (3 - 2 * tw) * kx;
      if (k > 0 && y < ry) y += (ry - y) * k;
    }
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
  // v5s27i: UN solo pilastro di roccia continuo (una griglia di vertici connessi, chiusa in cima), sagoma del pilastro vero:
  // piede largo che si fonde col pendio, fusto stretto e irregolare, spalla a ~62% e blocco superiore piu' stretto,
  // spostato e un po' inclinato, con la cima spaccata e frastagliata. Fessure verticali profonde, cenge, speroni.
  // Low-poly a facce piatte, anelli abbastanza fitti da tenere le facce quasi quadrate. Colore per faccia.
  const k = new Kit(seed);
  const r = rng(seed * 13 + 5);
  const H = 150, base = -48, SH = 0.58;
  const NR = 44, NV = 72;
  // fessure verticali (angolo, profondita', larghezza) e cenge (quota relativa, rientro)
  const cracks = [[0.4, 0.3, 0.16], [1.5, 0.22, 0.12], [2.6, 0.34, 0.18], [3.7, 0.2, 0.1], [4.6, 0.28, 0.14], [5.5, 0.18, 0.1]];
  const ledges = [[0.18, 0.06], [0.33, 0.05], [0.47, 0.07], [SH, 0.0], [0.78, 0.05], [0.88, 0.04]];
  const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  // v5s27k: sagoma prima di tutto. Il tratto visibile dalla via va da t~0.32 (quota della via) a 1.
  const prof = (t) => {
    if (t < 0.12) return 20 + 9 * Math.pow(1 - t / 0.12, 1.4);                        // piede largo di massi
    if (t < 0.5) return 20 + 1.5 * Math.sin((t - 0.12) / 0.38 * Math.PI) - 1.5 * (t - 0.12);   // v5s27l: ~30% piu' larga in basso e a meta'
    return 19.5 - 8.5 * Math.pow((t - 0.5) / 0.5, 1.3);   // v5s27l: parte alta piena, non a punta                                 // parte alta spessa (non una punta)
  };
  const smooth = (e0, e1, x) => { const q = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); };
  // v5s27m: anatomia geologica. Massa secondaria a SINISTRA: un secondo pilastro verticale, stretto e spigoloso,
  // fuso nel principale ma separato da una fenditura profonda; la cima piu' alta di prima, tagliata in obliquo.
  const SHA = 3.0, PT0 = 0.3, PT1 = 0.86;
  const protr = (a, t) => { const d = wrap(a - SHA - 0.12 * (t - 0.5)), ad = Math.abs(d); if (ad > 0.78) return 0;
    const tt = (t - PT0) / (PT1 - PT0); if (tt <= 0 || tt >= 1.08) return 0;
    const w = Math.min(1, (0.78 - ad) / 0.22);                                   // fianchi a spigolo, faccia piatta
    const top = 1 - smooth(0.78 + 0.18 * (d + 1) / 2, 1.06, tt);               // cima obliqua, piu' alta verso l'esterno
    return 20.5 * w * Math.min(1, tt / 0.5) * top * (1 + 0.05 * tri(tt * 9)); };
  const CL = [SHA - 0.8, SHA + 0.82];                                          // le due fenditure tra la massa e il pilastro
  // cengia orizzontale nella parte medio-alta (davanti e a sinistra)
  const LT = 0.64, ledge = (a, t) => { const d = Math.abs(wrap(a - (SHA - 1.3))); if (d > 1.2) return 0; const lt = LT + 0.04 * Math.sin(a * 2.3);   // v5s27m: cengia corta e inclinata, non una fascia
    return 3.2 * (1 - d / 1.2) * smooth(lt - 0.03, lt, t) * (1 - smooth(lt + 0.01, lt + 0.02, t)); };
  const tri = (x) => { const f = x / (Math.PI * 2); return 2 * Math.abs(f - Math.floor(f + 0.5)); };   // onda triangolare 0..1 (creste a spigolo)
  const P = (u, v) => {
    const a = u * Math.PI * 2, t = v;
    let R = prof(t);
    R *= 1 + 0.16 * Math.cos(2 * a + 1.3 + 1.2 * t) + 0.08 * Math.cos(3 * a + 0.5 - 1.5 * t);
    // lastre verticali grandi: sezione poligonale con fase che cambia solo ogni ~1/3 di altezza
    if (t < 0.62) { const band = Math.floor(t * 3 + 0.3 * Math.sin(a * 3)), F = 6 + (band % 2), sa = (Math.PI * 2) / F, ph = ((a + 0.9 * band) % sa + sa) % sa - sa / 2; R *= Math.cos(sa / 2) / Math.cos(ph); }
    else { // parte alta: creste verticali irregolari (non piu' una colonna rettangolare)
      const k3 = smooth(0.58, 0.68, t), rid = tri(a * 7 + 1.7 * Math.sin(a * 2 + 1) + 0.4 * t) ;
      R *= 1 + k3 * (0.2 * rid - 0.1 + 0.07 * Math.sin(a * 3 + 2)); }
    R += protr(a, t) + ledge(a, t);
    R *= 1 + 0.07 * fbm(Math.cos(a) * 1.5, t * 0.9, Math.sin(a) * 1.5 + seed, 2);       // ondulazioni lunghe, verticali
    for (const [ca, dep, w] of cracks) { const d = wrap(a - ca - 0.08 * Math.sin(t * 3 + ca)); R *= 1 - (dep + 0.18) * Math.max(0, 1 - Math.abs(d) / (w * 0.8)) * smooth(0.04, 0.12, t); }   // fessure lunghe che scendono per tutto il fusto
    for (const ca of CL) { const d = Math.abs(wrap(a - ca - 0.05 * Math.sin(t * 4))); R *= 1 - 0.55 * Math.max(0, 1 - d / 0.16) * smooth(PT0 - 0.06, PT0 + 0.04, t) * (1 - smooth(PT1 + 0.02, PT1 + 0.08, t)); }
    // cima spaccata: UNA frattura naturale, asimmetrica (piu' larga da un lato), che scende obliqua
    if (t > 0.74) { const k2 = smooth(0.74, 0.98, t), d = wrap(a - 2.15 - 0.4 * (t - 0.74)), w = d > 0 ? 0.36 : 0.18;
      R *= 1 - 0.78 * Math.max(0, 1 - Math.abs(d) / w) * k2; }
    let y = base + t * H;
    if (v === 1) y += 12 * Math.pow(Math.max(0, Math.cos(a - 0.9)), 3) + 13 * Math.pow(Math.max(0, Math.cos(a - 2.9)), 6) + 6 * Math.pow(Math.max(0, Math.cos(a - 4.4)), 6) + 3 * tri(a * 5 + 1) - 6 + r.range(-1, 1);   // v5s27m: punte irregolari, una piu' alta
    else if (v > 0.9) y += (v - 0.9) * 10 * (8 * Math.pow(Math.max(0, Math.cos(a - 0.9)), 3) + 9 * Math.pow(Math.max(0, Math.cos(a - 2.9)), 6) + 4 * Math.pow(Math.max(0, Math.cos(a - 4.4)), 6));
    else if (v > 0) y += r.range(-0.3, 0.3) * (H / NV);
    if (v > 0.86) { const d = wrap(a - 2.15 - 0.4 * (t - 0.74)), w = d > 0 ? 0.5 : 0.25; y -= 16 * smooth(0.86, 1, v) * Math.max(0, 1 - Math.abs(d) / w); }   // v5s27m: la frattura apre la cima in due punte diseguali
    const off = t >= 0.5 ? 1.0 * (t - 0.5) / 0.5 : 0;
    const fl = v === 1 ? 0.45 : 1;
    let x = Math.cos(a) * R * fl + off, z = Math.sin(a) * R * 0.86 * fl;
    x += noise3(x / 10, y / 40, z / 10) * 1.3; z += noise3(z / 10 + 7, y / 40, x / 10) * 1.3;   // v5s27m: deformazioni allungate in verticale      // spostamenti ampi: cambia davvero il contorno
    if (v === 0) y = base - 3;
    return [x, y, z];
  };
  // griglia condivisa: la cucitura (u=0 e u=1) usa gli stessi vertici, cosi' la superficie e' chiusa e continua
  const G2 = []; for (let j = 0; j <= NV; j++) { const row = []; for (let i = 0; i < NR; i++) row.push(P(i / NR, j / NV)); row.push(row[0]); G2.push(row); }
  const pos = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NR; i++) {
    const a = G2[j][i], b = G2[j][i + 1], c = G2[j + 1][i + 1], d = G2[j + 1][i];
    pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  }
  { const top = G2[NV], cx = top.slice(0, NR).reduce((s, p) => s + p[0], 0) / NR, cz = top.slice(0, NR).reduce((s, p) => s + p[2], 0) / NR, cy = Math.max(...top.map((p) => p[1])) + 0.8;
    for (let i = 0; i < NR; i++) pos.push(...top[i], cx, cy, cz, ...top[i + 1]); }   // chiusura in cima
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // colore per faccia: grigio e bruno caldo, ombra nelle fessure, un po' di verde scuro al piede
  const pal = ['#bdb2a1', '#c9bca6', '#b3a898', '#d2c2a6', '#c2ae92', '#ab9f90', '#d6c9b1', '#b8a38a'];   // v5s27k: piu' chiara e calda
  const col = [], pa = g.attributes.position, nrm = g.attributes.normal;
  for (let f = 0; f < pa.count; f += 3) {
    const x = (pa.getX(f) + pa.getX(f + 1) + pa.getX(f + 2)) / 3, y = (pa.getY(f) + pa.getY(f + 1) + pa.getY(f + 2)) / 3, z = (pa.getZ(f) + pa.getZ(f + 1) + pa.getZ(f + 2)) / 3;
    const t = (y - base) / H, a = Math.atan2(z / 0.86, x);
    const n = noise3(Math.cos(a) * 1.6, t * 1.2, Math.sin(a) * 1.6) * 0.5 + 0.5;   // v5s27m: colore per lastra (macchie lunghe verticali), poco rumore per faccia
    _c.set(pickN(pal, Math.min(0.999, Math.max(0, n * 0.85 + r() * 0.15))));
    let cr = 1; for (const [ca, dep, w] of cracks) { const d = Math.abs(wrap(a - ca - 0.08 * Math.sin(t * 3 + ca))); if (d < w * 0.8) cr = Math.min(cr, 0.32 + d / w * 0.8); }
    if (t > PT0 - 0.04 && t < PT1 + 0.06) for (const ca of CL) { const d = Math.abs(wrap(a - ca)); if (d < 0.16) cr = Math.min(cr, 0.28 + d / 0.16 * 0.72); }   // fenditura in ombra
    if (t > 0.76) { const d = wrap(a - 2.15 - 0.4 * (t - 0.74)); if (Math.abs(d) < 0.35) cr = Math.min(cr, 0.3 + Math.abs(d) / 0.35 * 0.7); }
    _c.multiplyScalar(cr);
    const up = nrm.getY(f); if (up > 0.6 && t > 0.1) _c.lerp(_c2.set('#8a8a5a'), 0.3);    // cenge un po' verdastre
    if (t < 0.08) _c.lerp(_c2.set('#5d5a40'), 0.4 * (1 - t / 0.08));
    for (let q = 0; q < 3; q++) col.push(_c.r, _c.g, _c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  addColored(k, g);
  // v5s27m: cespugli low-poly veri: grappoli di 4-7 chiome sfaccettate, taglie diverse, ombra sotto e luce sopra
  const leaf = ['#4f7a2a', '#5f8a30', '#3f6a26', '#6b9a38', '#7aa83c', '#8fb447'];
  const shrub = (x, y, z, s) => { const n = 4 + Math.floor(r() * 4);
    for (let q = 0; q < n; q++) { const qa = r() * Math.PI * 2, qr = s * r.range(0.2, 0.75), qs = s * r.range(0.45, 0.8), up = q === 0 ? 0.2 : r.range(0, 0.8);
      k.add(G.ico(qs, 0), leaf[Math.min(5, Math.floor(up * 3 + r() * 3))], { x: x + Math.cos(qa) * qr, y: y + s * up * 0.7, z: z + Math.sin(qa) * qr, flat: true, sy: r.range(0.7, 0.95), vary: 0.15 }); } };
  const at = (t, a, f = 0.92) => { const j = Math.min(NV, Math.round(t * NV)), i = Math.round(((a / (Math.PI * 2)) % 1 + 1) % 1 * NR) % NR, p = G2[j][i]; return [p[0] * f, p[1], p[2] * f]; };
  for (let q = 0; q < 9; q++) { const [x, y, z] = at(PT1 - 0.02 + r.range(-0.01, 0.02), SHA + r.range(-0.7, 0.7), r.range(0.75, 0.95)); shrub(x, y + 2, z, r.range(4.5, 7.5)); }   // sulla massa di sinistra
  for (let q = 0; q < 7; q++) { const [x, y, z] = at(r.range(0.5, 0.82), CL[q % 2] + r.range(-0.08, 0.08), 0.96); shrub(x, y, z, r.range(2.8, 4.6)); }       // nella fenditura
  for (let q = 0; q < 10; q++) { const [x, y, z] = at(LT + 0.01 + r.range(-0.02, 0.03), SHA - 1.3 + r.range(-1.2, 1.2), r.range(0.8, 0.98)); shrub(x, y + 1.5, z, r.range(3.5, 6)); }   // cengia di mezzo
  for (let q = 0; q < 6; q++) { const c = cracks[q % cracks.length]; const [x, y, z] = at(r.range(0.3, 0.8), c[0], 0.95); shrub(x, y, z, r.range(2.2, 3.6)); }   // alcune fessure
  for (let q = 0; q < 4; q++) { const [x, y, z] = at(r.range(0.8, 0.9), 2.15 + r.range(-0.3, 0.4), 0.9); shrub(x, y, z, r.range(2.5, 4)); }    // nella frattura della cima
  for (let q = 0; q < 12; q++) { const a = r() * Math.PI * 2, rr = r.range(9, 15); addRock(k, r, Math.cos(a) * rr, base + 16 + r.range(-2, 2), Math.sin(a) * rr * 0.86, r.range(2.5, 4.5), ['#9a9083', '#8f877c', '#a49a8c', '#8a7a66'], { squash: 0.75, tilt: true }); }   // massi del piede, appoggiati
  for (let q = 0; q < 6; q++) { const [x, y, z] = at(r.range(0.1, 0.16), r() * Math.PI * 2, 1.0); shrub(x, y, z, r.range(2.5, 4.5)); }
  // pendio al piede: macchia bassa (la roccia si fonde col terreno)
  for (let q = 0; q < 26; q++) { const a = r() * Math.PI * 2, rr = r.range(14, 24); k.add(G.ico(r.range(1.8, 3.4), 0), r.pick(['#2c4626', '#36522c', '#3f5e30', '#4a6a36']), { x: Math.cos(a) * rr, y: base + r.range(1, 6), z: Math.sin(a) * rr, flat: true, sy: 0.8, vary: 0.2 }); }
  return k.build();
}
// ------------------------------------------------------------------ cascatelle e gocciolamenti (materiale animato a parte)
export function waterfallGeometry(h, w) {
  const g = new THREE.PlaneGeometry(w, h, 1, 6); g.translate(0, -h / 2, 0); return g;
}

// v5s33: albero tondo leggero per i piani lontani (chioma di icosaedri semplici: ~1/4 dei triangoli di tree())
function lowTree(k, r, x, y, z, s = 1, leaf = LEAF.fresh) {
  const h = s * r.range(2.4, 3.4);
  k.add(G.cyl(0.14 * s, 0.24 * s, h, 5), '#5a4430', { x, y: y + h / 2, z, flat: true });
  for (let i = 0; i < 4; i++) k.add(G.ico(s * r.range(1.0, 1.6), 0), r.pick(leaf), { x: x + r.range(-0.9, 0.9) * s, y: y + h + r.range(-0.2, 1.2) * s, z: z + r.range(-0.9, 0.9) * s, flat: true, vary: 0.25, sy: 0.85 });
}
// ------------------------------------------------------------------ v5s32: Sa Stiddiosa, sponda sinistra (target)
// muretto basso di pietra sul bordo del sentiero, sponda rocciosa che scende nel fiume, massi tondi muschiati
// nell'acqua, ogni tanto un grande albero sulla riva vicina, riva lontana bassa e boscosa
export function stiddiosaBankPiece(W0, len, o = {}) {
  const r = rng((Math.floor(W0 * 23) ^ 91) >>> 0);
  const k = new Kit(Math.floor(W0) + 32);
  const CL = o.farX ?? -22;
  dryWall(k, r, 0.95, 0, len, 0.62, ['#8a8478', '#9a9486', '#7a766a', '#a8a292', '#878f74'], 0.6);
  for (let z = -r() * 3; z > -len; z -= r.range(2.5, 5)) k.add(G.box(0.7, 0.08, r.range(0.4, 0.9)), r.pick(['#5f7a30', '#6f8a3a', '#4f6a2a']), { x: 0.95, y: 0.72, z, vary: 0.2 });   // muschio sul colmo
  // sponda: dal piede del muretto giu' nell'acqua
  addColored(k, gridSurface(Math.max(2, Math.ceil(len / 1.5)), 3, (u, v) => { const W = W0 + u * len; return [0.66 - v * 1.4 + noise3(W / 2.3, v * 3, 5) * 0.25 * v, 0.02 - v * 1.5, -u * len]; },
    (x, y, z) => pickN(['#6e6a5c', '#7c776a', '#5f6a3e', '#8a857a'], noise3((W0 - z) / 1.7, y * 2, 3) * 0.5 + 0.5)));
  // letto del fiume (si vede sotto l'acqua bassa vicino alla riva)
  addColored(k, gridSurface(Math.max(2, Math.ceil(len / 3)), 6, (u, v) => { const W = W0 + u * len; return [-0.6 + v * (CL + 0.6), -1.3 - Math.pow(v, 0.6) * 1.6 + noise3(W / 4, v * 5, 9) * 0.15, -u * len]; },
    (x, y, z) => { const t = Math.min(1, (-0.6 - x) / (-0.6 - CL)); _c.set('#5a7a5a').lerp(_c2.set('#1e5a4c'), Math.min(1, t * 2.2)).lerp(_c2.set('#0c3a34'), Math.max(0, t * 1.5 - 0.5)); return _c.getHex(); }));
  // massi tondi muschiati nel fiume
  const rc = ['#8a877c', '#9a968a', '#7a786e', '#a8a496', '#6f7a5a'];
  for (let i = 0; i < len * 0.42; i++) { const v = Math.pow(r(), 1.6), x = -0.9 - v * 15, s = r.range(0.35, 1.0) * (1 + v * 0.8);
    addRock(k, r, x, -0.45 - v * 0.4, -r() * len, s, rc, { squash: 0.58, rough: 0.18, detail: s > 0.8 ? 1 : 0 });
    if (r.chance(0.4)) k.add(G.ico(s * 0.75, 0), r.pick(['#5a7a30', '#6a8a3a', '#4e6a2a']), { x, y: -0.45 - v * 0.4 + s * 0.42, z: -r() * len, sy: 0.32, vary: 0.15 }); }
  // grande albero sulla riva vicina (ogni tanto), radici sul masso
  if (o.bigTree ?? r.chance(0.34)) { const z = -r.range(1, len - 1); addRock(k, r, -1.6, -0.6, z, 1.3, rc, { squash: 0.6, rough: 0.2, detail: 1 }); tree(k, r, -1.7, 0.1, z, r.range(2.2, 2.7), LEAF.fresh); }
  // riva lontana: bassa, boscosa (alberi tondi), qualche masso
  addColored(k, gridSurface(Math.max(2, Math.ceil(len / 2)), 4, (u, v) => { const W = W0 + u * len; return [CL - v * 8 - (v > 0.7 ? 6 : 0), -1.5 + v * (3.2 + 2.5 * (fbm(W / 30, 3, 1, 2) + 0.5)), -u * len]; },
    (x, y, z) => pickN(['#4f6a2a', '#5f7a30', '#6a7a3a', '#7a7a5a', '#8a8470'], noise3((W0 - z) / 3, y / 2, 4) * 0.5 + 0.5)));
  for (let z = -r() * 4; z > -len; z -= r.range(5, 8)) { const W = W0 - z; lowTree(k, r, CL - r.range(5, 12), 1.7 + 2.5 * (fbm(W / 30, 3, 1, 2) + 0.5), z, r.range(1.4, 2.1), LEAF.fresh); }
  return k.build({ ao: 0.15 });
}

// ------------------------------------------------------------------ v5s28: Sa Stiddiosa
// Parete enorme a strati (cenge che sporgono verso la via, rientranze scure sotto), tende di felci e muschio
// che pendono dalle cenge (fronde allungate, non cespugli tondi), rocce bagnate scure dove cadono le cascatelle.
// Costruita a sinistra (x<0, x=0 = bordo del sentiero), specchiata a destra da sidePiece.
export const STIDDIOSA_CLIFF = { BH: 8, FOOT: 0.55, LEAN: 6.5, LEAN_Y0: 8, H0: 41 };   // v5s32: piede a ~6.4 m dal centro, 40-45 m, sbalzo 6.5 m solo sopra 8 m
// profilo della parete (coordinate del pezzo: x=0 facciata, +x verso la via). Condiviso con le tende di felci della piscina.
export function stiddiosaProfile(sd = 28, falls = [], back = 0) {
  const { BH, FOOT, LEAN, LEAN_Y0, H0 } = STIDDIOSA_CLIFF;
  const Hf = (W) => H0 + 4 * fbm(W / 50, sd, 0.4, 2);
  const wet = (W) => { let m = 0; for (const fw of falls) m = Math.max(m, 1 - Math.abs(W - fw) / 3.4); m = Math.max(0, m); return m * m * (3 - 2 * m); };
  const band = (W, y) => { const yy = y + 3.5 * fbm(W / 14, sd + 1, 0.3, 2); const b = Math.floor(yy / BH); return { b, t: yy / BH - b }; };
  const X = (W, y) => {
    const { b, t } = band(W, y), w = wet(W);
    const mass = 0.35 + 0.65 * (noise3(W / 5, b * 1.7, sd + 4) * 0.5 + 0.5);         // masse tondeggianti a blocchi, non fasce continue
    const bulge = (Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.55) - 0.5) * 2.2 * mass;   // cuscino tondo per cengia, piega scura tra le cenge
    const lump = 1.2 * noise3(W / 6, y / 5, sd) + 0.5 * noise3(W / 2.2, y / 2.0, sd + 7);
    const yl = Math.max(0, Math.min(1, (y - LEAN_Y0) / 30)), over = LEAN * yl * yl * (3 - 2 * yl) * (1 - 0.85 * w);
    let x = FOOT + bulge + lump + over - 1.6 * w - back - (back ? 1.5 * w : 0);
    if (y < 3.5) x = Math.min(x, 1.0);                                                  // mai dentro la via sotto i 3 m (bordo via: x = 1.45)
    return x;
  };
  return { Hf, wet, band, X };
}
// griglia con normali morbide (masse arrotondate invece delle sfaccettature)
function smoothGrid(nu, nv, f, col) {
  const P = []; for (let j = 0; j <= nv; j++) { const row = []; for (let i = 0; i <= nu; i++) row.push(new THREE.Vector3(...f(i / nu, j / nv))); P.push(row); }
  const N = P.map((row, j) => row.map((p, i) => { const a = P[j][Math.min(nu, i + 1)].clone().sub(P[j][Math.max(0, i - 1)]), b = P[Math.min(nv, j + 1)][i].clone().sub(P[Math.max(0, j - 1)][i]); return a.cross(b).normalize(); }));
  const pos = [], nor = [], cols = [];
  const push = (j, i) => { const p = P[j][i], n = N[j][i]; pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); _c.set(col(p.x, p.y, p.z, n)); cols.push(_c.r, _c.g, _c.b); };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { push(j, i); push(j, i + 1); push(j + 1, i + 1); push(j, i); push(j + 1, i + 1); push(j + 1, i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}
export function stiddiosaCliffPiece(W0, len, o = {}) {
  const sd = o.seed || 28, r = rng((Math.floor(W0 * 11) ^ sd) >>> 0);
  const k = new Kit(Math.floor(W0) + 28);
  const B = !!o.backing;                                                              // v5s33: dietro i moduli 3D basta una parete semplice, un po' arretrata
  const { Hf, wet, band, X } = stiddiosaProfile(sd, o.falls || [], B ? 2.5 : 0);
  const nu = Math.max(2, Math.ceil(len / (B ? 2.2 : 1.1))), nv = B ? 16 : 46;
  const rockPal = ['#9a9080', '#aaa08c', '#887e70', '#b4aa96', '#786e62', '#a09682'];
  const g = smoothGrid(nu, nv, (u, v) => {
    const W = W0 + u * len, H = Hf(W), y = v * H;
    return [v === 1 ? X(W, y) - 4 : X(W, y), v === 1 ? H + 0.5 : y, -u * len];
  }, (x, y, z, n) => {
    const W = W0 - z, { t } = band(W, y), nn = fbm(W / 8, y / 5, sd + 5, 2) * 0.5 + 0.5;
    _c.set(pickN(rockPal, nn));
    const up = Math.max(0, n.y);                                                        // facce rivolte in alto: muschio e luce calda
    _c.lerp(_c2.set('#2a241e'), Math.pow(1 - Math.sin(Math.PI * t), 2.2) * (t < 0.5 ? 0.7 : 0.35));   // pieghe scure tra le masse
    if (up > 0.22 && noise3(W / 4, y / 3, sd + 8) > -0.35) _c.lerp(_c2.set(pickN(['#4f7a2e', '#5f8a34', '#3f6a26'], nn)), Math.min(0.9, (up - 0.22) * 2.5));
    else if (noise3(W / 3, y / 2.5, sd + 12) > 0.45) _c.lerp(_c2.set('#56703a'), 0.45);   // macchie di muschio sulle pareti
    else if (n.y < -0.3) _c.multiplyScalar(0.72);                                       // sotto le sporgenze
    const w = wet(W); if (w > 0) _c.lerp(_c2.set('#34342c'), w * 0.6);
    return _c.getHex();
  });
  addColored(k, g);
  const BH = STIDDIOSA_CLIFF.BH;   // v5s33: le tende di felci sono carte (stiddiosa3d.js), appese nel monumento della piscina
  // cuscini di muschio tondi sopra le masse (normali morbide)
  if (!B) for (let y = BH * 0.75; y < 40; y += BH) for (let z = -r() * 2; z > -len; z -= r.range(1.8, 3.2)) {
    const W = W0 - z; if (y > Hf(W) - 1 || wet(W) > 0.3 || noise3(W / 6, y / 7, sd + 21) < -0.2) continue;
    k.add(G.ico(r.range(0.7, 1.3), 0), r.pick(['#4f7a2e', '#5f8a34', '#3f6a26', '#6a9a3a']), { x: X(W, y) - 0.4, y: y + 0.2, z, sy: 0.55, sx: 1.2, vary: 0.15 });
  }
  // piede: massi grigi tondi e felci sul bordo della via (mai dentro la via sotto i 3 m)
  for (let z = -r() * 2; z > -len; z -= r.range(1.6, 3.4)) {
    const s = r.range(0.45, 1.0), x = Math.min(1.45 - 1.3 * s, X(W0 - z, 0.5) + 0.2);
    addRock(k, r, x, 0.05, z, s, ['#8a877c', '#9a968a', '#7a786e', '#6f7a5a'], { squash: 0.75, rough: 0.2, detail: 1 });
  }
  for (let z = -r() * 2; z > -len; z -= r.range(1.3, 2.6)) fern(k, r, r.range(-0.45, 0.05), 0, z, r.range(0.6, 0.8));
  // alberi tondi in cima
  for (let z = -r() * 3; z > -len; z -= r.range(4.5, 7) * (B ? 1.4 : 1)) { const W = W0 - z; lowTree(k, r, X(W, Hf(W)) - r.range(3, 8), Hf(W) + 0.3, z, r.range(1.5, 2.1), LEAF.fresh); }
  return k.build({ ao: 0.3 });
}
