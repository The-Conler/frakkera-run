// v5s39: conta alberi/cespugli del paese che intersecano impronte case (stesso schema di env.js).
import * as common from '../src/game/biomes/builders/common.js';
import * as M from '../src/game/models.js';
import { byId } from '../src/game/biomes/config.js';
import * as N from '../src/game/biomes/builders/nature.js';
import * as THREE from 'three';

const FACADE = 11 / 2 + 1.45;
const V = byId.village;
const APPLY = process.argv.includes('--apply'); // usa footprints come in produzione
const MARGIN = 1.25;

function houseFoot(s, W0, w, margin = MARGIN) {
  return { s, minW: W0 - margin, maxW: W0 + w + margin, minX: -8.2 - margin * 0.25, maxX: 1.0 + margin * 0.25 };
}

// replica densita' slopePiece (posizioni tronco/cespuglio) rispettando footprints se APPLY
function slopePlants(W0, len, o, side) {
  const r = common.rng((Math.floor(W0 * 13) ^ (o.seed || 3)) >>> 0);
  const Hs = o.Hs ?? 10, D = o.dist ?? 32, sd = o.seed || 3;
  const dens = o.trees ?? 0.25;
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
  const hAt = (x, W) => {
    const t = Math.max(0, -x) / D;
    return Math.pow(t, 1.3) * Hs + (common.fbm(W / 12, x / 9, sd, 2) * 0.5 + 0.2) * 2.2 * Math.min(1, t * 4);
  };
  const out = [];
  const toW = (lx, lz) => {
    const sx = side < 0 ? 1 : -1;
    return { worldX: side * FACADE + sx * lx, worldZ: -W0 + lz, lx, lz };
  };
  for (let i = 0; i < Math.round(len * dens); i++) {
    let placed = false;
    for (let t = 0; t < 10 && !placed; t++) {
      const zl = -r() * len, x = -r.range(3.5, D * 0.95);
      if (APPLY && hitsFoot(x, zl, 1.5 * 1.85)) continue;
      const isCyp = !!(o.conifers && r.chance(0.25));
      const s = isCyp ? r.range(0.8, 1.1) : r.range(1.1, 1.8);
      if (!isCyp) r.chance(0.5);
      out.push({ kind: isCyp ? 'cypress' : 'tree', s, side, W0, tag: o._tag || 'slope', ...toW(x, zl) });
      placed = true;
    }
  }
  for (let i = 0; i < Math.round(len * 0.4); i++) {
    let placed = false;
    for (let t = 0; t < 8 && !placed; t++) {
      const zl = -r() * len, x = -r.range(0, 4);
      const s = r.range(0.5, 0.9);
      if (APPLY && hitsFoot(x, zl, s * 1.7)) continue;
      out.push({ kind: 'shrub', s, side, W0, tag: (o._tag || 'slope') + '-shrub', ...toW(x, zl) });
      placed = true;
    }
  }
  return out;
}

function plantRad(p) {
  if (p.kind === 'tree') return p.s * 1.5;
  if (p.kind === 'cypress') return 0.9 * p.s;
  return p.s * 1.3;
}

function overlapsFoot(p, f) {
  const W = p.W0 - p.lz; // = -worldZ along road... wait: worldZ = -W0 + lz => W_abs = W0 - lz
  const rad = plantRad(p);
  const Wa = p.W0 - p.lz;
  if (Wa + rad < f.minW || Wa - rad > f.maxW) return false;
  if (p.lx + rad < f.minX || p.lx - rad > f.maxX) return false;
  return true;
}

