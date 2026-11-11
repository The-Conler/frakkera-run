// v5s46d: regole pure (stelle, orologio, finestra del Garag). Niente Three, cosi' i test node le importano.
// Le stelle compaiono solo quando il sole e' gia' sotto: un tramonto con la luna a meta' non le accende.
export function starOpacity(moon, sun) {
  const m = Math.max(0, +moon || 0);
  const s = Math.max(0, +sun || 0);
  const night = s >= 0.42 ? 0 : s <= 0.12 ? 1 : (0.42 - s) / 0.30;
  return m * 0.9 * night;
}

// Lancette in radianti, senso orario, mezzogiorno = 0 (verso l'alto, rotazione Three attorno a Z).
// tSec e' il tempo di gioco in secondi: le lancette si muovono, non restano sulle 10:10.
export function clockHandAngles(tSec) {
  const t = Number.isFinite(+tSec) ? +tSec : 0;
  const sec = ((t % 60) + 60) % 60;
  const totMin = t / 60;
  const min = ((totMin % 60) + 60) % 60;
  const hr = (((t / 3600) % 12) + 12) % 12;
  const minute = -((min + sec / 60) / 60) * Math.PI * 2;
  const hour = -((hr + (totMin % 60) / 60) / 12) * Math.PI * 2;
  return { hour, minute };
}

// Il banner del Garag vale solo davanti al negozio (metri locali del paese).
export function shopInWindow(local, from, until) {
  return local >= from && local <= until;
}
