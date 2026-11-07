// v5 stage 20: correzioni (carrello, ballo, corteo). Uso: node tests/sim-s20.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator } from '../src/systems/generator.js';
import { WORLD, CART, DANCE, PX_PER_METER } from '../src/config.js';
import { byId, biomeAt } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const OFF = byId['mine-int'].from - 5;
// 1) velocita' del carrello senza scatti
{
  const sim = new Sim(() => {}, { mapOffsetM: OFF }); sim.startRun(77);
  let prev = 0, maxJump = 0, wasCart = false, exits = 0;
  for (let i = 0; i < 120 * 30 && sim.mode === 'run'; i++) { sim.fuel = 100; sim.invuln = 1; sim.tick(DT);
    if (prev && sim.slowT > 1) maxJump = Math.max(maxJump, Math.abs(sim.currentSpeed - prev)); prev = sim.currentSpeed;
    if (wasCart && !sim.cart) exits++; wasCart = !!sim.cart; }
  ok('salita/discesa senza salti di velocita', maxJump < 6, maxJump.toFixed(2));
  ok('discesa avvenuta', exits === 1);
}
// 2) uno scambio conta solo i propri binari interrotti
{
  const sim = new Sim(() => {}, { mapOffsetM: OFF }); sim.startRun(5);
  for (let i = 0; i < 120 * 30 && sim.mode === 'run'; i++) {
    sim.fuel = 100;
    const sc = sim.entities.filter((e) => e.kind === 'scambio' && !e.done && e.d - sim.T > 0).sort((a, b) => a.d - b.d)[0];
    // al primo scambio si sbaglia apposta, poi si gioca bene
    if (sc && sc.junction > 1 && sc.d - sim.T < 160 && !sc.open.includes(sim.targetLane)) { const t = sc.open.reduce((b, l) => (Math.abs(l - sim.targetLane) < Math.abs(b - sim.targetLane) ? l : b), sc.open[0]); sim.move(Math.sign(t - sim.targetLane)); }
    sim.tick(DT);
  }
  const T = sim.events.filter((e) => e[1] === 'T');
  ok('dopo un errore gli scambi seguenti valgono', T.length >= 3 && T.slice(1).filter((e) => e[2] > 0).length >= T.length - 2, JSON.stringify(T.map((e) => e[2])));
}
// 3) morte nel carrello e riavvio: stato pulito
{
  const sim = new Sim(() => {}, { mapOffsetM: OFF }); sim.startRun(9);
  for (let i = 0; i < 120 * 12 && !sim.cart; i++) { sim.fuel = 100; sim.tick(DT); }
  const inCart = !!sim.cart; sim.fuel = 0;
  for (let i = 0; i < 120 * 6 && sim.mode !== 'over'; i++) sim.tick(DT);
  ok('morte nel carrello -> game over', inCart && sim.mode === 'over');
  sim.startRun(10);
  ok('riavvio: niente carrello, velocita normale', !sim.cart && sim.cartSpK === 1 && sim.cartLap === -1);
}
// 4) nessuna maschera nel cerchio del ballo; carrelli fermi al punto di salita
{
  let bad = 0, carts = 0, cartBad = 0;
  for (let seed = 1; seed < 120; seed++) {
    const g = new Generator(seed), a = []; g.fillUntil(WORLD.LEAD_IN + 1500 * WORLD.ROW, (e) => a.push(e));
    for (const e of a) {
      const bi = biomeAt(e.d / PX_PER_METER);
      if (['maimoni', 'fune', 'fuso'].includes(e.kind) && bi.b.id === 'village' && bi.lap >= 1 && bi.local > DANCE.AT_M - 45 && bi.local < DANCE.AT_M + 25) bad++;
      if (e.kind === 'carrello') { carts++; const l = (e.d + e.len / 2) / PX_PER_METER - (bi.b.from + CART.FROM_M) - bi.lap * 0; if (bi.b.id !== 'mine-int' || Math.abs(bi.local - CART.FROM_M) > 2) cartBad++; }
    }
  }
  ok('corteo mai nel cerchio del ballu tundu', bad === 0, bad);
  ok('carrelli fermi al punto di salita', carts > 0 && cartBad === 0, `${carts}/${cartBad}`);
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK');
process.exit(fail ? 1 : 0);
