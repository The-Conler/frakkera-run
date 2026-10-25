// v5 stage 10: maschere del carnevale di Gadoni (su Maimoni, Stramaionis con la fune, sa Grastula).
// Uso: node tests/sim-masks.test.mjs
import { Sim } from '../src/game/sim.js';
import { WORLD, PISTOL, DUCK, MASKS } from '../src/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
function base(seed = 777) {
  const fx = []; const sim = new Sim((t, d) => fx.push([t, d])); sim.startRun(seed);
  for (let i = 0; i < 60; i++) sim.tick(DT);
  sim.entities = []; sim.parades = {}; sim.gen.fillUntil = () => {};
  return { sim, fx };
}
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
const run = (sim, n, f) => { for (let i = 0; i < n; i++) { sim.fuel = 100; if (f) f(i); sim.tick(DT); } };
// 1) Maimoni: campanacci prima, poi zig-zag (rimbalza), urto = HIT_MAIMONI
{
  const { sim, fx } = base(); const m = put(sim, { kind: 'maimoni', lane: 0, len: 12, dir: 1, vx: 40, group: 1 }, 700);
  let bellAt = null; run(sim, 1500, () => { if (bellAt === null && fx.some((f) => f[0] === 'sound' && f[1] === 'cowbell')) bellAt = m.d - sim.T; });
  ok('maimoni: campanacci prima che arrivi', bellAt !== null && bellAt > 300, `${bellAt && bellAt.toFixed(0)} px`);
  ok('maimoni: zig-zag tra le corsie', (m.zig || 0) >= 1 || m.hit, `zig ${m.zig}`);
  const b = base(); const m2 = put(b.sim, { kind: 'maimoni', lane: 1, len: 12, dir: 1, vx: 0, group: 1 }, 80); m2.x = 0;
  const f0 = 100; b.sim.fuel = f0; for (let i = 0; i < 200; i++) b.sim.tick(DT);
  ok('maimoni: urto costa carburante (h)', m2.hit && b.sim.events.some((e) => e[1] === 'h' && e[2] === MASKS.HIT_MAIMONI));
}
// 2) fune su 2 corsie: abbassarsi = passa (j), altrimenti urto; la terza corsia e' libera
{
  const { sim } = base(); const f = put(sim, { kind: 'fune', lane: 0, len: DUCK.BEAM_LEN, group: 2 }, 120);
  run(sim, 300); ok('fune: senza abbassarsi = urto', f.hit && !f.ducked && sim.events.some((e) => e[1] === 'h' && e[2] === MASKS.HIT_FUNE));
  const b = base(); const f2 = put(b.sim, { kind: 'fune', lane: 0, len: DUCK.BEAM_LEN, group: 2 }, 120);
  let d = false; run(b.sim, 300, () => { if (!d && f2.d - b.sim.T < b.sim.currentSpeed * 0.25) d = b.sim.duck(); });
  ok('fune: abbassato = passa (j)', f2.ducked && b.sim.stats.hits === 0 && b.sim.events.some((e) => e[1] === 'j'));
  const c = base(); put(c.sim, { kind: 'fune', lane: 1, len: DUCK.BEAM_LEN, group: 2 }, 120); c.sim.targetLane = 0; run(c.sim, 300);
  ok('fune: la corsia fuori dalla fune e\' libera', c.sim.stats.hits === 0);
}
// 3) Grastula: segno a terra ~1 s prima del fuso, lancio registrato (J)
{
  const { sim, fx } = base(); const s = put(sim, { kind: 'fuso', lane: 1, len: 12, side: 1, group: 3, last: true }, 900);
  let warnT = null, throwT = null; run(sim, 1500, (i) => {
    if (warnT === null && fx.some((f) => f[0] === 'spindleWarn')) warnT = i * DT;
    if (throwT === null && s.landed) throwT = i * DT; });
  ok('fuso: segno a terra ~1 s prima del lancio', warnT !== null && throwT !== null && throwT - warnT > 0.7 && throwT - warnT < 1.3, `${warnT} ${throwT}`);
  ok('fuso: lancio nel registro (J) e urto', sim.events.some((e) => e[1] === 'J') && s.hit && sim.events.some((e) => e[1] === 'h' && e[2] === MASKS.HIT_FUSO));
}
// 4) pistola: il colpo attraversa le maschere senza effetto
{
  const { sim } = base(); const m = put(sim, { kind: 'fuso', lane: 1, len: 12, side: 1, group: 4, last: true }, 150);
  sim.ammo = PISTOL.AMMO; sim.fire(); let passed = false; run(sim, 40, () => { if (sim.shots.some((p) => p.d > m.d + m.len)) passed = true; });
  ok('pistola: il colpo passa attraverso sa Grastula', passed && !m.done && !m.destroyed && sim.stats.obst === 0);
}
// 5) corteo intero senza urti = BRAVU! +200 (M); con un urto niente bonus
function parade(hitOne) {
  const { sim, fx } = base(); sim.targetLane = 1;
  const m = put(sim, { kind: 'maimoni', lane: 0, len: 12, dir: 1, vx: 0, group: 9 }, 150); m.x = -200;
  const f = put(sim, { kind: 'fune', lane: hitOne ? 0 : 1, len: DUCK.BEAM_LEN, group: 9 }, 260);
  put(sim, { kind: 'fuso', lane: 0, len: 12, side: -1, group: 9, last: true }, 380);
  let d = false; run(sim, 900, () => { if (!hitOne && !d && f.d - sim.T < sim.currentSpeed * 0.25) d = sim.duck(); });
  return { sim, fx };
}
{
  const a = parade(false);
  ok('corteo passato: BRAVU! +200 (M)', a.sim.events.some((e) => e[1] === 'M' && e[2] === MASKS.BONUS) && a.fx.some((f) => f[0] === 'popup' && /BRAVU!/.test(f[1].text)), JSON.stringify(a.sim.stats));
  const b = parade(true);
  ok('corteo con urto: niente BRAVU', !b.sim.events.some((e) => e[1] === 'M') && b.sim.stats.hits >= 1);
}
// 6) deterministico: stessa partita = stesso log (con cortei)
{
  const go = () => { const s = new Sim(() => {}); s.startRun(4242); for (let i = 0; i < 120 * 90; i++) { s.fuel = 100; if (i % 97 === 0) s.move(i % 194 ? 1 : -1); if (i % 61 === 0) s.duck(); s.tick(DT); } return JSON.stringify(s.events); };
  const a = go(); ok('deterministico (stesso log)', a === go());
}
console.log(fail ? `FALLITO: ${fail}` : 'OK: maschere di Gadoni');
process.exit(fail ? 1 : 0);
