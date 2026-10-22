// =====================================================================
// Sprite v2: botti da vino, tappeti "Sa Burra", pistola Broccu, proiettile,
// vampata, schegge. (Personaggio, frakkera e fiamma restano in textures.js
// e NON vengono modificati.)
// =====================================================================
import { canvasTex, finishFrames, R, D, ell, outline } from './textures.js';

export const W2 = {
  // legno di botte (bruno caldo) e ferro
  bw0: '#24140b', bw1: '#43280f', bw2: '#653d1d', bw3: '#88552a', bw4: '#ad7238', bw5: '#cf9a5a',
  fe0: '#141519', fe1: '#2c2f37', fe2: '#565c6b', fe3: '#8a91a2',
  wine0: '#4a1124', wine1: '#7a1f36',
  brass: '#c8a040', brass2: '#ecc96a',
  // tappeto (dal riferimento sa burra)
  red: '#b3283a', red2: '#86202f', bord: '#4c1227', must: '#d9a63a', must2: '#f2c95c',
  cream: '#efe3c6', cream2: '#cbb894', dark: '#26101d', olive: '#5d6a2c',
  ink: '#0b0810',
};

// -------------------------------------------------------------- botti
function shadeAcross(rel) {
  if (rel < 0.1) return W2.bw1;
  if (rel < 0.26) return W2.bw3;
  if (rel < 0.42) return W2.bw4;
  if (rel < 0.66) return W2.bw3;
  if (rel < 0.86) return W2.bw2;
  return W2.bw1;
}

// botte in piedi 18x22 (vista 3/4: coperchio + doghe bombate + cerchi di ferro)
function standingBarrel(ctx, ox, oy) {
  const cx = 9;
  for (let y = 5; y <= 20; y++) {
    const t = (y - 5) / 15;
    const hw = Math.round(6 + 2.2 * Math.sin(Math.PI * t));
    const x0 = cx - hw, w = hw * 2;
    const hoop = y === 7 || y === 8 || y === 17 || y === 18;
    for (let x = x0; x < x0 + w; x++) {
      const rel = (x - x0 + 0.5) / w;
      let c = shadeAcross(rel);
      const st = Math.floor(rel * 6), st2 = Math.floor(((x + 1 - x0 + 0.5) / w) * 6);
      if (st !== st2 && x < x0 + w - 1) c = rel < 0.5 ? W2.bw2 : W2.bw1; // giunzione doghe
      if (hoop) c = (y === 7 || y === 17) ? (rel < 0.45 ? W2.fe3 : W2.fe2) : W2.fe1;
      D(ctx, ox + x, oy + y, c);
    }
  }
  // base piu' scura (ombra di contatto)
  R(ctx, ox + 4, oy + 20, 10, 1, W2.bw0);
  // coperchio
  ell(ctx, ox + cx, oy + 4, 7, 2, W2.fe1);
  ell(ctx, ox + cx, oy + 4, 6, 1, W2.bw3);
  R(ctx, ox + cx - 5, oy + 3, 9, 1, W2.bw4);
  R(ctx, ox + cx - 4, oy + 4, 8, 1, W2.bw2);
  D(ctx, ox + cx + 2, oy + 4, W2.bw0); // foro del tappo
  D(ctx, ox + cx - 3, oy + 5, W2.wine1); D(ctx, ox + cx - 2, oy + 5, W2.wine0); // macchia di vino
  R(ctx, ox + cx - 6, oy + 2, 3, 1, W2.fe3); // riflesso sul cerchio
}
function standingBarrelCanvas() {
  const c = document.createElement('canvas'); c.width = 18; c.height = 22;
  const x = c.getContext('2d'); standingBarrel(x, 0, 0); outline(x, 0, 18, 22, W2.ink);
  return c;
}

