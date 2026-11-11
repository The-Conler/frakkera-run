// v5 stage 25: chiesa di Santa Marta (Gadoni) rifatta sulle foto target6-santamarta-facciata/navata/interno.
// Facciata a capanna in scisto grigio-bruno a pezzi irregolari, cornice a dentelli in mattoni sui due spioventi e
// in orizzontale, lesene agli spigoli, oculo tondo con doppia ghiera di mattoni e rosa scura, portale ad arco con
// doppia ghiera di mattoni, lunetta a raggiera e ante scure a riquadri, 5 gradini rossi che si allargano in basso,
// due vasi bianchi, croce con statuina in cima. Dentro: muri in pietra, pilastri in pietra con archi tondi in mattoni
// (navata + navatelle), volta intonacata bianca, lunette affrescate, pavimento in cotto a quadri, banchi di legno ai
// due lati, passatoia gialla intrecciata (la strada), abside in fondo con arco in mattoni, affresco, crocifisso e
// altare bianco (ai lati del portale di uscita: la corsa passa libera). Coordinate locali: facciata a z = 0, corsa verso -z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, G } from '../../kit.js';
import { SANTAMARTA } from '../../../config.js';
import { CARPET_ASPECT, loadCarpetTexture } from '../../tex3d.js';

const C = { schist: '#7d7a72', schistL: '#9a978e', schistD: '#5f5d58', schistB: '#8f7a62', brick: '#985238', brickD: '#7a3f2c',
  stone: '#5e5a52', stoneL: '#736c60', plaster: '#ece6da', floor: '#b5603f', floorL: '#c8724c', runner: '#e8b52c', runnerD: '#c28d18',
  pew: '#7a5434', pewD: '#5a3a22', door: '#3a2618', doorD: '#2a1a10', step: '#a8442e', stepT: '#bf5a3e', marble: '#f2eee6', gold: '#d8b050' };
