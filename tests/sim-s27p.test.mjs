// v5 stage 27p: fune centrata e saltabile; calamita che porta i tappeti dritti al personaggio.
// Uso: node tests/sim-s27p.test.mjs
import { Sim } from '../src/game/sim.js';
import { WORLD, DUCK, MASKS, POWER } from '../src/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
function base(seed = 777) { const sim = new Sim(() => {}); sim.startRun(seed); for (let i = 0; i < 60; i++) sim.tick(DT); sim.entities = []; sim.parades = {}; sim.gen.fillUntil = () => {}; return sim; }
const put = (sim, e, ahead) => { sim.spawn({ ...e, d: sim.T - sim.genOffset + ahead }); return sim.entities[sim.entities.length - 1]; };
const run = (sim, n, f) => { for (let i = 0; i < n; i++) { sim.fuel = 100; if (f) f(i); sim.tick(DT); } };
// fune: centrata (x = 0) su tutte le corsie
{ const sim = base(); const f = put(sim, { kind: 'fune', lane: 1, len: DUCK.BEAM_LEN, group: 2 }, 120); ok('fune centrata', sim.entX(f) === 0); }
// salto normale, in vari momenti prima della fune: passa sempre
for (const lead of [0.12, 0.2, 0.28, 0.36]) {
  const sim = base(); const f = put(sim, { kind: 'fune', lane: 1, len: DUCK.BEAM_LEN, group: 2 }, 160);
  let j = false; run(sim, 300, () => { if (!j && f.d - sim.T < sim.currentSpeed * lead) j = sim.jump(); });
  ok(`fune: salto ${lead}s prima = passa`, j && f.jumped && sim.stats.hits === 0);
}
{ const sim = base(); const f = put(sim, { kind: 'fune', lane: 1, len: DUCK.BEAM_LEN, group: 2 }, 160); run(sim, 300);
  ok('fune: senza saltare = urto', f.hit && !f.jumped && sim.stats.hits === 1 && sim.events.some((e) => e[1] === 'h' && e[2] === MASKS.HIT_FUNE)); }
// calamita: il tappeto vola dritto al personaggio e viene preso prima che la sua fila arrivi
{ const sim = base(); sim.magnetT = 5; const c0 = sim.stats.carpets;
  const t = put(sim, { kind: 'tappeto', lane: 0, len: 12, pickup: true }, 250); const row0 = t.d;
  let min = 1e9, aheadAtGrab = null; run(sim, 200, () => { if (!t.done) { min = Math.min(min, Math.hypot(sim.entX(t) - sim.px, t.d - sim.T)); aheadAtGrab = row0 - sim.T; } });
  ok('calamita: tappeto raccolto (contatore +1)', sim.stats.carpets - c0 === 1);
  ok('calamita: preso in volo, prima che la sua fila arrivi', aheadAtGrab > 40, aheadAtGrab && aheadAtGrab.toFixed(0));
}
// calamita: cambio di corsia a meta' volo, lo segue lo stesso
{ const sim = base(); sim.magnetT = 5; const c0 = sim.stats.carpets;
  const t = put(sim, { kind: 'tappeto', lane: 2, len: 12, pickup: true }, 300); let moved = false;
  run(sim, 240, (i) => { if (i === 8) { sim.move(-1); sim.move(-1); moved = true; } });
  ok('calamita: segue il personaggio che cambia corsia', moved && t.done && sim.stats.carpets - c0 === 1);
}
// determinismo
{ const go = () => { const sim = base(); sim.magnetT = 5; for (const l of [0, 1, 2]) put(sim, { kind: 'tappeto', lane: l, len: 12, pickup: true }, 200 + l * 30); const tr = []; run(sim, 120, () => tr.push(sim.entities.map((e) => [e.mx, e.d]))); return JSON.stringify(tr); };
  ok('calamita deterministica', go() === go()); }
if (fail) { console.log(`${fail} FAIL`); process.exit(1); } else console.log('tutto ok');
