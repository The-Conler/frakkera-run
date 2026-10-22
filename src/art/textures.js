// =====================================================================
// Pixel art generata via codice (canvas 2D) all'avvio: zero file immagine
// da scaricare, caricamento istantaneo, stile coerente.
// =====================================================================
import { P } from './palette.js';
import { makeRng } from '../systems/rng.js';
import { WORLD } from '../config.js';
import { buildV2Textures } from './textures2.js';

export function canvasTex(scene, key, w, h, frames = 1) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * frames, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return { tex, ctx };
}
export function finishFrames(tex, w, h, frames, line) {
  if (line) for (let i = 0; i < frames; i++) outline(tex.getContext(), i * w, w, h, line);
  for (let i = 0; i < frames; i++) tex.add(i, 0, i * w, 0, w, h);
  tex.refresh();
}
export const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
export const D = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
// ellisse piena pixel-perfect
export function ell(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

// --------------------------------------------------------------------
// Acciottolato (tile 32x32, ripetibile): ciottoli arrotondati irregolari
export const COBBLE_H = 30;
function cobbles(scene) {
  const S = 32, SH = COBBLE_H;
  const { tex, ctx } = canvasTex(scene, 'cobble', S, SH);
  const rng = makeRng(77);
  R(ctx, 0, 0, S, SH, '#111017');
  for (let row = 0; row < 6; row++) {
    const y = row * 5 + 2;
    const off = row % 2 ? 2.7 : 0;
    for (let col = 0; col < 6; col++) {
      const x = off + col * 5.35 + rng() * 0.8;
      const rx = 2;
      const base = rng.pick([P.stone2, P.stone2, P.stone3, P.warm1, P.stone1, P.stone3, P.warm2]);
      const hi = base === P.stone3 ? P.stone4 : P.stone3;
      const ry = rng() < 0.6 ? 2 : 1;
      for (const ox of [0, -S, S]) for (const oy of [0, -SH, SH]) {
        const cx = Math.round(x + ox), cy = y + oy;
        ell(ctx, cx, cy, rx, ry, base);
        R(ctx, cx - 1, cy - ry, 2, 1, hi);
        D(ctx, cx - 1, cy - ry, rng() < 0.35 ? P.stone5 : hi);
        R(ctx, cx - 1, cy + ry, 3, 1, P.stone1);
      }
    }
  }
  for (let i = 0; i < 6; i++) D(ctx, rng.int(0, S - 1), rng.int(0, SH - 1), rng() < 0.5 ? P.weed : P.weed2);
  tex.refresh();
}

// contorno scuro di 1px attorno ai pixel opachi (leggibilita' su fondo scuro)
export function outline(ctx, x0, w, h, color = '#0b0810') {
  const img = ctx.getImageData(x0, 0, w, h);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img.data[(y * w + x) * 4 + 3]);
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a(x, y) > 0) continue;
    if (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128) out.push([x, y]);
  }
  ctx.fillStyle = color;
  out.forEach(([x, y]) => ctx.fillRect(x0 + x, y, 1, 1));
}

// bordo della strada (canaletta di pietra) 8x32
function curb(scene) {
  const { tex, ctx } = canvasTex(scene, 'curb', 6, 32);
  R(ctx, 0, 0, 6, 32, P.stone1);
  for (let y = 0; y < 32; y += 8) {
    R(ctx, 0, y + 1, 6, 7, P.stone3);
    R(ctx, 0, y + 1, 6, 1, P.stone4);
    R(ctx, 0, y + 7, 6, 1, P.stone0);
  }
  tex.refresh();
}

