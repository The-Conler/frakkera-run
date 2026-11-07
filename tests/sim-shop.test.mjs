// v5 stage 7: Garag di Pinu - offerta a ogni ritorno al paese, sim congelata nel negozio,
// acquisti con i tappeti passati dalla sim e dal log (E/B/X), tetto per visita, scudo.
// Uso: node tests/sim-shop.test.mjs
import { Sim } from '../src/game/sim.js';
import { SHOP, WORLD, PISTOL, FUEL } from '../src/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
function toVillage(total = 200, script) {
  let wallet = total; const fx = [];
  const sim = new Sim((t, d) => fx.push([t, d]), { carpetTotal: wallet, addCarpets: (n) => (wallet += n), spendCarpets: (n) => (n > wallet ? -1 : (wallet -= n)) });
  sim.startRun(4242); sim.gen.fillUntil = () => {};
  let guard = 0;
  while (sim.shopOffer <= 0 && guard++ < 300000) { sim.fuel = 100; sim.tick(DT); }
  return { sim, fx, wallet: () => wallet };
}
// 1) offerta al ritorno al paese (giro 2, ~1600 m), non al primo passaggio
const a = toVillage();
const m = a.sim.runD / 10;
ok('offerta al ritorno al paese (~1606 m)', m >= 1600 && m < 1620 && a.sim.events.some((e) => e[1] === 'O' && e[2] === 1), `${m.toFixed(1)} m`);
ok('offerta annunciata alla UI (shopOffer)', a.fx.some((f) => f[0] === 'shopOffer'));
// 2) entrare congela la corsa
const T0 = a.sim.T, step0 = a.sim.step;
ok('entra da Pinu', a.sim.enterShop() && a.sim.mode === 'shop');
for (let i = 0; i < 500; i++) a.sim.tick(DT);
ok('sim congelata nel negozio (T e passi fermi, fiamma ferma)', a.sim.T === T0 && a.sim.step === step0);
// 3) acquisti
a.sim.fuel = 40; a.sim.ammo = 0;
const r1 = a.sim.buy('pistola'), r2 = a.sim.buy('asfodelo'), r3 = a.sim.buy('scudo'), r4 = a.sim.buy('asfodelo');
ok('pistola: 3 colpi', r1.ok && a.sim.ammo === PISTOL.AMMO);
ok('asfodelo: fiamma piena', r2.ok && a.sim.fuel === FUEL.MAX);
ok('scudo comprato', r3.ok && a.sim.shield === 1);
ok('tetto per visita (max 3)', !r4.ok && r4.why === 'tetto', JSON.stringify(r4));
const spent = SHOP.ITEMS.reduce((s, it) => s + it.price, 0);
ok('tappeti spesi dal totale persistente', a.wallet() === 200 - spent && a.sim.carpetTotal === 200 - spent, `${a.wallet()}`);
ok('acquisti nel log (B) e negli input', a.sim.events.filter((e) => e[1] === 'B').length === 3 && a.sim.inputs.filter((x) => x[1] === 'B').length === 3);
ok('esci: la corsa riparte', a.sim.exitShop() && a.sim.mode === 'run' && a.sim.events.some((e) => e[1] === 'X' && e[2] === 3));
for (let i = 0; i < 20; i++) a.sim.tick(DT);
ok('dopo l\'uscita la corsa avanza', a.sim.T > T0);
// 4) scudo para un urto
a.sim.spawn({ kind: 'muretto', lane: a.sim.targetLane, d: a.sim.T - a.sim.genOffset + 40, len: 14 });
const f0 = a.sim.fuel; for (let i = 0; i < 120; i++) a.sim.tick(DT);
ok('scudo para l\'urto (Z, niente fiamma persa per l\'urto)', a.sim.stats.shields === 1 && a.sim.stats.hits === 0 && a.sim.events.some((e) => e[1] === 'Z') && a.sim.shield === 0, `fuel ${f0.toFixed(1)} -> ${a.sim.fuel.toFixed(1)}`);
// 5) tappeti insufficienti, offerta scaduta senza entrare
const b = toVillage(10);
b.sim.enterShop(); const rb = b.sim.buy('pistola');
ok('tappeti insufficienti: niente acquisto', !rb.ok && rb.why === 'tappeti' && b.wallet() === 10);
const c = toVillage();
for (let i = 0; i < Math.ceil(SHOP.OFFER_S / DT) + 5; i++) { c.sim.fuel = 100; c.sim.tick(DT); }
ok('offerta scade (Q) e non si entra piu\'', c.sim.shopOffer === 0 && !c.sim.enterShop() && c.sim.events.some((e) => e[1] === 'Q'));
ok('niente offerta al primo passaggio nel paese', !c.sim.events.some((e) => e[1] === 'O' && e[2] === 0));
// 6) determinismo: stessa sequenza => stesso log
const go = () => { const x = toVillage(); x.sim.enterShop(); x.sim.buy('asfodelo'); x.sim.exitShop(); for (let i = 0; i < 600; i++) { x.sim.fuel = 100; x.sim.tick(DT); } return JSON.stringify([x.sim.events, x.sim.inputs]); };
ok('deterministico', go() === go());
console.log(fail ? `FALLITO: ${fail}` : 'OK: Garag di Pinu');
process.exit(fail ? 1 : 0);