const tor = (r, t, rs, ts, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const SM_DOOR_W = 9.6;
export const SM = { HW: 7.2, H: 13, RIDGE: 16.6, STEPS: 5, WALL: 0.8, AW: 11.8, AH: 7.2 };   // v5s26: navatelle vere (AW = muro esterno, AH = altezza)

// pezzi di pietra irregolari su una parete piana (normale +z o -z) nel rettangolo [x0,x1]x[y0,y1]
function stones(k, x0, x1, y0, y1, z, dir, pal, hole) {
  for (let y = y0 + 0.12; y < y1 - 0.1; y += 0.42) {
    let x = x0 + k.r() * 0.4;
    while (x < x1 - 0.2) {
      const w = 0.55 + k.r() * 0.9; const cx = Math.min(x + w / 2, x1 - w / 2);
      if (!hole || !hole(cx, y)) k.add(new THREE.PlaneGeometry(w - 0.05, 0.34 + k.r() * 0.06), pal[Math.floor(k.r() * pal.length)], { x: cx, y, z: z + dir * 0.03, ry: dir > 0 ? 0 : Math.PI });
      x += w;
    }
  }
}
// stesse pietre su una parete laterale (normale +x o -x)
function stonesX(k, z0, z1, y0, y1, x, dir, pal, hole) {
  for (let y = y0 + 0.12; y < y1 - 0.1; y += 0.5) {
    let z = z0 + k.r() * 0.4;
    while (z < z1 - 0.2) {
      const w = 0.7 + k.r() * 1.1; const cz = Math.min(z + w / 2, z1 - w / 2);
      if (!hole || !hole(cz, y)) k.add(new THREE.PlaneGeometry(w - 0.06, 0.42), pal[Math.floor(k.r() * pal.length)], { x: x + dir * 0.03, y, z: cz, ry: dir * Math.PI / 2 });
      z += w;
    }
  }
}

export function buildSantaMarta(seed = 1) {
  const L = SANTAMARTA.LEN_M, { HW, H, RIDGE, WALL, AW, AH } = SM, k = new Kit(500 + seed);
  const zc = -L / 2, OW = HW + WALL, zb = -L, PX = 6.3, PX0 = PX + 0.35;
  const facePal = [C.schist, C.schistL, C.schistD, C.schistB, C.schist, '#8a8a88'];
  const inPal = [C.stone, C.stoneL, '#4e4b46', '#6e5e4c', C.stone];
  const sl = Math.atan2(RIDGE - H, OW), len = Math.hypot(RIDGE - H, OW);

  // ---- 5 gradini rossi che si allargano verso il basso; vasi bianchi sull'ultimo
  for (let i = 0; i < SM.STEPS; i++) {
    const h = 0.1 + i * 0.09, w = 10.8 - i * 0.9, z = 3.6 - i * 0.75;
    k.add(G.box(w, h, 0.8), C.step, { y: h / 2, z, vary: 0.04 });
    k.add(G.box(w + 0.06, 0.05, 0.86), C.stepT, { y: h, z });
  }
  for (const s of [-1, 1]) {   // v5s45: vasi fuori dal passaggio della corsia (erano a 4.2 m, sfioravano chi corre a sinistra/destra)
    k.add(G.cyl(0.18, 0.28, 0.5, 10), C.marble, { x: s * 5.3, y: 0.8, z: 0.5 });
    k.add(G.cyl(0.55, 0.22, 0.5, 12), C.marble, { x: s * 5.3, y: 1.3, z: 0.5 });
    k.add(G.sph(0.45, 8, 6), '#4f7a3a', { x: s * 5.3, y: 1.7, z: 0.5, sy: 0.7 });
  }

  // ---- pavimento in cotto a quadri (non un piano rosso unico) e passatoia gialla intrecciata
  k.add(G.box(AW * 2, 0.05, L), '#7a3828', { y: 0.025, z: zc });
  { const tw = 2.4, td = 2.2;
    for (let ix = 0, x = -AW + tw / 2; x < AW; x += tw, ix++) for (let iz = 0, z = -td / 2; z > -L; z -= td, iz++) {
      k.add(G.box(tw - 0.08, 0.035, td - 0.08), (ix + iz) % 2 ? C.floor : C.floorL, { x, y: 0.06, z });
    } }
  // v5s26: la passatoia e' un grande tappeto sa burra (texture, vedi burraRunner); qui solo le frange alle due teste
  for (const zf of [-0.45, -L + 0.45]) k.add(G.box(7.6, 0.03, 0.5), '#efe3c6', { y: 0.1, z: zf });


  // ---- muri esterni delle navatelle (pietra) con nicchie bianche e quadri della Via Crucis
  for (const s of [-1, 1]) {
    const x = s * (AW + WALL / 2);
    k.add(G.box(WALL, AH, L), C.stone, { x, y: AH / 2, z: zc });
    k.add(G.box(AW - PX0, 0.25, L), C.plaster, { x: s * (PX0 + AW) / 2, y: AH, z: zc });                       // soffitto bianco della navatella
    k.add(G.box(AW + WALL - PX0 + 0.4, 0.3, L + 0.6), '#9a4a2e', { x: s * (PX0 + AW + WALL) / 2, y: AH + 0.9, z: zc, rz: -s * 0.33, vary: 0.05 });   // tetto a spiovente
    stonesX(k, zb + 0.3, -0.3, AH - 1.0, AH - 0.3, s * AW, -s, inPal);
  }
  // ---- arcate: pilastri quadrati in pietra e archi tondi in mattoni tra navata e navatelle
  const bay = L / 5;
  for (const s of [-1, 1]) for (let i = 0; i <= 5; i++) {
    const z = -i * bay;
    k.add(G.box(0.9, 4.2, 0.9), C.stone, { x: s * PX, y: 2.1, z: Math.min(-0.6, Math.max(zb + 0.6, z)), vary: 0.06 });
    stonesX(k, z - 0.45, z + 0.45, 0, 4.2, s * (PX - 0.45), -1 * s, inPal);
    if (i < 5) {
      k.add(tor(bay / 2 - 0.45, 0.32, 5, 14, Math.PI), C.brick, { x: s * PX, y: 4.2, z: z - bay / 2, ry: Math.PI / 2, vary: 0.04 });
      k.add(tor(bay / 2 - 0.1, 0.12, 4, 14, Math.PI), C.brickD, { x: s * PX, y: 4.2, z: z - bay / 2, ry: Math.PI / 2 });
      // v5s26: cappella laterale in ogni campata: nicchia bianca, affresco, altare con candele e statua
      const zm = z - bay / 2, xw = s * (AW - 0.06), xi = s * (AW - 0.12);
      k.add(G.box(0.1, AH - 1.0, bay - 1.2), C.plaster, { x: xw, y: (AH - 1.0) / 2 + 0.3, z: zm });
      // (affresco dipinto: texture, vedi frescoes())
      k.add(G.box(0.12, 0.2, bay - 1.8), C.gold, { x: s * (AW - 0.16), y: AH - 0.85, z: zm });
      k.add(tor(1.4, 0.16, 4, 12, Math.PI), C.brick, { x: s * (AW - 0.15), y: AH - 3.4, z: zm, ry: Math.PI / 2 });     // arco della nicchia
      k.add(G.box(1.0, 1.0, 2.0), C.marble, { x: s * (AW - 0.7), y: 0.5, z: zm });                                    // altare
      k.add(G.box(1.1, 0.08, 2.1), '#ffffff', { x: s * (AW - 0.7), y: 1.04, z: zm });
      k.add(G.box(0.06, 0.6, 1.9), i % 2 ? '#c8283a' : '#2f6fb0', { x: s * (AW - 1.22), y: 0.6, z: zm });             // paliotto
      for (const dz of [-0.7, 0.7]) { k.add(G.cyl(0.05, 0.05, 0.4, 5), C.marble, { x: s * (AW - 0.6), y: 1.28, z: zm + dz }); k.add(G.sph(0.07, 5, 4), '#ffd070', { x: s * (AW - 0.6), y: 1.52, z: zm + dz, unlit: true }); }
      k.add(G.cyl(0.26, 0.36, 1.5, 8), ['#c89a3a', '#d8d4d0', '#5a9ac8', '#a83a3a', '#d8d4d0'][i], { x: s * (AW - 0.55), y: 1.08 + 0.75, z: zm });   // statua
      k.add(G.sph(0.2, 8, 6), '#e8c8a8', { x: s * (AW - 0.55), y: 2.8, z: zm });
      k.add(G.box(0.08, 0.7, 0.55), '#3a2a1a', { x: s * (PX0 + 0.05), y: 2.6, z: zm });                               // quadro della Via Crucis sul pilastro
      k.add(G.box(0.1, 0.55, 0.42), i % 2 ? '#7a6a9a' : '#b07850', { x: s * (PX0 + 0.08), y: 2.6, z: zm });
    }
  }
  // muro sopra le arcate (pietra) fino alla volta
  for (const s of [-1, 1]) { k.add(G.box(0.7, H - 5.0, L), C.stone, { x: s * PX, y: 5.0 + (H - 5.0) / 2, z: zc });
    stonesX(k, zb + 0.3, -0.3, 6.6, H - 1.6, s * (PX - 0.35), -s, inPal); }
  // finestrelle alte sopra il tetto delle navatelle (luce)
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) k.add(G.box(0.12, 1.2, 0.8), '#c4a070', { x: s * (PX + 0.38), y: AH + 3.0, z: -i * bay - bay / 2, unlit: true });
  // ---- archi trasversali in mattoni sopra la navata e volta a botte intonacata bianca
  for (let i = 1; i < 5; i++) { const z = -i * bay;
    k.add(tor(PX - 0.5, 0.42, 6, 18, Math.PI), C.brick, { y: H - PX + 0.2, z, vary: 0.04, sz: 1.4 });
    k.add(tor(PX - 0.05, 0.12, 4, 18, Math.PI), C.brickD, { y: H - PX + 0.2, z }); }
  { const v = new THREE.CylinderGeometry(PX - 0.3, PX - 0.3, L, 18, 1, true, Math.PI / 2, Math.PI), ix = v.index.array, n = v.attributes.normal.array;
    for (let j = 0; j < ix.length; j += 3) { const t = ix[j]; ix[j] = ix[j + 2]; ix[j + 2] = t; } for (let j = 0; j < n.length; j++) n[j] = -n[j];
    k.add(v, C.plaster, { y: H - PX + 0.2, z: zc, rx: Math.PI / 2 }); }
  k.add(G.box(OW * 2, 0.3, L), '#6a5a4a', { y: H + 0.15, z: zc });
  // ---- banchi di legno ai lati della passatoia (legno diverso, qualche libro e inginocchiatoio; la navata resta libera)
  for (let z = -2.6, n = 0; z > -L + 5; z -= 1.6, n++) for (const s of [-1, 1]) {
    const x = s * 4.95;
    const wood = ['#7a5434', '#6a482c', '#8a6844', '#5c3c26'][n % 4];
    k.add(G.box(1.7, 0.08, 0.42), wood, { x, y: 0.48 + (n % 3) * 0.015, z, vary: 0.06 });
    k.add(G.box(1.7, 0.36 + (n % 2) * 0.06, 0.07), wood, { x, y: 0.82, z: z - 0.22, vary: 0.06 });
    k.add(G.box(1.74, 0.42, 0.5), C.pewD, { x, y: 0.22, z });
    if (n % 2 === 0) k.add(G.box(0.22, 0.035, 0.16), n % 4 ? '#6a2a22' : '#2a3a55', { x: x + s * 0.25, y: 0.55, z });
    if (n % 3 === 1) k.add(G.box(1.45, 0.05, 0.26), '#4a301c', { x, y: 0.3, z: z + 0.16 });
  }
  // ---- lampadari in ottone con candele accese
  for (let i = 0; i < 5; i += 2) { const z = -i * bay - bay / 2, y = H - 3.4;
    k.add(G.box(0.04, 2.6, 0.04), '#3a2a1a', { y: H - 2.0, z });
    k.add(G.torus(0.7, 0.05, 4, 14), C.gold, { y, z, rx: Math.PI / 2 }); k.add(G.torus(0.4, 0.05, 4, 12), C.gold, { y: y + 0.4, z, rx: Math.PI / 2 });
    for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; k.add(G.sph(0.09, 6, 4), '#fff0c0', { x: Math.cos(a) * 0.7, y: y + 0.15, z: z + Math.sin(a) * 0.7, unlit: true }); } }

  // v5s46c (16): le luci delle navatelle pendono da una lanterna in ferro appesa al soffitto (prima: luce sospesa nel vuoto)
  for (const [lx, ly, lz] of santaMartaAisleLamps()) {
    k.add(G.box(0.035, SM.AH - ly - 0.32, 0.035), '#2a2018', { x: lx, y: (SM.AH + ly + 0.32) / 2, z: lz });
    k.add(G.box(0.36, 0.06, 0.36), '#2a2018', { x: lx, y: ly + 0.3, z: lz });
    k.add(G.box(0.26, 0.42, 0.26), '#ffe2a8', { x: lx, y: ly + 0.05, z: lz, unlit: true });
    for (const [ox, oz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) k.add(G.box(0.03, 0.5, 0.03), '#2a2018', { x: lx + ox, y: ly + 0.05, z: lz + oz });
    k.add(G.box(0.32, 0.05, 0.32), '#2a2018', { x: lx, y: ly - 0.2, z: lz });
  }
  // ---- facciata (davanti) e parete di fondo (abside), con portale ad arco
  const DOOR_W = SM_DOOR_W, DOOR_H = 7.4, DR = DOOR_W / 2;   // v5s45 (QA10 #4): portale piu largo (era 7.6), la frakkera in corsia 0 non attraversa lo stipite
  const inDoor = (x, y) => (Math.abs(x) < DR + 1.1 && y < DOOR_H - DR + 0.2) || Math.hypot(x, y - (DOOR_H - DR)) < DR + 1.1;
  const tri = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-OW, 0), new THREE.Vector2(OW, 0), new THREE.Vector2(0, RIDGE - H)]), { depth: 0.8, bevelEnabled: false });
  for (const front of [true, false]) {
    const zz = front ? 0.4 : zb - 0.4, dir = front ? 1 : -1, zf = zz + dir * 0.4;
    // muro con buco ad arco (fasce verticali + parte alta)
    for (const s of [-1, 1]) k.add(G.box(OW - DR, H, 0.8), C.schist, { x: s * (DR + (OW - DR) / 2), y: H / 2, z: zz });
    k.add(G.box(DOOR_W, H - DOOR_H, 0.8), C.schist, { y: DOOR_H + (H - DOOR_H) / 2, z: zz });

    for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(s * DR, 0); sh.lineTo(s * DR, DR + 0.02); sh.lineTo(0, DR + 0.02);
      sh.absarc(0, 0, DR, Math.PI / 2, s > 0 ? 0 : Math.PI, s > 0); 
      k.add(new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false, curveSegments: 12 }), C.schist, { y: DOOR_H - DR, z: zz - 0.4 }); }
    k.add(tri, C.schist, { y: H, z: zz - 0.4 });
    // cornice a dentelli in mattoni: due fasce sugli spioventi e in orizzontale sotto il timpano non c'e' (foto)
    for (const s of [-1, 1]) {
      const cx = s * OW / 2, cy = H + (RIDGE - H) / 2;
      k.add(G.box(len + 0.9, 0.22, 0.5), C.brick, { x: cx, y: cy + 0.15, z: zf + dir * 0.2, rz: -s * sl });
      k.add(G.box(len + 0.9, 0.14, 0.45), C.brickD, { x: cx, y: cy + 0.42, z: zf + dir * 0.15, rz: -s * sl });
      k.add(G.box(len + 0.9, 0.18, 0.6), C.brick, { x: cx, y: cy + 0.62, z: zf + dir * 0.22, rz: -s * sl });
      if (front) for (let t = 0.03; t < 0.97; t += 0.07) { const px = s * OW * (1 - t), py = H + (RIDGE - H) * t;
        k.add(G.box(0.16, 0.16, 0.3), C.brickD, { x: px, y: py - 0.12, z: zf + dir * 0.12, rz: -s * sl }); }
      // risvolto orizzontale della cornice agli spigoli + lesene
      k.add(G.box(1.6, 0.6, 0.7), C.brick, { x: s * (OW - 0.6), y: H + 0.1, z: zf + dir * 0.2 });
      k.add(G.box(1.1, H, 0.25), C.schistL, { x: s * (OW - 0.55), y: H / 2, z: zf + dir * 0.1, vary: 0.04 });
    }
    // pietre a vista
    if (front) stones(k, -OW + 1.1, OW - 1.1, 0, H, zf, dir, facePal, inDoor);
    if (front) for (let y = H + 0.2; y < RIDGE - 0.6; y += 0.42) { const hw = OW * (1 - (y - H) / (RIDGE - H)) - 0.5;
      for (let x = -hw; x < hw - 0.2;) { const w = 0.55 + k.r() * 0.9; k.add(new THREE.PlaneGeometry(w - 0.05, 0.34), facePal[Math.floor(k.r() * facePal.length)], { x: x + w / 2, y, z: zf + dir * 0.03, ry: dir > 0 ? 0 : Math.PI }); x += w; } }
    if (front) for (const s of [-1, 1]) { stones(k, s > 0 ? OW - 1.1 : -OW, s > 0 ? OW : -OW + 1.1, 0, H, zf + dir * 0.22, dir, [C.schistL, C.schist, '#9a968c']); }
    // v5s26: ali basse delle navatelle ai lati della facciata (chiesa a tre navate)
    for (const s of [-1, 1]) { const ww = AW + WALL - OW, wx = s * (OW + ww / 2);
      k.add(G.box(ww, AH, 0.8), C.schistD, { x: wx, y: AH / 2, z: zz });
      k.add(G.box(ww + 0.5, 0.28, 0.6), C.brick, { x: wx, y: AH + 0.55, z: zf + dir * 0.15, rz: -s * 0.33 });
      if (front) {
        stones(k, s > 0 ? OW + 0.1 : -AW - WALL, s > 0 ? AW + WALL : -OW - 0.1, 0, AH - 0.2, zf, dir, facePal, (x, y) => Math.abs(x - wx) < 0.9 && y > 3.2 && y < 5.6);
        k.add(G.box(1.2, 1.8, 0.1), '#2a2420', { x: wx, y: 4.3, z: zf + 0.06 }); k.add(tor(0.75, 0.16, 4, 10, Math.PI), C.brick, { x: wx, y: 5.2, z: zf + 0.08 });
        k.add(G.box(0.9, 1.5, 0.12), '#c4a070', { x: wx, y: 4.2, z: zf + 0.07, unlit: true });
      } }
    // portale: doppia ghiera di mattoni sull'arco e sugli stipiti
    k.add(tor(DR + 0.25, 0.32, 5, 20, Math.PI), C.brick, { y: DOOR_H - DR, z: zf + dir * 0.05 });
    k.add(tor(DR + 0.85, 0.3, 5, 20, Math.PI), C.brickD, { y: DOOR_H - DR, z: zf + dir * 0.02 });
    for (const s of [-1, 1]) { k.add(G.box(0.6, DOOR_H - DR, 0.95), C.brick, { x: s * (DR + 0.25), y: (DOOR_H - DR) / 2, z: zz + dir * 0.1 });
      k.add(G.box(0.55, DOOR_H - DR, 0.85), C.brickD, { x: s * (DR + 0.85), y: (DOOR_H - DR) / 2, z: zz + dir * 0.05 }); }
    if (front) {
      // ante scure a riquadri, spalancate verso l'interno
      for (const s of [-1, 1]) { const zx = zz - 0.4 - DR / 2;
        k.add(G.box(0.14, DOOR_H - DR - 0.1, DR - 0.1), C.door, { x: s * (DR - 0.2), y: (DOOR_H - DR) / 2, z: zx });
        for (let r = 0; r < 4; r++) for (const c of [-0.45, 0.45]) k.add(G.box(0.06, 0.65, 0.6), C.doorD, { x: s * (DR - 0.3), y: 0.6 + r * 0.95, z: zx + c * DR / 2 }); }
      // oculo tondo con doppia ghiera di mattoni e rosa scura a 8 spicchi
      const oy = H - 2.0;   // v5s26: piu' in alto, muro libero sopra l'arco del portale
      k.add(G.torus(1.25, 0.22, 6, 22), C.brick, { y: oy, z: zf + 0.08 });
      k.add(G.torus(1.65, 0.2, 6, 24), C.brickD, { y: oy, z: zf + 0.05 });
      // v5s46d (261): vetri colorati, non un disco dipinto; la luce cade sulla passatoia (lampada in env)
      const GL = ['#c4323a', '#2f6fb0', '#e0b030', '#3a8a4a', '#f4efe4', '#6a3a8a', '#d86a28', '#3a6a8a'];
      for (let j = 0; j < 8; j++) k.add(G.box(0.62, 0.26, 0.05), GL[j], { y: oy, z: zf + 0.1, rz: (j / 8) * Math.PI * 2, unlit: true });
      k.add(G.cyl(0.26, 0.26, 0.07, 10), '#f6e2a4', { y: oy, z: zf + 0.12, rx: Math.PI / 2, unlit: true });
      k.add(G.torus(0.42, 0.035, 4, 12), '#3a342e', { y: oy, z: zf + 0.14 });
      for (let j = 0; j < 4; j++) k.add(G.box(1.7, 0.045, 0.04), '#3a342e', { y: oy, z: zf + 0.14, rz: j * Math.PI / 4 });
      // croce in ferro con statuina azzurra
      k.add(G.box(0.12, 1.6, 0.12), '#2e2a28', { y: RIDGE + 1.0, z: zz }); k.add(G.box(1.1, 0.12, 0.12), '#2e2a28', { y: RIDGE + 1.3, z: zz });
      k.add(G.cyl(0.12, 0.18, 0.6, 8), '#5a9ac8', { y: RIDGE + 1.6, z: zz + 0.12 }); k.add(G.sph(0.1, 6, 5), '#e8c8a8', { y: RIDGE + 2.0, z: zz + 0.12 });
    } else {
      // abside vista dalla navata: grande arco in mattoni con affresco a fascia (scena di Santa Marta), crocifisso, altare bianco ai lati
      const zi = zb + 0.02;
      k.add(G.box(OW * 2 - 1.6, H - DOOR_H, 0.1), C.stone, { y: DOOR_H + (H - DOOR_H) / 2, z: zi + 0.02 });
      stones(k, -HW + 0.2, HW - 0.2, DOOR_H + 1.6, H, zi + 0.06, 1, inPal);
      k.add(G.box(9.2, 1.6, 0.12), '#d8c8a0', { y: DOOR_H + 0.8, z: zi + 0.1 });   // fondo dell'affresco (dipinto: frescoes())
      k.add(G.box(9.4, 0.15, 0.16), '#f0e8d0', { y: DOOR_H + 0.02, z: zi + 0.12 });
      k.add(tor(5.0, 0.4, 5, 20, Math.PI), C.brick, { y: DOOR_H - 1.0, z: zi + 0.3 });
      k.add(G.box(0.14, 1.4, 0.1), '#3a2a1a', { y: DOOR_H + 2.4, z: zi + 0.2 }); k.add(G.box(0.8, 0.12, 0.1), '#3a2a1a', { y: DOOR_H + 2.7, z: zi + 0.2 });
      k.add(G.box(0.18, 0.7, 0.12), '#d8b088', { y: DOOR_H + 2.4, z: zi + 0.26 });
      for (const s of [-1, 1]) {
        k.add(G.box(1.8, 1.0, 0.8), C.marble, { x: s * 5.0, y: 0.5, z: zb + 0.9 });
        k.add(G.box(1.9, 0.08, 0.9), '#ffffff', { x: s * 5.0, y: 1.04, z: zb + 0.9 });
        k.add(G.sph(0.3, 8, 6), '#d84a5a', { x: s * 5.0 + 0.5, y: 1.3, z: zb + 0.9 });
      }
    }
  }
  // ---- tetto in coppi
  for (const s of [-1, 1]) k.add(G.box(len + 0.6, 0.3, L + 0.6), '#9a4a2e', { x: s * OW / 2, y: H + (RIDGE - H) / 2, z: zc, rz: -s * sl, vary: 0.05 });
  return k.build({ ao: 0.15 });
}
// luci calde interne [x, y, z, intensita']
export function santaMartaLamps() { const L = SANTAMARTA.LEN_M, bay = L / 5; return [0, 2, 4].map((i) => [0, SM.H - 3.6, -i * bay - bay / 2, 1]); }
// v5s26: navatelle illuminate (una luce calda per lato)
export function santaMartaAisleLamps() { const L = SANTAMARTA.LEN_M; return [[-(SM.AW - 2), SM.AH - 1.6, -L * 0.35, 0.8], [SM.AW - 2, SM.AH - 1.6, -L * 0.65, 0.8]]; }
// v5s26: la passatoia della navata e' un unico grande tappeto "sa burra" (lana color crema con motivi a rilievo
// a rombi, fasce e figurine stilizzate in rosso, nero, ocra e verde). Texture su tela: 2 triangoli in tutto.
export function burraRunner() {
  // un solo tappeto Sa Burra (foto 860x557): ogni ripetizione lungo la navata tiene il rapporto, senza stirare
  const Wd = 7.2, tile = Wd / CARPET_ASPECT, n = Math.max(1, Math.round((SANTAMARTA.LEN_M - 1.2) / tile)), L = n * tile;
  const tex = loadCarpetTexture(0, 4);
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, n); tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(Wd, L).rotateX(-Math.PI / 2); geo.translate(0, 0.12, -SANTAMARTA.LEN_M / 2);
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
  return { geo, mat };
}

