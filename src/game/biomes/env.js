// =====================================================================
//  Gestore degli ambienti (solo grafica): costruisce e smonta a tratti
//  ("chunk") il percorso davanti al giocatore - terreno, lati, galleria,
//  decorazioni, monumenti - secondo i biomi di config.js, e calcola la
//  luce/nebbia/audio del punto in cui si trova il giocatore, con
//  dissolvenze ai confini. Nulla qui influisce su sim.js.
//  Coordinate: W = metri lungo il percorso (z del mondo = -W).
// =====================================================================
import * as THREE from 'three';
import { BIOMES, CYCLE, biomeAt, nextBoundary, byId, LAP_NIGHT, NIGHT_MOOD, mapFromURL } from './config.js';
import * as M from '../models.js';
import * as BT from './textures.js';
import * as N from './builders/nature.js';
import * as S from './builders/structures.js';
import { buildChurchSquare } from './builders/church.js';
import { Kit, G, rng, ROCK, LEAF } from './builders/common.js';

export const ROAD_W = 11, WALK_W = 1.45, FACADE = ROAD_W / 2 + WALK_W;
const SEG = 44, BLEND = 12, AHEAD = 190, BEHIND = 14;

const _c = new THREE.Color();
const MOOD_KEYS = ['top', 'mid', 'hor', 'fog', 'hemiS', 'hemiG', 'dirC', 'far'];
const NUM_KEYS = ['hemiI', 'dirI', 'moon', 'sun', 'fogNear', 'fogFar'];
const LIGHT_KEYS = ['flameDist', 'flameK', 'mineral', 'lamp', 'darkByFuel', 'tunnel', 'exposure'];
const AMB_KEYS = ['wind', 'water', 'drips', 'birds', 'bells', 'cave'];