// --------------------------------------------------------------------
// Case laterali. Facciata obliqua (verso la strada) + tetto in coppi.
export const HOUSE_FACADE = 13;
function stoneWall(ctx, x0, y0, w, h, rng, plaster) {
  R(ctx, x0, y0, w, h, plaster ? P.warm1 : P.stone1);
  if (plaster) {
    for (let i = 0; i < (w * h) / 10; i++) D(ctx, x0 + rng.int(0, w - 1), y0 + rng.int(0, h - 1), rng() < 0.5 ? P.warm2 : P.warm0);
    // intonaco scrostato: pietre a vista
    for (let i = 0; i < 2; i++) {
      const px = x0 + rng.int(0, Math.max(0, w - 4)), py = y0 + rng.int(0, Math.max(0, h - 5));
      R(ctx, px, py, 3, 2, P.stone3); R(ctx, px + 1, py + 2, 3, 2, P.stone2);
    }
    return;
  }
  let y = y0;
  let row = 0;
  while (y < y0 + h) {
    const sh = 3 + rng.int(0, 1);
    let x = x0 - (row % 2 ? 2 : 0);
    while (x < x0 + w) {
      const sw = 3 + rng.int(0, 3);
      const c = rng.pick([P.stone2, P.stone3, P.stone2, P.warm1, P.stone3]);
      const xa = Math.max(x0, x + 1), xb = Math.min(x0 + w, x + sw);
      const yb = Math.min(y0 + h, y + sh);
      if (xb > xa && yb > y + 1) {
        R(ctx, xa, y + 1, xb - xa, yb - y - 1, c);
        R(ctx, xa, y + 1, xb - xa, 1, P.stone4);
      }
      x += sw;
    }
    y += sh; row++;
  }
}

function roof(ctx, x0, y0, w, h, side, rng, kind) {
  const base = kind === 0 ? [P.roof1, P.roof2] : kind === 1 ? [P.roof0, P.roof1] : [P.stone1, P.stone2];
  R(ctx, x0, y0, w, h, base[0]);
  // coppi: righe orizzontali (dalla gronda al colmo)
  for (let y = y0; y < y0 + h; y += 3) {
    R(ctx, x0, y, w, 2, base[1]);
    R(ctx, x0, y, w, 1, kind === 2 ? P.stone3 : P.roof3);
    // giunzioni sfalsate
    for (let x = x0 + ((y / 3) % 2 ? 2 : 0); x < x0 + w; x += 5) D(ctx, x, y + 1, base[0]);
  }
  // colmo
  const rx = side < 0 ? x0 + 2 : x0 + w - 3;
  R(ctx, rx, y0, 1, h, P.ink);
  // muschio / coppi rotti
  for (let i = 0; i < 3; i++) D(ctx, x0 + rng.int(0, w - 1), y0 + rng.int(0, h - 1), rng() < 0.5 ? P.weed2 : P.roof4);
  // bordi tra case
  R(ctx, x0, y0, w, 1, P.ink);
  R(ctx, x0, y0 + h - 1, w, 1, P.ink);
}

