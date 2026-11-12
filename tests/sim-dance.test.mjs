// v5 stage 11: ballu tundu (una volta per giro nella piazza, ritmo, SALTA senza penalita').
// Uso: node tests/sim-dance.test.mjs
import { Sim } from '../src/game/sim.js';
import { WORLD, DANCE, PX_PER_METER } from '../src/config.js';
import { CYCLE } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT;
let fail = 0; const ok = (n, c, info = '') => { console.log((c ? '  PASS ' : '  FAIL ') + n + (info ? `  [${info}]` : '')); if (!c) fail++; };
// corsa senza ostacoli fino alla piazza (salto di mappa nel paese)
function toSquare(offM = CYCLE + DANCE.AT_M - 30, seed = 99) {
  const fx = []; const sim = new Sim((t, d) => fx.push([t, d]), { mapOffsetM: offM }); sim.startRun(seed);
  sim.gen.fillUntil = () => {};
  for (let i = 0; i < 120 * 40 && sim.mode !== 'dance'; i++) { sim.fuel = 100; sim.entities = []; sim.tick(DT); }
  return { sim, fx };
}
// suona lo spartito: 'perfect' | 'good' | 'none' | 'wrong'
function play(sim, how) {
  const d = sim.dance; let guard = 0;
  while (sim.mode === 'dance' && guard++ < 120 * 60) {
    if (how !== 'none') for (const n of d.notes) if (!n.res && !n.sent && d.t >= n.t + (how === 'good' ? 0.11 : 0)) { n.sent = true; sim.danceInput(how === 'wrong' ? (n.dir + 1) % 4 : n.dir); }
    sim.tick(DT);
  }
}
{
  const { sim, fx } = toSquare();
  ok('cue launeddas prima del ballo (2-3 s)', fx.some((f) => f[0] === 'danceCue') && fx.some((f) => f[0] === 'sound' && f[1] === 'danceCue'));
  const cueStep = sim.events.find((e) => e[1] === 'A' && e[2] < 100)[0], startStep = sim.events.find((e) => e[1] === 'A' && e[2] >= 100)[0];
  const s = (startStep - cueStep) * DT;
  ok('il cue arriva 2-3 s prima (la corsa rallenta)', s >= 2 && s <= 3.6, `${s.toFixed(2)} s`);
  ok('il ballo parte nella piazza', sim.mode === 'dance' && sim.dance.lap === 1);
  { const f2 = []; const s0 = new Sim((t, d) => f2.push([t, d]), { mapOffsetM: 120 }); s0.startRun(99); s0.gen.fillUntil = () => {}; for (let i = 0; i < 120 * 12; i++) { s0.fuel = 100; s0.entities = []; s0.tick(DT); } ok('niente ballo al primo giro', s0.mode !== 'dance' && !f2.some((f) => f[0] === 'danceCue')); }
  const d = sim.dance; const r = d.rounds;
  ok('giri di 8-10 s', r.every((x) => x.n * 60 / x.bpm >= 8 && x.n * 60 / x.bpm <= 10), JSON.stringify(r));
  sim.fuel = 60; const score0 = sim.score, fuel0 = sim.fuel;
  play(sim, 'perfect');
  const st = sim.stats;
  ok('tutto Perfetto: punti, combo, tappeti, fiamma piu\' grande', st.dancePerfect === d.notes.length && sim.score > score0 + 1000 && st.carpets >= 1 && sim.fuel > fuel0, `pts ${sim.score - score0} carpets ${st.carpets}`);
  ok('dopo il ballo si riprende a correre', sim.mode === 'run');
  ok('registro: P e Y', sim.events.some((e) => e[1] === 'P') && sim.events.some((e) => e[1] === 'Y' && e[2] > 0));
  ok('una sola volta per giro', (() => { for (let i = 0; i < 120 * 10; i++) { sim.fuel = 100; sim.entities = []; sim.tick(DT); } return sim.stats.dances === 1 && sim.mode === 'run'; })());
}
{
  const a = toSquare(); play(a.sim, 'good');
  ok('Bene: meno punti di Perfetto', a.sim.stats.danceGood > 0 && a.sim.stats.dancePerfect === 0);
  const b = toSquare(); const f0 = b.sim.fuel, sc0 = b.sim.score; play(b.sim, 'none');
  ok('fallito: niente bonus e un po\' di carburante', b.sim.stats.danceMiss === b.sim.stats.danceMiss && b.sim.score === sc0 && b.sim.fuel < f0 && b.sim.events.some((e) => e[1] === 'Y' && e[2] === 0), `${f0} -> ${b.sim.fuel}`);
  const c = toSquare(); play(c.sim, 'wrong');
  ok('freccia sbagliata = Mancato', c.sim.stats.danceMiss > 0 && c.sim.stats.dancePerfect === 0);
}
{
  const { sim } = toSquare(); const f0 = sim.fuel, sc0 = sim.score;
  sim.skipDance();
  ok('SALTA: nessuna penalita\', si riparte', sim.mode === 'run' && sim.fuel === f0 && sim.score === sc0 && sim.events.some((e) => e[1] === 'K'));
  // SALTA durante il cue: il ballo non parte
  const fx = []; const s2 = new Sim((t, d) => fx.push([t, d]), { mapOffsetM: CYCLE + DANCE.AT_M - 30 }); s2.startRun(5); s2.gen.fillUntil = () => {};
  for (let i = 0; i < 120 * 30; i++) { s2.fuel = 100; s2.entities = []; if (s2.danceCue && !s2.skipped) { s2.skipped = s2.skipDance(); } s2.tick(DT); }
  ok('SALTA durante il cue: niente ballo', s2.skipped && s2.stats.dances === 0 && s2.mode === 'run');
}
{
  const s = new Sim(() => {}); s.seed = 1;
  const b = [0, 1, 2, 3].map((l) => s.danceChart(l).bpm);
  ok('il tempo sale a ogni giro', b[0] < b[1] && b[1] < b[2] && b[2] < b[3], b.join(','));
  ok('spartito deterministico', JSON.stringify(s.danceChart(2)) === JSON.stringify(s.danceChart(2)));
  // ballo solo nei giri pari (2, 4, 6...): in codice lap 1, 3, 5 (il primo paese e' lap 0)
  const skip = toSquare(2 * CYCLE + DANCE.AT_M - 30);
  ok('niente ballo al giro dispari (lap 2)', skip.sim.mode !== 'dance' && !skip.fx.some((f) => f[0] === 'danceCue'));
  const { sim } = toSquare(3 * CYCLE + DANCE.AT_M - 30);
  ok('ballo al giro pari successivo, piu\' veloce', sim.mode === 'dance' && sim.dance.lap === 3 && sim.dance.bpm > DANCE.BPM0 + DANCE.BPM_LAP * 2 - 0.01);
}
{
  const go = () => { const { sim } = toSquare(CYCLE + DANCE.AT_M - 30, 7); play(sim, 'good'); return JSON.stringify([sim.events, sim.inputs]); };
  ok('deterministico (stesso log)', go() === go());
}
console.log(fail ? `FALLITO: ${fail}` : 'OK: ballu tundu');
process.exit(fail ? 1 : 0);
