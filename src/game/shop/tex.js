// v5s7c: texture dipinte a mano (canvas) per tessuti e intreccio dei cesti
import * as THREE from 'three';
import { canvasTex, rng } from './geo.js';

// intreccio di vimini: trama/ordito con ombre, usato come map + bumpMap
export function weaveTex(base = '#c48a4c') {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#5a3818'; x.fillRect(0, 0, w, h);
    const rows = 10, cols = 8, rh = h / rows, cw = w / cols, r = rng(9);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const ox = (j % 2) * cw * 0.5, cx = i * cw + ox, cy = j * rh;
      for (const dx of [0, w]) {
        const g = x.createLinearGradient(0, cy, 0, cy + rh);
        const l = 0.9 + r() * 0.2;
        g.addColorStop(0, shade(base, 0.55 * l)); g.addColorStop(0.35, shade(base, 1.15 * l)); g.addColorStop(0.7, shade(base, 0.95 * l)); g.addColorStop(1, shade(base, 0.5 * l));
        x.fillStyle = g; x.beginPath(); x.ellipse(cx + cw / 2 - dx, cy + rh / 2, cw * 0.47, rh * 0.42, 0, 0, Math.PI * 2); x.fill();
      }
    }
    // montanti verticali
    for (let i = 0; i < cols * 2; i++) { x.fillStyle = 'rgba(60,35,15,0.35)'; x.fillRect(i * cw / 2 - 1.5, 0, 3, h); }
  }, [6, 2]);
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

// tappeto sardo (stile Mogoro/Samugheo): rombi a gradini, greche, bordo a dentelli
export function sardTex(bg = '#a8182a', fg = '#f1e4c8', w = 512, h = 512, repeat) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const u = w / 64;
    const px = (i, j, c) => { x.fillStyle = c; x.fillRect(Math.round(i * u), Math.round(j * u), Math.ceil(u), Math.ceil(u)); };
    const H = Math.round(h / u);
    // bordo a dentelli
    for (let i = 0; i < 64; i++) for (const j0 of [2, H - 5]) { if ((i % 4) < 2) { px(i, j0, fg); px(i, j0 + 1, fg); } px(i, j0 + 2, fg); }
    for (let j = 0; j < H; j++) for (const i0 of [2, 59]) { px(i0, j, fg); if ((j % 4) < 2) px(i0 + 1, j, fg); }
    // rombi a gradini concentrici
    const dia = (ci, cj, R) => { for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const d = Math.abs(i) + Math.abs(j); if (d <= R && (d % 3 === 0 || d === R)) px(ci + i, cj + j, fg); if (d === 1) px(ci + i, cj + j, '#2a1418'); } };
    const n = Math.max(1, Math.round((H - 14) / 24));
    for (let k = 0; k < n; k++) { const cj = Math.round(7 + (H - 14) * (k + 0.5) / n); dia(32, cj, 10); dia(13, cj, 5); dia(51, cj, 5); }
    // piccole croci
    for (let j = 10; j < H - 8; j += 6) for (const i of [7, 57]) { px(i, j, fg); px(i - 1, j, fg); px(i + 1, j, fg); px(i, j - 1, fg); px(i, j + 1, fg); }
  }, repeat);
}
// scozzese rosso (tartan) del bancone, con filo giallo e nero
export function tartanTex() {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b3141f'; x.fillRect(0, 0, w, h);
    const band = (p, s, c, a) => { x.globalAlpha = a; x.fillStyle = c; x.fillRect(p, 0, s, h); x.fillRect(0, p, w, s); };
    for (const o of [0, 128]) { band(o + 14, 34, '#2a0c10', 0.55); band(o + 60, 8, '#160608', 0.6); band(o + 92, 3, '#f4cc3a', 0.95); band(o + 104, 14, '#6a0a14', 0.5); }
    x.globalAlpha = 0.12; for (let i = 0; i < h; i += 2) { x.fillStyle = i % 4 ? '#000' : '#fff'; x.fillRect(0, i, w, 1); } x.globalAlpha = 1;
  }, [3, 1.6]);
}
// alone morbido per lanterne
export function glowTex() {
  return canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,220,140,0.95)'); g.addColorStop(0.3, 'rgba(255,170,70,0.45)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
}
export function skyTex() {
  return canvasTex(8, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a78d6'); g.addColorStop(0.5, '#5aa6ea'); g.addColorStop(0.8, '#a8d2f2'); g.addColorStop(1, '#f4dcb8'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}