function barrels(scene) {
  // singola
  let { tex, ctx } = canvasTex(scene, 'botte', 18, 22);
  standingBarrel(ctx, 0, 0); outline(ctx, 0, 18, 22, W2.ink); tex.refresh();

  // botte coricata 26x16 (asse di traverso alla corsia) con cunei
  ({ tex, ctx } = canvasTex(scene, 'bottecoricata', 26, 16));
  for (let x = 3; x <= 22; x++) {
    const t = (x - 3) / 19;
    const hh = Math.round(4.5 + 1.8 * Math.sin(Math.PI * t));
    const y0 = 7 - hh, h = hh * 2;
    const hoop = x === 5 || x === 6 || x === 19 || x === 20;
    for (let y = y0; y < y0 + h; y++) {
      const rel = (y - y0 + 0.5) / h;
      let c = rel < 0.14 ? W2.bw2 : rel < 0.34 ? W2.bw4 : rel < 0.56 ? W2.bw3 : rel < 0.8 ? W2.bw2 : W2.bw1;
      const st = Math.floor(rel * 5), st2 = Math.floor(((y + 1 - y0 + 0.5) / h) * 5);
      if (st !== st2 && y < y0 + h - 1) c = W2.bw1;
      if (hoop) c = rel < 0.4 ? W2.fe3 : rel < 0.75 ? W2.fe2 : W2.fe1;
      D(ctx, x, y, c);
    }
  }
  // fondi (testate)
  for (const ex of [1, 23]) {
    R(ctx, ex, 3, 2, 8, W2.fe1); R(ctx, ex + (ex === 1 ? 1 : 0), 4, 1, 6, W2.bw2);
  }
  D(ctx, 12, 4, W2.wine1); D(ctx, 13, 4, W2.wine0);
  R(ctx, 6, 13, 3, 2, W2.bw1); R(ctx, 17, 13, 3, 2, W2.bw1); // cunei
  R(ctx, 6, 13, 3, 1, W2.bw3); R(ctx, 17, 13, 3, 1, W2.bw3);
  outline(ctx, 0, 26, 16, W2.ink); tex.refresh();

  // gruppo di botti 30x50 (occupa 2 file)
  ({ tex, ctx } = canvasTex(scene, 'botti', 30, 50));
  const one = standingBarrelCanvas();
  [[0, 0], [12, 1], [6, 13], [0, 27], [12, 28]].forEach(([x, y]) => ctx.drawImage(one, x, y));
  tex.refresh();

  // botte che rotola di lato (4 frame), asse lungo la strada
  ({ tex, ctx } = canvasTex(scene, 'rollbarrel', 16, 22, 4));
  for (let f = 0; f < 4; f++) {
    const o = f * 16;
    for (let y = 3; y <= 19; y++) {
      const t = (y - 3) / 16;
      const hw = Math.round(5.5 + 1.6 * Math.sin(Math.PI * t));
      const x0 = 8 - hw, w = hw * 2;
      const hoop = y === 5 || y === 6 || y === 16 || y === 17;
      for (let x = x0; x < x0 + w; x++) {
        const rel = (x - x0 + 0.5) / w;
        let c = shadeAcross(rel);
        if ((x + f) % 4 === 0 && rel > 0.08 && rel < 0.92) c = W2.bw1; // doghe che girano
        if (hoop) c = y === 5 || y === 16 ? (rel < 0.45 ? W2.fe3 : W2.fe2) : W2.fe1;
        D(ctx, o + x, y, c);
      }
    }
    ell(ctx, o + 8, 2, 5, 1, W2.fe1); R(ctx, o + 5, 2, 6, 1, W2.bw3);
  }
  finishFrames(tex, 16, 22, 4, W2.ink);

  // schegge e vino
  const small = [
    ['plank', 4, 2, (c) => { R(c, 0, 0, 4, 2, W2.bw3); R(c, 0, 0, 4, 1, W2.bw5); }],
    ['plank2', 2, 3, (c) => { R(c, 0, 0, 2, 3, W2.bw2); D(c, 0, 0, W2.bw4); }],
    ['hoopbit', 3, 1, (c) => { R(c, 0, 0, 3, 1, W2.fe2); D(c, 0, 0, W2.fe3); }],
    ['wine', 2, 2, (c) => { R(c, 0, 0, 2, 2, W2.wine1); D(c, 1, 1, W2.wine0); }],
    ['chip', 1, 1, (c) => { R(c, 0, 0, 1, 1, W2.bw4); }],
    ['thread', 2, 1, (c) => { R(c, 0, 0, 2, 1, '#ffffff'); }],
  ];
  for (const [k, w, h, fn] of small) { const t = canvasTex(scene, k, w, h); fn(t.ctx); t.tex.refresh(); }
}

// -------------------------------------------------------------- tappeti
function carpetPattern(v, i, j) {
  // i: 0..9 (larghezza), j: 0..5 (altezza) area interna
  if (v === 0) { // rombi a reticolo su rosso
    const a = (i + j) % 4 === 0, b = (i - j + 40) % 4 === 0;
    if (a && b) return W2.cream;
    return a || b ? W2.must : W2.red;
  }
  if (v === 1) { // zig-zag crema su bordeaux
    const z = Math.abs((i % 4) - 2);
    if ((j + z) % 3 === 0) return W2.cream;
    return (j + z) % 3 === 1 ? W2.red2 : W2.bord;
  }
  if (v === 2) { // bande verticali
    return [W2.red, W2.must, W2.must2, W2.red, W2.red2, W2.cream, W2.red2, W2.red, W2.must, W2.red][i];
  }
  // v3: campo crema con rombo centrale rosso
  const d = Math.abs(i - 4.5) + Math.abs(j - 2.5);
  if (d <= 1) return W2.must;
  if (d <= 2.5) return W2.red;
  if (d <= 3) return W2.dark;
  if ((i === 0 || i === 9) && (j === 0 || j === 5)) return W2.olive;
  return W2.cream;
}

