// Texture procedurali (canvas 2D) per il mondo 3D cartoon.
import * as THREE from 'three';
import { rng } from './kit.js';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// acciottolato chiaro con due "guide" di lastre tra le corsie
export function cobbleTexture() {
  const S = 512;
  const [c, ctx] = cv(S, S);
  const r = rng(11);
  ctx.fillStyle = '#857b70'; ctx.fillRect(0, 0, S, S);
  const cols = ['#cfc7bb', '#c3bbaf', '#d8d1c5', '#b9b0a4', '#cdbfa9', '#c6b49c', '#d2cabd'];
  const rows = 22, rh = S / rows;
  for (let j = 0; j < rows; j++) {
    let x = (j % 2) * -12 - r() * 8;
    while (x < S) {
      const w = r.range(20, 34);
      const y = j * rh;
      const col = r.pick(cols);
      for (const ox of [0, S]) { // tile orizzontale continuo
        const X = x - ox + (x < 0 ? S : 0);
        ctx.fillStyle = 'rgba(60,50,40,0.35)'; rr(ctx, X + 2, y + 3, w - 2, rh - 2, 8); ctx.fill();
        ctx.fillStyle = col; rr(ctx, X + 1, y + 1, w - 3, rh - 3, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, X + 4, y + 3, w - 10, rh * 0.35, 5); ctx.fill();
      }
      x += w;
    }
  }
  // lastre tra le corsie (aiutano a leggere le 3 corsie)
  for (const u of [S / 3, (2 * S) / 3]) {
    for (let y = 0; y < S; y += 32) {
      ctx.fillStyle = 'rgba(60,50,40,0.35)'; rr(ctx, u - 9, y + 2, 20, 30, 4); ctx.fill();
      ctx.fillStyle = r.pick(['#ddd4c6', '#e2dacd', '#d6ccbc']); rr(ctx, u - 10, y + 1, 20, 29, 4); ctx.fill();
    }
  }
  // bordi (canaletta)
  ctx.fillStyle = 'rgba(70,60,50,0.45)'; ctx.fillRect(0, 0, 8, S); ctx.fillRect(S - 8, 0, 8, S);
  return tex(c, { repeat: true, aniso: 8 });
}

// marciapiede a lastre
export function slabTexture() {
  const S = 256;
  const [c, ctx] = cv(S, S);
  const r = rng(5);
  ctx.fillStyle = '#7f7468'; ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 128) {
    const off = (y / 64) % 2 ? 64 : 0;
    for (const X of [x + off, x + off - S]) {
      ctx.fillStyle = r.pick(['#c9bba5', '#bfb19b', '#d1c4ae']); rr(ctx, X + 3, y + 3, 122, 58, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, X + 8, y + 6, 100, 16, 5); ctx.fill();
    }
  }
  return tex(c, { repeat: true });
}

