// v5s40: bot "giocatore onesto": vede solo cio' che c'e' sullo schermo, prevede il moto lineare degli animali,
// reagisce ogni 0.1 s, cambia corsia verso quella libera, salta/si abbassa quando serve. Conta gli urti per tipo.
import { Sim, laneX, HALF_W, isMoving } from '../src/game/sim.js';
import { WORLD, JUMP } from '../src/config.js';
import { SOLID } from '../src/systems/generator.js';
import { BIOMES, CYCLE } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT, HZ = Math.round(1 / DT);
let PRED = !process.argv.includes('pred=0');
const DUCKK = { trave: 1, ramo: 1, panni: 1, fune: 1 };
const JUMPK = { ...JUMP.KINDS, fune: 1 };
function danger(s, e, l, horizon) {
  const v = Math.max(1, s.currentSpeed || 1), T = s.T;
  const t0 = (e.d - T - 5) / v, t1 = (e.d + e.len - T + 3) / v;
  if (t1 < 0 || t0 > horizon) return null;
  const hw = (HALF_W[e.kind] || 10) + 3 + 3;
  const vx = !PRED ? 0 : isMoving(e.kind) && (e.moving || e.d - T < 336 + v * t0) ? (e.vx || 0) * (e.dir || 1) : 0;
  const ex = s.entX(e);
  for (const t of [Math.max(0, t0), (Math.max(0, t0) + t1) / 2, t1]) { const x = ex + vx * t; if (Math.abs(x - laneX(l)) <= hw) return Math.max(0, t0); }
  return null;
}
export function play(seed, off, secs, onHit, pred) {
  if (pred != null) PRED = pred;
  const hits = [];
  const s = new Sim((t, d) => { if (t === 'hit') { hits.push({ kind: d.e.kind, lane: d.e.lane, step: s.step, T: s.T }); onHit && onHit(s, d.e); } }, { mapOffsetM: off });
  s.startRun(seed);
  let n = 0;
  while (s.step < secs * HZ && n++ < secs * HZ * 4) {
    s.fuel = 100;
    if (s.mode === 'dance') s.skipDance();
    if (s.mode === 'shop') s.exitShop();
    if (s.mode === 'run' && s.step % 12 === 0) {
      const H = 1.5, ents = s.entities.filter((e) => !e.done && !e.hit && !e.pickup && (SOLID[e.kind] || DUCKK[e.kind]));
      const first = [0, 1, 2].map((l) => { let m = Infinity, k = null; for (const e of ents) { const t = danger(s, e, l, H); if (t != null && t < m) { m = t; k = e; } } return { t: m, e: k }; });
      const cur = s.targetLane, fc = first[cur];
      const needAct = fc.e && !(DUCKK[fc.e.kind]);
      if (fc.e && DUCKK[fc.e.kind] && fc.t < 0.3) s.duck();
      if (needAct) {
        let best = cur, bt = fc.t;
        for (const l of [cur - 1, cur + 1, cur - 2, cur + 2]) { if (l < 0 || l > 2) continue; const mid = (l + cur) / 2; if (Math.abs(l - cur) === 2 && first[mid].t < 0.35) continue; if (first[l].t > bt + 0.05 || (first[l].e && DUCKK[first[l].e.kind] && bt < 9)) { best = l; bt = first[l].t; } }
        if (best !== cur) s.move(best > cur ? 1 : -1);
        else if (fc.t < 0.22 && JUMPK[fc.e.kind]) s.jump();
      }
    }
    s.tick(DT);
  }
  return { hits, s };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = Object.fromEntries(process.argv.slice(2).map((x) => x.split('=')));
  const SEEDS = +(a.seeds || 10), SECS = +(a.secs || 34), LAPS = +(a.laps || 3), KINDS = (a.kinds || '').split(',').filter(Boolean);
  const tally = {}, perLap = {}; let tot = 0;
  for (let lap = 0; lap < LAPS; lap++) for (const b of BIOMES) for (let seed = 1; seed <= SEEDS; seed++) {
    if (a.zone && b.id !== a.zone) continue;
    const { hits } = play(seed * 7919 + lap, lap * CYCLE + b.from + (b.id === 'village' ? 0 : 5), SECS);
    for (const h of hits) { if (KINDS.length && !KINDS.includes(h.kind)) continue; tally[h.kind] = (tally[h.kind] || 0) + 1; tot++; perLap[lap] = (perLap[lap] || 0) + 1; if (a.v) console.log(`HIT lap${lap} ${b.id} seed${seed} ${h.kind} lane${h.lane} step${h.step}`); }
  }
  console.log('TOTAL hits', tot, JSON.stringify(tally), 'perLap', JSON.stringify(perLap));
}