function carpets(scene) {
  const FW = 16, FH = 13, N = 8;
  const { tex, ctx } = canvasTex(scene, 'tappeto', FW, FH, N);
  for (let v = 0; v < 4; v++) for (let f = 0; f < 2; f++) {
    const o = (v * 2 + f) * FW;
    // spessore / ombra (vista 3/4)
    R(ctx, o + 2, 10, 12, 1, W2.dark);
    // bordo
    R(ctx, o + 2, 2, 12, 8, W2.bord);
    R(ctx, o + 2, 2, 12, 1, v === 3 ? W2.red : W2.red2); // bordo superiore illuminato
    for (let j = 0; j < 6; j++) for (let i = 0; i < 10; i++) D(ctx, o + 3 + i, 3 + j, carpetPattern(v, i, j));
    // frange sui lati corti, mosse
    for (let y = 2; y < 10; y += 2) {
      const yy = y + (f ? 1 : 0);
      if (yy < 10) { D(ctx, o + 1, yy, W2.cream2); D(ctx, o + 14, yy, W2.cream2); }
      D(ctx, o + (f ? 0 : 1), y + 1 < 10 ? y + 1 : y, f ? W2.cream : W2.cream2);
      D(ctx, o + (f ? 15 : 14), y + 1 < 10 ? y + 1 : y, f ? W2.cream : W2.cream2);
    }
    if (f) D(ctx, o + 4 + v * 2, 3, '#ffffff'); // luccichio
  }
  finishFrames(tex, FW, FH, N, W2.ink);
}

// -------------------------------------------------------------- pistola
export function pistolTextures(scene) { return pistol(scene); }
function pistol(scene) {
  // a terra, 18x12 (2 frame per il luccichio)
  let { tex, ctx } = canvasTex(scene, 'pistola', 18, 12, 2);
  for (let f = 0; f < 2; f++) {
    const o = f * 18;
    R(ctx, o + 7, 3, 10, 1, W2.fe3);       // canna
    R(ctx, o + 7, 4, 10, 1, W2.fe2);
    D(ctx, o + 16, 3, W2.fe1); D(ctx, o + 16, 4, W2.fe0); // bocca
    R(ctx, o + 7, 5, 7, 1, W2.bw3);        // cassa sotto la canna
    D(ctx, o + 13, 5, W2.bw2);
    R(ctx, o + 11, 3, 1, 3, W2.brass);     // fascetta
    R(ctx, o + 5, 2, 3, 3, W2.fe2); D(ctx, o + 5, 1, W2.fe3); D(ctx, o + 6, 1, W2.fe1); // acciarino e cane
    D(ctx, o + 6, 0, W2.fe2);
    // impugnatura curva
    R(ctx, o + 4, 5, 4, 1, W2.bw4);
    R(ctx, o + 3, 6, 4, 1, W2.bw3);
    R(ctx, o + 2, 7, 4, 1, W2.bw3);
    R(ctx, o + 1, 8, 4, 1, W2.bw2);
    R(ctx, o + 1, 9, 3, 1, W2.bw2);
    R(ctx, o + 1, 10, 3, 1, W2.brass); D(ctx, o + 1, 10, W2.brass2); // calciolo in ottone
    D(ctx, o + 7, 6, W2.brass); D(ctx, o + 8, 7, W2.brass); D(ctx, o + 9, 6, W2.brass); D(ctx, o + 8, 6, W2.fe1); // ponticello
    if (f) { D(ctx, o + 13, 3, '#ffffff'); D(ctx, o + 2, 10, '#ffffff'); }
  }
  finishFrames(tex, 18, 12, 2, W2.ink);

  // in mano, canna verso l'alto 6x12
  ({ tex, ctx } = canvasTex(scene, 'pistolhand', 6, 12));
  R(ctx, 2, 1, 1, 6, W2.fe3); R(ctx, 3, 1, 1, 6, W2.fe2); D(ctx, 2, 0, W2.fe1); D(ctx, 3, 0, W2.fe0);
  R(ctx, 2, 3, 2, 1, W2.brass);
  R(ctx, 1, 6, 2, 2, W2.fe2); D(ctx, 1, 5, W2.fe3);
  R(ctx, 2, 7, 2, 1, W2.bw4); R(ctx, 3, 8, 2, 1, W2.bw3); R(ctx, 3, 9, 2, 1, W2.bw2); R(ctx, 3, 10, 2, 1, W2.brass);
  outline(ctx, 0, 6, 12, W2.ink); tex.refresh();

  // vampata (3 frame) 11x11
  ({ tex, ctx } = canvasTex(scene, 'muzzle', 11, 11, 3));
  const c = 5;
  // f0
  R(ctx, c - 1, c - 1, 3, 3, '#ffffff');
  R(ctx, c, 0, 1, 11, '#ffe589'); R(ctx, 0, c, 11, 1, '#ffe589');
  R(ctx, c, 1, 1, 2, '#fff7d6'); R(ctx, c, 8, 1, 2, '#fff7d6');
  [[2, 2], [8, 2], [2, 8], [8, 8], [3, 3], [7, 3], [3, 7], [7, 7]].forEach(([x, y]) => D(ctx, x, y, '#ff8a24'));
  // f1
  let o = 11;
  R(ctx, o + c - 1, c - 1, 3, 3, '#ffe589'); D(ctx, o + c, c, '#ffffff');
  R(ctx, o + c, 1, 1, 9, '#ffbf3a'); R(ctx, o + 1, c, 9, 1, '#ffbf3a');
  [[3, 3], [7, 3], [3, 7], [7, 7]].forEach(([x, y]) => D(ctx, o + x, y, '#e0521a'));
  // f2 fumo
  o = 22;
  R(ctx, o + c - 2, c - 2, 5, 5, '#55525c'); R(ctx, o + c - 1, c - 3, 3, 1, '#77737e'); R(ctx, o + c - 1, c - 1, 2, 2, '#77737e');
  D(ctx, o + 2, 3, '#ff8a24'); D(ctx, o + 8, 6, '#e0521a');
  finishFrames(tex, 11, 11, 3);

  // proiettile 3x6
  ({ tex, ctx } = canvasTex(scene, 'palla', 3, 6));
  D(ctx, 1, 0, '#ffffff'); R(ctx, 0, 1, 3, 1, '#fff7d6'); R(ctx, 0, 2, 3, 1, '#ffe589');
  D(ctx, 1, 3, '#ffbf3a'); D(ctx, 1, 4, '#ff8a24'); D(ctx, 1, 5, '#a8270f');
  tex.refresh();

  // sbuffo di fumo 8x8 e cenere
  ({ tex, ctx } = canvasTex(scene, 'puff', 8, 8));
  ell(ctx, 4, 4, 3, 3, 'rgba(84,80,92,0.85)'); ell(ctx, 3, 3, 2, 1, 'rgba(122,117,128,0.85)'); D(ctx, 5, 5, 'rgba(60,56,66,0.9)');
  tex.refresh();
  ({ tex, ctx } = canvasTex(scene, 'ash', 1, 1)); R(ctx, 0, 0, 1, 1, '#8c8590'); tex.refresh();
}

