import test from "node:test";
import assert from "node:assert/strict";
import { loadFrak, fill } from "./load-frak.mjs";

const F = loadFrak();
const ROCK = new Set(F.rockKinds);
const ROW = F.row.ROW;
const LEAD = F.rock.ROCK_LEAD_S;

function span(e) {
  let a = e.d / 10;
  let b = (e.d + (e.len || 0)) / 10;
  if (e.kind === "sasso") a -= (F.speed(e.d) * LEAD + 40) / 10;
  if (e.kind === "rollin") a -= (F.rock.ROLL_ROWS * ROW) / 10;
  return [Math.min(a, b), Math.max(a, b)];
}

test("rocks leave at least two lanes passable on seeds 12345, 7919 and 15838 over 5 laps", () => {
  for (const seed of [12345, 7919, 15838]) {
    const ents = fill(F, seed, 5);
    let bad = 0;
    let where = null;
    for (let m = 0; m < F.mapLen * 5; m += 1) {
      const lanes = new Set();
      for (const e of ents) {
        if (!ROCK.has(e.kind) || e.lane == null) continue;
        const [a, b] = span(e);
        if (a < m && b > m) lanes.add(e.lane);
      }
      if (lanes.size > 1) {
        bad++;
        if (!where) where = { seed, m, lanes: Array.from(lanes) };
      }
    }
    assert.equal(bad, 0, "only one free lane " + JSON.stringify(where));
  }
});