// v5s26: affreschi dipinti (texture su tela 1024x512, 4 scene): 0 Santa Marta col drago (la tarasca), 1 santi con
// l'aureola, 2 angeli, 3 Deposizione dalla croce (abside). Stile sbiadito: ocra, grigio-azzurro, rosa, bordi screpolati.
function paintFrescoes() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  const OCH = '#c99a5a', ROSE = '#c98a80', BLUE = '#8a9eac', SKIN = '#e6c4a4', DRK = '#5a4638', GOLD = '#d9b860', GRN = '#8a9a6a';
  const cell = (i, f) => { const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 256; x.save(); x.translate(ox, oy);
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#a9b8c2'); g.addColorStop(0.62, '#c8c8bc'); g.addColorStop(1, '#c8ae86'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    f(); // bordo rosso scuro e screpolature, intonaco caduto sui bordi
    x.strokeStyle = '#8a3a2a'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 246);
    let sd = i * 97 + 13; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    x.strokeStyle = 'rgba(70,50,40,0.35)'; x.lineWidth = 1;
    for (let n = 0; n < 14; n++) { x.beginPath(); let px = rnd() * 512, py = rnd() * 256; x.moveTo(px, py); for (let m = 0; m < 5; m++) { px += (rnd() - 0.5) * 60; py += (rnd() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = 'rgba(236,226,206,0.85)'; for (let n = 0; n < 9; n++) { const ex = rnd() < 0.5 ? rnd() * 40 : 472 + rnd() * 40; x.beginPath(); x.ellipse(ex, rnd() * 256, 10 + rnd() * 25, 8 + rnd() * 20, rnd() * 3, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(240,232,215,0.22)'; x.fillRect(0, 0, 512, 256);   // patina sbiadita
    x.restore(); };
  const figure = (cx, by, h, robe, mantle, halo = true, arms = 0) => {
    x.fillStyle = robe; x.beginPath(); x.moveTo(cx - h * 0.2, by); x.lineTo(cx - h * 0.12, by - h * 0.7); x.lineTo(cx + h * 0.12, by - h * 0.7); x.lineTo(cx + h * 0.2, by); x.fill();
    x.fillStyle = mantle; x.beginPath(); x.moveTo(cx - h * 0.14, by - h * 0.68); x.quadraticCurveTo(cx - h * 0.26, by - h * 0.3, cx - h * 0.08, by - h * 0.05); x.lineTo(cx + h * 0.02, by - h * 0.6); x.fill();
    if (arms) { x.strokeStyle = SKIN; x.lineWidth = h * 0.05; x.beginPath(); x.moveTo(cx, by - h * 0.62); x.lineTo(cx + arms * h * 0.25, by - h * 0.8); x.stroke(); }
    if (halo) { x.fillStyle = GOLD; x.beginPath(); x.arc(cx, by - h * 0.8, h * 0.13, 0, 7); x.fill(); x.strokeStyle = '#a8803a'; x.lineWidth = 2; x.stroke(); }
    x.fillStyle = SKIN; x.beginPath(); x.arc(cx, by - h * 0.8, h * 0.08, 0, 7); x.fill();
    x.fillStyle = DRK; x.fillRect(cx - h * 0.03, by - h * 0.8, h * 0.015, h * 0.015); x.fillRect(cx + h * 0.02, by - h * 0.8, h * 0.015, h * 0.015);
  };
  const ground = () => { x.fillStyle = GRN; x.beginPath(); x.moveTo(0, 210); x.quadraticCurveTo(256, 180, 512, 205); x.lineTo(512, 256); x.lineTo(0, 256); x.fill(); };
  cell(0, () => { ground(); // Santa Marta con l'aspersorio e la tarasca legata alla cintura
    figure(200, 226, 190, ROSE, BLUE, true, 1);
    x.strokeStyle = DRK; x.lineWidth = 3; x.beginPath(); x.moveTo(250, 75); x.lineTo(262, 60); x.stroke();
    x.fillStyle = '#6a8a5a'; x.beginPath(); x.ellipse(360, 200, 80, 26, 0, 0, 7); x.fill();      // drago
    x.beginPath(); x.moveTo(430, 195); x.quadraticCurveTo(470, 150, 450, 120); x.lineTo(440, 130); x.quadraticCurveTo(450, 170, 415, 188); x.fill();
    x.beginPath(); x.ellipse(290, 178, 26, 18, -0.3, 0, 7); x.fill(); x.fillStyle = '#c84a3a'; x.beginPath(); x.moveTo(266, 180); x.lineTo(250, 188); x.lineTo(268, 186); x.fill();
    x.fillStyle = '#4a6a4a'; for (let j = 0; j < 6; j++) { x.beginPath(); x.moveTo(320 + j * 18, 176); x.lineTo(328 + j * 18, 160); x.lineTo(336 + j * 18, 176); x.fill(); }
    x.strokeStyle = '#8a7050'; x.lineWidth = 2; x.beginPath(); x.moveTo(215, 150); x.quadraticCurveTo(250, 190, 285, 185); x.stroke(); });
  cell(1, () => { ground(); [[110, OCH, BLUE], [256, BLUE, ROSE], [402, ROSE, OCH]].forEach(([cx, a, b], j) => figure(cx, 228, 180, a, b, true, j === 1 ? -1 : 0)); });
  cell(2, () => { // angeli in volo tra le nuvole
    x.fillStyle = 'rgba(240,236,228,0.8)'; for (const [cx, cy] of [[90, 200], [250, 220], [420, 205]]) { x.beginPath(); x.ellipse(cx, cy, 90, 22, 0, 0, 7); x.fill(); }
    for (const [cx, by, dir] of [[150, 200, 1], [362, 200, -1]]) { x.fillStyle = '#efe6d8'; x.beginPath(); x.moveTo(cx, by - 110); x.quadraticCurveTo(cx - dir * 110, by - 170, cx - dir * 140, by - 60); x.quadraticCurveTo(cx - dir * 60, by - 90, cx, by - 80); x.fill();
      figure(cx, by, 150, ROSE, OCH, true, dir); }
    x.fillStyle = GOLD; x.beginPath(); x.arc(256, 70, 30, 0, 7); x.fill(); });
  cell(3, () => { ground(); // Deposizione: croce al centro, il Cristo sorretto, le pie donne e san Giovanni
    x.fillStyle = '#6a4a32'; x.fillRect(248, 20, 16, 200); x.fillRect(190, 50, 132, 14);
    x.strokeStyle = '#8a7a6a'; x.lineWidth = 3; x.beginPath(); x.moveTo(205, 58); x.lineTo(150, 190); x.stroke(); x.beginPath(); x.moveTo(307, 58); x.lineTo(362, 190); x.stroke();
    x.fillStyle = '#e8d2b8'; x.save(); x.translate(256, 150); x.rotate(-0.5); x.fillRect(-12, -60, 24, 110); x.restore();
    x.fillStyle = GOLD; x.beginPath(); x.arc(230, 92, 16, 0, 7); x.fill(); x.fillStyle = SKIN; x.beginPath(); x.arc(230, 92, 10, 0, 7); x.fill();
    figure(80, 232, 160, BLUE, ROSE); figure(150, 232, 170, ROSE, BLUE, true, 1); figure(362, 232, 170, OCH, ROSE, true, -1); figure(440, 232, 160, BLUE, OCH); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// piani con le scene: nicchie delle cappelle laterali (10) e fascia sopra l'abside
export function frescoes() {
  const L = SANTAMARTA.LEN_M, bay = L / 5, { AW, AH } = SM, ps = [];
  const quad = (w, h, cellI, mat4) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, u0 = (cellI % 2) * 0.5, v0 = cellI < 2 ? 0.5 : 0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5); g.applyMatrix4(mat4); ps.push(g); };
  const M = (x, y, z, ry) => new THREE.Matrix4().makeRotationY(ry).premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) quad(bay - 2.0, 2.0, [0, 1, 2, 1, 0][i], M(s * (AW - 0.13), AH - 2.0, -i * bay - bay / 2, -s * Math.PI / 2));
  quad(9.0, 1.5, 3, M(0, 7.4 + 0.8, -L + 0.2, 0));
  const geo = mergeGeometries(ps); const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: typeof document !== 'undefined' ? paintFrescoes() : null });
  return { geo, mat };
}
