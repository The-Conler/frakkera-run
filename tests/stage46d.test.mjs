// v5s46d: voci 251-300 verificabili senza WebGL (negozio, stelle, orologio, soak, vincoli di mappa).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../src/game/sim.js';
import { SHOP, WORLD, SANTAMARTA, PX_PER_METER } from '../src/config.js';
import { Generator } from '../src/systems/generator.js';
import { CYCLE, biomeAt } from '../src/game/biomes/config.js';
import { starOpacity, clockHandAngles, shopInWindow } from '../src/game/polish46d.js';

const DT = WORLD.FIXED_DT;
const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('251 shop offer is only in front of the garage, not on Santa Marta', () => {
  assert.ok(SHOP.OFFER_AT_M < 40 && SHOP.OFFER_UNTIL_M < 40, 'the garage window stays at the village start');
  assert.ok(SHOP.AT_M >= SHOP.FACADE_FROM && SHOP.AT_M <= SHOP.FACADE_TO);
  assert.equal(shopInWindow(177, SHOP.OFFER_AT_M, SHOP.OFFER_UNTIL_M), false);
  assert.equal(shopInWindow(14, SHOP.OFFER_AT_M, SHOP.OFFER_UNTIL_M), true);
  const sim = new Sim(() => {}, { carpetTotal: 0, addCarpets() {}, spendCarpets: () => -1 });
  sim.startRun(251); sim.gen.fillUntil = () => {};
  let saw = false, guard = 0;
  while (sim.runD / PX_PER_METER < CYCLE + 190 && guard++ < 400000) {
    sim.fuel = 100;
    if (sim.danceCue || sim.mode === 'dance') sim.skipDance();
    sim.tick(DT);
    const m = sim.runD / PX_PER_METER;
    const local = m - Math.floor(m / CYCLE) * CYCLE;
    const bi = biomeAt(m);
    if (sim.shopOffer > 0) {
      saw = true;
      assert.equal(bi.b.id, 'village');
      assert.ok(local <= SHOP.OFFER_UNTIL_M + 0.3, 'offer still up at local ' + local.toFixed(1));
    }
    if (m > CYCLE + 170 && m < CYCLE + 190) assert.equal(sim.shopOffer, 0, 'prompt still open beside Santa Marta');
  }
  assert.equal(saw, true);
});

test('256 stars stay off while the sun is up', () => {
  assert.equal(starOpacity(0.9, 1.2), 0);
  assert.equal(starOpacity(0.55, 0.8), 0);
  assert.ok(starOpacity(1, 0.05) > 0.7);
  assert.ok(starOpacity(0, 0) === 0);
  const w = src('../src/game/world3d.js');
  assert.match(w, /starOpacity\(m\.moon, m\.sun\)/);
});

