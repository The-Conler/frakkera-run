// Texture procedurali (canvas) dei nuovi ambienti: sentiero, lastricato
// di pietra, ghiaia, pavimento della miniera, pavimento bagnato blu,
// mappa di normali per l'acqua, insegna "MINIERA FENICE", pavimento a scacchi.
// Una piastrella copre 11 x 11 m (larghezza della strada).
import * as THREE from 'three';
import { rng } from '../kit.js';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
// disegna con ripetizione orizzontale e verticale (texture senza cuciture)
function wrapDraw(S, x, y, f) { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) f(x + ox, y + oy); }
function blob(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); }
function speckle(ctx, S, r, n, cols, s0, s1, a = 1) {
  ctx.globalAlpha = a;
  for (let i = 0; i < n; i++) { ctx.fillStyle = r.pick(cols); const x = r() * S, y = r() * S, s = r.range(s0, s1); wrapDraw(S, x, y, (X, Y) => ctx.fillRect(X, Y, s, s)); }
  ctx.globalAlpha = 1;
}
function stones(ctx, S, r, n, cols, s0, s1, shade = 'rgba(40,30,20,0.35)') {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rx = r.range(s0, s1), ry = rx * r.range(0.6, 1), rot = r() * 3, col = r.pick(cols);
    wrapDraw(S, x, y, (X, Y) => {
      ctx.fillStyle = shade; blob(ctx, X + 1.5, Y + 2, rx, ry, rot);
      ctx.fillStyle = col; blob(ctx, X, Y, rx, ry, rot);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; blob(ctx, X - rx * 0.25, Y - ry * 0.3, rx * 0.5, ry * 0.35, rot);
    });
  }
}
// ombra leggera lungo le 3 corsie (aiuta a leggere il percorso senza linee artificiali)
function laneHints(ctx, S, col, a) {
  ctx.globalAlpha = a; ctx.fillStyle = col;
  for (const u of [S / 3, (2 * S) / 3]) ctx.fillRect(u - 3, 0, 6, S);
  ctx.globalAlpha = 1;
}
function gutters(ctx, S, col = 'rgba(50,40,30,0.4)') { ctx.fillStyle = col; ctx.fillRect(0, 0, 10, S); ctx.fillRect(S - 10, 0, 10, S); }