// ---------------------------------------------------------------- materiali del suolo con UV nel mondo
function groundMat(map, o = {}) {
  const P = o.phong ? THREE.MeshPhongMaterial : THREE.MeshLambertMaterial;
  const m = new P({ map, color: o.color || '#ffffff', ...(o.phong ? { specular: o.specular || '#8890a0', shininess: o.shininess || 60 } : {}) });
  const u = { uWet: { value: 1 }, uMapB: { value: o.mapB || map }, uZ0: { value: 0 }, uZ1: { value: 1 }, uSX: { value: o.sx ?? 1 / 11 }, uSZ: { value: o.sz ?? 1 / 11 }, uX0: { value: o.x0 ?? -5.5 }, uAbs: { value: o.abs ? 1 : 0 } };
  m.userData.u = u;
  if (o.mapB) m.defines = { BLEND: '' };
  if (o.wet) m.defines = { ...(m.defines || {}), WET: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform sampler2D uMapB; uniform float uZ0, uZ1, uSX, uSZ, uX0, uAbs;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 wuv = vec2((mix(vWP.x, abs(vWP.x), uAbs) - uX0) * uSX, -vWP.z * uSZ);
      vec4 sA = texture2D(map, wuv);
      #ifdef BLEND
        vec4 sB = texture2D(uMapB, wuv);
        float kb = smoothstep(uZ0, uZ1, -vWP.z + (sA.g - 0.45) * 9.0);
        sA = mix(sA, sB, kb);
      #endif
      diffuseColor *= sA;`);
    if (o.wet) {
      // pavimento bagnato: pozze lucide che riflettono il blu delle pareti (fresnel) + riflesso caldo dalla fiamma (specular Phong)
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 pq = vWP.xz * vec2(0.9, 0.55);
        float pn = sin(pq.x * 3.1 + sin(pq.y * 1.7) * 2.0) * 0.5 + sin(pq.y * 2.3 + pq.x * 1.3 + sin(pq.x * 0.7)) * 0.5;
        float puddle = smoothstep(0.42, 0.75, pn) * (1.0 - smoothstep(0.35, 0.65, sA.g));
        float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.0);
        diffuseColor.rgb *= mix(1.0, 0.45, puddle);                  // le pozze sono scure come uno specchio
        float rip = sin(vWP.z * 3.0 + vWP.x * 0.8) * 0.5 + 0.5;
        totalEmissiveRadiance += vec3(0.03, 0.09, 0.36) * (0.08 + puddle * (0.25 + 0.55 * rip * rip)) * (0.3 + fr * 1.2) * uWet;
        float streak = exp(-pow(abs(abs(vWP.x) - 5.4) * 0.9, 2.0));
        totalEmissiveRadiance += vec3(0.9, 0.5, 0.18) * streak * puddle * fr * 0.35 * uWet;`)
        .replace('#include <lights_phong_fragment>', `#include <lights_phong_fragment>
        material.specularShininess = mix(40.0, 160.0, puddle); material.specularStrength = mix(0.5, 1.6, puddle);`);
      sh.fragmentShader = 'uniform float uWet;\n' + sh.fragmentShader;
    }
  };
  m.customProgramCacheKey = () => (o.mapB ? 'gb' : 'g') + (o.phong ? 'p' : 'l') + (o.wet ? 'w' : '');
  return m;
}
function waterMat(normalMap, color, opacity = 0.84) {
  const m = new THREE.MeshPhongMaterial({ color, specular: '#fff0d0', shininess: 110, normalMap, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity, depthWrite: false });
  const u = { uFlow: { value: new THREE.Vector2() } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform vec2 uFlow;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vNormalMapUv = (modelMatrix * vec4(position, 1.0)).xz * 0.09 + uFlow;');
    // un po' di cielo riflesso ai bordi (fresnel) + verde smeraldo in profondita'
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal), 0.0, 1.0), 3.0);
      outgoingLight = mix(outgoingLight, outgoingLight * 0.6 + vec3(0.55, 0.62, 0.6) * 0.35, fr * 0.6);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'water';
  return m;
}
function tunnelMat(blue) {
  // galleria blu: Phong (riflessi bagnati) + scintille minerali che brillano cambiando punto di vista
  const m = blue ? new THREE.MeshPhongMaterial({ vertexColors: true, specular: '#3f6fe0', shininess: 38, flatShading: true }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  const u = { uLamp: { value: 0.5 }, uMineral: { value: 0 }, uLampCol: { value: new THREE.Color(blue ? '#d8e0ff' : '#ffe6c4') }, uMinCol: { value: new THREE.Color('#2f4cff') } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec2 aGlow;\nvarying vec2 vGlow; varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow;').replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uLamp; uniform float uMineral; uniform vec3 uLampCol; uniform vec3 uMinCol; varying vec2 vGlow; varying vec3 vWP;\n'
      + 'float hsh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n'
      + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * uLampCol * (vGlow.x * uLamp * 1.5);
      ${blue ? `
      // bagliore minerale: piu' forte sulle facce rivolte verso la camera, buio nelle fessure
      vec3 vd = normalize(cameraPosition - vWP);
      vec3 fn = normalize(cross(dFdx(vWP), dFdy(vWP)));
      float face = clamp(abs(dot(fn, vd)), 0.0, 1.0);
      totalEmissiveRadiance += vGlow.y * uMineral * (diffuseColor.rgb * (0.12 + 1.25 * face * face * face) + uMinCol * 0.08 * face * face);
      // scintille: celle di 12 cm, ognuna con una direzione casuale che "accende" il riflesso
      vec3 cell = floor(vWP * 3.5);
      float h = hsh(cell);
      if (h > 0.7 && vGlow.y > 0.25) {
        vec3 rd = normalize(vec3(hsh(cell + 1.7), hsh(cell + 3.1), hsh(cell + 5.3)) * 2.0 - 1.0);
        float sp = pow(max(0.0, dot(rd, vd)), 10.0);
        vec3 f = fract(vWP * 3.5) - 0.5; float dotm = 1.0 - smoothstep(0.08, 0.32, length(f));
        totalEmissiveRadiance += vec3(0.65, 0.88, 1.0) * sp * dotm * 4.0 * uMineral;
      }` : `
      totalEmissiveRadiance += vGlow.y * uMineral * (diffuseColor.rgb * 1.25 + uMinCol * 0.16);`}`);
  };
  m.customProgramCacheKey = () => 'tunnel' + (blue ? 'B' : 'R');
  return m;
}
// geometria di base lunga 1 m (scalata in z): piano largo w centrato in x
function strip(x0, x1, y = 0) { const g = new THREE.PlaneGeometry(x1 - x0, 1).rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, -0.5); return g; }

// ---------------------------------------------------------------- monumenti (per bioma, distanza locale)
// at: punto di riferimento (distanza locale nel bioma); exist: [da, a] relativo ad at in cui esiste
const LANDMARKS = {
  church: { at: 140, exist: [-200, 70] },
  pinnacle: { at: 200, exist: [-260, 120] },
  valley: { at: 0, exist: [-140, 330] },
  pool: { at: 0, exist: [-40, 280] },
  viaduct: { at: 150, exist: [-330, 130] },
  valleyRiver: { at: 0, exist: [-150, 290] },
  minePortal: { at: 150, exist: [-200, 30] },
  mineExit: { at: 250, exist: [-80, 20] },
  farVillage: null,
};

export class Env {
  constructor(world) {
    this.world = world; this.scene = world.scene; this.mats2 = world.mats2;
    this.markCache = new Map();
    if (typeof window !== 'undefined') setTimeout(() => this.prewarm(), 200);
    const dev = mapFromURL();
    this.dev = dev;
    // salto di mappa (solo grafica): ?map=<id> e, opzionale, &at=<metri dentro l'ambiente>
    const at = typeof location !== 'undefined' ? Math.max(0, +new URLSearchParams(location.search).get('at') || 0) : 0;
    this.offset = dev ? Math.min(dev.to - 5, dev.from + at) : 0;
    this.menuB = dev ? this.offset + 4 : 20;
    this.mode = 'attract'; this.anchor = 0;
    this.fade = 1;
    this.mats();
    this.ground = []; this.gW = -40;
    this.sides = [-1, 1].map((s) => ({ s, list: [], cur: -40, r: rng(s > 0 ? 71 : 37) }));
    this.center = []; this.cW = -40;
    this.decor = []; this.dW = -30; this.dR = rng(55);
    this.marks = new Map();
    this.prefabs = new Map();       // prefab condivisi (case, giardini, festoni) per bioma
    this.pools = new Map();
    this.lampPool = [];
    this.stats = { built: 0, disposed: 0, segs: 0 };
    this.cur = { b: BIOMES[0], local: 0, lap: 0, bDist: 0 };
    this.target = { light: {}, amb: {} };
  }

  // ------------------------------------------------------------ materiali
  mats() {
    const t = this.world.tex;
    const nrm = BT.waterNormalTexture();
    this.tex = {
      cobble: t.cobble, slab: t.slab, trail: BT.trailTexture(), stoneTrail: BT.stoneTrailTexture(), gravel: BT.gravelTexture(),
      mineFloor: BT.gravelTexture({ floor: true }), blueFloor: BT.gravelTexture({ blue: true }), nrm,
      grassEdge: BT.edgeTexture('grassEdge'), mossEdge: BT.edgeTexture('mossEdge'), drystone: BT.edgeTexture('drystone'), gravelEdge: BT.edgeTexture('gravelEdge'),
    };
    this.roadTex = { cobble: this.tex.cobble, trail: this.tex.trail, stoneTrail: this.tex.stoneTrail, gravel: this.tex.gravel, mineFloor: this.tex.mineFloor, blueFloor: this.tex.blueFloor };
    this.roadMat = {};
    for (const k in this.roadTex) this.roadMat[k] = groundMat(this.roadTex[k], k === 'blueFloor' || k === 'mineFloor' ? { phong: true, wet: k === 'blueFloor', shininess: k === 'blueFloor' ? 120 : 40, specular: k === 'blueFloor' ? '#c8d8ff' : '#606870' } : {});
    this.blendMats = new Map();
    this.shoulderMat = {
      walk: groundMat(this.tex.slab, { sx: 1 / WALK_W, sz: 1 / 2.9, x0: 5.5, abs: true }),
      grassEdge: groundMat(this.tex.grassEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      mossEdge: groundMat(this.tex.mossEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      drystone: groundMat(this.tex.drystone, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      gravelEdge: groundMat(this.tex.gravelEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      none: groundMat(this.tex.mineFloor, { phong: true, shininess: 30 }),
    };
    this.waterMat = { pool: waterMat(nrm, '#2e9a76', 0.8), river: waterMat(nrm, '#3f7f7c', 0.86) };
    this.tunnelMat = { rock: tunnelMat(false), blue: tunnelMat(true) };
    this.fallMat = new THREE.MeshBasicMaterial({ color: '#e8f4f0', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, map: this.fallTexture() });
    this.fallMat.map.wrapT = THREE.RepeatWrapping; this.fallMat.map.repeat.set(1, 2);
    this.lit = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.geo = {
      road: strip(-ROAD_W / 2, ROAD_W / 2),
      walk: (() => { const a = new THREE.BoxGeometry(WALK_W, 0.22, 1); a.translate(0, 0.11, -0.5); return a; })(),
      edge: strip(5.5, 9.5, 0.02),
      tfloor: strip(5.4, 7.6, 0.01),
      waterPool: strip(8.0, 80, -0.35), waterRiver: strip(13.0, 85, -4.0),
    };
    this.miscGeo = new Map();
  }
  fallTexture() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`; x.fillRect(Math.random() * 32, Math.random() * 128, 1 + Math.random() * 2, 10 + Math.random() * 40); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  blendMat(a, b) {
    const key = a + '>' + b;
    let m = this.blendMats.get(key);
    if (!m) { m = groundMat(this.roadTex[a], { mapB: this.roadTex[b], phong: b === 'blueFloor' || b === 'mineFloor' || a === 'blueFloor', wet: b === 'blueFloor' || a === 'blueFloor', specular: '#a8b8e0', shininess: 90 }); this.blendMats.set(key, m); }
    return m;
  }
  // geometria varia unita (cordoli, terreni ai lati, binari, letto del fiume), lunga 1 m
  misc(bid) {
    if (this.miscGeo.has(bid)) return this.miscGeo.get(bid);
    const g = byId[bid].ground; const k = new Kit(3);
    const one = (w, h, x, y, col) => k.add(G.box(w, h, 1), col, { x, y, z: -0.5 });
    if (g.curb) for (const s of [-1, 1]) one(0.22, 0.26, s * (ROAD_W / 2 + 0.05), 0.13, '#9a8e80');
    if (g.terrain) {
      one(80, 0.1, -(9.0 + 40), (g.terrainY ?? -0.06) - 0.05, g.terrain);
      if (!g.right) one(80, 0.1, 9.0 + 40, (g.terrainY ?? -0.06) - 0.05, g.terrain);
    }
    if (g.right === 'water') one(80, 0.1, 8 + 40, -2.6, '#55744a');
    if (g.right === 'river') one(80, 0.1, 12 + 40, -6.0, '#5a5a48');
    if (g.rails) for (const lx of [0, 3.4]) for (const s of [-0.52, 0.52]) { one(0.1, 0.12, lx + s, 0.06, '#6a4a32'); one(0.05, 0.03, lx + s, 0.135, g.wet ? '#c4cfee' : '#9a7a62'); }
    const geom = k.build();
    this.miscGeo.set(bid, geom);
    return geom;
  }

  // ------------------------------------------------------------ distanze
  bAt(W) { return this.mode === 'attract' ? this.menuB : W - this.anchor + this.offset; }
  wOf(b) { return b - this.offset + this.anchor; }
  info(W) { return biomeAt(this.bAt(W)); }
  boundaryAfter(W) { if (this.mode === 'attract') return Infinity; return this.wOf(nextBoundary(this.bAt(W) + 1e-4)); }
  boundaryBefore(W) {
    if (this.mode === 'attract') return -Infinity;
    const i = this.info(W); const b0 = i.lap * CYCLE + i.b.from;
    return (b0 <= 0 && this.offset === 0) || b0 <= this.offset - 1e-6 ? -Infinity : this.wOf(b0);
  }

  // ------------------------------------------------------------ cambi di modalita'
  startRun(W) {
    const prevB = this.info(W).b.id;
    this.mode = 'run'; this.anchor = W;
    const now = this.info(W);
    this.rebuild(now.b.id === prevB ? W + Math.min(118, this.firstBreak(now)) : null, W);
  }
  toAttract(W) {
    const prevB = this.info(W).b.id;
    this.mode = 'attract';
    this.rebuild(this.info(W).b.id === prevB ? W + 60 : null, W);
  }
  firstBreak(i) { // distanza dal punto di partenza al primo vuoto / confine che i pezzi del menu non rispettano
    const g = i.b.gaps || {}; let m = i.b.to - i.b.from - i.local;
    for (const s in g) for (const [a] of g[s]) if (a > i.local) m = Math.min(m, a - i.local);
    if (i.b.id === 'village') m = Math.min(m, 140 - i.local);
    return Math.max(10, m);
  }
  rebuild(keepUntil, W) {
    const full = keepUntil == null;
    const cut = full ? -Infinity : keepUntil;
    const dropFrom = (list, rm) => { while (list.length && list[list.length - 1].W0 >= cut) rm(list.pop()); return list.length ? list[list.length - 1].W1 : W - 40; };
    this.gW = dropFrom(this.ground, (s) => this.freeSeg(s));
    for (const sd of this.sides) sd.cur = dropFrom(sd.list, (p) => this.freePiece(p));
    this.cW = dropFrom(this.center, (p) => this.freePiece(p));
    this.dW = dropFrom(this.decor, (p) => this.freePiece(p));
    for (const [key] of this.marks) this.freeMark(key);
    if (full) { this.fade = 0; for (const sd of this.sides) sd.cur = W - 40; this.gW = W - 40; this.cW = W - 40; this.dW = W - 30; }
  }

  // ------------------------------------------------------------ terreno
  fillGround(front) {
    while (this.gW < front) {
      const W0 = this.gW;
      const i = this.info(W0 + 0.01);
      let W1 = W0 + SEG, blend = null;
      const Wb = this.boundaryAfter(W0 + 0.01), Wp = this.boundaryBefore(W0 + 0.01);
      if (Number.isFinite(Wb)) {
        if (W0 < Wb - BLEND) W1 = Math.min(W1, Wb - BLEND);
        else { W1 = Wb; blend = { a: i.b.ground.road, b: biomeAt(this.bAt(Wb + 0.01)).b.ground.road, z0: Wb - BLEND, z1: Wb + BLEND }; }
      }
      if (Number.isFinite(Wp) && W0 < Wp + BLEND) { W1 = Math.min(W1, Wp + BLEND); blend = { a: biomeAt(this.bAt(Wp - 0.01)).b.ground.road, b: i.b.ground.road, z0: Wp - BLEND, z1: Wp + BLEND }; }
      if (W1 - W0 < 0.05) { this.gW = W1 + 0.05; continue; }
      this.ground.push(this.makeSeg(W0, W1, i.b, blend));
      this.gW = W1;
    }
  }
  makeSeg(W0, W1, b, blend) {
    const len = W1 - W0, g = b.ground, meshes = [];
    let rm = this.roadMat[g.road];
    if (blend && blend.a !== blend.b) { rm = this.blendMat(blend.a, blend.b); rm.userData.u.uZ0.value = blend.z0; rm.userData.u.uZ1.value = blend.z1; }
    const add = (geo, mat, key) => {
      const pool = this.pools.get(key) || []; let m = pool.pop();
      if (!m) { m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = true; this.scene.add(m); }
      m.geometry = geo; m.material = mat; m.visible = true; m.position.set(0, 0, -W0); m.scale.set(1, 1, len); m.userData.key = key;
      meshes.push(m);
    };
    add(this.geo.road, rm, 'road');
    if (g.shoulder === 'walk') { add(this.geo.walk, this.shoulderMat.walk, 'walkL'); meshes[meshes.length - 1].position.x = -(ROAD_W / 2 + WALK_W / 2); add(this.geo.walk, this.shoulderMat.walk, 'walkR'); meshes[meshes.length - 1].position.x = ROAD_W / 2 + WALK_W / 2; }
    else if (g.shoulder === 'none') { add(this.geo.tfloor, this.shoulderMat.none, 'tfR'); add(this.geo.tfloor, this.shoulderMat.none, 'tfL'); meshes[meshes.length - 1].scale.x = -1; }
    else if (g.shoulder) { add(this.geo.edge, this.shoulderMat[g.shoulder], 'edgeR'); if (g.right !== 'water' && g.right !== 'river') { add(this.geo.edge, this.shoulderMat[g.shoulder], 'edgeL'); meshes[meshes.length - 1].scale.x = -1; } else { add(this.geo.edge, this.shoulderMat[g.shoulder], 'edgeL'); meshes[meshes.length - 1].scale.x = -1; } }
    add(this.misc(b.id), this.mats2, 'misc');
    if (g.right === 'water') add(this.geo.waterPool, this.waterMat.pool, 'water');
    if (g.right === 'river') add(this.geo.waterRiver, this.waterMat.river, 'water');
    for (const m of meshes) if (m.scale.x < 0) m.material = m.material; // (specchio: three gestisce il determinante negativo)
    this.stats.segs++;
    return { W0, W1, meshes, b: b.id };
  }
  freeSeg(s) { for (const m of s.meshes) { m.visible = false; const k = m.userData.key; if (!this.pools.has(k)) this.pools.set(k, []); m.scale.x = 1; m.position.x = 0; this.pools.get(k).push(m); } }

  // ------------------------------------------------------------ pezzi ai lati
  fillSide(sd, front) {
    let guard = 0;
    while (sd.cur < front && guard++ < 60) {
      const W = sd.cur, i = this.info(W + 0.01);
      const Wb = this.boundaryAfter(W + 0.01);
      const maxLen = Wb - W;
      if (maxLen < 0.5) { sd.cur = Wb + 0.001; continue; }
      // vuoti (piazza della chiesa, piazzale del portale)
      const gaps = (i.b.gaps && i.b.gaps[sd.s < 0 ? 'left' : 'right']) || [];
      let skip = 0;
      if (this.mode !== 'attract') for (const [a, z] of gaps) if (i.local >= a - 0.01 && i.local < z) skip = z - i.local;
      if (skip > 0) { sd.cur = W + skip; continue; }
      let lim = maxLen;
      if (this.mode !== 'attract') for (const [a] of gaps) if (a > i.local) lim = Math.min(lim, a - i.local);
      const p = this.sidePiece(sd, W, i, lim);
      if (!p) { sd.cur = W + Math.min(lim, 6); continue; }
      sd.list.push(p);
      sd.cur = W + p.w;
    }
  }
  sidePiece(sd, W, i, lim) {
    const s = sd.s, r = sd.r, b = i.b, loc = i.local, len = b.to - b.from;
    const own = (geom, w, extra = {}) => {
      const mesh = new THREE.Mesh(geom, this.mats2); mesh.position.set(s * FACADE, 0, -W); mesh.scale.x = s < 0 ? 1 : -1; this.scene.add(mesh); this.stats.built++;
      return { W0: W, W1: W + w, w, mesh, owned: true, lamps: [], ...extra };
    };
    const fit = (a, bb) => Math.max(1.5, Math.min(lim, r.range(a, bb)));
    switch (b.sides) {
      case 'houses': {
        const nearEnd = loc > len - 32 && Number.isFinite(lim);
        if (nearEnd || lim < 5.1) {   // fine del paese: orti, muretti, alberi
          const w = fit(5, 9);
          return own(N.slopePiece(W, w, { Hs: 3, dist: 16, trees: 0.25, wall: true, wallH: 1.1, rocks: 0.1, ferns: 0, seed: 40 + i.lap, flowers: 0.3, ground: ['#7d8a4e', '#6e7a3e', '#8a9a56'] }), w);
        }
        const pf = r.chance(0.14) ? this.prefab('garden', r.int(5), () => M.buildGarden(r.lastInt + 1)) : this.prefab('house', r.int(26), () => M.buildHouse(r.lastInt + 1));
        if (pf.w > lim) { const w = Math.min(lim, 6); return own(N.slopePiece(W, w, { Hs: 2, dist: 12, trees: 0.2, wall: true, wallH: 1.1, ferns: 0, rocks: 0.1 }), w); }
        return this.placePrefab(sd, W, pf);
      }
      case 'mountain': {
        if (s < 0) {
          if (loc < 28) { const w = fit(6, 10); return own(N.slopePiece(W, w, { Hs: 6 + loc * 0.3, dist: 22, trees: 0.3, rocks: 0.3, wall: loc < 12, seed: 5 }), w); }
          const w = fit(8, 14); return own(N.cliffPiece(W, w, { H0: 15, Hamp: 9, lean: 0.16, pal: ROCK.granite, moss: 0.55, ochre: true, seed: 7 }), w);
        }
        const w = fit(8, 12); return own(N.parapetPiece(W, w, { drop: 7 }), w);
      }
      case 'river': {
        if (s < 0) { const w = fit(7, 11); return own(N.slopePiece(W, w, { Hs: 9, dist: 30, trees: 0.35, ferns: 0.6, rocks: 0.35, fence: true, leaf: LEAF.fresh, rockPal: ROCK.limestone, ground: ['#4f7a2a', '#5f8a30', '#6b8a3c', '#3f6a24', '#7a8a4a'], seed: 9 }), w); }
        const w = fit(8, 12); return own(N.poolBankPiece(W, w), w);
      }
      case 'valley': {
        if (s < 0) { const w = fit(8, 12); return own(N.slopePiece(W, w, { Hs: 16, dist: 30, trees: 0.22, rocks: 0.5, wall: true, wallH: 0.9, ferns: 0.05, seed: 13, ground: ['#7a7a44', '#6b7a3e', '#8a7a5a', '#9a8f6a', '#6e6a40'], conifers: true }), w); }
        const w = fit(8, 12); return own(N.riverDropPiece(W, w, { depth: 4 }), w);
      }
      case 'mineYard': {
        if (s < 0) { const w = fit(8, 13); return own(N.cliffPiece(W, w, { H0: 17, Hamp: 7, lean: 0.12, pal: ['#7d7a74', '#8f8b83', '#6c6a65', '#9c978e'], moss: 0.2, mossCol: '#7a6a52', leaf: LEAF.dry, top: 'shrub', seed: 17 }), w); }
        const w = fit(8, 12); return own(N.slopePiece(W, w, { Hs: 18, dist: 26, trees: 0.06, rocks: 0.6, wall: true, wallH: 1.4, leaf: LEAF.dry, ground: ['#8a857c', '#7a766e', '#9a958c', '#7a7a56'], rockPal: ['#7d7a74', '#8f8b83', '#6c6a65'], seed: 19, ferns: 0 }), w);
      }
      case 'tunnel': default:
        return { W0: W, W1: W + Math.min(lim, 20), w: Math.min(lim, 20), mesh: null, lamps: [] };
    }
  }
  markGeom(name, make) {
    let g = this.markCache.get(name);
    if (!g) { g = make(); this.markCache.set(name, g); }
    return g;
  }
  // pre-costruisce le geometrie pesanti dei monumenti nei momenti morti (menu), una per volta
  prewarm() {
    if (this._warm) return; this._warm = true;
    const jobs = [
      () => this.prefab('church', 0, () => { const s = buildChurchSquare(1); return { geom: s.geom, w: 0, lamps: s.lamps, houses: s.houses }; }),
      () => { for (const h of this.prefabs.get('church0').houses) this.prefab('house', h.seed % 26, () => M.buildHouse(h.seed % 26 + 1)); },
      () => this.markGeom('pinnacle', () => N.buildPinnacle(3)),
      () => this.markGeom('valley', () => N.valleyTerrain(250 + 0 - 140, 480, { side: 1, x0: 14.5, topY: -7, floorY: -46, dropW: 24, floorW: 150, far: 330, mtnH: 75, seed: 7, trees: 600 })),
      () => this.markGeom('viaduct', () => S.buildViaduct((x) => (x < 0 ? -2 : -5))),
      () => this.markGeom('valleyRiverR', () => N.valleyTerrain(750 - 150, 460, { side: 1, x0: 70, topY: -4.4, floorY: -4.4, dropW: 2, floorW: 30, far: 340, mtnH: 85, seed: 11, trees: 520 })),
      () => this.markGeom('valleyRiverL', () => N.valleyTerrain(750 - 150, 460, { side: -1, x0: 36, topY: 14, floorY: 14, dropW: 2, floorW: 8, far: 320, mtnH: 70, seed: 12, trees: 420 })),
      () => this.prefab('portal', 0, () => ({ geom: S.buildMinePortal(5), w: 0, lamps: [] })),
      () => this.prefab('cartDecor', 0, () => ({ geom: S.buildMineCartDecor(), w: 0, lamps: [] })),
      () => this.prefab('exit', 0, () => ({ geom: S.buildMineExit(8), w: 0, lamps: [] })),
    ];
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
    let n = 0;
    const step = () => { if (!jobs.length) return; if (this.mode === 'run' && n >= 3) { setTimeout(step, 400); return; } n++; jobs.shift()(); idle(step); };
    idle(step);
  }
  prefab(kind, idx, make) {
    const key = kind + idx;
    let p = this.prefabs.get(key);
    if (!p) { p = make(); p.key = key; this.prefabs.set(key, p); }
    return p;
  }
  placePrefab(sd, W, pf) {
    const pool = this.pools.get(pf.key) || []; let mesh = pool.pop();
    if (!mesh) { mesh = new THREE.Mesh(pf.geom, this.mats2); this.scene.add(mesh); }
    mesh.visible = true; mesh.position.set(sd.s * FACADE, 0, -W); mesh.scale.x = sd.s < 0 ? 1 : -1; mesh.rotation.set(0, 0, 0);
    const lamps = [];
    for (const l of pf.lamps) lamps.push(this.lamp(sd.s * FACADE - sd.s * l.x, l.y, -W + l.z, '#ffb85a', 2.6));
    return { W0: W, W1: W + pf.w, w: pf.w, mesh, key: pf.key, lamps };
  }
  // tutte le luci decorative (lanterne, lampadine, lampade di miniera) in UN solo draw call:
  // ogni "lamp" e' un handle leggero; ogni frame gli handle visibili vengono scritti in un THREE.Points
  glowLayer() {
    const N = 640;
    const g = new THREE.BufferGeometry();
    this.gP = new Float32Array(N * 3); this.gC = new Float32Array(N * 4); this.gS = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.gP, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.gC, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.gS, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.world.tex.glow }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
        void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = min(480.0, size * uScale / max(0.5, -mv.z)); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec4 vC;
        void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, t.a * vC.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glowPts = new THREE.Points(g, mat); this.glowPts.frustumCulled = false; this.glowPts.renderOrder = 15;
    this.scene.add(this.glowPts);
    this.glows = [];
  }
  flushGlow() {
    if (!this.glowPts) return;
    const w = this.world, cam = w.camera;
    const h = w.renderer.domElement.height;
    this.glowPts.material.uniforms.uScale.value = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    let n = 0; const P = this.gP, C = this.gC, S = this.gS, max = S.length;
    for (const g of this.glows) {
      if (!g.visible || n >= max) continue;
      P[n * 3] = g.position.x; P[n * 3 + 1] = g.position.y; P[n * 3 + 2] = g.position.z;
      const c = g.material.color; C[n * 4] = c.r; C[n * 4 + 1] = c.g; C[n * 4 + 2] = c.b; C[n * 4 + 3] = g.material.opacity;
      S[n] = g.scale.x; n++;
    }
    const geo = this.glowPts.geometry;
    geo.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size']) { const a = geo.attributes[k]; a.clearUpdateRanges?.(); a.addUpdateRange?.(0, n * a.itemSize); a.needsUpdate = true; }
  }
  lamp(x, y, z, color, size, op = 0.9) {
    if (!this.glowPts) this.glowLayer();
    let g = this.lampPool.pop();
    if (!g) { g = { visible: true, position: new THREE.Vector3(), scale: { x: 1, set(a) { this.x = a; } }, material: { color: new THREE.Color(), opacity: 1 }, userData: {} }; this.glows.push(g); }
    g.material.color.set(color); g.scale.set(size, size, 1); g.material.opacity = op; g.userData.op = op; g.userData.ph = Math.random() * 6;
    g.visible = true; g.position.set(x, y, z);
    return g;
  }
  freePiece(p) {
    if (p.mesh) {
      if (p.owned) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); this.stats.disposed++; }
      else { p.mesh.visible = false; if (!this.pools.has(p.key)) this.pools.set(p.key, []); this.pools.get(p.key).push(p.mesh); }
    }
    if (p.extra) for (const m of p.extra) { this.scene.remove(m); if (m.userData.ownGeo) m.geometry.dispose(); }
    for (const g of p.lamps || []) { g.visible = false; this.lampPool.push(g); }
  }

  // ------------------------------------------------------------ galleria
  fillCenter(front) {
    let guard = 0;
    while (this.cW < front && guard++ < 40) {
      const W = this.cW, i = this.info(W + 0.01);
      const Wb = this.boundaryAfter(W + 0.01);
      if (!i.b.tunnel) { const step = Number.isFinite(Wb) ? Math.max(0.5, Wb - W) : 30; this.center.push({ W0: W, W1: W + step, mesh: null, lamps: [] }); this.cW = W + step; continue; }
      const len = Math.max(0.5, Math.min(10, Wb - W));
      const type = i.b.tunnel;
      const every = i.b.decor.mineLamps || 40;
      const bStart = i.lap * CYCLE + i.b.from;
      const lampsNear = [];
      const b0 = this.bAt(W) - 10, b1 = this.bAt(W) + len + 10;
      for (let lb = Math.ceil((b0 - bStart - 6) / every) * every + bStart + 6; lb < b1; lb += every) {
        const idx = Math.round((lb - bStart - 6) / every);
        if (lb < bStart + 3 || lb > bStart + (i.b.to - i.b.from) - 3) continue;
        const lx = type === 'blue' ? 4.9 : 5.9;          // la parete blu sporge di piu'
        lampsNear.push([this.wOf(lb), idx % 2 ? lx : -lx, type === 'blue' ? 5.2 : 4.6]);
      }
      const geom = S.tunnelSegment(W, len, type, lampsNear);
      const mesh = new THREE.Mesh(geom, this.tunnelMat[type]); this.scene.add(mesh);
      const extra = [];
      const props = S.tunnelProps(W, len, type, lampsNear, { frames: i.b.id === 'mine-int' && i.local < 70 ? 7 : type === 'blue' ? 15 : 0 });
      if (props) { const pm = new THREE.Mesh(props, this.mats2); pm.position.z = -W; pm.userData.ownGeo = true; this.scene.add(pm); extra.push(pm); }
      if (i.b.id === 'mine-int' && Math.floor((i.local + len) / 90) > Math.floor(i.local / 90) && i.local > 40) {
        const dm = new THREE.Mesh(this.prefab('drill', 0, () => ({ geom: S.buildDrillMachine(), w: 0, lamps: [] })).geom, this.mats2);
        dm.position.set(-5.4, 0, -(W + len * 0.5)); dm.rotation.y = 0.05; this.scene.add(dm); extra.push(dm);
      }
      const lamps = [];
      for (const [lw, lx, ly] of lampsNear) if (lw >= W && lw < W + len) lamps.push(this.lamp(lx * 0.97, ly, -lw, type === 'blue' ? '#ffb45a' : '#ffd49a', type === 'blue' ? 4.2 : 2.4, type === 'blue' ? 0.95 : 0.8));
      this.center.push({ W0: W, W1: W + len, mesh, owned: true, extra, lamps });
      this.stats.built++;
      this.cW = W + len;
    }
  }

  // ------------------------------------------------------------ festoni e fili di luci sopra la strada
  fillDecor(front) {
    let guard = 0;
    while (this.dW < front && guard++ < 20) {
      const W = this.dW, i = this.info(W + 0.01), r = this.dR;
      const step = r.range(18, 30);
      const inSquare = this.mode !== 'attract' && i.b.id === 'village' && i.local > 128 && i.local < 200;
      if (i.b.decor.banners && !inSquare && i.local < 225) {
        const bulbs = i.b.decor.bulbs && r.chance(0.55);
        const pf = bulbs ? this.prefab('bulbs', r.int(4), () => ({ geom: buildBulbString(r.lastInt + 1), w: 0, lamps: [] })) : this.prefab('banner', r.int(4), () => ({ geom: M.buildBanner(r.lastInt + 1, FACADE), w: 0, lamps: [] }));
        const pool = this.pools.get(pf.key) || []; let m = pool.pop();
        if (!m) { m = new THREE.Mesh(pf.geom, bulbs ? this.mats2 : [this.world.bannerMat, this.world.mat.unlit]); this.scene.add(m); }
        m.visible = true; m.position.set(0, bulbs ? r.range(7.6, 8.6) : r.range(9.3, 10.0), -W); m.rotation.set(0, r.range(-0.12, 0.12), 0);
        m.userData.sway = !bulbs;
        this.decor.push({ W0: W, W1: W + step, mesh: m, key: pf.key, lamps: [] });
      } else this.decor.push({ W0: W, W1: W + step, mesh: null, lamps: [] });
      this.dW = W + step;
    }
  }

  // ------------------------------------------------------------ monumenti
  updateMarks(back, front) {
    if (this.mode === 'attract') return;
    const b0 = this.bAt(back), b1 = this.bAt(front);
    const want = new Set();
    const lap0 = Math.max(0, Math.floor((b0 - 400) / CYCLE)), lap1 = Math.floor((b1 + 400) / CYCLE);
    for (let lap = lap0; lap <= lap1; lap++) for (const b of BIOMES) for (const id of b.landmarks || []) {
      const d = LANDMARKS[id]; if (!d) continue;
      const at = lap * CYCLE + b.from + d.at;
      if (at + d.exist[0] < b1 && at + d.exist[1] > b0) want.add(`${id}@${lap}`);
    }
    for (const [key] of this.marks) if (!want.has(key)) this.freeMark(key);
    for (const key of want) if (!this.marks.has(key)) this.buildMark(key);
  }
  buildMark(key) {
    const [id, lapS] = key.split('@'); const lap = +lapS;
    const b = BIOMES.find((x) => (x.landmarks || []).includes(id));
    const d = LANDMARKS[id];
    const W = this.wOf(lap * CYCLE + b.from + d.at);
    const root = new THREE.Group(); root.position.z = -W;
    const own = [];         // geometrie da liberare
    const lamps = [];
    const mesh = (geom, mat = this.mats2, keep = false) => { const m = new THREE.Mesh(geom, mat); root.add(m); if (!keep) own.push(geom); return m; };
    // geometria del monumento in cache (solo CPU: alla rimozione si libera la GPU, i dati restano
    // per non ricostruirla a ogni giro). Costruita in coordinate b del giro 0 => indipendente dal giro.
    const Bm = b.from + d.at;
    const cached = (name, make) => { const g = this.markGeom(name, make); m_gpu.push(g); return mesh(g, this.mats2, true); };
    const m_gpu = [];
    const t0 = performance.now();
    if (id === 'church') {
      const sq = this.prefab('church', 0, () => { const s = buildChurchSquare(1); return { geom: s.geom, w: 0, lamps: s.lamps, houses: s.houses }; });
      mesh(sq.geom, this.mats2, true);
      for (const [x, y, z, s] of sq.lamps) lamps.push(this.lamp(x, y, z - W, '#ffd27a', s * 1.4, 0.8));
      for (const h of sq.houses) {
        const pf = this.prefab('house', h.seed % 26, () => M.buildHouse(h.seed % 26 + 1));
        const m = mesh(pf.geom, this.mats2, true);
        m.rotation.y = h.ry;
        if (h.ry > 0) m.position.set(h.x, 0, h.z);          // facciata verso -z (dentro la piazza), corpo verso +z
        else m.position.set(h.x - pf.w, 0, h.z);            // facciata verso +z
      }
    } else if (id === 'pinnacle') {
      const m = cached('pinnacle', () => N.buildPinnacle(3)); m.position.set(64, 0, 0); m.rotation.y = 0.4;
    } else if (id === 'valley') {
      cached('valley', () => N.valleyTerrain(Bm - 140, 480, { side: 1, x0: 14.5, topY: -7, floorY: -46, dropW: 24, floorW: 150, far: 330, mtnH: 75, seed: 7, trees: 600 })).position.z = Bm;
    } else if (id === 'pool') {
      for (const [lz, h, w] of [[60, 18, 3.2], [150, 21, 2.2], [205, 16, 4]]) {
        const fall = mesh(N.waterfallGeometry(h, w), this.fallMat); fall.position.set(34.5, h - 0.4, -lz); fall.rotation.y = -Math.PI / 2 + 0.1;
        lamps.push(this.lamp(33.5, 0.6, -lz - W, '#ffffff', 6, 0.35));
      }
    } else if (id === 'viaduct') {
      cached('viaduct', () => S.buildViaduct((x) => (x < 0 ? -2 : -5)));
    } else if (id === 'valleyRiver') {
      cached('valleyRiverR', () => N.valleyTerrain(Bm - 150, 460, { side: 1, x0: 70, topY: -4.4, floorY: -4.4, dropW: 2, floorW: 30, far: 340, mtnH: 85, seed: 11, trees: 520 })).position.z = Bm;
      cached('valleyRiverL', () => N.valleyTerrain(Bm - 150, 460, { side: -1, x0: 36, topY: 14, floorY: 14, dropW: 2, floorW: 8, far: 320, mtnH: 70, seed: 12, trees: 420 })).position.z = Bm;
    } else if (id === 'minePortal') {
      mesh(this.prefab('portal', 0, () => ({ geom: S.buildMinePortal(5), w: 0, lamps: [] })).geom, this.mats2, true);
      const cart = mesh(this.prefab('cartDecor', 0, () => ({ geom: S.buildMineCartDecor(), w: 0, lamps: [] })).geom, this.mats2, true); cart.position.set(8.6, 0, 7.5); cart.rotation.y = 0.15;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.65), new THREE.MeshLambertMaterial({ map: this.signTex || (this.signTex = BT.mineSignTexture()) }));
      sign.position.set(9.6, 11.6, 1.9); sign.rotation.set(0, -0.12, 0.04); root.add(sign); own.push(sign.geometry);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(70, 26), new THREE.MeshBasicMaterial({ map: this.netTex || (this.netTex = (() => { const t = BT.netTexture(); t.repeat.set(18, 7); return t; })()), transparent: true, depthWrite: false, opacity: 0.55 }));
      net.position.set(0, 27, -0.5); net.rotation.x = -0.18; root.add(net); own.push(net.geometry);
      lamps.push(this.lamp(0, 7.5, -W - 2, '#ffcf8a', 2.2, 0.7));
    } else if (id === 'mineExit') {
      mesh(this.prefab('exit', 0, () => ({ geom: S.buildMineExit(8), w: 0, lamps: [] })).geom, this.mats2, true);
    }
    this.scene.add(root);
    this.marks.set(key, { root, own, lamps, gpu: m_gpu, ms: performance.now() - t0 });
  }
  freeMark(key) {
    const m = this.marks.get(key); if (!m) return;
    this.scene.remove(m.root);
    for (const g of m.own) g.dispose();
    for (const g of m.gpu || []) g.dispose();          // solo buffer GPU; i dati CPU restano in cache
    for (const g of m.lamps) { g.visible = false; this.lampPool.push(g); }
    this.marks.delete(key);
  }

  // ------------------------------------------------------------ frame
  update(camW, playerW, dt, clock) {
    const back = camW - BEHIND, front = playerW + AHEAD;
    this.fillGround(front); this.fillCenter(front); this.fillDecor(front);
    for (const sd of this.sides) this.fillSide(sd, front);
    const cull = (list, rm) => { while (list.length && list[0].W1 < back) rm(list.shift()); };
    cull(this.ground, (s) => this.freeSeg(s));
    for (const sd of this.sides) cull(sd.list, (p) => this.freePiece(p));
    cull(this.center, (p) => this.freePiece(p)); cull(this.decor, (p) => this.freePiece(p));
    this.updateMarks(back, front + 160);
    // animazioni leggere
    for (const p of this.decor) if (p.mesh && p.mesh.userData.sway) p.mesh.rotation.x = Math.sin(clock * 1.3 + p.W0) * 0.04;
    for (const sd of this.sides) for (const p of sd.list) for (const g of p.lamps) g.material.opacity = g.userData.op * (0.85 + Math.sin(clock * 3 + g.userData.ph) * 0.12);
    for (const k in this.waterMat) { const u = this.waterMat[k].userData.u.uFlow.value; u.set(clock * 0.012, -clock * (k === 'river' ? 0.05 : 0.018)); }
    if (this.fallMat.map) this.fallMat.map.offset.y = -clock * 1.6;
    this.fade = Math.min(1, this.fade + dt * 2.2);
    // bioma corrente
    const b = this.bAt(playerW);
    this.cur = { ...biomeAt(b), bDist: b };
    this.updateMotes(camW, dt);
    this.flushGlow();
  }
  // pulviscolo minerale sospeso nella galleria blu (un solo draw call, segue la camera)
  updateMotes(camW, dt) {
    const k = (this.world.light && this.world.light.mineral) || 0;
    if (k < 0.02 && !this.motes) return;
    if (!this.motes) {
      const N = 180, P = new Float32Array(N * 3); const r = rng(909);
      for (let i = 0; i < N; i++) { P[i * 3] = r.range(-6, 6); P[i * 3 + 1] = r.range(0.3, 7.5); P[i * 3 + 2] = -camW - r.range(-2, 46); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      const m = new THREE.PointsMaterial({ map: this.world.tex.glow, color: '#9cc8ff', size: 0.13, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      this.motes = new THREE.Points(g, m); this.motes.frustumCulled = false; this.motes.renderOrder = 16; this.scene.add(this.motes);
      this.moteW = camW;
    }
    const m = this.motes; m.visible = k > 0.02; m.material.opacity = 0.85 * k;
    if (!m.visible) return;
    const P = m.geometry.attributes.position; const a = P.array; const t = this.world.clock || 0;
    for (let i = 0; i < P.count; i++) {
      a[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.12; a[i * 3 + 1] += (Math.sin(t * 0.4 + i * 1.7) * 0.08 + 0.03) * dt;
      if (a[i * 3 + 1] > 7.8) a[i * 3 + 1] = 0.3;
      let z = a[i * 3 + 2]; const rel = -z - camW;                 // distanza davanti alla camera
      if (rel < -2) z -= 48; else if (rel > 46) z += 48;
      a[i * 3 + 2] = z;
    }
    P.needsUpdate = true;
  }

  // luce / nebbia / audio del punto b (con dissolvenza verso il bioma successivo)
  moodAt(b, out) {
    const i = biomeAt(b), B = i.b, len = B.to - B.from;
    const nextI = (BIOMES.indexOf(B) + 1) % BIOMES.length, NB = BIOMES[nextI];
    const T = B.transitionOut || 30;
    let t = this.mode === 'attract' ? 0 : Math.max(0, Math.min(1, (i.local - (len - T)) / T)); t = t * t * (3 - 2 * t);
    const e = B.moodEnd ? Math.min(1, Math.max(0, i.local / len)) : 0;
    const night = (LAP_NIGHT[Math.min(LAP_NIGHT.length - 1, i.lap + (t > 0.5 && nextI === 0 ? 1 : 0))] || 0);
    for (const k of MOOD_KEYS) {
      out[k] = out[k] || new THREE.Color();
      out[k].set(B.mood[k]); if (B.moodEnd && B.moodEnd[k]) out[k].lerp(_c.set(B.moodEnd[k]), e);
      if (t > 0) out[k].lerp(_c.set(NB.mood[k]), t);
    }
    for (const k of NUM_KEYS) {
      let v = B.mood[k]; if (B.moodEnd && B.moodEnd[k] != null) v += (B.moodEnd[k] - v) * e;
      out[k] = v + (NB.mood[k] - v) * t;
    }
    const L = out.light || (out.light = {}), A = out.amb || (out.amb = {});
    for (const k of LIGHT_KEYS) L[k] = B.light[k] + (NB.light[k] - B.light[k]) * t;
    for (const k of AMB_KEYS) A[k] = B.ambience[k] + (NB.ambience[k] - B.ambience[k]) * t;
    out.farVis = (B.id === 'village' ? 1 : 0) * (1 - t) + (NB.id === 'village' ? 1 : 0) * t;
    // sera dei giri successivi (non dentro la miniera)
    const nk = night * (1 - L.tunnel);
    if (nk > 0) {
      for (const k of MOOD_KEYS) if (NIGHT_MOOD[k]) out[k].lerp(_c.set(NIGHT_MOOD[k]), nk * 0.8);
      for (const k of ['hemiI', 'dirI', 'moon', 'sun']) out[k] += (NIGHT_MOOD[k] - out[k]) * nk * 0.8;
    }
    out.biome = B.id; out.night = nk;
    return out;
  }
  ambience() { return this.target.amb; }
  skin(kind, W) { const s = this.info(W).b.skins; return (s && s[kind]) || null; }
  biomeIdAt(W) { return this.info(W).b.id; }
  debug() {
    let tris = 0, meshes = 0;
    this.scene.traverse((o) => { if (o.isMesh && o.visible) { meshes++; } });
    return { mode: this.mode, anchor: +this.anchor.toFixed(1), offset: this.offset, biome: this.cur.b.id, local: +this.cur.local.toFixed(1), lap: this.cur.lap, bDist: +this.cur.bDist.toFixed(1), ground: this.ground.length, center: this.center.length, sides: this.sides.map((s) => s.list.length), marks: [...this.marks.keys()], markMs: [...this.marks.values()].map((m) => +m.ms.toFixed(1)), stats: this.stats, meshes, prefabs: this.prefabs.size };
  }
}

// filo di lampadine attraverso la strada (come nel riferimento del paese in festa)
export function buildBulbString(seed) {
  const r = rng(seed * 13 + 1); const k = new Kit(seed + 50);
  const L = FACADE - 0.1, sag = r.range(0.6, 1.1);
  const yAt = (x) => -sag * (1 - (x / L) * (x / L));
  for (let i = 0; i < 12; i++) {
    const x0 = -L + (2 * L * i) / 12, x1 = -L + (2 * L * (i + 1)) / 12, y0 = yAt(x0), y1 = yAt(x1), len = Math.hypot(x1 - x0, y1 - y0);
    k.add(G.cyl(0.02, 0.02, len, 3), '#2a2624', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2 });
  }
  for (let x = -L + 0.5; x < L - 0.3; x += 0.8) {
    k.add(G.box(0.03, 0.12, 0.03), '#2a2624', { x, y: yAt(x) - 0.06 });
    k.add(G.box(0.13, 0.17, 0.13), r.chance(0.2) ? '#ffd27a' : '#fff1c8', { x, y: yAt(x) - 0.2, unlit: true });
  }
  return k.build();
}