// side: -1 sinistra, +1 destra. Restituisce meta con finestre accese/lampioni.
function house(scene, key, w, h, side, seed) {
  const rng = makeRng(seed);
  const { tex, ctx } = canvasTex(scene, key, w, h);
  const F = HOUSE_FACADE;
  const fx = side < 0 ? w - F : 0;
  const rxo = side < 0 ? 0 : F;
  const plaster = rng() < 0.3;
  stoneWall(ctx, fx, 0, F, h, rng, plaster);
  // ombra della gronda sulla facciata
  R(ctx, side < 0 ? fx : fx + F - 2, 0, 2, h, 'rgba(5,7,15,0.55)');
  roof(ctx, rxo, 0, w - F, h, side, rng, rng.int(0, 2));
  // gronda
  R(ctx, side < 0 ? w - F - 1 : F, 0, 1, h, P.roof0);
  // base del muro
  R(ctx, side < 0 ? w - 1 : 0, 0, 1, h, P.stone0);

  const meta = { windows: [], lamps: [], doors: [] };
  // aperture lungo la facciata
  let y = 4 + rng.int(0, 4);
  while (y < h - 12) {
    const r = rng();
    const ox = side < 0 ? fx + 3 : fx + 3;
    if (r < 0.28) {
      // porta in legno ad arco
      const dh = 14;
      R(ctx, ox - 1, y - 1, 8, dh + 2, P.stone4);
      R(ctx, ox, y, 6, dh, P.wood1);
      for (let i = 1; i < 6; i += 2) R(ctx, ox + i, y + 1, 1, dh - 2, P.wood0);
      R(ctx, ox, y, 6, 1, P.wood2);
      D(ctx, side < 0 ? ox + 1 : ox + 4, y + 7, P.metal2);
      // gradino
      R(ctx, side < 0 ? fx + F - 2 : 0, y + 2, 2, dh - 4, P.stone4);
      meta.doors.push({ x: ox + 3, y: y + dh / 2 });
      y += dh + 6;
    } else if (r < 0.75) {
      // finestra: accesa o con scuri
      const lit = rng() < 0.55;
      R(ctx, ox - 1, y - 1, 7, 10, P.stone5);
      if (lit) {
        R(ctx, ox, y, 5, 8, P.win0);
        R(ctx, ox + 1, y + 1, 3, 6, P.win1);
        R(ctx, ox + 1, y + 2, 2, 3, P.win2);
        R(ctx, ox + 2, y, 1, 8, P.wood0); R(ctx, ox, y + 3, 5, 1, P.wood0); // croce
        meta.windows.push({ x: ox + 2.5, y: y + 4 });
      } else {
        R(ctx, ox, y, 5, 8, P.wood2);
        for (let i = 0; i < 8; i += 2) R(ctx, ox, y + i, 5, 1, P.wood1);
        R(ctx, ox + 2, y, 1, 8, P.wood0);
      }
      // davanzale
      R(ctx, ox - 1, y + 8, 7, 1, P.stone6);
      y += 14 + rng.int(0, 6);
    } else if (r < 0.88) {
      // lanterna da muro
      const lx = side < 0 ? w - 3 : 1;
      R(ctx, lx, y, 2, 1, P.metal);
      R(ctx, lx, y + 1, 2, 3, P.win2); D(ctx, lx, y + 1, P.win1);
      R(ctx, lx, y + 4, 2, 1, P.metal);
      meta.lamps.push({ x: lx + 1, y: y + 2 });
      y += 18;
    } else {
      y += 8;
    }
  }
  tex.refresh();
  return meta;
}

