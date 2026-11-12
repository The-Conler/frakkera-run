// Cartellone di Tolu sul muro di testa della casa (z = 0, da x = -6 alla via).
// Il tetto a padiglione appoggia sulla gronda e sporge verso chi arriva: il timpano
// visibile e' quel rettangolo, non un triangolo. Il piano copre il muro bordo a bordo,
// con uno zoccolo basso e un filo d'intonaco sotto il tetto.
// Foto 768x1010: il viso e' a sinistra, il fascio arriva al bordo destro. Se il muro
// e' piu' alto della foto si taglia la punta del fascio, non la faccia. Niente stiramento.
const MURAL_IMG_A = 768 / 1010;

export function endWallMural(geom) {
  const P = geom.attributes.position;
  let xMin = Infinity, xMax = -Infinity, top = 0, n = 0;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (Math.abs(z) > 0.03 || x < -6.05 || x > 0.05) continue;
    n++;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y > top) top = y;
  }
  if (n < 4 || !(top > 2)) return null;
  const side = 0.04, plinth = 0.34, underRoof = 0.1;
  const x0 = xMin + side, x1 = xMax - side;
  const y0 = plinth, y1 = top - underRoof;
  const w = x1 - x0, h = y1 - y0;
  if (!(w > 1 && h > 1)) return null;
  const wallA = w / h;
  let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
  if (wallA < MURAL_IMG_A - 1e-4) u1 = wallA / MURAL_IMG_A;
  else if (wallA > MURAL_IMG_A + 1e-4) {
    const span = MURAL_IMG_A / wallA;
    const trim = (1 - span) / 2;
    v0 = trim; v1 = 1 - trim;
  }
  return { w, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, u0, u1, v0, v1, top };
}
