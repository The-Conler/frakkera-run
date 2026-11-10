// v5s45 (QA10 #6): molla della presa integrata a passo fisso. Con dt grandi (frame lenti, fino a 0.25 s) l'Eulero
// semi-implicito con k=70 / c=7.5 diventava instabile: la frakkera girava fino a capovolgersi con la fiamma a terra.
export const SPRING_H = 1 / 120, SPRING_MAX = 0.6;   // passo fisso e limite di sicurezza (rad)
export function stepCarrySpring(sg, tgt, dt) {
  const n = Math.min(40, Math.max(1, Math.ceil(dt / SPRING_H))), h = dt / n;
  for (let i = 0; i < n; i++) {
    sg.v += ((tgt - sg.a) * 70 - sg.v * 7.5) * h; sg.a += sg.v * h;
    sg.pv += ((0 - sg.p) * 55 - sg.pv * 6) * h; sg.p += sg.pv * h;
  }
  if (Math.abs(sg.a) > SPRING_MAX) { sg.a = Math.sign(sg.a) * SPRING_MAX; sg.v = 0; }
  if (Math.abs(sg.p) > SPRING_MAX) { sg.p = Math.sign(sg.p) * SPRING_MAX; sg.pv = 0; }
}