// vicoletto laterale tra due case (scuro, con gradini)
function sideAlley(scene, key, w, h, side) {
  const { tex, ctx } = canvasTex(scene, key, w, h);
  R(ctx, 0, 0, w, h, P.night1);
  for (let y = 2; y < h - 2; y += 4) {
    R(ctx, 0, y, w, 3, P.stone1);
    R(ctx, 0, y, w, 1, P.stone2);
  }
  // muri laterali del vicoletto in prospettiva
  R(ctx, 0, 0, w, 2, P.stone2); R(ctx, 0, h - 2, w, 2, P.stone0);
  const g = ctx.createLinearGradient(side < 0 ? 0 : w, 0, side < 0 ? w : 0, 0);
  g.addColorStop(0, 'rgba(5,7,15,0.9)'); g.addColorStop(1, 'rgba(5,7,15,0.1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  tex.refresh();
}

// --------------------------------------------------------------------
// Personaggio visto da dietro mentre corre verso l'alto (4 frame)
function player(scene) {
  const W = 16, H = 24, N = 4;
  const { tex, ctx } = canvasTex(scene, 'player', W, H, N);
  for (let f = 0; f < N; f++) {
    const o = f * W;
    const bob = f % 2 === 1 ? 1 : 0;
    const legA = f === 0 ? -2 : f === 2 ? 2 : 0; // sinistra avanti/indietro
    // gambe
    const leg = (x, off) => {
      const top = 15 + bob;
      const len = 6 + off;
      R(ctx, o + x, top, 3, Math.max(3, len), P.trou);
      R(ctx, o + x, top + Math.max(3, len) - 2, 3, 2, P.boot);
      if (off > 0) R(ctx, o + x, top + Math.max(3, len) - 1, 3, 1, P.wood3); // suola visibile
    };
    leg(4, legA);
    leg(9, -legA);
    // busto (giacca scura)
    R(ctx, o + 3, 8 + bob, 10, 8, P.coat1);
    R(ctx, o + 4, 8 + bob, 8, 1, P.coat2);
    R(ctx, o + 7, 9 + bob, 1, 6, P.coat0); // cucitura schiena
    R(ctx, o + 3, 15 + bob, 10, 1, P.coat0);
    // sciarpa rosso bruciato
    R(ctx, o + 4, 7 + bob, 8, 2, P.scarf);
    R(ctx, o + 4, 7 + bob, 8, 1, P.scarf2);
    R(ctx, o + 10, 9 + bob, 2, 3, P.scarf);
    // braccio sinistro che oscilla
    const ay = 9 + bob + (f === 0 ? 1 : f === 2 ? -1 : 0);
    R(ctx, o + 1, ay, 2, 5, P.coat1);
    R(ctx, o + 1, ay + 5, 2, 1, P.skin1);
    // braccio destro alzato (regge la frakkera)
    R(ctx, o + 13, 5 + bob, 2, 5, P.coat1);
    R(ctx, o + 13, 4 + bob, 2, 1, P.skin1);
    // testa (capelli da dietro)
    R(ctx, o + 5, 1 + bob, 6, 6, P.hair);
    R(ctx, o + 6, 1 + bob, 4, 1, P.coat2);
    D(ctx, o + 4, 4 + bob, P.skin0); D(ctx, o + 11, 4 + bob, P.skin0); // orecchie
    R(ctx, o + 5, 6 + bob, 6, 1, P.skin0); // collo
    // contorno luce calda sul lato destro (fuoco)
    R(ctx, o + 12, 9 + bob, 1, 6, P.fire1);
    D(ctx, o + 10, 2 + bob, P.fire2);
  }
  finishFrames(tex, W, H, N, '#0b0810');
}

// frakkera: grande fascio di asfodelo/ferula legato con corde
function torch(scene) {
  const W = 8, H = 30;
  const { tex, ctx } = canvasTex(scene, 'torch', W, H);
  for (let x = 1; x < 7; x++) R(ctx, x, 4, 1, H - 6, [P.stalk0, P.stalk1, P.stalk2, P.stalk1, P.stalk2, P.stalk0][x - 1]);
  R(ctx, 0, 3, 8, 9, P.stalk1); // testa piu' larga
  for (let x = 0; x < 8; x++) R(ctx, x, 3, 1, 9, x % 2 ? P.stalk2 : P.stalk0);
  R(ctx, 0, 1, 8, 3, P.ink); D(ctx, 2, 2, P.fire1); D(ctx, 5, 1, P.fire2); D(ctx, 4, 3, P.fire1); // brace
  [12, 18, 24].forEach((y) => { R(ctx, 1, y, 6, 1, P.cord); D(ctx, 6, y + 1, P.cord); });
  R(ctx, 2, H - 2, 4, 2, P.stalk0);
  outline(ctx, 0, W, H);
  tex.refresh();
}

// fiamma animata (6 frame): goccia con lingue mosse dal rumore
function flame(scene) {
  const W = 20, H = 30, N = 6;
  const { tex, ctx } = canvasTex(scene, 'flame', W, H, N);
  const cols = [P.fire0, P.fire1, P.fire2, P.fire3, P.fire4, P.fire5, P.fire6];
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const rgb = cols.map(hex);
  const baseY = H - 7, Rb = 6.2;
  for (let f = 0; f < N; f++) {
    const img = ctx.createImageData(W, H);
    const ph = (f / N) * Math.PI * 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v;
        if (y >= baseY) {
          const dx = x + 0.5 - W / 2, dy = (y + 0.5 - baseY) * 1.25;
          v = 1 - Math.sqrt(dx * dx + dy * dy) / Rb;
        } else {
          const t = Math.min(1, (baseY - y) / (baseY - 1)); // 0..1 verso la punta
          const sway = Math.sin(t * 4.2 + ph) * 2.4 * t + Math.sin(t * 9 - ph * 2) * 0.9 * t;
          const r = Rb * Math.pow(1 - t, 0.75) + 0.3;
          v = 1 - Math.abs(x + 0.5 - W / 2 - sway) / r - t * 0.18;
          // lingue: rumore che "morde" i bordi
          v += Math.sin(x * 1.7 + y * 0.9 + ph * 2) * 0.1 * t;
        }
        if (!(v > 0.02)) continue;
        const ci = Math.min(6, Math.max(0, Math.floor(v * 6.2)));
        const i = (y * W + x) * 4;
        const c = rgb[ci];
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, f * W, 0);
    // fiammelle staccate che salgono
    const tx = f * W + 9 + Math.round(Math.sin(ph * 2) * 3);
    const ty = 4 - (f % 3);
    D(ctx, tx, ty, P.fire3); D(ctx, tx, ty + 1, P.fire2);
    D(ctx, f * W + 12 - (f % 2) * 4, 1 + (f % 2), P.fire2);
  }
  finishFrames(tex, W, H, N);
}

