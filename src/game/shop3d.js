// =====================================================================
// v5 stage 7: "Garag di Pinu" - bottega rustica low-poly (scena 3D a parte,
// renderizzata al posto della strada mentre la corsa e' in pausa nel negozio).
// Riferimento (v5s7b): reference/gadoni/target2-garage-di-pinu.jpg (9:16) (pali e travi di legno,
// lanterne, zucche e taglieri appesi, cesti, tappeto sardo rosso/bianco, bancone
// con coperta scozzese rossa, Pinu con coppola e giacca scura, giocattoli di legno,
// pavimento di lastre di pietra). Solo grafica: nessuna logica di gioco qui.
// =====================================================================
import * as THREE from 'three';
import { Kit, G, rng } from './kit.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// tappeto sardo: rombi e greche bianchi su rosso
function rugTexture() {
  return canvasTex(512, 320, (x, w, h) => {
    x.fillStyle = '#a8202a'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#f2e6d0'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
    x.lineWidth = 5; x.strokeRect(30, 30, w - 60, h - 60);
    const dia = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); x.fill(); };
    dia(w / 2, h / 2, 95, '#f2e6d0'); dia(w / 2, h / 2, 72, '#a8202a'); dia(w / 2, h / 2, 48, '#f2e6d0'); dia(w / 2, h / 2, 26, '#2a1a20');
    for (const s of [-1, 1]) { dia(w / 2 + s * 170, h / 2, 50, '#f2e6d0'); dia(w / 2 + s * 170, h / 2, 32, '#a8202a'); dia(w / 2 + s * 170, h / 2, 14, '#f2e6d0'); }
    x.fillStyle = '#f2e6d0';
    for (let i = 0; i < 22; i++) { dia(50 + i * 19.5, 50, 6, '#f2e6d0'); dia(50 + i * 19.5, h - 50, 6, '#f2e6d0'); }
    for (let i = 0; i < 40; i++) { x.fillRect(10 + i * 12.5, h - 8, 4, 8); }
  });
}
// coperta scozzese rossa del bancone
function tartanTexture() {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b81c24'; x.fillRect(0, 0, w, h);
    const band = (p, s, col, a) => { x.globalAlpha = a; x.fillStyle = col; x.fillRect(p, 0, s, h); x.fillRect(0, p, w, s); x.globalAlpha = 1; };
    for (const o of [0, 128]) { band(o + 20, 26, '#1a1414', 0.55); band(o + 56, 6, '#1a1414', 0.6); band(o + 84, 4, '#f2d24a', 0.8); band(o + 100, 14, '#2a2a60', 0.4); }
  });
}
function signTexture(text) {
  return canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = '#6b4126'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#5f3a22' : '#74482a'; x.fillRect(0, i * 22, w, 20); }
    x.font = 'bold 64px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#2a160c'; x.fillText(text, w / 2 + 3, h / 2 + 4); x.fillStyle = '#ffd98a'; x.fillText(text, w / 2, h / 2);
  });
}
function banner() {
  return canvasTex(128, 320, (x, w, h) => {
    x.fillStyle = '#b81c2a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2e6d0'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#f2e6d0';
    for (let i = 0; i < 4; i++) { const cy = 60 + i * 66; x.beginPath(); x.moveTo(w / 2, cy - 26); x.lineTo(w / 2 + 26, cy); x.lineTo(w / 2, cy + 26); x.lineTo(w / 2 - 26, cy); x.closePath(); x.fill(); x.fillStyle = '#b81c2a'; x.fillRect(w / 2 - 7, cy - 7, 14, 14); x.fillStyle = '#f2e6d0'; }
  });
}

