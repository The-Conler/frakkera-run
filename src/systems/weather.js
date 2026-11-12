// v5s25: meteo deterministico per distanza (stesso risultato per tutti, nessun RNG di partita)
import { WEATHER } from '../config.js';
import { CYCLE, biomeAt } from '../game/biomes/config.js';
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Seme 0: l'alternanza storica (test). Un seme di partita sceglie pioggia o neve giro per giro, sempre allo stesso modo.
const roll = (seed, lap) => {
  let h = ((seed >>> 0) ^ Math.imul(lap + 1, 0x9e3779b1)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
export const rainLap = (lap, seed = 0) => {
  if (lap < WEATHER.RAIN_FROM_LAP) return false;
  if (!seed) return (lap - WEATHER.RAIN_FROM_LAP) % 2 === 0;
  return roll(seed, lap) < 0.5;
};
// intensita' della pioggia 0..1 alla distanza b (m dall'inizio del ciclo, con offset)
export function rainAt(b, seed = 0) {
  const x = Math.max(0, b), lap = Math.floor(x / CYCLE), f = (x - lap * CYCLE) / CYCLE;
  if (!rainLap(lap, seed)) return 0;
  return sm(0, 0.05, f) * (1 - sm(0.95, 1, f));
}
const hash = (n) => { let h = (n * 0x9e3779b1) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
// densita' della nebbia 0..1 (chiazze nella valle: roccia e fiume)
export function fogAt(b) {
  const x = Math.max(0, b);
  if (!WEATHER.FOG_BIOMES.includes(biomeAt(x).b.id)) return 0;
  const B = WEATHER.FOG_BLOCK_M, i = Math.floor(x / B);
  if (hash(i + 17) >= WEATHER.FOG_P) return 0;
  const len = WEATHER.FOG_LEN_M[0] + hash(i + 991) * (WEATHER.FOG_LEN_M[1] - WEATHER.FOG_LEN_M[0]);
  const s = i * B + hash(i + 4242) * (B - len), l = x - s;
  if (l < 0 || l > len) return 0;
  return sm(0, 8, l) * (1 - sm(len - 8, len, l));
}
