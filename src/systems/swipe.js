// v5s45 (#10): direzione di uno swipe. Si decide solo dopo `min` px di movimento, con l'asse dominante:
// un piccolo scarto laterale all'inizio di uno swipe verso l'alto non diventa piu' un cambio di corsia.
export const SWIPE_PX = 16;   // piu' pronto: lo swipe si chiude prima, il secondo gesto sulla stessa dita non si perde
export function classifySwipe(dx, dy, min = SWIPE_PX) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.max(ax, ay) < min) return null;
  if (ax > ay) return dx > 0 ? 'right' : 'left';
  return dy < 0 ? 'up' : 'down';
}
