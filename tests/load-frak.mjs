import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bundlePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../v5/assets/index-DcoDRe0J.js");

export function loadFrak() {
  const ctx = {
    __FRAK_TEST: true,
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams, Promise, Math, Date, Object, Array, Map, Set, WeakMap, Error,
    Uint8Array, Uint32Array, Float32Array, ArrayBuffer, TextDecoder,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: "node" },
    location: { search: "", href: "http://localhost/frakkera-run/v5/" },
    Image: class { set src(v) {} },
    WebGLRenderingContext: function () {},
    WebGL2RenderingContext: function () {},
  };
  const el = () => ({
    style: {}, relList: { supports: () => true }, setAttribute() {}, appendChild() {}, addEventListener() {},
    classList: { contains: () => false }, getContext: () => null, width: 8, height: 8,
  });
  ctx.document = {
    createElement: el, querySelectorAll: () => [], getElementById: () => el(), addEventListener() {},
    documentElement: { style: { setProperty() {} } }, fonts: { load: () => Promise.resolve() },
    body: { appendChild() {} }, head: { appendChild() {} },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  const code = fs.readFileSync(bundlePath, "utf8").replaceAll("import.meta.url", '"http://localhost/frakkera-run/v5/assets/index.js"');
  vm.runInContext(code, ctx, { filename: "index-DcoDRe0J.js" });
  if (!ctx.__FRAK) throw new Error("generator hook missing");
  return ctx.__FRAK;
}

export function fill(F, seed, laps = 5) {
  const g = new F.Generator(seed);
  const ents = [];
  g.fillUntil(F.mapLen * laps * 10 + 800, (e) => ents.push(e));
  return ents;
}
