// v5s29: regole pure della camera (testabili senza WebGL)
// Sguardo in alto verso la torre di roccia: SOLO al primo giro (lap 0); dal secondo giro camera normale.
export function towerLookK(biomeId, local, lap) {
  if (lap >= 1 || biomeId !== 'rock' || local < 0) return 0;
  return local > 150 ? 0 : Math.max(0, Math.min(1, (local + 10) / 20, (150 - local) / 15));
}
// quanto alzare il punto guardato / la camera / il fov: il corridore resta a ~75% dell'altezza (sopra il pulsante SPARA)
export const TOWER_LOOK = { lookY: 1.2, camY: 0.4, fov: 7 };   // v5s29: soprattutto campo piu' largo (la cima entra) invece di alzare lo sguardo