function particles(scene) {
  let t = canvasTex(scene, 'spark', 2, 2);
  R(t.ctx, 0, 0, 2, 2, P.fire4); D(t.ctx, 0, 0, P.fire6); t.tex.refresh();
  t = canvasTex(scene, 'ember', 1, 1); R(t.ctx, 0, 0, 1, 1, P.fire3); t.tex.refresh();
  t = canvasTex(scene, 'smoke', 6, 6);
  ell(t.ctx, 3, 3, 2, 2, 'rgba(90,86,96,0.8)'); R(t.ctx, 2, 2, 2, 2, 'rgba(130,124,130,0.8)'); t.tex.refresh();
  t = canvasTex(scene, 'drop', 2, 2); R(t.ctx, 0, 0, 2, 2, P.water3); t.tex.refresh();
  t = canvasTex(scene, 'pixel', 1, 1); R(t.ctx, 0, 0, 1, 1, '#ffffff'); t.tex.refresh();
  // ombra
  t = canvasTex(scene, 'shadow', 16, 6);
  ell(t.ctx, 8, 3, 7, 2, 'rgba(0,0,0,0.5)'); t.tex.refresh();
  // bagliore morbido (luce)
  const g = canvasTex(scene, 'glow', 64, 64);
  const grd = g.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,190,90,1)');
  grd.addColorStop(0.35, 'rgba(255,140,50,0.45)');
  grd.addColorStop(1, 'rgba(255,110,30,0)');
  g.ctx.fillStyle = grd; g.ctx.fillRect(0, 0, 64, 64); g.tex.refresh();
}

// --------------------------------------------------------------------
// Ostacoli (vista 3/4: faccia superiore + faccia frontale)
function obstacles(scene) {
  // muretto a secco 30x18
  let { tex, ctx } = canvasTex(scene, 'muretto', 30, 18);
  const rng = makeRng(5);
  R(ctx, 0, 0, 30, 18, P.ink);
  R(ctx, 1, 1, 28, 6, P.stone4);
  for (let x = 1; x < 29; x += 4 + rng.int(0, 2)) { R(ctx, x, 1, 1, 6, P.stone3); D(ctx, x + 1, 2, P.stone6); }
  R(ctx, 1, 1, 28, 1, P.stone6);
  stoneWall(ctx, 1, 7, 28, 10, rng, false);
  R(ctx, 1, 7, 28, 1, P.stone0);
  D(ctx, 4, 0, P.weed2); D(ctx, 5, 0, P.weed2); D(ctx, 22, 1, P.weed2); D(ctx, 23, 0, P.weed);
  tex.refresh();

  // pozzanghera 26x13
  ({ tex, ctx } = canvasTex(scene, 'pozza', 26, 13));
  ell(ctx, 13, 6, 12, 5, P.water0);
  ell(ctx, 12, 6, 10, 4, P.water1);
  ell(ctx, 9, 5, 5, 2, P.water2);
  R(ctx, 6, 4, 4, 1, P.water3); R(ctx, 15, 8, 3, 1, P.water2);
  D(ctx, 18, 4, P.fire4); D(ctx, 19, 4, P.fire3); // riflesso del fuoco
  tex.refresh();

  // capra (2 frame), rivolta a destra
  ({ tex, ctx } = canvasTex(scene, 'goat', 20, 16, 2));
  for (let f = 0; f < 2; f++) {
    const o = f * 20;
    // zampe
    const lx = f ? [4, 13] : [6, 11];
    R(ctx, o + lx[0], 10, 2, 5, P.goat0); R(ctx, o + lx[1], 10, 2, 5, P.goat0);
    R(ctx, o + lx[0] + 2 - f * 3, 10, 2, 4, P.goat1); R(ctx, o + lx[1] - 1 + f * 2, 10, 2, 4, P.goat1);
    // corpo
    R(ctx, o + 3, 4, 13, 7, P.ink);
    R(ctx, o + 4, 4, 11, 6, P.goat2);
    R(ctx, o + 4, 4, 11, 2, P.goatW);
    R(ctx, o + 8, 6, 4, 3, P.goatW);
    R(ctx, o + 2, 4, 2, 2, P.goat1); // coda
    // testa
    R(ctx, o + 15, 1, 4, 5, P.goat1);
    R(ctx, o + 15, 1, 4, 1, P.goatW);
    D(ctx, o + 18, 3, P.fire5); // occhio che riflette la fiamma
    R(ctx, o + 14, 0, 1, 2, P.horn); D(ctx, o + 13, 0, P.horn);
    R(ctx, o + 17, 6, 1, 2, P.goatW); // barbetta
  }
  finishFrames(tex, 20, 16, 2, '#0b0810');

}