test('262 clock hands move with game time', () => {
  const a = clockHandAngles(0), b = clockHandAngles(15 * 60), c = clockHandAngles(3600);
  assert.notEqual(a.minute, b.minute);
  assert.notEqual(a.hour, c.hour);
  assert.ok(Math.abs(b.minute - a.minute) > 1);
  const church = src('../src/game/biomes/builders/church.js');
  assert.match(church, /vistaClockFaces/);
  assert.doesNotMatch(church, /lancette \(circa le 10/);
});

test('265 seed 4571 holding left does not freeze, and warmup is still one geometry per frame', () => {
  const sim = new Sim(() => {}, { carpetTotal: 0, addCarpets() {}, spendCarpets: () => -1 });
  sim.startRun(4571);
  sim.move(-1);
  let stall = 0;
  for (let i = 0; i < 120 * 30 && sim.mode === 'run' && sim.runD / PX_PER_METER < 120; i++) {
    sim.fuel = 100;
    const t0 = sim.T;
    sim.tick(DT);
    if (sim.mode === 'run' && sim.T - t0 < 1e-4) stall++;
    else stall = 0;
    assert.ok(stall < 90, 'sim stuck while running at ' + (sim.runD / PX_PER_METER).toFixed(1) + ' m');
  }
  assert.ok(sim.runD / PX_PER_METER > 40 || sim.mode !== 'run');
  const env = src('../src/game/biomes/env.js');
  assert.match(env, /una geometria per frame/);
  assert.match(env, /items\.shift\(\)/);
});

test('map rules: nave clear, no bunting, no mine arrows, viaduct shape untouched, memorial trees off', () => {
  for (const seed of [3, 4571, 9001]) {
    const g = new Generator(seed), ents = [];
    g.fillUntil(CYCLE * 2 * PX_PER_METER + 400, (e) => ents.push(e));
    const nave = ents.filter((e) => {
      const a = e.d / PX_PER_METER, b = (e.d + (e.len || 0)) / PX_PER_METER;
      for (let lap = 0; lap < 3; lap++) {
        const from = lap * CYCLE + SANTAMARTA.FROM_M - SANTAMARTA.LEAD_M, to = lap * CYCLE + SANTAMARTA.FROM_M + SANTAMARTA.LEN_M;
        if (Math.min(a, b) < to && Math.max(a, b) > from) return true;
      }
      return false;
    });
    assert.equal(nave.length, 0, 'nave not clear seed ' + seed + ' ' + nave.slice(0, 3).map((e) => e.kind).join(','));
  }
  const files = ['world3d.js', 'biomes/env.js', 'village3d.js', 'festa3d.js', 'biomes/builders/structures.js'];
  for (const f of files) {
    const s = src('../src/game/' + f);
    assert.doesNotMatch(s, /arrowTexture\(/, f);
  }
  const w3 = src('../src/game/world3d.js');
  const fest = w3.slice(w3.indexOf("} else if (kind === 'festone') {"), w3.indexOf("} else if (kind === 'panni') {"));
  assert.ok(fest.length > 20 && !/new THREE\.(Mesh|Sprite|Line|Points)/.test(fest));
  const via = src('../src/game/biomes/builders/structures.js');
  const body = via.slice(via.indexOf('export function buildViaduct'), via.indexOf('export function tunnelSegment'));
  assert.ok(body.length > 200);
  assert.doesNotMatch(body, /weatherViaduct/);
  const env = src('../src/game/biomes/env.js');
  assert.match(env, /local > 140 && i\.local < 230 \? 0/);
  assert.match(env, /weatherViaduct\(S\.buildViaduct/);
});
test('utente 2026-11-11: niente cane che segue, niente facciola, istruzioni nuove, interno di Pinu visibile', () => {
  for (const seed of [12345, 777, 4242]) {
    const g = new Generator(seed), out = []; g.fillUntil(WORLD.LEAD_IN + 1500 * WORLD.ROW, (e) => out.push(e));
    assert.equal(out.filter((e) => e.kind === 'cane' || e.kind === 'facciola').length, 0);
    assert.ok(out.some((e) => e.kind === 'campanaccio'));
  }
  const html = src('../index.html'), sim = src('../src/game/sim.js');
  assert.doesNotMatch(html, /FACCIOLE|facciole/);
  assert.doesNotMatch(sim, /UN AMICO!|FACCIOLA!/);
  const how = html.slice(html.indexOf('id="scr-howto"'), html.indexOf('</section>', html.indexOf('id="scr-howto"')));
  for (const k of ['I comandi', 'Le corsie', 'SPARA', 'La fiamma e il carburante', 'I tappeti Sa Burra', 'Il Garag di Pinu', 'Ciccio']) assert.ok(how.includes(k), k);
  assert.match(src('../src/styles.css'), /#scr-shop \.shop-items \{ display: flex; flex-direction: row;/);
  assert.match(src('../src/game/shop3d.js'), /sBot - sTop < 0\.3/);
  assert.match(src('../src/game/masks/figures.js'), /sa facciola/);   // il velo nero di sa Grastula resta
});