// v2: selciato più calmo (meno contrasto interno) per far risaltare ostacoli e tappeti
function calmCobbles(scene, k = 0.38, dark = 0.9) {
  if (!scene.textures.exists('cobble')) return;
  const tex = scene.textures.get('cobble');
  if (!tex.getContext) return;
  const ctx = tex.getContext();
  const { width: w, height: h } = tex.getSourceImage();
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
  const mr = sr / n, mg = sg / n, mb = sb / n;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round((d[i] + (mr - d[i]) * k) * dark);
    d[i + 1] = Math.round((d[i + 1] + (mg - d[i + 1]) * k) * dark);
    d[i + 2] = Math.round((d[i + 2] + (mb - d[i + 2]) * k) * dark);
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

export function buildV2Textures(scene) {
  calmCobbles(scene);
  barrels(scene);
  carpets(scene);
  pistol(scene);
}

// fascia tessuta in stile sa burra per l'interfaccia (data URL)
export function wovenBandURL(w = 48, h = 8) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  R(x, 0, 0, w, h, W2.red);
  R(x, 0, 0, w, 1, W2.bord); R(x, 0, h - 1, w, 1, W2.bord);
  for (let i = 0; i < w; i++) {
    const seg = Math.floor(i / 12) % 4;
    for (let j = 1; j < h - 1; j++) {
      const jj = j - 1, ii = i % 12;
      let col = null;
      if (seg === 0) { const d = Math.abs(ii - 5.5) + Math.abs(jj - 2.5); col = d < 1.5 ? W2.cream : d < 3 ? W2.must : null; }
      else if (seg === 1) { const z = Math.abs((ii % 4) - 2); col = (jj + z) % 3 === 0 ? W2.cream : W2.bord; }
      else if (seg === 2) col = [W2.must, W2.must2, W2.red2, W2.red, W2.cream, W2.red2, W2.must, W2.red, W2.red2, W2.must2, W2.must, W2.red][ii];
      else { const a = (ii + jj) % 4 === 0, b = (ii - jj + 40) % 4 === 0; col = a && b ? W2.cream : a || b ? W2.must : W2.red2; }
      if (col) D(x, i, j, col);
    }
  }
  return c.toDataURL();
}
