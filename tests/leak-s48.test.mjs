// La scena non deve crescere giro dopo giro: a meta' del giro 10 gli oggetti
// restano vicini a quelli del giro 2 (stesso punto del paese).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

const noop = () => {};
function mockDom() {
  const ctx = new Proxy({
    fillRect: noop, clearRect: noop, fill: noop, stroke: noop, beginPath: noop, closePath: noop,
    ellipse: noop, moveTo: noop, lineTo: noop, bezierCurveTo: noop, rect: noop, arc: noop,
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    measureText: () => ({ width: 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 }),
    putImageData: noop, drawImage: noop,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }),
    fillStyle: '', strokeStyle: '', globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineWidth: 1,
    canvas: { width: 8, height: 8 },
  }, { get(t, p) { return p in t ? t[p] : noop; } });
  const el = () => ({ width: 64, height: 64, style: {}, getContext: () => ctx, addEventListener: noop, removeEventListener: noop, setAttribute: noop });
  globalThis.document = { createElement: el, createElementNS: el };
  globalThis.window = globalThis;
  globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
  globalThis.requestAnimationFrame = (f) => setTimeout(f, 16);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.Image = class { set src(_) {} };
}

test('scene object count stays flat from lap 2 to lap 10', async () => {
  mockDom();
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { Env } = await server.ssrLoadModule('/src/game/biomes/env.js');
    const scene = new THREE.Scene();
    const world = {
      scene, camera: new THREE.PerspectiveCamera(60, 0.5, 0.1, 500),
      renderer: { domElement: { height: 844 }, getPixelRatio: () => 1 },
      mats2: [new THREE.MeshLambertMaterial({ vertexColors: true }), new THREE.MeshBasicMaterial({ vertexColors: true })],
      mat: {}, tex: { glow: new THREE.Texture() }, clock: 0, tipW: new THREE.Vector3(), flameI: 0, light: { tunnel: 0 },
    };
    const env = new Env(world);
    env.mode = 'run';
    const count = () => { let n = 0; scene.traverse(() => { n++; }); return n; };
    const sweep = (from, to) => {
      let n = 0;
      for (let m = from; m <= to; m += 45) { env.update(m, m, 1 / 30, m); n = count(); }
      return n;
    };
    const lap2 = sweep(0, 2 * 1600 + 120);
    const lap10 = sweep(2 * 1600, 10 * 1600 + 120);
    assert.ok(lap10 <= lap2 * 1.15 + 40, `lap2 ${lap2} lap10 ${lap10}`);
  } finally {
    await server.close();
  }
});
