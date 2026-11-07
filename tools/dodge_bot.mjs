// v5s40: bot che schiva. Per ogni urto cerca (rigiocando in modo deterministico) una mossa fatta
// tra 1.25 s e 0.3 s prima dell'urto che lo eviti senza causarne un altro. Se nessuna -> urto inevitabile.
import { Sim } from '../src/game/sim.js';
import { WORLD } from '../src/config.js';
import { BIOMES, CYCLE } from '../src/game/biomes/config.js';
const DT = WORLD.FIXED_DT, HZ = Math.round(1 / DT);
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const SEEDS = +(args.seeds || 6), SECS = +(args.secs || 34), LAPS = +(args.laps || 3);
const ONLY = args.zone || null;
function run(seed, off, plan, until) {
  const hits = [];
  const s = new Sim((t, d) => { if (t === 'hit') hits.push({ step: s.step, kind: d.e.kind, lane: d.e.lane, id: d.e.id }); }, { mapOffsetM: off });
  s.startRun(seed);
  let n = 0;
  while (s.step < until && n++ < until * 3) {
    s.fuel = 100;
    if (s.mode === 'dance') { s.skipDance(); }
    if (s.mode === 'shop') s.exitShop();
    const a = plan.get(s.step);
    if (a && s.mode === 'run') for (const x of a) { if (x === 'L') s.move(-1); else if (x === 'R') s.move(1); else if (x === 'J') s.jump(); else if (x === 'D') s.duck(); }
    s.tick(DT);
  }
  return { s, hits };
}
const MOVES = [[], ['L'], ['R'], ['L', 'L'], ['R', 'R']];
const EXTRA = [null, ['J', 0], ['D', 0], ['J', 0.25], ['D', 0.25], ['J', 0.5], ['D', 0.5]];
const LEADS = [1.25, 0.95, 0.7, 0.5, 0.3];
function addPlan(plan, step, xs) { const p = new Map(plan); p.set(step, [...(p.get(step) || []), ...xs]); return p; }
export function dodge(seed, off) {
  const until = SECS * HZ; let plan = new Map(); const bad = [];
  let r = run(seed, off, plan, until), guard = 0; const ok = new Set();
  while (guard++ < 200) {
    const h = r.hits.find((x) => !ok.has(x.step)); if (!h) break;
    let found = null;
    outer: for (const lead of LEADS) for (const mv of MOVES) for (const ex of EXTRA) {
      const t0 = h.step - Math.round(lead * HZ); if (t0 < 1) continue;
      let p = mv.length ? addPlan(plan, t0, mv) : plan;
      if (ex) p = addPlan(p, t0 + Math.round(ex[1] * HZ), [ex[0]]);
      if (!mv.length && !ex) continue;
      const rr = run(seed, off, p, Math.min(until, h.step + 1.2 * HZ));
      if (!rr.hits.some((x) => x.step >= t0 - 1 && !ok.has(x.step))) { found = p; break outer; }
    }
    if (found) { plan = found; r = run(seed, off, plan, until); }
    else { bad.push(h); ok.add(h.step); }
  }
  return { bad, plan, hits: r.hits.filter((x) => !ok.has(x.step)).length };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const tally = {}; let crossings = 0, total = 0;
  for (let lap = 0; lap < LAPS; lap++) for (const b of BIOMES) {
    if (ONLY && b.id !== ONLY) continue;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const off = lap * CYCLE + b.from + (b.id === 'village' ? 0 : 5);
      const { bad } = dodge(seed * 7919 + lap, off);
      for (const h of bad) { const k = h.kind; tally[k] = (tally[k] || 0) + 1; total++; console.log(`UNAVOIDABLE lap${lap} ${b.id} seed${seed} step${h.step} ${k} lane${h.lane}`); }
    }
  }
  console.log('TOTAL unavoidable', total, JSON.stringify(tally));
}
