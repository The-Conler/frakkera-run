// v5 stage 24: chiesa di Santa Marta (Gadoni) attraversata di corsa: su per i gradini rossi, dentro dal portone,
// lungo la navata (la passatoia gialla e' la strada), fuori dal portale posteriore. Riferimenti:
// target6-santamarta-facciata/navata/interno. Coordinate locali: facciata a z = 0, la corsa va verso -z.
// Solo grafica (la sim legge solo SANTAMARTA in config.js per tenere la navata libera da ostacoli).
import * as THREE from 'three';
import { Kit, G } from '../../kit.js';
import { SANTAMARTA } from '../../../config.js';

const C = { schist: '#7a6e62', schistD: '#62584e', brick: '#a5553a', brickD: '#8a4630', stone: '#9c9284', plaster: '#d8cbb2',
  floor: '#b8674a', runner: '#e2b33c', runnerB: '#b88a26', pew: '#6b4429', wood: '#4a2e1c', step: '#a8442e', marble: '#efe9de', gold: '#e0b450' };
const tor = (r, t, rs, ts, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const SM = { HW: 7.2, H: 11.5, RIDGE: 15.5, STEPS: 4, WALL: 0.8 };

export function buildSantaMarta(seed = 1) {
  const L = SANTAMARTA.LEN_M, { HW, H, RIDGE, WALL } = SM, k = new Kit(500 + seed);
  const zc = -L / 2;
  // ---- gradini rossi davanti al portone (rampa bassa: la corsa non salta) e urne bianche
  for (let i = 0; i < SM.STEPS; i++) k.add(G.box(HW * 2 - 1, 0.12 + i * 0.1, 1.0), C.step, { y: (0.12 + i * 0.1) / 2, z: 4 - i * 1.0, vary: 0.05 });
  for (const s of [-1, 1]) { k.add(G.cyl(0.35, 0.5, 0.25, 10), C.marble, { x: s * 5.6, y: 0.55, z: 1.2 }); k.add(G.sph(0.55, 10, 7), C.marble, { x: s * 5.6, y: 1.1, z: 1.2, sy: 1.1 }); k.add(G.cyl(0.45, 0.3, 0.2, 10), C.marble, { x: s * 5.6, y: 1.75, z: 1.2 }); }
  // ---- pavimento in cotto e passatoia gialla tessuta lungo le corsie
  k.add(G.box(HW * 2, 0.08, L), C.floor, { y: 0.04, z: zc, vary: 0.08 });
  for (let z = -1; z > -L; z -= 1.2) k.add(G.box(HW * 2, 0.085, 0.05), '#8f4c36', { y: 0.045, z });
  k.add(G.box(8.6, 0.1, L - 1), C.runnerB, { y: 0.06, z: zc });
  k.add(G.box(8.0, 0.11, L - 1), C.runner, { y: 0.065, z: zc, vary: 0.06 });
  for (let z = -1.5; z > -L + 1; z -= 2.2) k.add(G.box(8.0, 0.115, 0.25), '#c94a2a', { y: 0.07, z });   // righe tessute
  // ---- muri laterali in pietra, con archi in mattoni su pilastri e cappelle con statue
  const bay = L / 6;
  for (const s of [-1, 1]) {
    const x = s * (HW + WALL / 2);
    k.add(G.box(WALL, H, L), C.stone, { x, y: H / 2, z: zc, vary: 0.05 });
    for (let i = 0; i <= 6; i++) {
      const z = -i * bay;
      k.add(G.box(1.0, 5.2, 1.0), C.stone, { x: s * (HW - 0.4), y: 2.6, z, vary: 0.06, flat: true });   // pilastro
      if (i < 6) {
        // arco in mattoni (mezzo toro) verso la cappella
        k.add(tor(bay / 2 - 0.5, 0.35, 5, 10, Math.PI), C.brick, { x: s * (HW - 0.35), y: 5.2, z: z - bay / 2, ry: Math.PI / 2, sx: 1, sy: 0.9 });
        k.add(G.box(0.3, 3.8, bay - 1.4), C.plaster, { x: s * (HW - 0.05), y: 2.4, z: z - bay / 2 });          // fondo della cappella
        if (i % 2 === 0) {   // statua su piedistallo
          k.add(G.box(0.8, 1.0, 0.8), C.marble, { x: s * (HW - 0.55), y: 0.5, z: z - bay / 2 });
          k.add(G.cyl(0.25, 0.4, 1.5, 8), i % 4 ? '#3a5aa0' : '#8a2a2a', { x: s * (HW - 0.55), y: 1.75, z: z - bay / 2 });
          k.add(G.sph(0.22, 8, 6), '#e8c8a8', { x: s * (HW - 0.55), y: 2.7, z: z - bay / 2 });
        } else k.add(G.box(0.12, 2.0, 1.6), '#8a6a4a', { x: s * (HW - 0.2), y: 3.0, z: z - bay / 2 });            // affresco/quadro
        k.add(G.box(0.14, 1.6, 1.2), '#d8a85a', { x: s * (HW - 0.12), y: 3.0, z: z - bay / 2, unlit: i % 2 === 1 });
      }
    }
    // archi trasversali in mattoni sopra la navata (si vedono arrivare, ritmo leggibile)
  }
  for (let i = 1; i < 6; i++) {
    const z = -i * bay;
    k.add(tor(HW - 0.5, 0.45, 5, 14, Math.PI), C.brick, { y: 4.6, z, vary: 0.05 });
    k.add(G.box(1.0, 1.2, 1.0), C.brickD, { x: -(HW - 0.5), y: 4.6, z }); k.add(G.box(1.0, 1.2, 1.0), C.brickD, { x: HW - 0.5, y: 4.6, z });
  }
  // ---- banchi di legno ai lati (fuori dalle corsie: la corsa passa sulla passatoia)
  for (let z = -3; z > -L + 6; z -= 1.6) for (const s of [-1, 1]) {
    k.add(G.box(1.6, 0.12, 0.5), C.pew, { x: s * 5.2, y: 0.5, z, vary: 0.06 });
    k.add(G.box(1.6, 0.6, 0.1), C.pew, { x: s * 5.2, y: 0.85, z: z - 0.25, vary: 0.06 });
    for (const dx of [-0.75, 0.75]) k.add(G.box(0.1, 0.9, 0.55), C.wood, { x: s * 5.2 + dx, y: 0.45, z });
  }
  // ---- soffitto a capriate e tetto in coppi
  k.add(G.box(HW * 2 + WALL * 2, 0.3, L), '#5a3a26', { y: H, z: zc });
  for (let z = -1; z > -L; z -= 2.5) k.add(G.box(HW * 2, 0.35, 0.35), C.wood, { y: H - 0.3, z });
  const sl = Math.atan2(RIDGE - H, HW + WALL), len = Math.hypot(RIDGE - H, HW + WALL);
  for (const s of [-1, 1]) k.add(G.box(len + 0.6, 0.3, L + 0.6), '#9a4a2e', { x: s * (HW + WALL) / 2, y: H + (RIDGE - H) / 2, z: zc, rz: -s * sl, vary: 0.05 });
  // ---- lampadari (luce calda, unlit)
  for (let i = 1; i < 6; i += 2) { const z = -i * bay - bay / 2;
    k.add(G.box(0.05, 3.0, 0.05), '#3a2a1a', { y: H - 1.5, z });
    k.add(G.torus(0.8, 0.06, 4, 12), C.gold, { y: H - 3.1, z, rx: Math.PI / 2 });
    for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; k.add(G.sph(0.12, 6, 5), '#ffe3a0', { x: Math.cos(a) * 0.8, y: H - 2.9, z: z + Math.sin(a) * 0.8, unlit: true }); } }
  // ---- abside: altare bianco a lato, crocifisso e affresco (sopra il portale di uscita)
  const zb = -L;
  for (const s of [-1, 1]) {
    k.add(G.box(2.4, 1.1, 1.0), C.marble, { x: s * 5.0, y: 0.55, z: zb + 1.4 });   // altari laterali, fuori dalle corsie
    for (const c of [-0.6, 0.6]) k.add(G.cyl(0.08, 0.08, 0.6, 6), C.gold, { x: s * 5.0 + c, y: 1.4, z: zb + 1.4 });
  }
  // ---- facciata in scisto (davanti) e parete posteriore, entrambe con grande portale ad arco in mattoni
  const DOOR_W = 9.4, DOOR_H = 6.2;
  for (const [z, front] of [[0, true], [zb, false]]) {
    const zz = z + (front ? 0.4 : -0.4);
    for (const s of [-1, 1]) k.add(G.box((HW * 2 + WALL * 2 - DOOR_W) / 2, H, 0.8), C.schist, { x: s * (DOOR_W / 2 + (HW * 2 + WALL * 2 - DOOR_W) / 4), y: H / 2, z: zz, vary: 0.06 });
    k.add(G.box(DOOR_W, H - DOOR_H, 0.8), C.schist, { y: DOOR_H + (H - DOOR_H) / 2, z: zz, vary: 0.06 });
    // timpano
    const tri = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-HW - WALL, 0), new THREE.Vector2(HW + WALL, 0), new THREE.Vector2(0, RIDGE - H)]), { depth: 0.8, bevelEnabled: false });
    k.add(tri, C.schistD, { y: H, z: zz - 0.4 });
    // cornice rossa in mattoni (orizzontale + spioventi)
    k.add(G.box(HW * 2 + WALL * 2 + 0.4, 0.4, 1.0), C.brick, { y: H, z: zz });
    for (const s of [-1, 1]) k.add(G.box(len + 0.4, 0.35, 1.0), C.brick, { x: s * (HW + WALL) / 2, y: H + (RIDGE - H) / 2 + 0.15, z: zz, rz: -s * sl });
    // arco del portale in mattoni e stipiti
    k.add(tor(DOOR_W / 2 - 0.15, 0.45, 5, 16, Math.PI), C.brick, { y: DOOR_H - 2.5, z: zz + (front ? 0.3 : -0.3), sy: 0.55 });
    for (const s of [-1, 1]) k.add(G.box(0.6, DOOR_H - 0.6, 1.0), C.brick, { x: s * (DOOR_W / 2 - 0.15), y: (DOOR_H - 0.6) / 2, z: zz });
    // ante di legno scuro spalancate verso l'interno, contro il muro
    for (const s of [-1, 1]) k.add(G.box(0.15, DOOR_H - 1.0, DOOR_W / 2 - 0.5), C.wood, { x: s * (DOOR_W / 2 - 0.6), y: (DOOR_H - 1.0) / 2, z: zz + (front ? -1 : 1) * (DOOR_W / 4 + 0.2), vary: 0.05 });
    if (front) {
      // rosone tondo incorniciato di mattoni e croce in cima
      k.add(G.torus(1.3, 0.3, 6, 18), C.brick, { y: 8.9, z: zz + 0.45 });
      k.add(G.cyl(1.25, 1.25, 0.1, 16), '#e8c070', { y: 8.9, z: zz + 0.42, rx: Math.PI / 2, unlit: true });
      for (let j = 0; j < 4; j++) k.add(G.box(2.4, 0.1, 0.12), '#5a3a22', { y: 8.9, z: zz + 0.5, rz: j * Math.PI / 4 });
      k.add(G.box(0.25, 1.8, 0.25), '#3a3030', { y: RIDGE + 0.9, z: zz }); k.add(G.box(1.1, 0.25, 0.25), '#3a3030', { y: RIDGE + 1.2, z: zz });
    } else {
      // affresco dell'abside sopra il portale di uscita, crocifisso
      k.add(new THREE.CylinderGeometry(2.6, 2.6, 0.1, 16, 1, false, 0, Math.PI), '#7a8ab0', { y: DOOR_H + 1.0, z: zz + 0.45, rx: Math.PI / 2, rz: Math.PI / 2 });
      k.add(G.box(3.6, 1.4, 0.12), '#c8a070', { y: DOOR_H + 1.9, z: zz + 0.5 });
      k.add(G.box(0.18, 1.6, 0.15), '#5a3a22', { y: DOOR_H + 3.3, z: zz + 0.55 }); k.add(G.box(1.0, 0.18, 0.15), '#5a3a22', { y: DOOR_H + 3.6, z: zz + 0.55 });
      k.add(G.box(2.0, 0.3, 0.6), C.marble, { y: DOOR_H + 0.3, z: zz + 0.6 });
    }
  }
  return k.build({ ao: 0.15 });
}
// luci calde interne [x, y, z, intensita']
export function santaMartaLamps() { const L = SANTAMARTA.LEN_M, bay = L / 6; return [1, 3, 5].map((i) => [0, SM.H - 3.0, -i * bay - bay / 2, 1]).concat([[0, 8.9, 0.5, 0.8]]); }