function simulate(lap = 0) {
  const feet = [];
  const plants = [];
  for (const side of [-1, 1]) {
    const r = common.rng(side > 0 ? 71 : 37);
    // advance rng by lap? sides keep same seed across rebuilds; lap changes via i.lap in seed:40+lap only
    const gaps = (side < 0 ? V.gaps.left : V.gaps.right) || [];
    let cur = 0, guard = 0;
    while (cur < 250 && guard++ < 300) {
      const loc = cur;
      let skip = 0, gapA = null, gapZ = null;
      for (const [a, z] of gaps) if (loc >= a - 0.01 && loc < z) { skip = z - loc; gapA = a; gapZ = z; }
      if (skip > 0 && side < 0 && gapA != null && gapA < 80) {
        const w = Math.min(skip, Math.max(4, Math.min(10, 250 - cur)));
        const fp = feet.filter((f) => f.s === side && f.maxW >= cur - 8 && f.minW <= cur + w + 8)
          .map((f) => ({ minW: f.minW, maxW: f.maxW, minX: f.minX, maxX: f.maxX }));
        if (APPLY) {
          fp.push({ minW: gapA - 14, maxW: gapA + 3.5, minX: -8.5, maxX: 1.2 });
          fp.push({ minW: gapZ - 3.5, maxW: gapZ + 14, minX: -8.5, maxX: 1.2 });
        }
        plants.push(...slopePlants(cur, w, {
          Hs: 22, dist: 70, trees: 0.22, seed: 77 + Math.floor(cur), flowers: 0.1,
          footprints: APPLY ? fp : [], _tag: 'gap-hillside',
        }, side));
        cur += w; continue;
      }
      if (skip > 0) { cur += skip; continue; }
      let lim = 250 - cur;
      for (const [a] of gaps) if (a > loc) lim = Math.min(lim, a - loc);
      const nearEnd = loc > 250 - 32;
      if (nearEnd || lim < 5.1) {
        const w = Math.max(1.5, Math.min(lim, r.range(5, 9)));
        const fp = feet.filter((f) => f.s === side && f.maxW >= cur - 6 && f.minW <= cur + w + 6)
          .map((f) => ({ minW: f.minW, maxW: f.maxW, minX: f.minX, maxX: f.maxX }));
        plants.push(...slopePlants(cur, w, {
          Hs: 3, dist: 16, trees: 0.25, seed: 40 + lap, flowers: 0.3,
          footprints: APPLY ? fp : [], _tag: 'near-end',
        }, side));
        cur += w; continue;
      }
      const garden = r.chance(0.14);
      const idx = r.int(garden ? 5 : 26);
      const pf = garden ? M.buildGarden(idx + 1) : M.buildHouse(idx + 1);
      if (pf.w > lim) {
        const w = Math.min(lim, 6);
        const fp = feet.filter((f) => f.s === side && f.maxW >= cur - 6 && f.minW <= cur + w + 6)
          .map((f) => ({ minW: f.minW, maxW: f.maxW, minX: f.minX, maxX: f.maxX }));
        plants.push(...slopePlants(cur, w, {
          Hs: 2, dist: 12, trees: 0.2, seed: 3,
          footprints: APPLY ? fp : [], _tag: 'fit-slope',
        }, side));
        cur += w; continue;
      }
      if (!garden) feet.push(houseFoot(side, cur, pf.w));
      else {
        // giardino: tronco al centro; con APPLY la chioma e' clampata nel prefab (non si conta overlap AABB ampio)
        const sx = side < 0 ? 1 : -1;
        const lx = -1.6, lz = -pf.w / 2;
        const gHalf = pf.w / 2;
        const gRad = APPLY ? Math.max(0.2, gHalf - 1.35) : 2.4;
        plants.push({
          kind: 'tree', s: gRad / 1.5, tag: 'garden', side, W0: cur, lx, lz,
          worldX: side * FACADE + sx * lx, worldZ: -cur + lz,
        });
      }
      cur += pf.w;
    }
  }
  let overlaps = 0;
  const samples = [];
  for (const p of plants) {
    for (const f of feet) {
      if (f.s !== p.side) continue;
      if (overlapsFoot(p, f)) {
        overlaps++;
        if (samples.length < 12) samples.push({ tag: p.tag, kind: p.kind, side: p.side, W0: +p.W0.toFixed(1), lx: +p.lx.toFixed(1), lz: +p.lz.toFixed(1), footW: +f.minW.toFixed(1) });
        break;
      }
    }
  }
  return { houses: feet.length, plants: plants.length, overlaps, samples, apply: APPLY };
}

const laps = [0, 1, 2].map((lap) => ({ lap, ...simulate(lap) }));
const total = laps.reduce((a, x) => a + x.overlaps, 0);
console.log(JSON.stringify({ totalOverlaps: total, laps }, null, 2));
process.exit(total === 0 && APPLY ? 0 : (APPLY ? 1 : 0));