// cielo: gradiente azzurro
function skyTexture() {
  return canvasTex(8, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2f7fd8'); g.addColorStop(0.55, '#6fb2ec'); g.addColorStop(1, '#cfe6f6');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}
// occlusione finta "di bottega": scurisce sotto il tetto, contro il muro di fondo e vicino al suolo
function bakeAO(geo, { ground = 0.28, roof = 0.22, wall = 0.18 } = {}) {
  const p = geo.attributes.position, c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const inside = Math.abs(x) < 3.2 && z < 0.6 && z > -3;
    let k = 1 - ground * Math.max(0, 1 - y / 0.9) * (y > 0.08 ? 1 : 0);
    if (inside && y > 3.0 && y < 4.4) k -= roof * Math.min(1, (y - 3.0) / 1.2);
    if (inside && z < -2.0) k -= wall * Math.min(1, (-2.0 - z) / 0.7) * Math.max(0, 1 - y / 4.2);
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
}

export function buildShopRoom() {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#cfe6f6', 22, 60);
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true }), unlit = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mats = [lit, unlit];
  const k = new Kit(77), r = rng(91);
  const W = ['#8a5530', '#7a4a2a', '#94603a', '#6f4226'], PL = ['#a8703c', '#9a6434', '#b47c46', '#8c5a30', '#c08850'];
  const STONE = ['#e6d0ae', '#dcc49e', '#d2b892', '#ead8ba', '#ccb08a'];
  const X0 = 3.0, ZF = 0.35, ZB = -2.7, EAVE = 4.55;

  // ---------------------------------------------------------- cortile di lastre irregolari
  const fk = new Kit(13);
  fk.add(G.box(30, 0.1, 40), '#9c8262', { y: -0.05, z: 12 });
  for (let row = 0, z = -3.2; z < 26; row++) {
    const sz = 0.75 + Math.max(0, z) * 0.07;          // lastre un po' piu' grandi verso la camera (come nel riferimento)
    for (let x = -9 + (row % 2) * sz * 0.5; x < 9; x += sz * r.range(0.95, 1.2)) {
      fk.add(G.cyl(sz * 0.56, sz * 0.6, 0.07, r.pick([5, 6, 6, 7])), r.pick(STONE), { x: x + r.range(-0.1, 0.1), y: 0.03, z: z + r.range(-0.08, 0.08), ry: r.range(0, 6), sz: r.range(0.62, 0.8), sx: r.range(0.95, 1.15), vary: 0.06 });
    }
    z += sz * 0.62;
  }
  const floor = new THREE.Mesh(fk.build(), mats); floor.receiveShadow = true; scene.add(floor);

  // ---------------------------------------------------------- muretti e basi di pietra
  const block = (x, y, z, w, h, d) => k.add(G.box(w, h, d), r.pick(['#d9cfbd', '#cbbfa8', '#e2d9c8', '#c2b59c']), { x, y, z, ry: r.range(-0.06, 0.06), vary: 0.08 });
  for (const s of [-1, 1]) {
    // base dei pali davanti
    block(s * X0, 0.32, ZF, 0.95, 0.64, 0.95); block(s * X0, 0.7, ZF, 0.75, 0.14, 0.75);
    // muretti a secco ai lati, in primo piano
    for (let z = -2.6; z < 1.0; z += 0.72) { block(s * (X0 + 0.9 + r.range(0, 0.1)), 0.32, z, 0.8, 0.62, 0.7); block(s * (X0 + 0.95), 0.92, z + 0.3, 0.75, 0.58, 0.68); }
    for (let z = 1.2; z < 5.5; z += 0.8) { const xx = s * (X0 + 0.25 + (z - 1.2) * 0.05); block(xx, 0.36, z, 0.9, 0.72, 0.78); block(xx + s * 0.05, 1.05, z + 0.35, 0.85, 0.66, 0.74); if (z > 2) block(xx + s * 0.1, 1.65, z + 0.1, 0.8, 0.56, 0.7); }
    
  }
  // ---------------------------------------------------------- struttura di legno
  for (const s of [-1, 1]) {
    k.add(G.box(0.42, EAVE - 0.75, 0.42), W[0], { x: s * X0, y: 0.77 + (EAVE - 0.75) / 2, z: ZF, vary: 0.08 });     // pali davanti
    k.add(G.box(0.3, 0.3, 0.46), W[3], { x: s * X0, y: 1.1, z: ZF });                                              // collari
    k.add(G.box(0.36, EAVE, 0.36), W[1], { x: s * X0, y: EAVE / 2, z: ZB + 0.2, vary: 0.08 });                    // pali dietro
    k.add(G.box(0.12, 1.0, 0.16), W[2], { x: s * (X0 - 0.42), y: EAVE - 0.5, z: ZF, rz: s * 0.78 });              // saette
    k.add(G.box(0.34, 0.34, 3.6), W[2], { x: s * X0, y: EAVE - 0.05, z: (ZF + ZB) / 2, vary: 0.08 });             // correnti laterali
  }
  k.add(G.box(0.3, EAVE, 0.3), W[1], { x: -1.35, y: EAVE / 2, z: ZB + 0.15 });
  k.add(G.box(7.0, 0.42, 0.42), W[0], { y: EAVE, z: ZF, vary: 0.06 });                 // trave maestra davanti
  k.add(G.box(6.6, 0.22, 0.26), W[3], { y: EAVE - 0.38, z: ZF + 0.02 });               // seconda trave
  k.add(G.box(6.6, 0.32, 0.32), W[1], { y: EAVE - 0.3, z: -1.1 });                     // trave a meta'
  k.add(G.box(6.6, 0.34, 0.34), W[0], { y: EAVE, z: ZB + 0.2 });
  for (let x = -2.7; x <= 2.75; x += 0.9) k.add(G.box(0.2, 0.2, 0.8), W[2], { x, y: EAVE + 0.02, z: ZF + 0.55, vary: 0.1 });   // teste dei travetti
  // tetto a due falde di assi spesse con gronda sporgente (falda davanti verso la camera)
  const RID = 7.0, ZR = -1.0, ZE = 1.35;
  const run = ZE - ZR, rise = RID - EAVE - 0.25, len = Math.hypot(run, rise) + 0.3, ang = Math.atan2(rise, run);
  for (let x = -3.7; x < 3.75; x += 0.44) {
    const l = len + r.range(-0.15, 0.2), dz = r.range(-0.05, 0.05);
    k.add(G.box(0.42, 0.14, l), r.pick(PL), { x: x + r.range(-0.02, 0.02), y: (RID + EAVE + 0.25) / 2 + r.range(-0.03, 0.03), z: (ZR + ZE) / 2 + dz, rx: ang + r.range(-0.03, 0.03), rz: r.range(-0.04, 0.04), vary: 0.1 });
    k.add(G.box(0.42, 0.14, 2.2), r.pick(PL), { x, y: RID - 0.55, z: ZR - 0.95, rx: -0.55, vary: 0.1 });     // falda dietro
  }
  k.add(G.box(7.6, 0.24, 0.3), W[3], { y: RID + 0.05, z: ZR - 0.05 });                  // colmo
  for (let x = -3.4; x <= 3.5; x += 1.15) k.add(G.box(0.18, 0.2, 2.6), W[3], { x, y: (RID + EAVE) / 2 - 0.05, z: (ZR + ZE) / 2 - 0.1, rx: ang });   // puntoni sotto le assi
  k.add(G.box(6.4, 0.1, 3.3), '#6a4226', { y: EAVE + 0.2, z: (ZF + ZB) / 2 });           // soffitto scuro sotto il tetto

  // ---------------------------------------------------------- muro di fondo color crema + taglieri appesi
  k.add(G.box(6.4, EAVE, 0.25), '#f0e2c4', { y: EAVE / 2, z: ZB, vary: 0.02 });
  k.add(G.box(6.4, 0.25, 0.3), '#c8b494', { y: 0.12, z: ZB + 0.05 });
  for (let i = 0; i < 9; i++) {
    const x = -1.95 + i * 0.6 + r.range(-0.05, 0.05), h = r.range(0.55, 0.95), w = r.range(0.32, 0.44);
    k.add(G.box(w, h, 0.07), r.pick(['#8a5a34', '#7a4c2a', '#9a6a3e', '#6b4126']), { x, y: 2.95 - h / 2, z: ZB + 0.17, rz: r.range(-0.03, 0.03), vary: 0.06 });
    k.add(G.box(0.1, 0.16, 0.07), '#6b4126', { x, y: 3.0, z: ZB + 0.17 });
    k.add(G.cyl(0.025, 0.025, 0.05, 6), '#3a2614', { x, y: 3.12, z: ZB + 0.18, rx: Math.PI / 2 });
  }
  // scaffale con cesti a sinistra
  const basket = (x, y, z, s, handle = true) => {
    k.add(G.cyl(0.3 * s, 0.24 * s, 0.38 * s, 9), r.pick(['#c08a4c', '#b07a40', '#cc985a']), { x, y: y + 0.19 * s, z, vary: 0.1, flat: true });
    for (let i = 1; i < 4; i++) k.add(G.torus(0.3 * s - (3 - i) * 0.018 * s, 0.014 * s, 3, 12), '#8a5a2a', { x, y: y + i * 0.1 * s, z, rx: Math.PI / 2 });
    k.add(G.torus(0.3 * s, 0.03 * s, 4, 12), '#8a5a2a', { x, y: y + 0.38 * s, z, rx: Math.PI / 2 });
    if (handle) k.add(G.torus(0.22 * s, 0.025 * s, 4, 10), '#8a5a2a', { x, y: y + 0.38 * s, z, sz: 0.4 });
  };
  for (const y of [1.25, 1.95, 2.6]) { k.add(G.box(1.2, 0.08, 0.5), W[2], { x: -2.15, y, z: ZB + 0.38 }); k.add(G.box(0.07, 0.25, 0.4), W[3], { x: -2.15, y: y - 0.15, z: ZB + 0.38 }); }
  basket(-2.15, 1.29, ZB + 0.38, 1.2); basket(-2.15, 1.99, ZB + 0.38, 1.1); basket(-2.15, 2.64, ZB + 0.38, 1.0);
  // tavolino rosso (telo sardo, mesh a parte) e cesti a terra
  basket(-2.25, 0, 0.4, 1.55); basket(-1.45, 0, 0.55, 1.25, false); basket(-0.95, 0, -0.35, 1.2); basket(-1.3, 0.62, -1.1, 0.85);
  basket(2.45, 0, 0.55, 1.1, false);
  // arcolaio/telaio di legno tra il tavolino e il bancone
  k.add(G.box(0.08, 1.7, 0.08), W[2], { x: -1.1, y: 0.85, z: -1.55, rz: 0.12 });
  k.add(G.box(0.08, 1.4, 0.08), W[2], { x: -0.7, y: 0.7, z: -1.6, rz: -0.18 });
  k.add(G.torus(0.34, 0.035, 4, 14), W[1], { x: -0.9, y: 1.45, z: -1.6, ry: 0.5 });
  for (let a = 0; a < 3; a++) k.add(G.box(0.03, 0.66, 0.03), W[3], { x: -0.9, y: 1.45, z: -1.6, ry: 0.5, rz: a * 1.05 });
  k.add(G.box(1.0, 0.06, 0.06), W[0], { x: -0.9, y: 0.5, z: -1.6, ry: 0.5 });
  k.add(G.box(0.7, 0.06, 0.5), W[2], { x: -1.3, y: 0.62, z: -1.1 }); for (const dx of [-0.3, 0.3]) for (const dz of [-0.2, 0.2]) k.add(G.box(0.05, 0.6, 0.05), W[3], { x: -1.3 + dx, y: 0.3, z: -1.1 + dz });
  // cassette di frutta a destra
  for (let i = 0; i < 3; i++) for (let j = 0; j < (i < 2 ? 2 : 1); j++) {
    const x = 2.35 + j * 0.05, z = -1.7 - j * 0.65 + 0.3;
    k.add(G.box(0.85, 0.42, 0.6), r.pick(W), { x, y: 0.22 + i * 0.44, z, ry: r.range(-0.05, 0.05), vary: 0.1 });
    for (const yy of [-0.08, 0.1]) k.add(G.box(0.87, 0.04, 0.62), '#5a3a22', { x, y: 0.22 + i * 0.44 + yy, z });
  }
  for (let i = 0; i < 9; i++) k.add(G.ico(0.1, 0), r.pick(['#c8202e', '#d83040', '#b01a26']), { x: 2.35 + r.range(-0.3, 0.3), y: 1.36 + r.range(0, 0.06), z: -1.4 + r.range(-0.2, 0.2), flat: true });
  k.add(G.box(0.85, 0.85, 0.08), '#a8783e', { x: 2.4, y: 2.2, z: ZB + 0.2 }); for (let i = 0; i < 4; i++) k.add(G.box(0.85, 0.05, 0.1), '#7a4c2a', { x: 2.4, y: 1.85 + i * 0.24, z: ZB + 0.26 });  // graticcio
  // bancone (il telo scozzese e' a parte), gambe sotto il telo
  for (const dx of [-1.6, 1.6]) for (const dz of [-0.45, 0.45]) k.add(G.box(0.14, 0.3, 0.14), W[3], { x: 0.25 + dx, y: 0.15, z: -0.35 + dz });
  // piramide di legno a gradini sul bancone e scatolina
  for (let i = 0; i < 6; i++) k.add(G.box(0.62 - i * 0.1, 0.12, 0.5 - i * 0.08), i % 2 ? '#c8945a' : '#a8743e', { x: 1.4, y: 1.17 + i * 0.12, z: -0.5 });
  k.add(G.cone(0.06, 0.18, 6), '#8a5a2a', { x: 1.4, y: 1.94, z: -0.5 });
  k.add(G.box(0.42, 0.14, 0.3), '#c49058', { x: -0.95, y: 1.18, z: -0.35 }); k.add(G.box(0.44, 0.04, 0.32), '#8a5a2a', { x: -0.95, y: 1.27, z: -0.35 });

  // ---------------------------------------------------------- zucche appese e lanterne
  for (const [x, z, s, L] of [[-1.85, 0.0, 1.0, 0.55], [-1.2, -0.3, 0.8, 0.65], [-0.45, 0.1, 1.15, 0.5], [0.95, -0.2, 1.1, 0.6], [1.75, -0.9, 0.7, 0.4], [2.45, 0.05, 0.95, 0.85], [-1.6, -1.3, 0.6, 0.35]]) {
    const y0 = EAVE - 0.2;
    k.add(G.cyl(0.012, 0.012, L, 4), '#3a2a1a', { x, y: y0 - L / 2, z });
    k.add(G.cyl(0.05 * s, 0.07 * s, 0.14 * s, 6), '#b05a28', { x, y: y0 - L - 0.04, z, flat: true });
    k.add(G.sph(0.24 * s, 7, 6), r.pick(['#e47a34', '#d86a2a', '#ec8a44']), { x, y: y0 - L - 0.3 * s, z, sx: 1.25, sz: 1.25, sy: 1.6, flat: true, vary: 0.08 });
  }
  k.add(G.box(0.2, 0.3, 0.2), '#3a2a1a', { x: 1.75, y: EAVE - 0.85, z: -0.9 }); k.add(G.box(0.14, 0.2, 0.22), '#ffd36a', { x: 1.75, y: EAVE - 0.85, z: -0.9, unlit: true });
  for (const s of [-1, 1]) {
    const lx = s * (X0 + 0.38), ly = 3.15, lz = ZF + 0.05;
    k.add(G.box(0.3, 0.06, 0.1), '#2a1a12', { x: s * (X0 + 0.2), y: ly + 0.42, z: lz });   // braccio
    k.add(G.box(0.36, 0.06, 0.36), '#2a1a12', { x: lx, y: ly - 0.25, z: lz });
    for (const [dx, dz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) k.add(G.box(0.05, 0.46, 0.05), '#2a1a12', { x: lx + dx, y: ly, z: lz + dz });
    k.add(G.box(0.28, 0.42, 0.28), '#ffcf5a', { x: lx, y: ly, z: lz, unlit: true });
    k.add(G.cone(0.3, 0.22, 4), '#2a1a12', { x: lx, y: ly + 0.33, z: lz, ry: Math.PI / 4 });
    k.add(G.sph(0.05, 6, 4), '#2a1a12', { x: lx, y: ly + 0.47, z: lz });
  }
  // ---------------------------------------------------------- fuori: alberi, casa di pietra, nuvole
  const tree = (x, z, h, s) => {
    k.add(G.cyl(0.14 * s, 0.22 * s, h, 6), '#6a4a30', { x, y: h / 2, z, flat: true });
    for (const [dx, dy, dz, rr] of [[0, 0.2, 0, 1.25], [-0.75, -0.3, 0.25, 0.95], [0.8, -0.2, -0.2, 1.0], [0.1, 0.95, -0.1, 0.9]]) k.add(G.ico(rr * s, 1), r.pick(['#4f8f2e', '#5ea036', '#47822a', '#69ad3e']), { x: x + dx * s, y: h + dy * s, z: z + dz * s, flat: true, vary: 0.12 });
  };
  tree(-4.6, -3.6, 5.6, 1.5); tree(-5.0, -1.2, 3.0, 1.1); tree(3.9, -5.4, 6.3, 1.4); tree(5.4, -2.6, 2.8, 1.0);
  for (let y = 0; y < 9; y += 0.55) for (let x = 0; x < 3; x += 0.75) k.add(G.box(0.72, 0.52, 0.5), r.pick(['#d8b894', '#cfae88', '#e0c4a0', '#c4a07a']), { x: 4.9 + x + ((y / 0.55) % 2) * 0.35, y: y + 0.27, z: -4.0, vary: 0.08 });
  k.add(G.box(3.6, 0.3, 2.0), '#b8553a', { x: 6.1, y: 9.1, z: -4.6, rz: 0.25 });
  k.add(G.box(1.2, 9.5, 1.2), '#c8a47e', { x: -7.6, y: 4.75, z: -7, vary: 0.05 });
  const rk = new Kit(3); for (const [x, y, z, s] of [[-6, 10.5, -14, 1.6], [-4.2, 10.8, -14, 1.2], [-7.6, 10.2, -14, 1.1], [6.5, 11.6, -16, 1.0], [7.8, 11.4, -16, 0.8]]) rk.add(G.ico(s, 1), '#ffffff', { x, y, z, sy: 0.55, flat: true, unlit: true });
  scene.add(new THREE.Mesh(rk.build(), mats));

  const geo = k.build(); bakeAO(geo);
  const stall = new THREE.Mesh(geo, mats); stall.castShadow = true; stall.receiveShadow = true; scene.add(stall);

  // ---------------------------------------------------------- tessuti (texture su volumi 3D)
  const tm = (tex) => new THREE.MeshLambertMaterial({ map: tex });
  const clothBox = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const tart = tartanTexture(); tart.wrapS = tart.wrapT = THREE.RepeatWrapping; tart.repeat.set(2.2, 1);
  clothBox(3.6, 0.84, 1.3, tm(tart), 0.25, 0.7, -0.35);                       // telo scozzese del bancone
  clothBox(3.66, 0.06, 1.36, tm(tart), 0.25, 1.12, -0.35);
  clothBox(1.55, 0.95, 0.95, tm(rugTexture()), -2.05, 0.48, -1.15);            // cassa coperta col tappeto sardo
  const ban = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.45, 0.04), tm(banner()));
  ban.position.set(-X0 + 0.5, 2.55, ZF + 0.06); ban.castShadow = true; scene.add(ban);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 5), new THREE.MeshLambertMaterial({ color: '#4a2c18' })); rod.rotation.z = Math.PI / 2; rod.position.set(-X0 + 0.5, 3.3, ZF + 0.08); scene.add(rod);

  // ---------------------------------------------------------- Pinu
  const pinu = new THREE.Group();
  const pk = new Kit(5);
  const SK = '#d9946c', SK2 = '#c07a58', JK = '#2a2a32', JK2 = '#1f1f26';
  // busto con spalle e risvolti
  pk.add(G.cyl(0.36, 0.3, 0.62, 7), JK, { y: 1.3, sz: 0.62, flat: true, vary: 0.04 });
  pk.add(G.box(0.86, 0.16, 0.42), JK, { y: 1.58 });
  pk.add(G.box(0.2, 0.36, 0.03), '#f4f2ea', { y: 1.5, z: 0.21 });
  pk.add(G.box(0.07, 0.26, 0.03), '#3a1c1c', { y: 1.48, z: 0.23 });
  for (const s of [-1, 1]) {
    pk.add(G.box(0.12, 0.42, 0.03), JK2, { x: s * 0.13, y: 1.47, z: 0.225, rz: s * 0.32 });            // risvolti
    pk.add(G.box(0.2, 0.42, 0.24), JK, { x: s * 0.42, y: 1.34, z: 0.05, rz: s * 0.12, flat: true });   // braccio
    pk.add(G.box(0.18, 0.17, 0.48), JK, { x: s * 0.33, y: 1.08, z: 0.34, ry: s * 0.45 });               // avambraccio sul tavolo
    pk.add(G.box(0.15, 0.13, 0.16), SK, { x: s * 0.07, y: 1.1, z: 0.6, ry: s * 0.3, vary: 0.04 });     // mani giunte
    pk.add(G.box(0.05, 0.06, 0.13), SK2, { x: s * 0.03, y: 1.17, z: 0.6 });
  }
  pk.add(G.box(0.2, 0.1, 0.16), SK, { y: 1.69, z: 0.03 });                                // collo
  // testa angolosa: mascella, zigomi, naso, sopracciglia
  pk.add(G.box(0.36, 0.3, 0.34), SK, { y: 1.9, vary: 0.03 });
  pk.add(G.box(0.3, 0.12, 0.3), SK2, { y: 1.73, z: 0.01 });                              // mascella
  pk.add(G.box(0.2, 0.06, 0.06), SK2, { y: 1.71, z: 0.16 });                             // mento
  for (const s of [-1, 1]) {
    pk.add(G.box(0.09, 0.07, 0.08), SK2, { x: s * 0.12, y: 1.84, z: 0.15, ry: s * 0.4 });  // zigomi
    pk.add(G.box(0.07, 0.035, 0.03), '#1e1410', { x: s * 0.085, y: 1.93, z: 0.175 });     // occhi
    pk.add(G.box(0.11, 0.035, 0.05), '#8a8478', { x: s * 0.085, y: 1.98, z: 0.17, rz: -s * 0.18 }); // sopracciglia
    pk.add(G.box(0.04, 0.1, 0.07), SK2, { x: s * 0.19, y: 1.9, z: 0 });                    // orecchie
    pk.add(G.box(0.04, 0.11, 0.2), '#d8d2c6', { x: s * 0.182, y: 1.98, z: -0.04 });        // capelli bianchi
    pk.add(G.box(0.03, 0.08, 0.02), '#b07058', { x: s * 0.09, y: 1.79, z: 0.165, rz: s * 0.5 }); // pieghe del sorriso
  }
  pk.add(G.cone(0.065, 0.17, 4), SK2, { y: 1.86, z: 0.21, rx: Math.PI / 2, ry: Math.PI / 4, sy: 1.2 });   // naso
  pk.add(G.box(0.13, 0.025, 0.02), '#8a4a3a', { y: 1.78, z: 0.172 });                    // bocca sorridente
  pk.add(G.box(0.38, 0.07, 0.36), '#2c2824', { y: 2.07, z: -0.01 });                     // coppola
  pk.add(G.box(0.36, 0.06, 0.3), '#34302b', { y: 2.12, z: -0.04, rx: -0.12 });
  pk.add(G.box(0.42, 0.035, 0.17), '#24201c', { y: 2.05, z: 0.23, rx: 0.22 });              // visiera
  const pm = new THREE.Mesh(pk.build(), mats); pm.castShadow = true; pinu.add(pm);
  pinu.position.set(0.15, 0.1, -1.3); pinu.scale.setScalar(1.3); scene.add(pinu);

  // ---------------------------------------------------------- luci: sole caldo del pomeriggio con ombre morbide
  scene.add(new THREE.HemisphereLight('#ffe2bc', '#8a6a48', 1.25));
  const sun = new THREE.DirectionalLight('#ffc884', 1.8);
  sun.position.set(-7, 10, 7); sun.target.position.set(0, 0, -0.5);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 9; sc.bottom = -6; sc.near = 1; sc.far = 30;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#bcd6ff', 0.35); fill.position.set(6, 4, 8); scene.add(fill);
  for (const s of [-1, 1]) { const l = new THREE.PointLight('#ffb050', 6, 5, 1.6); l.position.set(s * (X0 + 0.38), 3.0, ZF + 0.5); scene.add(l); }
  const pl = new THREE.PointLight('#ffcf88', 3, 5, 1.6); pl.position.set(0.3, 3.0, -0.6); scene.add(pl);

  const camera = new THREE.PerspectiveCamera(62, 0.5625, 0.1, 80);
  let t = 0, nodT = 0;
  return {
    scene, camera, pinu,
    nod() { nodT = 0.6; },
    // ui: frazioni di schermo occupate in alto (titolo) e in basso (pannello acquisti)
    update(dt, aspect, ui = { top: 0.1, bottom: 0.34 }) {
      t += dt;
      // inquadratura calcolata dall'aspetto: tutta la bancarella (tetto con gronde, pali, lanterne)
      // nella fascia libera tra il titolo e il pannello; camera frontale e centrata.
      const fov = 62, tn = Math.tan(THREE.MathUtils.degToRad(fov / 2));
      const halfW = 3.5, top = 7.25, bot = -0.2, zp = ZF + 0.5;
      const band = Math.max(0.3, 1 - ui.top - ui.bottom);
      const dW = halfW / (tn * aspect);                       // distanza che fa entrare la larghezza
      const dH = (top - bot) / (2 * tn * band);               // distanza che fa entrare l'altezza nella fascia
      const D = Math.max(dW, dH);
      const H = 2 * D * tn;                                   // altezza visibile al piano della bancarella
      const sBot = 1 - ui.bottom - 0.015;                      // il piede della bancarella appoggia sul bordo del pannello
      const cy = bot + (sBot - 0.5) * H;          // camera senza beccheggio: sposto in altezza
      camera.aspect = aspect; camera.fov = fov;
      camera.position.set(0, cy, zp + D);
      camera.lookAt(0, cy, zp);                                // frontale, senza beccheggio (il calcolo della fascia resta esatto)
      camera.updateProjectionMatrix();
      pinu.position.y = Math.sin(t * 1.6) * 0.008;
      pinu.rotation.y = Math.sin(t * 0.5) * 0.05;
      if (nodT > 0) { nodT = Math.max(0, nodT - dt); pinu.rotation.x = Math.sin((0.6 - nodT) / 0.6 * Math.PI * 2) * 0.06; } else pinu.rotation.x = 0;
    },
  };
}
