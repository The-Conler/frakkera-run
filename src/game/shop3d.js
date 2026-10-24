// =====================================================================
// v5 stage 7: "Garag di Pinu" - bottega rustica low-poly (scena 3D a parte,
// renderizzata al posto della strada mentre la corsa e' in pausa nel negozio).
// Riferimento: reference/gadoni/target-garage-di-pinu.jpg (pali e travi di legno,
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

export function buildShopRoom(name = 'Garag di Pinu') {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f2a868');
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true }), unlit = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mats = [lit, unlit];
  const k = new Kit(77); const r = rng(77);
  const wood = ['#7a4a2a', '#6b4126', '#85532e'], dark = '#4a2c18';
  // pavimento di lastre di pietra
  k.add(G.box(11, 0.1, 10), '#8a7a66', { y: -0.05, z: -3 });
  for (let z = 1.6; z > -7.6; z -= 0.95) for (let x = -5.2 + (Math.round(z * 3) % 2) * 0.45; x < 5.3; x += 0.95) k.add(G.cyl(0.46, 0.46, 0.06, 6), r.pick(['#e2d4bc', '#d6c6aa', '#cdbc9e', '#e8dcc6', '#c8b694']), { x: x + r.range(-0.08, 0.08), y: 0.02, z: z + r.range(-0.08, 0.08), ry: r.range(0, 1), vary: 0.08 });
  // pareti: fondo color crema, fianco sinistro di pietra
  k.add(G.box(11, 5.4, 0.3), '#efe2c6', { y: 2.7, z: -7.8 });
  k.add(G.box(0.3, 5.4, 9), '#e6d6b8', { x: 5.4, y: 2.7, z: -3.5 });
  for (let y = 0.3; y < 1.6; y += 0.5) for (let z = -7.4; z < 1.5; z += 0.8) k.add(G.box(0.7, 0.45, 0.75), r.pick(['#cfc2a8', '#bdb094', '#d8ccb4']), { x: -5.25, y: y + 0.2, z: z + (y % 1 ? 0.4 : 0), vary: 0.1 });
  // pali e travi di legno, soffitto di assi
  for (const [x, z] of [[-4.6, 0.6], [4.6, 0.6], [-4.6, -7.4], [4.6, -7.4], [-1.2, -7.4]]) k.add(G.box(0.42, 5.2, 0.42), r.pick(wood), { x, y: 2.6, z, vary: 0.1 });
  for (const z of [0.6, -3.4, -7.4]) k.add(G.box(10.4, 0.42, 0.42), r.pick(wood), { y: 4.75, z, vary: 0.1 });
  for (const x of [-4.6, 4.6]) k.add(G.box(0.4, 0.4, 8.4), r.pick(wood), { x, y: 4.75, z: -3.4 });
  for (let x = -5.2; x < 5.3; x += 0.45) k.add(G.box(0.44, 0.08, 9), r.pick(['#b8864a', '#a8783a', '#c49456', '#9a6c34']), { x, y: 5.05, z: -3.4, rx: 0.06, vary: 0.1 });
  for (const s of [-1, 1]) k.add(G.box(0.3, 0.3, 1.6), dark, { x: s * 4.6, y: 4.2, z: -0.2, rx: 0.8 });
  // taglieri appesi al muro di fondo
  for (let i = 0; i < 12; i++) {
    const x = -3.9 + i * 0.72 + r.range(-0.08, 0.08), h = r.range(0.7, 1.25), w = r.range(0.38, 0.6);
    if (x > 2.9 && x < 3.8) continue;
    k.add(G.box(w, h, 0.06), r.pick(['#8a5a34', '#7a4c2a', '#9a6a3e', '#6b4126']), { x, y: 3.55 - (h - 1) / 2, z: -7.6, vary: 0.08 });
    k.add(G.box(0.12, 0.25, 0.06), '#6b4126', { x, y: 3.55 + h / 2 + 0.05, z: -7.6 });
  }
  // zucche (cucuzze) e lanterne di ferro appese alle travi
  for (const [x, z, s] of [[-3.2, -3.4, 1], [-2.1, -3.4, 0.8], [-0.6, -3.4, 1.1], [0.9, -3.4, 0.9], [2.6, -3.4, 1], [-1.4, 0.6, 0.9], [1.8, 0.6, 1.1], [3.6, -3.4, 0.8]]) {
    const L = r.range(0.5, 0.9);
    k.add(G.cyl(0.015, 0.015, L, 4), '#3a2a1a', { x, y: 4.55 - L / 2, z });
    k.add(G.sph(0.28 * s, 8, 6), r.pick(['#e07a3a', '#d06a2a', '#e88a48']), { x, y: 4.55 - L - 0.32 * s, z, sy: 1.15, vary: 0.1, flat: true });
    k.add(G.sph(0.15 * s, 7, 5), '#d8763a', { x, y: 4.55 - L - 0.02, z, flat: true });
  }
  // cesti intrecciati a sinistra (impilati) e sul pavimento
  const basket = (x, y, z, s, handle = true) => {
    k.add(G.cyl(0.42 * s, 0.32 * s, 0.5 * s, 10), r.pick(['#b8834a', '#a8743e', '#c49058']), { x, y: y + 0.25 * s, z, vary: 0.12, flat: true });
    k.add(G.torus(0.42 * s, 0.04 * s, 4, 12), '#8a5a2a', { x, y: y + 0.5 * s, z, rx: Math.PI / 2 });
    for (let i = 1; i < 4; i++) k.add(G.torus(0.42 * s - i * 0.03 * s, 0.015 * s, 3, 12), '#8a5a2a', { x, y: y + i * 0.12 * s, z, rx: Math.PI / 2 });
    if (handle) k.add(G.torus(0.3 * s, 0.03 * s, 4, 10, Math.PI), '#8a5a2a', { x, y: y + 0.5 * s, z });
  };
  for (const [x, y, z, s] of [[-3.9, 1.05, -6.6, 1.1], [-3.0, 1.05, -6.7, 1.0], [-3.5, 1.65, -6.6, 1.0], [-3.9, 2.4, -7.2, 0.9], [-2.9, 2.5, -7.2, 0.9], [-3.6, 0, -4.2, 0.9], [-2.8, 0, -4.0, 0.8], [-1.5, 0, -6.0, 0.9], [-0.7, 0, -6.2, 0.75], [-4.1, 0, -2.6, 1.0]]) basket(x, y, z, s);
  // ripiano dei cesti
  k.add(G.box(2.6, 0.12, 1.2), wood[0], { x: -3.4, y: 1.0, z: -6.7 }); k.add(G.box(2.4, 0.1, 0.5), wood[1], { x: -3.4, y: 2.35, z: -7.3 });
  // tavolino col tappeto (il tappeto e' una mesh a parte con texture)
  k.add(G.box(2.8, 0.9, 1.1), dark, { x: -3.0, y: 0.45, z: -5.2 });
  // albero-espositore di legno e sedie
  k.add(G.cyl(0.12, 0.2, 2.4, 6), '#8a5a2a', { x: -0.6, y: 1.2, z: -6.6, flat: true });
  for (const [a, y] of [[0.8, 1.7], [-0.9, 1.3], [2.2, 2.1]]) k.add(G.cyl(0.05, 0.08, 1.1, 5), '#8a5a2a', { x: -0.6 + Math.cos(a) * 0.45, y, z: -6.6 + Math.sin(a) * 0.2, rz: Math.cos(a) * 0.9, flat: true });
  basket(-0.1, 1.15, -6.5, 0.6); basket(-1.1, 1.7, -6.6, 0.55);
  for (const [x, z] of [[0.4, -5.6], [-1.6, -4.4]]) { k.add(G.box(0.6, 0.06, 0.6), '#a8743e', { x, y: 0.5, z }); for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) k.add(G.box(0.06, 0.5, 0.06), '#8a5a2a', { x: x + dx, y: 0.25, z: z + dz }); }
  // cassette di legno a destra con frutta
  for (let i = 0; i < 4; i++) k.add(G.box(1.0, 0.45, 0.6), r.pick(wood), { x: 4.6, y: 0.25 + i * 0.47, z: -6.6, vary: 0.1 });
  for (let i = 0; i < 6; i++) k.add(G.ico(0.12, 0), '#c8283a', { x: 4.4 + r.range(-0.3, 0.3), y: 2.1, z: -6.6 + r.range(-0.2, 0.2), flat: true });
  // bancone (il telo scozzese e' una mesh a parte)
  k.add(G.box(3.0, 1.05, 1.2), '#5a3a22', { x: 2.0, y: 0.52, z: -3.8 });
  // giocattoli di legno sul bancone e su uno sgabello: pagoda a gradini e carrettino
  for (let i = 0; i < 5; i++) k.add(G.box(0.5 - i * 0.08, 0.14, 0.5 - i * 0.08), i % 2 ? '#c49058' : '#a8743e', { x: 3.15, y: 1.17 + i * 0.15, z: -3.7, ry: i * 0.2 });
  k.add(G.cone(0.1, 0.25, 6), '#8a5a2a', { x: 3.15, y: 2.0, z: -3.7 });
  k.add(G.box(0.5, 0.18, 0.3), '#c49058', { x: 0.95, y: 1.2, z: -3.5 }); for (const [dx, dz] of [[-0.17, 0.16], [0.17, 0.16], [-0.17, -0.16], [0.17, -0.16]]) k.add(G.cyl(0.07, 0.07, 0.04, 8), '#6b4126', { x: 0.95 + dx, y: 1.12, z: -3.5 + dz, rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) k.add(G.box(0.36 - i * 0.06, 0.12, 0.36 - i * 0.06), '#d8a868', { x: -0.05, y: 0.6 + i * 0.13, z: -5.6 });
  // lanterne a muro sui pali davanti (vetro luminoso)
  for (const s of [-1, 1]) {
    k.add(G.box(0.5, 0.65, 0.5), '#2a1a12', { x: s * 4.25, y: 3.2, z: 0.75 });
    k.add(G.box(0.38, 0.5, 0.52), '#ffd36a', { x: s * 4.25, y: 3.2, z: 0.75, unlit: true });
    k.add(G.cone(0.38, 0.3, 4), '#2a1a12', { x: s * 4.25, y: 3.68, z: 0.75, ry: Math.PI / 4 });
  }
  k.add(G.box(0.36, 0.46, 0.36), '#ffe9a0', { x: 1.0, y: 1.55, z: -7.55, unlit: true });   // finestrella/lume sul fondo
  // fuori: alberelli tondi a sinistra e pietre in primo piano
  for (const [x, y, z, s] of [[-6.4, 3.6, 0.2, 1.3], [-6.8, 2.2, -1.6, 1.1], [-6.2, 4.6, -3.0, 1.2]]) k.add(G.ico(s, 0), r.pick(['#5f9a30', '#6faa3a', '#4f8a2a']), { x, y, z, flat: true });
  k.add(G.cyl(0.16, 0.22, 3, 5), '#5a4430', { x: -6.5, y: 1.5, z: -0.8 });
  for (const [x, z, s] of [[-4.9, 1.4, 0.8], [-5.4, 0.4, 0.9], [4.9, 1.3, 0.8], [5.3, 0.2, 0.9]]) k.add(G.dode(s), r.pick(['#d8ccb4', '#cfc2a8', '#bdb094']), { x, y: s * 0.7, z, sy: 0.9, flat: true, vary: 0.1 });
  const room = new THREE.Mesh(k.build({ ao: 0.18 }), mats);
  scene.add(room);
  // tappeto, telo scozzese, insegna, stendardo (texture)
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.93, 1.16), new THREE.MeshLambertMaterial({ map: rugTexture() }));
  rug.position.set(-3.0, 0.47, -5.2); scene.add(rug);
  const tart = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.0, 1.3), new THREE.MeshLambertMaterial({ map: tartanTexture() }));
  tart.position.set(2.0, 0.6, -3.8); scene.add(tart);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: signTexture(name) }));
  sign.position.set(0, 4.25, 0.85); scene.add(sign);
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.4), new THREE.MeshLambertMaterial({ map: banner(), side: THREE.DoubleSide }));
  ban.position.set(-4.3, 3.1, 0.9); scene.add(ban);
  // Pinu: anziano con coppola e giacca scura, mani giunte sul bancone
  const pinu = new THREE.Group(); const pk = new Kit(5);
  pk.add(G.box(1.0, 1.05, 0.55), '#26262e', { y: 1.55, vary: 0.04 });                  // giacca
  pk.add(G.box(0.3, 0.6, 0.05), '#f2f0e8', { y: 1.75, z: 0.28 });                      // camicia
  pk.add(G.box(0.08, 0.45, 0.06), '#5a1a1a', { y: 1.72, z: 0.31 });                    // cravatta
  for (const s of [-1, 1]) { pk.add(G.box(0.24, 0.24, 0.62), '#2a2a34', { x: s * 0.3, y: 1.22, z: 0.38, ry: -s * 0.25 }); pk.add(G.box(0.2, 0.55, 0.24), '#26262e', { x: s * 0.52, y: 1.5, z: 0.12, rz: s * 0.15 }); }
  pk.add(G.sph(0.17, 8, 6), '#e0a888', { y: 1.22, z: 0.72, flat: true });               // mani giunte
  pk.add(G.box(0.24, 0.18, 0.2), '#e0a888', { y: 2.12, z: 0.02 });                       // collo
  pk.add(G.box(0.5, 0.56, 0.48), '#e6ae8c', { y: 2.45, vary: 0.03 });                    // testa
  pk.add(G.box(0.14, 0.16, 0.12), '#d89a7a', { y: 2.4, z: 0.28 });                       // naso
  for (const s of [-1, 1]) { pk.add(G.box(0.1, 0.05, 0.03), '#1a1410', { x: s * 0.12, y: 2.53, z: 0.25 }); pk.add(G.box(0.14, 0.04, 0.04), '#d8d4cc', { x: s * 0.12, y: 2.6, z: 0.25 }); pk.add(G.box(0.06, 0.16, 0.12), '#e0a888', { x: s * 0.27, y: 2.45, z: 0 }); }
  pk.add(G.box(0.26, 0.05, 0.04), '#9a5a48', { y: 2.27, z: 0.25 });                      // bocca
  pk.add(G.box(0.54, 0.16, 0.5), '#cfcac0', { y: 2.3, z: -0.04 });                        // capelli bianchi ai lati
  pk.add(G.cyl(0.3, 0.32, 0.16, 10), '#3a3430', { y: 2.78, z: -0.02, sz: 1.1, flat: true }); // coppola
  pk.add(G.box(0.5, 0.05, 0.28), '#33302c', { y: 2.72, z: 0.3, rx: 0.15 });               // visiera
  pinu.add(new THREE.Mesh(pk.build(), mats));
  pinu.position.set(2.05, 0, -4.75); scene.add(pinu);
  const head = null;
  // luci calde: emisferica, sole radente da sinistra, lanterne
  scene.add(new THREE.HemisphereLight('#ffe2b8', '#6a4a30', 1.25));
  const sun = new THREE.DirectionalLight('#ffc888', 1.7); sun.position.set(-6, 7, 6); scene.add(sun);
  for (const s of [-1, 1]) { const l = new THREE.PointLight('#ffb050', 9, 9, 1.6); l.position.set(s * 4.0, 3.2, 0.2); scene.add(l); }
  const pl = new THREE.PointLight('#ffd890', 7, 7, 1.6); pl.position.set(1.0, 2.2, -6.6); scene.add(pl);
  const camera = new THREE.PerspectiveCamera(60, 0.46, 0.1, 80);
  let t = 0, nodT = 0;
  return {
    scene, camera, pinu,
    nod() { nodT = 0.6; },
    update(dt, aspect) {
      t += dt;
      camera.aspect = aspect;
      // inquadratura: in verticale il bancone con Pinu sta nella meta' alta (sotto c'e' il pannello degli acquisti)
      const por = aspect < 1;
      camera.fov = por ? 64 : 50;
      camera.position.set(por ? 0.9 : 0, por ? 2.1 : 2.3, por ? 5.2 : 6.5);
      camera.lookAt(por ? 1.2 : 0, por ? 0.6 : 1.8, -5);
      camera.updateProjectionMatrix();
      pinu.position.y = Math.sin(t * 1.6) * 0.012;
      pinu.rotation.y = Math.sin(t * 0.5) * 0.06 - 0.12;
      if (nodT > 0) { nodT = Math.max(0, nodT - dt); pinu.rotation.x = Math.sin((0.6 - nodT) / 0.6 * Math.PI * 2) * 0.08; } else pinu.rotation.x = 0;
    },
  };
}
