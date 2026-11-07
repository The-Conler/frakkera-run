import test from "node:test";
import assert from "node:assert/strict";
import { loadFrak, fill } from "./load-frak.mjs";

const F = loadFrak();

function hitsNave(e) {
  let a = e.d / 10;
  let b = (e.d + (e.len || 0)) / 10;
  if (a > b) { const t = a; a = b; b = t; }
  const lap0 = Math.floor(a / F.mapLen) - 1;
  const lap1 = Math.floor(b / F.mapLen) + 1;
  for (let lap = lap0; lap <= lap1; lap++) {
    const z0 = lap * F.mapLen + F.santa.from;
    const z1 = lap * F.mapLen + F.santa.to;
    if (a < z1 && b > z0) return true;
  }
  return false;
}

test("Santa Marta 230-285 m has no obstacles, pickups or masks on any lap", () => {
  for (const seed of [12345, 7919, 15838]) {
    const ents = fill(F, seed, 5);
    const hits = ents.filter(hitsNave);
    assert.equal(hits.length, 0, hits.slice(0, 4).map((e) => e.kind + "@" + (e.d / 10).toFixed(1)).join(","));
  }
});
