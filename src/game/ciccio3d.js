// v5s45 (18): "Ciccio" - pickup bianco doppia cabina (tipo Nissan Navara/Frontier), low-poly nello stile del gioco.
// Carrozzeria bianca, calandra nera, vetri scuri, cassone col rivestimento nero, cerchi in lega argento. Niente marchi.
// Origine: centro a terra; il muso guarda +z (verso chi corre, il camion arriva contro mano). Lungo 5.2 m, largo 1.9 m.
import { Kit, G } from './kit.js';
let geo = null;
export function ciccioGeom() {
  if (geo) return geo;
  const k = new Kit(4545);
  const WH = '#f4f4f0', WH2 = '#dcdcd8', BLK = '#1c1d20', GLS = '#2a3440', SIL = '#c4c8cc', RED = '#c8202a', AMB = '#f0a020';
  const W = 1.9, L = 5.2, zF = L / 2, zR = -L / 2;
  // telaio basso + paraurti
  k.add(G.box(W - 0.1, 0.32, L - 0.3), '#2a2b2e', { y: 0.42 });
  k.add(G.box(W + 0.04, 0.26, 0.22), '#3a3b3e', { y: 0.55, z: zF - 0.05 });              // paraurti anteriore
  k.add(G.box(W + 0.04, 0.22, 0.2), '#3a3b3e', { y: 0.55, z: zR + 0.05 });               // paraurti posteriore
  // muso (cofano) e fianchi della cabina
  k.add(G.box(W, 0.62, 1.45), WH, { y: 0.98, z: zF - 0.85 });                            // cofano/parafanghi
  k.add(G.box(W - 0.08, 0.08, 1.3), WH2, { y: 1.33, z: zF - 0.9, rx: -0.06 });           // piano del cofano
  k.add(G.box(W - 0.3, 0.42, 0.06), BLK, { y: 0.98, z: zF + 0.02 });                     // calandra nera
  for (const sx of [-1, 1]) {
    k.add(G.box(0.34, 0.16, 0.05), '#fff6d8', { x: sx * 0.68, y: 1.1, z: zF + 0.04, unlit: true });   // fari
    k.add(G.box(0.2, 0.08, 0.05), AMB, { x: sx * 0.68, y: 0.95, z: zF + 0.04, unlit: true });
  }
  // cabina doppia
  const cz0 = zF - 1.55, cz1 = cz0 - 2.0;
  k.add(G.box(W, 0.62, cz0 - cz1), WH, { y: 0.98, z: (cz0 + cz1) / 2 });                 // portiere
  k.add(G.box(W - 0.12, 0.66, cz0 - cz1 - 0.3), WH, { y: 1.62, z: (cz0 + cz1) / 2 - 0.1 });   // abitacolo
  k.add(G.box(W - 0.2, 0.06, cz0 - cz1 - 0.45), WH2, { y: 1.97, z: (cz0 + cz1) / 2 - 0.12 });  // tetto
  k.add(G.box(W - 0.22, 0.56, 0.06), GLS, { y: 1.62, z: cz0 - 0.08, rx: 0.32 });          // parabrezza
  for (const sx of [-1, 1]) {
    k.add(G.box(0.05, 0.46, 0.8), GLS, { x: sx * (W / 2 - 0.05), y: 1.64, z: cz0 - 0.65 });  // finestrino anteriore
    k.add(G.box(0.05, 0.46, 0.72), GLS, { x: sx * (W / 2 - 0.05), y: 1.64, z: cz0 - 1.5 });   // finestrino posteriore
    k.add(G.box(0.12, 0.1, 0.18), BLK, { x: sx * (W / 2 + 0.06), y: 1.4, z: cz0 - 0.28 });   // specchietti
    k.add(G.box(0.04, 0.05, 0.22), BLK, { x: sx * (W / 2 + 0.01), y: 1.18, z: cz0 - 0.5 });  // maniglie
    k.add(G.box(0.04, 0.05, 0.22), BLK, { x: sx * (W / 2 + 0.01), y: 1.18, z: cz0 - 1.4 });
  }
  k.add(G.box(W - 0.22, 0.46, 0.06), GLS, { y: 1.64, z: cz1 + 0.12 });                   // lunotto
  // cassone con rivestimento nero
  const bz0 = cz1 - 0.02, bz1 = zR + 0.08, bl = bz0 - bz1;
  k.add(G.box(W, 0.12, bl), BLK, { y: 0.74, z: (bz0 + bz1) / 2 });                        // fondo
  for (const sx of [-1, 1]) {
    k.add(G.box(0.08, 0.6, bl), WH, { x: sx * (W / 2 - 0.04), y: 1.0, z: (bz0 + bz1) / 2 });
    k.add(G.box(0.05, 0.48, bl - 0.1), BLK, { x: sx * (W / 2 - 0.11), y: 1.02, z: (bz0 + bz1) / 2 });   // rivestimento
    k.add(G.box(0.08, 0.2, 0.06), RED, { x: sx * 0.78, y: 1.08, z: zR + 0.06, unlit: true });           // fanali posteriori
  }
  k.add(G.box(W, 0.6, 0.08), WH, { y: 1.0, z: zR + 0.08 });                               // sponda
  // ruote: gomme nere e cerchi in lega argento
  for (const sx of [-1, 1]) for (const z of [zF - 0.95, zR + 1.05]) {
    k.add(G.cyl(0.4, 0.4, 0.3, 14), '#141416', { x: sx * (W / 2 - 0.06), y: 0.4, z, rz: Math.PI / 2 });
    k.add(G.cyl(0.25, 0.25, 0.32, 10), SIL, { x: sx * (W / 2 - 0.05), y: 0.4, z, rz: Math.PI / 2 });
    k.add(G.box(0.34, 0.06, 0.06), '#8a8e92', { x: sx * (W / 2 - 0.04), y: 0.4, z, rx: 0.6 });
    k.add(G.box(0.34, 0.06, 0.06), '#8a8e92', { x: sx * (W / 2 - 0.04), y: 0.4, z, rx: -0.6 });
    k.add(G.box(0.12, 0.12, 0.98), '#202124', { x: sx * (W / 2 + 0.02), y: 0.86, z, });   // passaruota
  }
  geo = k.build({ ao: 0.15 });
  return geo;
}
