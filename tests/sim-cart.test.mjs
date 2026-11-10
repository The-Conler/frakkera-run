// v5 stage 18: giro in carrello nella galleria di Funtana Raminosa. Salita e discesa decise dalla
// distanza, scambi con binari interrotti (sempre almeno un binario aperto), cambio binario con lo
// swipe, tutto nel log (R salita, T scambio, r discesa). Uso: node tests/sim-cart.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator, cartAt } from '../src/systems/generator.js';
import { WORLD, CART, PX_PER_METER } from '../src/config.js';
import { byId } from '../src/game/biomes/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const OFF = byId['mine-int'].from - 5;   // si parte poco prima della galleria
// giocatore automatico: guarda il prossimo scambio e si mette su un binario aperto
function play(seed, smart = true) {
  const sim = new Sim(() => {}, { mapOffsetM: OFF }); sim.startRun(seed);
  let inCart = 0, hitsInCart = 0;
  for (let i = 0; i < 120 * 30 && sim.mode === 'run'; i++) {
    sim.fuel = 100;
    if (smart) {
      const sc = sim.entities.filter((e) => e.kind === 'scambio' && !e.done && e.d - sim.T > 0).sort((a, b) => a.d - b.d)[0];
      if (sc && sc.d - sim.T < 160 && !sc.open.includes(sim.targetLane)) {
        const tgt = sc.open.reduce((b, l) => (Math.abs(l - sim.targetLane) < Math.abs(b - sim.targetLane) ? l : b), sc.open[0]);
        sim.move(Math.sign(tgt - sim.targetLane));
      }
    }
    sim.tick(DT);
    if (sim.cart) inCart++;
    if (sim.cart) hitsInCart = sim.stats.hits;
  }
  return { sim, inCart, hitsInCart };
}
{
  const a = play(77), b = play(77);
  const ev = (s, c) => s.events.filter((e) => e[1] === c);
  ok('salita in carrello registrata (R)', ev(a.sim, 'R').length === 1);
  ok('discesa registrata (r)', ev(a.sim, 'r').length === 1 && !a.sim.cart);
  const ride = a.inCart * DT * a.sim.currentSpeed / PX_PER_METER;
  ok('giro lungo il tratto previsto', a.inCart > 120, `${(a.inCart * DT).toFixed(1)} s`);
  ok('scambi superati tutti (giocatore attento)', a.sim.stats.junctions >= 3 && a.sim.stats.deadends === 0 && a.hitsInCart === 0, `${a.sim.stats.junctions} scambi`);
  ok('punti degli scambi nel log (T)', ev(a.sim, 'T').every((e) => e[2] === CART.PTS_JUNCTION));
  ok('deterministico: stesso log', JSON.stringify(a.sim.events) === JSON.stringify(b.sim.events) && JSON.stringify(a.sim.inputs) === JSON.stringify(b.sim.inputs));
  // v5s45: il primo scambio ora interrompe un solo binario (grazia dopo la salita): si cerca il primo seme che urta
  let c = play(77, false); for (let sd = 78; sd < 100 && c.sim.stats.deadends < 1; sd++) c = play(sd, false);
  ok('fermo sul binario: prima o poi un binario interrotto', c.sim.stats.deadends >= 1, `${c.sim.stats.deadends}`);
  ok('il registro della discesa conta gli scambi ok', ev(c.sim, 'r')[0]?.[2] < ev(c.sim, 'T').length);
}
// generatore: in ogni scambio almeno un binario aperto, carrelli fermi su tutti i binari, niente ostacoli normali
{
  let bad = 0, js = 0, carts = 0;
  for (let s = 1; s <= 80; s++) {
    const ents = []; new Generator(s * 31, { mapOffsetM: 0 }).fillUntil(40000, (e) => ents.push(e));
    for (const e of ents) {
      const c = cartAt(e.d / PX_PER_METER, 0, 0);
      if (e.kind === 'carrello') carts++;
      if (e.kind === 'scambio') { js++; const blocked = ents.filter((o) => o.kind === 'deadend' && o.junction === e.junction && Math.abs(o.d - e.d) < 1).map((o) => o.lane); if (blocked.length > 2 || blocked.includes(e.lane)) bad++; }
      if (c && c.local > 2 && !['deadend', 'scambio', 'tappeto', 'minatore', 'lampada', 'falo', 'narrow'].includes(e.kind)) bad++;
    }
  }
  ok('scambi sempre con un binario aperto, niente ostacoli normali nel tratto', bad === 0 && js > 100, `${js} scambi, ${bad} errori`);
  ok('tre carrelli fermi a ogni salita', carts % 3 === 0 && carts > 0, `${carts}`);
}
console.log(fail ? `FALLITO: ${fail}` : 'OK: giro in carrello');
process.exit(fail ? 1 : 0);
