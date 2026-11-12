// v5 stage 25: salto, migliorie permanenti, notte di pioggia, nebbia nella valle.
// Uso: node tests/sim-power2.test.mjs
import { Sim } from '../src/game/sim.js';
import { Generator } from '../src/systems/generator.js';
import { biomeAt, CYCLE } from '../src/game/biomes/config.js';
import { rainAt, rainLap, fogAt } from '../src/systems/weather.js';
import { snowAt } from '../src/game/snow.js';
import { WORLD, POWER, UPGRADES, WEATHER, FUEL, PX_PER_METER } from '../src/config.js';

const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
const mk = (o = {}) => { const sim = new Sim(() => {}, o); sim.startRun(5); for (let i = 0; i < 120; i++) sim.tick(DT); sim.clearEntities(); sim.gen.fillUntil = () => {}; return sim; };
const at = (sim, a) => sim.T - sim.genOffset + a;
const runUntilNear = (sim, e, gap, act) => { for (let i = 0; i < 2000; i++) { if (e.d - sim.T < gap) { act(); return; } sim.tick(DT); } };
{ // salto sopra la botte
  const sim = mk(); sim.shield = 0; const e = { kind: 'botte', lane: sim.targetLane, d: at(sim, 150), len: 14 }; sim.spawn(e);
  runUntilNear(sim, e, 22, () => sim.jump()); for (let i = 0; i < 120; i++) sim.tick(DT);
  ok('salto: botte superata', sim.stats.jumped === 1 && sim.stats.hits === 0);
  ok('log a', sim.events.some((x) => x[1] === 'a'));
  const s2 = mk(); s2.shield = 0; const e2 = { kind: 'botte', lane: s2.targetLane, d: at(s2, 150), len: 14 }; s2.spawn(e2); for (let i = 0; i < 300; i++) s2.tick(DT);
  ok('senza salto: urto', s2.stats.hits === 1);
  const s3 = mk(); s3.shield = 0; const b = { kind: 'trave', lane: 1, d: at(s3, 150), len: 10 }; s3.spawn(b);
  runUntilNear(s3, b, 22, () => s3.jump()); for (let i = 0; i < 120; i++) s3.tick(DT);
  ok('salto: la trave NON si salta', s3.stats.hits === 1);
  const s4 = mk(); s4.jump(); ok('niente salto mentre si e\' in aria', !s4.jump());
}
{ // migliorie
  const store = { calamita: 3, finocchio: 1, fiamma: 2 };
  const sim = mk({ getUpgrades: () => store });
  ok('log V con i livelli', sim.events.some((x) => x[1] === 'V' && x[2] === (3 | (1 << 2) | (2 << 6))));
  sim.powerUp('calamita', {}); ok('calamita lv3 = 16 s', Math.abs(sim.magnetT - (POWER.MAGNET_S + 6)) < 1e-9, sim.magnetT);
  sim.powerUp('finocchio', {}); ok('finocchio lv1 = 6.5 s', Math.abs(sim.fennelT - 6.5) < 1e-9);
  const a = mk(), b = mk({ getUpgrades: () => ({ fiamma: 3 }) }); a.fuel = b.fuel = 80;
  for (let i = 0; i < Math.ceil(3 / DT); i++) { a.tick(DT); b.tick(DT); a.fuel = Math.max(a.fuel, 20); }
  ok('fiamma lv3 consuma meno', 80 - b.fuel < (80 - a.fuel) * 0.85, `${(80 - b.fuel).toFixed(2)} vs ${(80 - a.fuel).toFixed(2)}`);
  let total = 500; const saved = {};
  const s = mk({ carpetTotal: 500, spendCarpets: (n) => (total >= n ? (total -= n) : -1), getUpgrades: () => ({ ...saved }), setUpgrade: (id, l) => { saved[id] = l; } });
  s.mode = 'shop'; s.shop = { buys: {}, count: 0 };
  const p = UPGRADES.find((u) => u.id === 'scarponi').prices;
  const r1 = s.buyUpgrade('scarponi'), r2 = s.buyUpgrade('scarponi'), r3 = s.buyUpgrade('scarponi'), r4 = s.buyUpgrade('scarponi');
  ok('3 livelli, prezzi crescenti', r1.ok && r2.ok && r3.ok && !r4.ok && r4.why === 'massimo' && total === 500 - p[0] - p[1] - p[2], total);
  ok('salvato in locale', saved.scarponi === 3);
  ok('non conta nel tetto per visita', s.shop.count === 0);
  const poor = mk({ carpetTotal: 10 }); poor.mode = 'shop'; poor.shop = { buys: {}, count: 0 };
  ok('tappeti insufficienti', poor.buyUpgrade('fiamma').why === 'tappeti');
}
{ // pioggia
  ok('giri di pioggia', !rainLap(0) && !rainLap(2) && rainLap(3) && !rainLap(4) && rainLap(5));
  ok('rainAt nel giro 4', rainAt(CYCLE * 3.5) > 0.99 && rainAt(CYCLE * 2.5) === 0);
  ok('niente neve sotto la pioggia', snowAt(CYCLE * 3.5).fall === 0 && snowAt(CYCLE * 3.5).ground < 0.01);
  const g = new Generator(31), out = []; g.fillUntil(WORLD.LEAD_IN + CYCLE * 6 * PX_PER_METER, (e) => out.push(e));
  const pd = out.filter((e) => e.kind === 'acqua');
  ok('pozzanghere solo nei giri di pioggia', pd.length > 20 && pd.every((e) => rainLap(biomeAt(e.d / PX_PER_METER).lap, g.seed)), pd.length);
  const sim = mk(); const ref = mk(); const e = { kind: 'acqua', lane: sim.targetLane, d: at(sim, 30), len: 14 }; sim.spawn(e);
  let slowed = false; for (let i = 0; i < 200; i++) { sim.tick(DT); ref.tick(DT); if (sim.wetT > 0 && sim.currentSpeed < ref.currentSpeed * 0.9) slowed = true; }
  ok('pozzanghera rallenta un poco, senza danno', slowed && sim.stats.wetSlows === 1 && sim.stats.hits === 0);
}
{ // nebbia
  let inFog = 0, bad = 0;
  for (let m = 0; m < CYCLE * 2; m += 1) { const f = fogAt(m); if (f > 0) { inFog++; if (!WEATHER.FOG_BIOMES.includes(biomeAt(m).b.id)) bad++; } }
  ok('nebbia solo sulla roccia (v5s28: niente a Sa Stiddiosa)', inFog > 50 && bad === 0, inFog);
  ok('nebbia deterministica', fogAt(612.3) === fogAt(612.3));
}
console.log(fail ? `\n${fail} FALLITI` : '\nTUTTI OK'); process.exit(fail ? 1 : 0);