// sentiero di montagna: terra battuta con sassi, solchi e ciuffi d'erba ai bordi
export function trailTexture() {
  const S = 512; const [c, ctx] = cv(S, S); const r = rng(21);
  ctx.fillStyle = '#a98f6c'; ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, r, 900, ['#9b8160', '#b89e78', '#8e7656', '#c2a982'], 6, 22, 0.5);
  // solchi di passaggio (due tracce leggermente piu' chiare)
  for (const u of [0.32, 0.68]) { ctx.fillStyle = 'rgba(214,196,160,0.35)'; ctx.fillRect(S * u - 28, 0, 56, S); }
  stones(ctx, S, r, 160, ['#c9bfae', '#b3a892', '#d8cfbe', '#a39983', '#8f877a'], 3, 9);
  stones(ctx, S, r, 18, ['#bfb4a0', '#a89c86'], 10, 18);
  // bordi erbosi
  for (let i = 0; i < 260; i++) {
    const side = i % 2, x = side ? S - r() * 40 : r() * 40, y = r() * S;
    ctx.fillStyle = r.pick(['#6f8a3a', '#7f9a44', '#5d7a32', '#8aa34e']);
    wrapDraw(S, x, y, (X, Y) => blob(ctx, X, Y, r.range(3, 9), r.range(2, 6), r() * 3));
  }
  return tex(c);
}
// lastricato naturale di pietra chiara con muschio (sentiero del fiume)
export function stoneTrailTexture() {
  const S = 512; const [c, ctx] = cv(S, S); const r = rng(33);
  ctx.fillStyle = '#7a5838'; ctx.fillRect(0, 0, S, S);   // v5s6 (target3-cascata): lastre calde arancio-sabbia
  // lastre irregolari (griglia deformata)
  const N = 7;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = (i + 0.5 + (j % 2) * 0.5) * S / N + r.range(-8, 8), cy = (j + 0.5) * S / N + r.range(-8, 8);
    const rad = S / N * 0.48;
    const col = r.pick(['#dcaa72', '#d09a62', '#e4b680', '#c88e58', '#d8a46e']);
    const pts = []; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + r() * 0.4; pts.push([Math.cos(a) * rad * r.range(0.78, 1.02), Math.sin(a) * rad * r.range(0.78, 1.02)]); }
    wrapDraw(S, cx, cy, (X, Y) => {
      ctx.fillStyle = 'rgba(30,30,20,0.45)'; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, X + x + 2, Y + y + 3)); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, X + x, Y + y)); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; blob(ctx, X - rad * 0.2, Y - rad * 0.25, rad * 0.45, rad * 0.25, 0.3);
    });
  }
  // muschio nelle fughe
  speckle(ctx, S, r, 260, ['#6f9a3a', '#5f8a30', '#86ad4a'], 2, 5, 0.45);
  gutters(ctx, S, 'rgba(70,50,30,0.4)');
  return tex(c);
}
// ghiaia grigia del piazzale della miniera, con traversine dei binari
export function gravelTexture({ floor = false, blue = false } = {}) {
  const S = 512; const [c, ctx] = cv(S, S); const r = rng(floor ? 57 : 44);
  const base = blue ? '#252b40' : floor ? '#56595a' : '#8d8a84';
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const cols = blue ? ['#36405c', '#2a3250', '#4a4038', '#3a4878', '#5a4a36'] : floor ? ['#626664', '#4c504f', '#6e706a', '#5a5550', '#4a5452'] : ['#a19d96', '#7f7b74', '#b3aea5', '#96918a', '#6f6b65', '#c0bbb1'];
  speckle(ctx, S, r, 5200, cols, 2, 5, 0.9);
  stones(ctx, S, r, 120, cols, 2, 5, 'rgba(20,20,20,0.35)');
  // traversine sotto i binari (corsia centrale e destra), passo 1 m
  ctx.globalAlpha = blue ? 0.8 : 0.9;
  for (const u of [0.5, 0.809]) for (let y = 0; y < S; y += S / 11) {
    ctx.fillStyle = 'rgba(20,15,10,0.5)'; ctx.fillRect(S * u - 30, y + 3, 62, 16);
    ctx.fillStyle = r.pick(blue ? ['#4a3a2c', '#3f3226'] : ['#6b5136', '#5e4630', '#77593a']); ctx.fillRect(S * u - 31, y, 62, 14);
  }
  ctx.globalAlpha = 1;
  if (floor || blue) { // pozze e zone bagnate (nella blu: zone scure lucide, il riflesso e' nello shader)
    for (let i = 0; i < 10; i++) { ctx.fillStyle = blue ? 'rgba(10,14,34,0.35)' : 'rgba(30,40,45,0.35)'; const x = r() * S, y = r() * S; wrapDraw(S, x, y, (X, Y) => blob(ctx, X, Y, r.range(20, 60), r.range(10, 26), r() * 3)); }
  }
  if (blue) { speckle(ctx, S, r, 400, ['#6f8cff', '#9db0ff', '#c59a52'], 1, 3, 0.7); }
  return tex(c);
}
// muschio/erba (bordi naturali)
export function edgeTexture(kind) {
  const S = 256; const [c, ctx] = cv(S, S); const r = rng(kind.length * 13);
  const P = {
    grassEdge: ['#6f8a3a', ['#7f9a44', '#5d7a32', '#8aa34e', '#a99a6c', '#9a8c70']],
    mossEdge: ['#4f7a2a', ['#5f8a30', '#6f9a3a', '#86ad4a', '#cfc8b4', '#3f6a24']],
    drystone: ['#8f7f62', ['#a89a7e', '#7f9a44', '#bfb092', '#6f8a3a']],
    gravelEdge: ['#77736c', ['#8d8a84', '#6c6a62', '#7a7a56', '#a19d96']],
  }[kind] || ['#777', ['#888']];
  ctx.fillStyle = P[0]; ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, r, 1600, P[1], 2, 7, 0.8);
  return tex(c);
}
// pavimento della piazza (quadrotti chiari e grigi come nella foto della chiesa)
export function checkerTexture() {
  const S = 256; const [c, ctx] = cv(S, S); const r = rng(8);
  const n = 8, w = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    ctx.fillStyle = (i + j) % 2 ? r.pick(['#d9d6cf', '#e2dfd8', '#d2cec6']) : r.pick(['#8e8c88', '#9a9792', '#85837f']);
    ctx.fillRect(i * w, j * w, w, w);
    ctx.fillStyle = 'rgba(40,40,40,0.25)'; ctx.fillRect(i * w, j * w, w, 1.5); ctx.fillRect(i * w, j * w, 1.5, w);
  }
  return tex(c);
}
// normali dell'acqua (onde morbide, ripetibile)
export function waterNormalTexture() {
  const S = 256; const [c, ctx] = cv(S, S);
  const img = ctx.createImageData(S, S); const d = img.data;
  const r = rng(5);
  const waves = []; for (let i = 0; i < 9; i++) waves.push({ kx: Math.round(r.range(-5, 5)), ky: Math.round(r.range(1, 7)), ph: r() * 6.28, a: r.range(0.4, 1) });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) { const p = (w.kx * x + w.ky * y) / S * Math.PI * 2 + w.ph; const cs = Math.cos(p) * w.a; dx += cs * w.kx; dy += cs * w.ky; }
    const nx = -dx * 0.05, ny = -dy * 0.05, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4; d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb: false, aniso: 4 });
}
// insegna di legno "MINIERA FENICE" (come quella vera sopra l'ingresso)
export function mineSignTexture() {
  const [c, ctx] = cv(512, 200); const r = rng(3);
  ctx.fillStyle = '#6a4a30'; ctx.fillRect(0, 0, 512, 200);
  for (let i = 0; i < 40; i++) { ctx.strokeStyle = r.pick(['rgba(40,25,12,0.35)', 'rgba(150,110,70,0.25)']); ctx.lineWidth = r.range(1, 3); ctx.beginPath(); const y = r() * 200; ctx.moveTo(0, y); ctx.bezierCurveTo(170, y + r.range(-8, 8), 340, y + r.range(-8, 8), 512, y + r.range(-6, 6)); ctx.stroke(); }
  ctx.fillStyle = '#efe3c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 52px Georgia, "Times New Roman", serif'; ctx.fillText('MINIERA', 256, 66);
  ctx.font = '700 76px Georgia, "Times New Roman", serif'; ctx.fillText('FENICE', 256, 140);
  ctx.strokeStyle = 'rgba(30,18,8,0.6)'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 190);
  return tex(c, { repeat: false });
}
// rete paramassi sulla parete rocciosa del piazzale
export function netTexture() {
  const S = 128; const [c, ctx] = cv(S, S);
  ctx.clearRect(0, 0, S, S); ctx.strokeStyle = 'rgba(70,70,70,0.75)'; ctx.lineWidth = 1.4;
  for (let i = -S; i < S * 2; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, S); ctx.lineTo(i + S, 0); ctx.stroke(); }
  return tex(c);
}