// vicolo che si stringe: porzione di casa che sporge nella corsia
function narrowTex(scene, key, w, len, side, seed) {
  const rng = makeRng(seed);
  const FH = 10; // faccia frontale
  const h = len + FH;
  const { tex, ctx } = canvasTex(scene, key, w, h);
  const F = 8;
  const fx = side < 0 ? w - F : 0;
  roof(ctx, side < 0 ? 0 : F, 0, w - F, len, side, rng, 1);
  stoneWall(ctx, fx, 0, F, len, rng, false);
  R(ctx, side < 0 ? fx : fx + F - 2, 0, 2, len, 'rgba(5,7,15,0.5)');
  // faccia frontale verso il giocatore
  stoneWall(ctx, 0, len, w, FH, rng, false);
  R(ctx, 0, len, w, 1, P.ink);
  R(ctx, 0, h - 1, w, 1, P.stone0);
  // finestrella accesa sulla faccia frontale
  const wx = Math.floor(w / 2) - 2;
  R(ctx, wx - 1, len + 2, 6, 6, P.stone5);
  R(ctx, wx, len + 3, 4, 4, P.win1); D(ctx, wx + 1, len + 4, P.win2);
  // spigolo
  R(ctx, side < 0 ? w - 1 : 0, 0, 1, h, P.stone5);
  tex.refresh();
}

// materiali da raccogliere: fasci legati, appoggiati a terra in diagonale
function bundle(ctx, o, stalks, colors, tipFn, f) {
  // fascio diagonale: dal basso-sinistra all'alto-destra
  for (let i = 0; i < stalks; i++) {
    const c = colors[i % colors.length];
    for (let k = 0; k < 13; k++) {
      const x = o + 2 + k, y = 12 - Math.round(k * 0.62) + i - Math.floor(stalks / 2);
      D(ctx, x, y, c);
    }
  }
  // legatura rossa
  R(ctx, o + 7, 4, 1, stalks + 3, P.cord); R(ctx, o + 8, 4, 1, stalks + 3, P.scarf2);
  tipFn(o, f);
}
function pickups(scene) {
  let { tex, ctx } = canvasTex(scene, 'asfodelo', 18, 16, 2);
  for (let f = 0; f < 2; f++) {
    bundle(ctx, f * 18, 4, [P.stalk2, P.stalk1, P.stalk2, P.stalk0], (o) => {
      // fiori bianchi a stella sulla punta
      [[14, 3], [16, 5], [13, 6], [15, 1]].forEach(([x, y]) => {
        D(ctx, o + x, y, '#ffffff'); D(ctx, o + x - 1, y, P.flower); D(ctx, o + x + 1, y, P.flower);
        D(ctx, o + x, y - 1, P.flower); D(ctx, o + x, y + 1, P.flower);
      });
      if (f) { D(ctx, o + 15, 3, P.fire5); D(ctx, o + 3, 10, '#ffffff'); }
    }, f);
  }
  finishFrames(tex, 18, 16, 2, '#0b0810');

  ({ tex, ctx } = canvasTex(scene, 'ferula', 18, 16, 2));
  for (let f = 0; f < 2; f++) {
    bundle(ctx, f * 18, 5, [P.fer2, P.fer1, P.fer2, P.fer0, P.fer1], (o) => {
      // ombrelle gialle
      [[14, 2], [16, 4], [15, 7]].forEach(([x, y]) => {
        R(ctx, o + x - 1, y, 3, 1, P.fer3); D(ctx, o + x, y - 1, P.fer3); D(ctx, o + x, y + 1, P.fer2);
      });
      if (f) { D(ctx, o + 16, 4, '#ffffff'); D(ctx, o + 3, 11, P.fire5); }
    }, f);
  }
  finishFrames(tex, 18, 16, 2, '#0b0810');
}