// doghe della botte (u = intorno, v = altezza)
export function staveTexture() {
  const [c, ctx] = cv(256, 128);
  const r = rng(3);
  const N = 16, w = 256 / N;
  for (let i = 0; i < N; i++) {
    ctx.fillStyle = r.pick(['#a8672f', '#9a5c29', '#b5733a', '#8f5426', '#a3622f']);
    ctx.fillRect(i * w, 0, w, 128);
    ctx.fillStyle = 'rgba(255,220,170,0.16)'; ctx.fillRect(i * w + 3, 0, 3, 128);
    ctx.strokeStyle = 'rgba(70,35,10,0.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); const x0 = i * w + 4 + r() * 8; ctx.moveTo(x0, 0); ctx.bezierCurveTo(x0 + 2, 40, x0 - 2, 80, x0 + 1, 128); ctx.stroke(); }
    ctx.fillStyle = '#4b2a12'; ctx.fillRect(i * w, 0, 2, 128);
  }
  return tex(c, { repeat: false });
}
export function lidTexture() {
  const [c, ctx] = cv(128, 128);
  ctx.fillStyle = '#7a4520'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#a0612d' : '#93572a'; ctx.fillRect(0, 8 + i * 19, 128, 18); }
  ctx.strokeStyle = '#3a200e'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(64, 64, 59, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#5b1a2c'; ctx.beginPath(); ctx.arc(78, 50, 7, 0, Math.PI * 2); ctx.fill(); // tappo
  return tex(c);
}

// tappeto Sa Burra: bande come nel riferimento (rombi, zig-zag, righe, medaglione)
const CR = { red: '#c0283c', red2: '#8e1f33', bord: '#4e1027', must: '#e0a93a', must2: '#f6cf5e', cream: '#f3e8cc', dark: '#2a0f1e', olive: '#6d7a34', rose: '#d9607a' };
function band(ctx, kind, x, w, h) {
  if (kind === 'lattice') {
    ctx.fillStyle = CR.must; ctx.fillRect(x, 0, w, h);
    const s = 12;
    for (let yy = -s; yy < h + s; yy += s) for (let xx = x; xx < x + w; xx += s) {
      ctx.fillStyle = CR.red; ctx.beginPath(); ctx.moveTo(xx + s / 2, yy); ctx.lineTo(xx + s, yy + s / 2); ctx.lineTo(xx + s / 2, yy + s); ctx.lineTo(xx, yy + s / 2); ctx.fill();
      ctx.fillStyle = CR.must2; ctx.fillRect(xx + s / 2 - 1.5, yy + s / 2 - 1.5, 3, 3);
    }
  } else if (kind === 'zigzag') {
    ctx.fillStyle = CR.cream; ctx.fillRect(x, 0, w, h);
    ctx.strokeStyle = CR.bord; ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const cx = x + w * (0.2 + k * 0.3);
      for (let yy = 0; yy <= h; yy += 10) ctx.lineTo(cx + ((yy / 10) % 2 ? 5 : -5), yy);
      ctx.stroke();
    }
  } else if (kind === 'stripes') {
    ctx.fillStyle = CR.red; ctx.fillRect(x, 0, w, h);
    ctx.fillStyle = CR.must2; ctx.fillRect(x + w * 0.2, 0, w * 0.15, h); ctx.fillRect(x + w * 0.65, 0, w * 0.15, h);
    ctx.fillStyle = CR.cream; ctx.fillRect(x + w * 0.45, 0, w * 0.1, h);
  } else if (kind === 'medal') {
    ctx.fillStyle = CR.red2; ctx.fillRect(x, 0, w, h);
    const cx = x + w / 2, cy = h / 2;
    for (const [rad, col] of [[h * 0.42, CR.cream], [h * 0.32, CR.red], [h * 0.2, CR.must], [h * 0.09, CR.dark]]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx + rad * 0.8, cy); ctx.lineTo(cx, cy + rad); ctx.lineTo(cx - rad * 0.8, cy); ctx.fill();
    }
  } else if (kind === 'dark') {
    ctx.fillStyle = CR.bord; ctx.fillRect(x, 0, w, h);
    ctx.fillStyle = CR.rose; for (let yy = 4; yy < h; yy += 9) ctx.fillRect(x + w / 2 - 2, yy, 4, 4);
  } else if (kind === 'olive') {
    ctx.fillStyle = CR.olive; ctx.fillRect(x, 0, w, h);
    ctx.fillStyle = CR.cream; for (let yy = 2; yy < h; yy += 12) { ctx.beginPath(); ctx.arc(x + w / 2, yy + 4, 3, 0, Math.PI * 2); ctx.fill(); }
  }
}
const CARPET_BANDS = [
  ['lattice', 'dark', 'medal', 'dark', 'lattice'],
  ['stripes', 'zigzag', 'medal', 'zigzag', 'stripes'],
  ['zigzag', 'red', 'lattice', 'red', 'zigzag'],
  ['dark', 'olive', 'medal', 'olive', 'dark'],
];
export function carpetTexture(v) {
  const W = 256, H = 176, F = 22; // F = frange
  const [c, ctx] = cv(W, H);
  ctx.clearRect(0, 0, W, H);
  const x0 = F, w = W - F * 2, y0 = 10, h = H - 20;
  ctx.save(); ctx.translate(0, y0);
  ctx.fillStyle = CR.bord; ctx.fillRect(x0, 0, w, h);
  const bands = CARPET_BANDS[v % 4];
  const inner = w - 16, bw = inner / bands.length;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + 8, 8, inner, h - 16); ctx.clip(); ctx.translate(0, 8);
  bands.forEach((b, i) => {
    if (b === 'red') { ctx.fillStyle = CR.red; ctx.fillRect(x0 + 8 + i * bw, 0, bw, h - 16); }
    else band(ctx, b, x0 + 8 + i * bw, bw + 0.5, h - 16);
  });
  ctx.restore();
  // bordo a denti
  ctx.fillStyle = CR.must;
  for (let xx = x0 + 4; xx < x0 + w - 4; xx += 8) { ctx.fillRect(xx, 2, 4, 3); ctx.fillRect(xx, h - 5, 4, 3); }
  ctx.restore();
  // frange
  ctx.strokeStyle = CR.cream; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  for (let yy = y0 + 6; yy < y0 + h - 4; yy += 8) {
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(4 + (yy % 16 ? 2 : 0), yy + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + w, yy); ctx.lineTo(W - 4 - (yy % 16 ? 2 : 0), yy + 2); ctx.stroke();
  }
  const t = tex(c);
  return t;
}
// ---- tappeti ufficiali "Sa Burra" (foto dei 4 tappeti veri, sfondo reso trasparente) ----
// public/textures/sa-burra-1..4.webp (512 px) e sa-burra-N-icon.png (128 px) per l'interfaccia.
// La texture parte con il disegno procedurale e viene sostituita appena l'immagine e' caricata;
// se il caricamento fallisce resta il disegno procedurale (fallback).
export const CARPET_ASPECT = 512 / 272;          // lunghezza / larghezza, frange comprese
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
export const carpetURL = (v, icon = false) => `${BASE}textures/sa-burra-${(v % 4) + 1}${icon ? '-icon.png' : '.webp'}`;
const carpetLoads = [];
export function loadCarpetTexture(v, maxAniso = 8) {
  const t = carpetTexture(v);
  t.anisotropy = maxAniso;
  const p = new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { t.dispose(); t.image = img;   /* v5s29: dimensione diversa dalla tela iniziale: riallocata (niente avviso GL_INVALID_VALUE) */ t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; t.userData.official = true; res(true); };
    img.onerror = () => { console.warn('tappeto ufficiale non caricato, uso il disegno procedurale', v); res(false); };
    img.src = carpetURL(v);
  });
  carpetLoads.push(p);
  return t;
}
export const carpetsReady = () => Promise.all(carpetLoads);
// icona del tappeto per l'interfaccia: immagine ufficiale (URL) o, se manca, il disegno procedurale
export function carpetDataURL(v = 0, official = true) { if (official) return carpetURL(v, true); const t = carpetTexture(v); return t.image.toDataURL(); }

// bagliore radiale morbido (additivo)
export function glowTexture() {
  const [c, ctx] = cv(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return tex(c, { srgb: false });
}
// ombra a macchia
export function blobTexture() {
  const [c, ctx] = cv(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(30,20,40,0.55)'); g.addColorStop(0.55, 'rgba(30,20,40,0.32)'); g.addColorStop(1, 'rgba(30,20,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return tex(c, { srgb: false });
}
// stella della vampata
export function flashTexture() {
  const [c, ctx] = cv(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 50);
  g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,210,90,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const rad = i % 2 ? 22 : 62; ctx.lineTo(64 + Math.cos(a) * rad, 64 + Math.sin(a) * rad); }
  ctx.fill();
  return tex(c, { srgb: false });
}
// luna
export function moonTexture() {
  const [c, ctx] = cv(128, 128);
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.42, 'rgba(255,248,230,1)'); g.addColorStop(0.47, 'rgba(255,240,220,0.35)'); g.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(220,210,200,0.5)'; ctx.beginPath(); ctx.arc(54, 58, 6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(72, 72, 4, 0, 7); ctx.fill();
  return tex(c);
}