// --------------------------------------------------------------------
// Maschera di oscurita: grande rettangolo scuro con un "buco" morbido
export function darkness(scene, W, H) {
  const w = W * 3, h = H * 3;
  const { tex, ctx } = canvasTex(scene, 'dark', w, h);
  const cx = w / 2, cy = h / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
  grd.addColorStop(0, 'rgba(7,10,24,0)');
  grd.addColorStop(0.22, 'rgba(7,10,24,0.0)');
  grd.addColorStop(0.5, 'rgba(7,10,24,0.38)');
  grd.addColorStop(0.78, 'rgba(7,10,24,0.62)');
  grd.addColorStop(1, 'rgba(7,10,24,0.74)');
  ctx.fillStyle = 'rgba(7,10,24,0.74)';
  ctx.fillRect(0, 0, w, h);
  ctx.clearRect(cx - 120, cy - 120, 240, 240);
  ctx.fillStyle = grd;
  ctx.fillRect(cx - 120, cy - 120, 240, 240);
  tex.refresh();
  // vignettatura fissa sui bordi
  const v = canvasTex(scene, 'vignette', W, H);
  const vg = v.ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(5,7,15,0.55)');
  vg.addColorStop(0.18, 'rgba(5,7,15,0)');
  vg.addColorStop(0.9, 'rgba(5,7,15,0)');
  vg.addColorStop(1, 'rgba(5,7,15,0.5)');
  v.ctx.fillStyle = vg; v.ctx.fillRect(0, 0, W, H);
  v.tex.refresh();
}

// --------------------------------------------------------------------
export const HOUSE_VARIANTS = 7;
export function buildLayoutTextures(scene, layout) {
  const meta = {};
  for (const side of [-1, 1]) {
    for (let i = 0; i < HOUSE_VARIANTS; i++) {
      const h = 44 + ((i * 13) % 50);
      const key = `house${side}_${i}`;
      meta[key] = { h, ...house(scene, key, layout.sideW, h, side, 1000 + i * 31 + (side > 0 ? 500 : 0)) };
    }
    sideAlley(scene, `alley${side}`, layout.sideW, 22, side);
    meta[`alley${side}`] = { h: 22, windows: [], lamps: [], doors: [] };
    for (let rows = 3; rows <= 6; rows++) {
      const len = rows * WORLD.ROW - 6;
      narrowTex(scene, `narrow${side}_${rows}`, WORLD.LANE_W + layout.gutter + 2, len, side, 900 + rows + (side > 0 ? 50 : 0));
    }
  }
  darkness(scene, layout.W, layout.H);
  return meta;
}

export function buildStaticTextures(scene) {
  cobbles(scene);
  curb(scene);
  player(scene);
  torch(scene);
  flame(scene);
  particles(scene);
  obstacles(scene);
  pickups(scene);
  buildV2Textures(scene);
}
