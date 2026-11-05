// =====================================================================
//  Gestore degli ambienti (solo grafica): costruisce e smonta a tratti
//  ("chunk") il percorso davanti al giocatore - terreno, lati, galleria,
//  decorazioni, monumenti - secondo i biomi di config.js, e calcola la
//  luce/nebbia/audio del punto in cui si trova il giocatore, con
//  dissolvenze ai confini. Nulla qui influisce su sim.js.
//  Coordinate: W = metri lungo il percorso (z del mondo = -W).
// =====================================================================
import { buildSantaMarta, santaMartaLamps, santaMartaAisleLamps, burraRunner, frescoes } from './builders/santamarta.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, CYCLE, biomeAt, nextBoundary, byId, LAP_NIGHT, NIGHT_MOOD, mapFromURL } from './config.js';
import * as M from '../models.js';
import * as BT from './textures.js';
import * as N from './builders/nature.js';
import { loadTower, fitTower, towerModel } from './towerModel.js';
import { loadCliffModels, cliffModels, buildCliffInstances, buildCurtains, fernMaterial, FERN_U } from './stiddiosa3d.js';
import { buildFalls, makeFaceX, stiddiosaFallSpecs, waterMaterial, fxMaterial, WATER_U } from './stiddiosaFalls.js';
import * as S from './builders/structures.js';
import { buildChurchSquare } from './builders/church.js';
import { buildVicolo, buildCappella, buildCappellaLeft } from './builders/gadoni5.js';
import { buildBanner } from '../masks/figures.js';
import { Kit, G, rng, ROCK, LEAF } from './builders/common.js';

export const ROAD_W = 11, WALK_W = 1.45, FACADE = ROAD_W / 2 + WALK_W;
const SEG = 120, BLEND = 12, AHEAD = 190, BEHIND = 14;   // v5s5: tratti di suolo lunghi (UV nel mondo): meno draw call ora che si costruisce piu lontano
// v5 stage 5: si costruisce sempre OLTRE la distanza visibile (nebbia / piano lontano della camera),
// cosi' nessun pezzo compare "dal nulla" e non si vede mai il vuoto in fondo al percorso.
// MUST = costruito subito (anche tutto in un frame); oltre, fino alla portata visibile, a tempo (BUDGET ms/frame).
const MUST = 150, MARGIN = 40, BUDGET = 3.5, MAX_REACH = 600;
// oltre LOD_D i pezzi ai lati si costruiscono senza i dettagli minuti (sassi, felci, ciuffi, pietre dei muretti:
// a quella distanza sono sotto il pixel) e si completano quando arrivano a LOD_D - 20 m
const LOD_D = 230, LOD_MIN = 0.8, BATCH = 70;   // i pezzi lontani sono uniti a gruppi di BATCH m per lato (pochi draw call)

const _c = new THREE.Color();
const MOOD_KEYS = ['top', 'mid', 'hor', 'fog', 'hemiS', 'hemiG', 'dirC', 'far'];
const NUM_KEYS = ['hemiI', 'dirI', 'moon', 'sun', 'fogNear', 'fogFar'];
const LIGHT_KEYS = ['flameDist', 'flameK', 'mineral', 'lamp', 'darkByFuel', 'tunnel', 'exposure', 'camLook', 'camFov', 'camYaw', 'sunDX', 'sunDY', 'sunDZ', 'glowX', 'glowY', 'skySunX'];   // v5s32: sole per ambiente (0 = come prima)
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
function waterMat(normalMap, color, opacity = 0.84, deep = null) {
  const m = new THREE.MeshPhongMaterial({ color, specular: '#fff0d0', shininess: 110, normalMap, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity, depthWrite: false });
  const u = { uFlow: { value: new THREE.Vector2() } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform vec2 uFlow;\nvarying float vWX;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vNormalMapUv = (modelMatrix * vec4(position, 1.0)).xz * 0.09 + uFlow; vWX = (modelMatrix * vec4(position, 1.0)).x;');
    sh.fragmentShader = 'varying float vWX;\n' + sh.fragmentShader;
    if (deep) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float t = smoothstep(${deep.x0.toFixed(1)}, ${deep.x1.toFixed(1)}, abs(vWX));
        diffuseColor.rgb = mix(vec3(${deep.a}), vec3(${deep.b}), t); diffuseColor.a = mix(${opacity.toFixed(2)}, 0.97, t); }`);
    // un po' di cielo riflesso ai bordi (fresnel) + verde smeraldo in profondita'
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal), 0.0, 1.0), 3.0);
      outgoingLight = mix(outgoingLight, outgoingLight * 0.6 + vec3(0.55, 0.62, 0.6) * 0.35, fr * ${deep ? '0.18' : '0.6'});
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'water' + (deep ? 'D' : '');
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

// valle della roccia: a sinistra del sentiero (la destra dell'inquadratura e' occupata dalla fiamma)
// le montagne cominciano presto (floorW 70) cosi' entrano nell'inquadratura verticale dietro la guglia
export const STIDDIOSA_FALLS = [[34, 17, 2.4], [62, 20, 1.8], [96, 16, 2.6], [128, 19, 2.0], [166, 17, 2.4], [204, 20, 1.8], [238, 16, 2.5]];   // v5s28: (z locale, altezza, larghezza)
const valleyRock = (Bm) => N.valleyTerrain(Bm - 30, 430, { side: -1, x0: 14.5, topY: -7, floorY: -46, dropW: 24, floorW: 70, far: 300, mtnH: 120, seed: 7, trees: 900, rise: [Bm + 175, Bm + 252, -3.6] });   // v5s34: risale sotto la riva del fiume (niente vuoto visto da ~430 m)
// ---------------------------------------------------------------- monumenti (per bioma, distanza locale)
// at: punto di riferimento (distanza locale nel bioma); exist: [da, a] relativo ad at in cui esiste
const LANDMARKS = {
  church: { at: 140, exist: [-200, 70] },
  vicolo: { at: 188, exist: [-200, 40] },      // v5s23c: vicolo delle porte (target5-vicolo-porte)
  cappella: { at: 222, exist: [-200, 40] },    // v5s23c: cappella tonda (target5-cappella-tonda)
  santamarta: { at: 240, exist: [-260, 60] },   // v5 stage 24: chiesa attraversata (builders/santamarta.js)
  pinnacle: { at: 230, exist: [-290, 120] },
  valley: { at: 0, exist: [-30, 390] },
  pool: { at: 0, exist: [-40, 280] },
  // reveal: il viadotto e la sua valle restano nascosti finche' si e' alla piscina naturale (luogo a se') e
  // compaiono in dissolvenza solo nel passaggio (metri relativi all'inizio del bioma indicato)
  viaduct: { at: 150, exist: [-200, 130], reveal: { biome: 'viaduct', from: -45, to: -10 } },
  valleyRiver: { at: 0, exist: [-70, 290], reveal: { biome: 'viaduct', from: -45, to: -10 } },
  minePortal: { at: 150, exist: [-200, 30] },
  mineExit: { at: 250, exist: [-80, 9] },   // v5s29 (QA L7): sparisce subito dopo l'uscita (restava come sagoma scura sopra il paese)
  farVillage: null,
};

export class Env {
  constructor(world) {
    this.world = world; this.scene = world.scene; this.mats2 = world.mats2;
    this.markCache = new Map();
    if (typeof window !== 'undefined') setTimeout(() => this.prewarm(), 200);
    // v5s33: i moduli della parete arrivano in un attimo (3 x ~11 KB); se nel frattempo si e' gia' costruito qualcosa, si ricostruisce una volta
    if (typeof window !== 'undefined') loadCliffModels().then((m) => { if (m && this._camW != null) this.rebuild(null, this._camW); });
    const dev = mapFromURL();
    this.dev = dev;
    // salto di mappa (solo grafica): ?map=<id> e, opzionale, &at=<metri dentro l'ambiente>
    const at = typeof location !== 'undefined' ? Math.max(0, +new URLSearchParams(location.search).get('at') || 0) : 0;
    // v5s23: &lap=N (solo test/sviluppo) parte dal giro N+1 dello stesso punto
    const lapQ = typeof location !== 'undefined' ? Math.max(0, Math.floor(+new URLSearchParams(location.search).get('lap') || 0)) : 0;
    this.offset = (dev ? Math.min(dev.to - 5, dev.from + Math.max(at, dev.id === 'rock' ? 26 : 0)) : 0) + lapQ * CYCLE;
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
    this.batches = new Map();
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
      cobble: t.cobble, slab: t.slab, trail: BT.trailTexture(), stoneTrail: BT.stoneTrailTexture(), earthTrail: BT.earthTrailTexture(), gravel: BT.gravelTexture(),
      mineFloor: BT.gravelTexture({ floor: true }), blueFloor: BT.gravelTexture({ blue: true }), nrm,
      grassEdge: BT.edgeTexture('grassEdge'), mossEdge: BT.edgeTexture('mossEdge'), drystone: BT.edgeTexture('drystone'), gravelEdge: BT.edgeTexture('gravelEdge'), earthEdge: BT.edgeTexture('earthEdge'),
    };
    this.roadTex = { cobble: this.tex.cobble, trail: this.tex.trail, stoneTrail: this.tex.stoneTrail, earthTrail: this.tex.earthTrail, gravel: this.tex.gravel, mineFloor: this.tex.mineFloor, blueFloor: this.tex.blueFloor };
    this.roadMat = {};
    for (const k in this.roadTex) this.roadMat[k] = groundMat(this.roadTex[k], k === 'blueFloor' || k === 'mineFloor' ? { phong: true, wet: false, shininess: k === 'blueFloor' ? 24 : 18, specular: k === 'blueFloor' ? '#2a3044' : '#2a2c30' } : {});
    this.blendMats = new Map();
    this.shoulderMat = {
      walk: groundMat(this.tex.slab, { sx: 1 / WALK_W, sz: 1 / 2.9, x0: 5.5, abs: true }),
      grassEdge: groundMat(this.tex.grassEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      mossEdge: groundMat(this.tex.mossEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      drystone: groundMat(this.tex.drystone, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      gravelEdge: groundMat(this.tex.gravelEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      earthEdge: groundMat(this.tex.earthEdge, { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true }),
      none: groundMat(this.tex.mineFloor, { phong: true, shininess: 30 }),
    };
    this.waterMat = { pool: waterMat(nrm, '#0f8a72', 0.8, { x0: 6.5, x1: 16, a: '0.03, 0.21, 0.17', b: '0.004, 0.075, 0.062' }), river: waterMat(nrm, '#3f7f7c', 0.86) };
    this.waterMat.pool.side = THREE.DoubleSide;   // v5s28: specchiata a sinistra (fiume di Sa Stiddiosa)
    this.tunnelMat = { rock: tunnelMat(false), blue: tunnelMat(true) };
    this.fallMat = new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, map: this.fallTexture() });
    this.fallMat.map.wrapT = THREE.RepeatWrapping; this.fallMat.map.repeat.set(1, 2);
    this.lit = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mistMat = new THREE.MeshBasicMaterial({ map: this.mistTexture(), color: '#f0fff8', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    this.shaftMat = new THREE.MeshBasicMaterial({ map: this.shaftTexture(), color: '#fff2c8', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.geo = {
      road: strip(-ROAD_W / 2, ROAD_W / 2),
      walk: (() => { const a = new THREE.BoxGeometry(WALK_W, 0.22, 1); a.translate(0, 0.11, -0.5); return a; })(),
      edge: strip(5.5, 9.5, 0.02),
      tfloor: strip(5.4, 7.6, 0.01),
      waterPool: strip(6.1, 80, -0.3), edgeN: strip(5.5, 6.25, 0.02), waterRiver: strip(13.0, 85, -4.0),
    };
    this.miscGeo = new Map();
  }
  mistTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 40, 2, 32, 40, 30); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  shaftTexture() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 128);
    const h = x.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 32, 128);
    return new THREE.CanvasTexture(c);
  }
  fallTexture() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = 'rgba(220,240,255,0.35)'; x.fillRect(4, 0, 24, 128);   // v5s28: velo continuo, le cascatelle si leggono
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`; x.fillRect(Math.random() * 32, Math.random() * 128, 1 + Math.random() * 2, 10 + Math.random() * 40); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  blendMat(a, b) {
    const key = a + '>' + b;
    let m = this.blendMats.get(key);
    if (!m) { m = groundMat(this.roadTex[a], { mapB: this.roadTex[b], phong: b === 'blueFloor' || b === 'mineFloor' || a === 'blueFloor', wet: false, specular: '#2a3044', shininess: 24 }); this.blendMats.set(key, m); }
    return m;
  }
  // geometria varia unita (cordoli, terreni ai lati, binari, letto del fiume), lunga 1 m
  misc(bid) {
    if (this.miscGeo.has(bid)) return this.miscGeo.get(bid);
    const g = byId[bid].ground; const k = new Kit(3);
    const one = (w, h, x, y, col) => k.add(G.box(w, h, 1), col, { x, y, z: -0.5 });
    if (g.curb) for (const s of [-1, 1]) one(0.22, 0.26, s * (ROAD_W / 2 + 0.05), 0.13, '#9a8e80');
    if (g.terrain) {
      if (g.left !== 'drop' && !g.mirrorWater) one(80, 0.1, -(9.0 + 40), (g.terrainY ?? -0.06) - 0.05, g.terrain);   // con la valle a sinistra niente terreno piano
      if (!g.right || g.mirrorWater) one(80, 0.1, 9.0 + 40, (g.terrainY ?? -0.06) - 0.05, g.terrain);
    }
    if (g.right === 'water') one(80, 0.1, (6.2 + 40) * (g.mirrorWater ? -1 : 1), -3.2, '#0e6e58');   // v5s28: fiume a sinistra (Sa Stiddiosa)
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
    // v5s14: anche i "vuoti" della galleria (segnaposto lunghi del menu) che scavalcano il taglio: se no la galleria
    // vera comincia solo dopo di loro e all'ingresso si vede il cielo nero (fascia nera sul soffitto)
    while (this.center.length) { const l = this.center[this.center.length - 1]; if (l.W0 >= cut || (!l.mesh && l.W1 > cut)) this.freePiece(this.center.pop()); else break; }
    this.cW = this.center.length ? this.center[this.center.length - 1].W1 : W - 40;
    this.dW = dropFrom(this.decor, (p) => this.freePiece(p));
    for (const [key] of this.marks) this.freeMark(key);
    if (full) { this.fade = 0; for (const sd of this.sides) sd.cur = W - 40; this.gW = W - 40; this.cW = W - 40; this.dW = W - 30; }
  }

  // ------------------------------------------------------------ terreno
  over(W) { return W > this.mustW && performance.now() > this.deadline; }
  fillGround(front) {
    while (this.gW < front && !this.over(this.gW)) {
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
    else if (g.shoulder) { add(g.right === 'water' ? this.geo.edgeN : this.geo.edge, this.shoulderMat[g.shoulder], g.right === 'water' ? 'edgeRn' : 'edgeR'); if (g.right !== 'water' && g.right !== 'river') { add(this.geo.edge, this.shoulderMat[g.shoulder], 'edgeL'); meshes[meshes.length - 1].scale.x = -1; } else { add(this.geo.edge, this.shoulderMat[g.shoulder], 'edgeL'); meshes[meshes.length - 1].scale.x = -1; } }
    add(this.misc(b.id), this.mats2, 'misc');
    if (g.right === 'water') add(this.geo.waterPool, this.waterMat.pool, 'water');
    if (g.right === 'river') add(this.geo.waterRiver, this.waterMat.river, 'water');
    if (g.mirrorWater) for (const m of meshes) if (m.userData.key === 'water' || m.userData.key === 'edgeRn' || m.userData.key === 'edgeL') m.scale.x = -m.scale.x;   // v5s28: acqua a sinistra, riva erbosa a destra
    for (const m of meshes) if (m.scale.x < 0) m.material = m.material; // (specchio: three gestisce il determinante negativo)
    this.stats.segs++;
    return { W0, W1, meshes, b: b.id };
  }
  freeSeg(s) { for (const m of s.meshes) { m.visible = false; const k = m.userData.key; if (!this.pools.has(k)) this.pools.set(k, []); m.scale.x = 1; m.position.x = 0; this.pools.get(k).push(m); } }

  // ------------------------------------------------------------ pezzi ai lati
  fillSide(sd, front) {
    let guard = 0;
    while (sd.cur < front && guard++ < 60 && !this.over(sd.cur)) {
      const W = sd.cur, i = this.info(W + 0.01);
      const Wb = this.boundaryAfter(W + 0.01);
      const maxLen = Wb - W;
      if (maxLen < 0.5) { sd.cur = Wb + 0.001; continue; }
      // vuoti (piazza della chiesa, piazzale del portale)
      const gaps = (i.b.gaps && i.b.gaps[sd.s < 0 ? 'left' : 'right']) || [];
      let skip = 0;
      for (const [a, z] of gaps) if (i.local >= a - 0.01 && i.local < z) skip = z - i.local;
      if (skip > 0) { sd.cur = W + skip; continue; }
      let lim = maxLen;
      for (const [a] of gaps) if (a > i.local) lim = Math.min(lim, a - i.local);
      const p = this.sidePiece(sd, W, i, lim);
      if (!p) { sd.cur = W + Math.min(lim, 6); continue; }
      sd.list.push(p);
      sd.cur = W + p.w;
    }
  }
  sidePiece(sd, W, i, lim) {
    const s = sd.s, r = sd.r, b = i.b, loc = i.local, len = b.to - b.from;
    const own = (make, w, extra = {}) => {
      const lod = W - this.lastPW > LOD_D;
      Kit.lodMin = lod ? LOD_MIN : 0; let geom; try { geom = make(); } finally { Kit.lodMin = 0; }
      this.stats.built++;
      if (lod) { const p = { W0: W, W1: W + w, w, mesh: null, geom, owned: true, lamps: [], make, lod, ...extra }; this.batchAdd(sd, p); return p; }
      const mesh = new THREE.Mesh(geom, this.mats2); mesh.position.set(s * FACADE, 0, -W); mesh.scale.x = s < 0 ? 1 : -1; this.scene.add(mesh);
      return { W0: W, W1: W + w, w, mesh, owned: true, lamps: [], make, lod, ...extra };
    };
    const fit = (a, bb) => Math.max(1.5, Math.min(lim, r.range(a, bb)));
    switch (b.sides) {
      case 'houses': {
        const nearEnd = loc > len - 32 && Number.isFinite(lim);
        if (nearEnd || lim < 5.1) {   // fine del paese: orti, muretti, alberi
          const w = fit(5, 9);
          return own(() => N.slopePiece(W, w, { Hs: 3, dist: 16, trees: 0.25, wall: true, wallH: 1.1, rocks: 0.1, ferns: 0, seed: 40 + i.lap, flowers: 0.3, ground: ['#7d8a4e', '#6e7a3e', '#8a9a56'] }), w);
        }
        const pf = r.chance(0.14) ? this.prefab('garden', r.int(5), () => M.buildGarden(r.lastInt + 1)) : this.prefab('house', r.int(26), () => M.buildHouse(r.lastInt + 1));
        if (pf.w > lim) { const w = Math.min(lim, 6); return own(() => N.slopePiece(W, w, { Hs: 2, dist: 12, trees: 0.2, wall: true, wallH: 1.1, ferns: 0, rocks: 0.1 }), w); }
        return this.placePrefab(sd, W, pf);
      }
      case 'mountain': {        // parete di roccia a destra, muretto e strapiombo sulla valle a sinistra
        if (s > 0) {
          if (loc < 28) { const w = fit(6, 10); return own(() => N.slopePiece(W, w, { Hs: 6 + loc * 0.3, dist: 22, trees: 0.3, rocks: 0.3, wall: loc < 12, seed: 5 }), w); }
          const w = fit(8, 14); return own(() => N.cliffPiece(W, w, { H0: 15, Hamp: 9, lean: 0.16, pal: ROCK.granite, moss: 0.55, ochre: true, seed: 7 }), w);
        }
        const w = fit(8, 12); return own(() => N.parapetPiece(W, w, { drop: 7 }), w);
      }
      case 'river': {
        // target2-fiume: bosco fitto e alto a sinistra con alberi chini sul sentiero; a destra piscina larga,
        // parete di travertino muschiata alta e lontana, massi bianchi e felci sulla riva
        // v5s28 (Sa Stiddiosa): fiume a sinistra (riva bassa e boscosa di la'), parete a strati con felci e cascatelle a destra
        if (s < 0) { const w = fit(8, 12); return own(() => N.stiddiosaBankPiece(W, w, {}), w); }   // v5s32: muretto + fiume vicino (target)
        const w = fit(8, 12), F = STIDDIOSA_FALLS.map(([lz]) => W - loc + lz); return own(() => N.stiddiosaCliffPiece(W, w, { falls: F, backing: !!cliffModels() }), w);
      }
      case 'valley': {
        if (s < 0) { const w = fit(8, 12); return own(() => N.slopePiece(W, w, { Hs: 16, dist: 30, trees: 0.22, rocks: 0.5, wall: true, wallH: 0.9, ferns: 0.05, seed: 13, ground: ['#7a7a44', '#6b7a3e', '#8a7a5a', '#9a8f6a', '#6e6a40'], conifers: true , skirt: -50 }), w); }
        const w = fit(8, 12); return own(() => N.riverDropPiece(W, w, { depth: 4 }), w);
      }
      case 'mineYard': {
        if (s < 0) { const w = fit(8, 13); return own(() => N.cliffPiece(W, w, { H0: 17, Hamp: 7, lean: 0.12, pal: ['#7d7a74', '#8f8b83', '#6c6a65', '#9c978e'], moss: 0.2, mossCol: '#7a6a52', leaf: LEAF.dry, top: 'shrub', seed: 17 , solid: 22 }), w); }
        const w = fit(8, 12); return own(() => N.slopePiece(W, w, { Hs: 18, dist: 26, trees: 0.06, rocks: 0.6, wall: true, wallH: 1.4, leaf: LEAF.dry, ground: ['#8a857c', '#7a766e', '#9a958c', '#7a7a56'], rockPal: ['#7d7a74', '#8f8b83', '#6c6a65'], seed: 19, ferns: 0 , skirt: -50 }), w);
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
      () => this.warmShaders(),
      () => this.prefab('church', 0, () => { const s = buildChurchSquare(1); return { geom: s.geom, w: 0, lamps: s.lamps, houses: s.houses }; }),
      () => { for (const h of this.prefabs.get('church0').houses) this.prefab('house', h.seed % 26, () => M.buildHouse(h.seed % 26 + 1)); },
      () => this.markGeom('pinnacle', () => N.buildPinnacle(3)),
      () => { loadTower(); },
      () => { loadCliffModels(); },   // v5s33: moduli della parete di Sa Stiddiosa
      () => this.markGeom('valley', () => valleyRock(250)),
      () => this.markGeom('viaduct', () => S.buildViaduct((x) => (x < 0 ? -2 : -5))),
      () => this.markGeom('valleyRiverR', () => N.valleyTerrain(750 - 150, 460, { side: 1, x0: 70, topY: -4.4, floorY: -4.4, dropW: 2, floorW: 30, far: 340, mtnH: 85, seed: 11, trees: 520, relief: 38 })),
      () => this.markGeom('valleyRiverL', () => N.valleyTerrain(750 - 150, 460, { side: -1, x0: 36, topY: 14, floorY: 14, dropW: 2, floorW: 8, far: 320, mtnH: 70, seed: 12, trees: 420, relief: 38 })),
      () => this.prefab('portal', 0, () => ({ geom: S.buildMinePortal(5), w: 0, lamps: [] })),
      () => this.prefab('cartDecor', 0, () => ({ geom: S.buildMineCartDecor(), w: 0, lamps: [] })),
      () => this.prefab('exit', 0, () => ({ geom: S.buildMineExit(8), w: 0, lamps: [] })),
      () => this.prefab('drill', 0, () => ({ geom: S.buildDrillMachine(), w: 0, lamps: [] })),
      // v5s29 (QA M1): anche i monumenti che mancavano, poi tutto caricato sulla GPU una volta (niente scatti al primo arrivo)
      () => this.markGeom('santamarta', () => buildSantaMarta(1)),
      () => this.markGeom('islet', () => N.isletGeometry(41)),
      () => this.markGeom('cappella', () => buildCappella()),
      () => this.markGeom('cappellaL', () => buildCappellaLeft()),
      () => this.markGeom('vicolo', () => buildVicolo(32)),
      () => this.warmShaders(),
      () => this.warmGPU(),
      () => { const p = loadTower(); if (p && p.then) p.then(() => idle(() => this.warmGPU())); },
    ];
    // nel menu: un lavoro per ogni momento libero. In corsa (partenza rapida): un lavoro ogni 0.7 s, mai a ridosso
    // di un confine (li' il frame deve restare libero)
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
    const step = () => {
      if (!jobs.length) { this._warmDone = true; return; }
      if (this.mode === 'run') {
        const pW = this.lastPW ?? 0, Wb = this.boundaryAfter(pW + 0.01), Wp = this.boundaryBefore(pW + 0.01);
        if (performance.now() - (this._jobT || 0) < 700 || Wb - pW < 25 || pW - Wp < 15) { setTimeout(step, 120); return; }
      }
      this._jobT = performance.now(); jobs.shift()(); idle(step);
    };
    idle(step);
  }
  // compila in anticipo TUTTI i materiali degli ambienti (anche i fondi di passaggio tra un ambiente e l'altro),
  // cosi' al confine non c'e' la pausa di compilazione dello shader alla prima apparizione
  // v5s29 (QA M1): disegna una volta, fuori schermo, ogni geometria pesante gia' costruita (buffer e shader pronti sulla GPU)
  warmGPU() {
    const r = this.world.renderer; if (!r) return;
    try {
      const grp = new THREE.Group(); grp.position.set(0, -2000, 0);
      const geos = new Set([...this.markCache.values()]); for (const p of this.prefabs.values()) if (p && p.geom) geos.add(p.geom);
      for (const g of geos) { if (!g || !g.attributes) continue; const m = new THREE.Mesh(g, this.mats2); m.frustumCulled = false; grp.add(m); }
      const tm = towerModel(); if (tm) { const c = tm.clone(); c.traverse((o) => { o.frustumCulled = false; }); grp.add(c); }
      for (const mat of [this.fallMat, this.mistMat, this.shaftMat]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), mat); m.frustumCulled = false; grp.add(m); }
      this.scene.add(grp);
      const rt = this._warmRT || (this._warmRT = new THREE.WebGLRenderTarget(4, 4));
      const prev = r.getRenderTarget(); r.setRenderTarget(rt); r.render(this.scene, this.world.camera); r.setRenderTarget(prev);
      this.scene.remove(grp);
    } catch (e) { /* solo ottimizzazione */ }
  }
  warmShaders() {
    const r = this.world.renderer; if (!r || !r.compile) return;
    for (let k = 0; k < BIOMES.length; k++) this.blendMat(BIOMES[k].ground.road, BIOMES[(k + 1) % BIOMES.length].ground.road);
    if (!this.signMat) this.signMat = new THREE.MeshLambertMaterial({ map: BT.mineSignTexture() });
    if (!this.netMat) this.netMat = new THREE.MeshBasicMaterial({ map: (() => { const t = BT.netTexture(); t.repeat.set(18, 7); return t; })(), transparent: true, depthWrite: false, opacity: 0.55 });
    const mats = [this.signMat, this.netMat, this.shaftMat, ...Object.values(this.roadMat), ...this.blendMats.values(), ...Object.values(this.shoulderMat), ...Object.values(this.waterMat), ...Object.values(this.tunnelMat), this.fallMat, ...this.mats2, this.lit];
    const grp = new THREE.Group(); const geo = new THREE.PlaneGeometry(0.01, 0.01);
    geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    for (const m of mats) { const me = new THREE.Mesh(geo, m); me.frustumCulled = false; grp.add(me); }
    grp.position.set(0, -500, 0);
    this.scene.add(grp);
    try { r.compile(this.scene, this.world.camera); } catch (e) { /* solo ottimizzazione */ }
    this.scene.remove(grp); geo.dispose();
    // v5s14: carica in anticipo sulla GPU anche tutte le texture (mipmap comprese): al primo uso non c'e' piu' il picco
    this.uploadTextures([...mats, ...Object.values(this.world.mat || {})]);
  }
  uploadTextures(mats) {
    const r = this.world.renderer; if (!r.initTexture) return;
    const seen = this._upTex || (this._upTex = new Set());
    const visit = (m) => { if (!m) return; if (Array.isArray(m)) return m.forEach(visit);
      for (const k of ['map', 'normalMap', 'alphaMap', 'emissiveMap', 'roughnessMap', 'bumpMap']) { const t = m[k]; if (t && t.isTexture && !seen.has(t)) { seen.add(t); try { r.initTexture(t); } catch (e) { /* */ } } }
      if (m.uniforms) for (const u of Object.values(m.uniforms)) { const t = u && u.value; if (t && t.isTexture && !seen.has(t)) { seen.add(t); try { r.initTexture(t); } catch (e) { /* */ } } } };
    mats.forEach(visit);
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
  // ---- gruppi di pezzi lontani: geometrie LOD unite (in coordinate del mondo) in una sola mesh per tratto
  batchAdd(sd, p) {
    const key = sd.s + ':' + Math.floor(p.W0 / BATCH);
    let b = this.batches.get(key); if (!b) { b = { key, s: sd.s, bin: Math.floor(p.W0 / BATCH), list: new Set(), mesh: null, dirty: true }; this.batches.set(key, b); }
    // la geometria del pezzo portata nel mondo (lato destro specchiato: si inverte l'ordine dei vertici)
    const g = p.geom; g.applyMatrix4(new THREE.Matrix4().makeTranslation(sd.s * FACADE, 0, -p.W0).multiply(new THREE.Matrix4().makeScale(sd.s < 0 ? 1 : -1, 1, 1)));
    if (sd.s > 0) { const P = g.attributes.position, Nn = g.attributes.normal, C = g.attributes.color; for (const A of [P, Nn, C]) if (A) for (let i = 0; i < A.count; i += 3) for (let c = 0; c < A.itemSize; c++) { const t = A.array[(i + 1) * A.itemSize + c]; A.array[(i + 1) * A.itemSize + c] = A.array[(i + 2) * A.itemSize + c]; A.array[(i + 2) * A.itemSize + c] = t; } }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    p.batch = b; p.off = null; b.list.add(p); b.dirty = true;
  }
  batchRemove(p) {
    const b = p.batch; if (!b) return;
    const first = b.list.values().next().value;
    b.list.delete(p); p.batch = null;
    // i pezzi si completano dal piu' vicino: se esce il primo basta spostare l'inizio del drawRange (niente fusione)
    if (first === p && p.off != null && !b.removed) b.head = true; else b.removed = true;
    b.dirty = true;
    if (p.geom) { p.geom.dispose(); p.geom = null; }
  }
  flushBatches() {
    for (const [key, b] of this.batches) {
      if (!b.dirty) continue;
      if (!b.list.size) { if (b.mesh) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); } this.batches.delete(key); continue; }
      const added = [...b.list].some((p) => p.off == null);
      if (b.head && !b.removed && !added && b.mesh) { b.mesh.geometry.setDrawRange(b.list.values().next().value.off, Infinity); b.head = false; b.dirty = false; continue; }
      // un gruppo che si sta ancora riempiendo si fonde solo quando e' completo o sta per entrare nella vista
      const binEnd = (b.bin + 1) * BATCH;
      if (!b.removed && !b.head && !(this.front >= binEnd + 14 || b.bin * BATCH < this.front - MARGIN)) continue;
      b.dirty = false; b.head = false; b.removed = false;
      if (b.mesh) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; }
      let off = 0; const list = [...b.list];
      for (const q of list) { q.off = off; off += q.geom.attributes.position.count; }
      const geo = mergeGeometries(list.map((q) => q.geom), false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      b.mesh = new THREE.Mesh(geo, this.mats2[0]); this.scene.add(b.mesh);
      if (performance.now() > this.deadline + 4) break;       // al massimo un paio di fusioni per frame
    }
  }
  freePiece(p) {
    if (p.batch) this.batchRemove(p);
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
    while (this.cW < front && guard++ < 40 && !this.over(this.cW)) {
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
    while (this.dW < front && guard++ < 20 && !this.over(this.dW)) {
      const W = this.dW, i = this.info(W + 0.01), r = this.dR;
      const step = r.range(18, 30);
      const inSquare = this.mode !== 'attract' && i.b.id === 'village' && i.local > 128 && i.local < 200;
      if (i.b.decor.banners && !inSquare && i.local < 176) {   // v5s23c: niente festoni sopra vicolo e cappella
        const bulbs = i.b.decor.bulbs && r.chance(0.55);
        const pf = bulbs ? this.prefab('bulbs', r.int(4), () => ({ geom: buildBulbString(r.lastInt + 1), w: 0, lamps: [] })) : this.prefab('banner', r.int(4), () => ({ geom: M.buildBanner(r.lastInt + 1, FACADE), w: 0, lamps: [] }));
        const pool = this.pools.get(pf.key) || []; let m = pool.pop();
        if (!m) { m = new THREE.Mesh(pf.geom, bulbs ? this.mats2 : [this.world.bannerMat, this.world.mat.unlit]); this.scene.add(m); }
        m.visible = true; m.position.set(0, bulbs ? r.range(10.2, 10.9) : r.range(9.3, 10.0), -W); m.rotation.set(0, r.range(-0.12, 0.12), 0);
        m.userData.sway = !bulbs;
        this.decor.push({ W0: W, W1: W + step, mesh: m, key: pf.key, lamps: [] });
      } else this.decor.push({ W0: W, W1: W + step, mesh: null, lamps: [] });
      this.dW = W + step;
    }
  }

  // ------------------------------------------------------------ monumenti
  updateMarks(back, front) {
    if (this.upQ) { for (const r of this.upQ) r.traverse((o) => { if (o.isMesh) o.frustumCulled = true; }); } this.upQ = [];
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
    // caricamento sulla GPU del monumento costruito al frame precedente: lo si disegna una volta anche fuori
    // inquadratura (oltre il piano lontano: costa solo i vertici), cosi' i buffer sono pronti prima che si veda
    for (const key of want) if (!this.marks.has(key)) {
      this.buildMark(key);
      const root = this.marks.get(key).root; root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); this.upQ.push(root);
      if (!this.mustMark(key, b0)) break;           // uno per frame, salvo che serva subito
    }
  }
  revealMarks(playerW) {
    const pb = this.bAt(playerW);
    for (const [key, m] of this.marks) {
      const [id, lap] = key.split('@');
      // v5s29 (QA H1): usciti dalla navata di Santa Marta la chiesa sparisce: la camera (qualche metro dietro) non resta dentro il muro d'uscita
      if (id === 'santamarta') { const ex = lap * CYCLE + byId.village.from + LANDMARKS.santamarta.at + 30 + 2.5; m.root.visible = this.mode === 'attract' || pb < ex; continue; }
      const rv = LANDMARKS[id].reveal; if (!rv) continue;
      let k = 1;
      if (this.mode !== 'attract') { const t = (pb - (lap * CYCLE + byId[rv.biome].from) - rv.from) / (rv.to - rv.from); k = Math.max(0, Math.min(1, t)); k = k * k * (3 - 2 * k); }
      m.root.visible = k > 0.001;
      if (m.fadeK === k) continue; m.fadeK = k;
      if (!this.fadeMats) this.fadeMats = this.mats2.map((x) => { const c = x.clone(); c.transparent = true; c.depthWrite = true; return c; });
      for (const f of this.fadeMats) f.opacity = k;
      const mats = k < 0.999 ? this.fadeMats : this.mats2;
      m.root.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) o.material = mats; });
    }
  }
  mustMark(key, b0) { const [id, lap] = key.split('@'); const b = BIOMES.find((x) => (x.landmarks || []).includes(id)); const d = LANDMARKS[id]; return lap * CYCLE + b.from + d.at + d.exist[0] < b0 + MUST; }
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
      root.scale.x = -1;                                   // piazza costruita a sinistra, specchiata a destra della via
      // v5s10: stendardo di cuoio dell'Ass. Culturale Maimoni e Grastula (testa di capra), a bordo via
      const ban = buildBanner(this.mats2); ban.scale.x = -1; ban.position.set(6.0, 0, 52); ban.rotation.y = 0.4; root.add(ban);
      for (const [x, y, z, s] of sq.lamps) lamps.push(this.lamp(-x, y, z - W, '#ffd27a', s * 1.4, 0.8));
      let chainZ = 0;
      for (const h of sq.houses) {
        const pf = this.prefab('house', h.seed % 26, () => M.buildHouse(h.seed % 26 + 1));
        const m = mesh(pf.geom, this.mats2, true);
        if (h.road) {                                        // facciata verso la via, sul lato opposto alla chiesa
          const z = h.z ?? chainZ; m.scale.x = -1; m.position.set(h.x, 0, z); chainZ = z - pf.w;
          for (const l of pf.lamps) lamps.push(this.lamp(-(h.x - l.x), l.y, z + l.z - W, '#ffb85a', 2.6));
          continue;
        }
        m.rotation.y = h.ry;
        if (h.ry > 0) m.position.set(h.x, 0, h.z);          // facciata verso -z (dentro la piazza), corpo verso +z
        else m.position.set(h.x - pf.w, 0, h.z);            // facciata verso +z
      }
    } else if (id === 'vicolo') {
      cached('vicolo', () => buildVicolo(32));
    } else if (id === 'cappella') {
      // specchiata: la cappella a SINISTRA della via (a destra la coprirebbe la fiamma), case bianche a destra
      root.scale.x = -1;
      cached('cappella', () => buildCappella());
      cached('cappellaL', () => buildCappellaLeft());
      // v5s26: lampioni tolti davanti alla cappella
    } else if (id === 'santamarta') {
      // v5s24: la navata e' al coperto: niente neve per terra (passatoia gialla e cotto restano visibili nei giri di neve)
      if (!this.mats2NoSnow) this.mats2NoSnow = this.mats2.map((m) => m.clone());
      { const g = this.markGeom('santamarta', () => buildSantaMarta(1)); m_gpu.push(g); mesh(g, this.mats2NoSnow, true); }
      for (const [x, y, z, s] of santaMartaLamps()) lamps.push(this.lamp(x, y, z - W, '#ffc070', 3.2 * s, 0.9));
      for (const [x, y, z, s] of santaMartaAisleLamps()) lamps.push(this.lamp(x, y, z - W, '#ffc878', 3.0 * s, 0.9));
      if (!this.burra) this.burra = burraRunner();
      mesh(this.burra.geo, this.burra.mat, true);   // v5s26: tappeto sa burra lungo la navata
      if (!this.fresc) this.fresc = frescoes();
      mesh(this.fresc.geo, this.fresc.mat, true);   // v5s26: affreschi dipinti
    } else if (id === 'pinnacle') {
      const m = cached('pinnacle', () => N.buildPinnacle(3)); m.position.set(-25, 0, 0); m.rotation.y = 0.4; fitTower(m, root);   /* v5s27n: modello 3D al posto della procedurale (che resta se il modello manca) */   // v5s27k: un po' piu' vicina alla via    // nella valle a SINISTRA del sentiero: a destra c'e' la fiamma che la coprirebbe
    } else if (id === 'valley') {
      cached('valley', () => valleyRock(Bm)).position.z = Bm;
    } else if (id === 'pool') {
      // v5s28 (Sa Stiddiosa): cascatelle sottili dalle cenge della parete a destra, spruzzi e foschia leggera al piede,
      // fiume a sinistra con isolotti e massi muschiati; niente piu' nebbia bianca che copre tutto
      // v5s33: parete a moduli 3D (3 draw call) + tende di felci su carte (1 draw call); senza modelli: felci sulle cenge procedurali
      { const fl = STIDDIOSA_FALLS.map(([lz]) => lz), cm = cliffModels(); let lips = [], cliffMeshes = [];
        if (cm) { const ci = buildCliffInstances(cm, this.mats2[0], fl); for (const im of ci.meshes) { root.add(im); own.push({ dispose: () => im.dispose() }); } lips = ci.lips; cliffMeshes = ci.meshes; }
        else { const P = N.stiddiosaProfile(28, fl.map((lz) => W + lz)); for (let lz = -10; lz < 262; lz += 1.25) for (let y = N.STIDDIOSA_CLIFF.BH; y < 42; y += N.STIDDIOSA_CLIFF.BH) { const Wa = W + lz; if (y > P.Hf(Wa) - 1 || P.wet(Wa) > 0.3) continue; lips.push({ x: FACADE - P.X(Wa, y - 0.6), y: y - 0.6, z: -lz, t: 0 }); } }
        const FS = stiddiosaFallSpecs(fl), avoid = FS.map((f) => ({ z: -f.lz, half: f.w * 0.5 + (f.kind === 'trickle' ? 1.2 : 2.2), y0: f.y0 }));
        for (const g of buildCurtains(lips, 5 + lap, { keep: cm ? 1 : 0.9, avoid })) mesh(g, fernMaterial());
        // v5s37: cascate vere (acqua curva a strati sulle cenge + pozza, schiuma, foschia): 2 draw call al posto delle 21 strisce piatte
        const P = N.stiddiosaProfile(28, fl.map((lz) => W + lz), cm ? 2.5 : 0), back = (lz, y) => (y > P.Hf(W + lz) ? 99 : FACADE - P.X(W + lz, y));
        const FA = buildFalls(makeFaceX(cliffMeshes, back), FS, 7 + lap);
        mesh(FA.water, waterMaterial()).renderOrder = 2; mesh(FA.fx, fxMaterial()).renderOrder = 3;
        this.falls = [];
        FA.bases.forEach((b, i) => { const o = new THREE.Object3D(); o.position.set(b.x, 0, b.z); o.userData.big = b.big; root.add(o); this.falls.push(o);
          if (!FA.bases.some((c, j) => j < i && Math.abs(c.z - b.z) < 4)) lamps.push(this.lamp(Math.max(6.4, b.x + 0.6), 0.7, b.z - W, '#e8fff4', 7, 0.35 * Math.max(0.7, b.big))); }); }
      const ig = this.markGeom('islet', () => N.isletGeometry(41)); m_gpu.push(ig);
      for (const [x, lz, ry] of [[-14, 58, 0.4], [-16, 150, -0.6], [-13, 228, 1.2]]) { const isl = mesh(ig, this.mats2, true); isl.position.set(x, -0.2, -lz); isl.rotation.y = ry; }
      const sg = this.shaftGeo || (this.shaftGeo = (() => { const g = new THREE.PlaneGeometry(3.2, 26); g.translate(0, -13, 0); return g; })());
      for (const [sx, lz, rz] of [[2.5, 28, 0.42], [1.5, 101, 0.45], [3.5, 176, 0.42]]) {
        const sh = mesh(sg, this.shaftMat, true); sh.position.set(sx, 24, -lz); sh.rotation.set(0, -0.6, rz);
      }
    } else if (id === 'viaduct') {
      cached('viaduct', () => S.buildViaduct((x) => (x < 0 ? -2 : -5)));
    } else if (id === 'valleyRiver') {
      cached('valleyRiverR', () => N.valleyTerrain(Bm - 150, 460, { side: 1, x0: 70, topY: -4.4, floorY: -4.4, dropW: 2, floorW: 30, far: 340, mtnH: 85, seed: 11, trees: 520, relief: 38 })).position.z = Bm;
      cached('valleyRiverL', () => N.valleyTerrain(Bm - 150, 460, { side: -1, x0: 36, topY: 14, floorY: 14, dropW: 2, floorW: 8, far: 320, mtnH: 70, seed: 12, trees: 420, relief: 38 })).position.z = Bm;
    } else if (id === 'minePortal') {
      mesh(this.prefab('portal', 0, () => ({ geom: S.buildMinePortal(5), w: 0, lamps: [] })).geom, this.mats2, true);
      const cart = mesh(this.prefab('cartDecor', 0, () => ({ geom: S.buildMineCartDecor(), w: 0, lamps: [] })).geom, this.mats2, true); cart.position.set(8.6, 0, 7.5); cart.rotation.y = 0.15;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.65), this.signMat || (this.signMat = new THREE.MeshLambertMaterial({ map: BT.mineSignTexture() })));
      sign.position.set(9.6, 11.6, 1.9); sign.rotation.set(0, -0.12, 0.04); root.add(sign); own.push(sign.geometry);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(70, 26), this.netMat || (this.netMat = new THREE.MeshBasicMaterial({ map: (() => { const t = BT.netTexture(); t.repeat.set(18, 7); return t; })(), transparent: true, depthWrite: false, opacity: 0.55 })));
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

  // distanza fino a cui si vede dal giocatore: nebbia dell'ambiente corrente e (vicino al confine) del successivo,
  // limitata dal piano lontano della camera; + margine (la camera sta ~10 m dietro al giocatore)
  reach(playerW) {
    if (this.mode === 'attract') return AHEAD;
    const camFar = this.world.camera.far;
    const ff = (B) => Math.max(B.mood.fogFar, (B.moodEnd && B.moodEnd.fogFar) || 0);
    const i = this.info(playerW + 0.01);
    let f = ff(i.b);
    const Wb = this.boundaryAfter(playerW + 0.01);
    // la nebbia del prossimo ambiente arriva negli ultimi metri (transitionOut) + inseguimento morbido: anticipo largo
    if (Number.isFinite(Wb) && Wb - playerW < 200) f = Math.max(f, ff(this.info(Wb + 0.01).b));
    return Math.max(AHEAD, Math.min(MAX_REACH, Math.min(camFar, f) + MARGIN));
  }
  // ------------------------------------------------------------ frame
  update(camW, playerW, dt, clock) {
    this._camW = camW;
    const back = camW - BEHIND, front = playerW + this.reach(playerW);
    this.lastPW = playerW; this.mustW = playerW + MUST; this.deadline = performance.now() + BUDGET;
    this.front = front;
    this.fillGround(front); this.fillCenter(front); this.fillDecor(front);
    for (const sd of this.sides) this.fillSide(sd, front);
    // pezzi lontani (LOD) che si avvicinano: si completano con tutti i dettagli (a tempo, salvo se gia' vicini)
    for (const sd of this.sides) for (const p of sd.list) {
      if (!p.lod || p.W0 - playerW > LOD_D - 20) continue;
      if (p.W0 - playerW > 140 && performance.now() > this.deadline) break;
      const g = p.make(); this.batchRemove(p); p.lod = false; this.stats.upgraded = (this.stats.upgraded || 0) + 1;
      p.mesh = new THREE.Mesh(g, this.mats2); p.mesh.position.set(sd.s * FACADE, 0, -p.W0); p.mesh.scale.x = sd.s < 0 ? 1 : -1; this.scene.add(p.mesh);
    }
    const cull = (list, rm) => { while (list.length && list[0].W1 < back) rm(list.shift()); };
    this.flushBatches();
    cull(this.ground, (s) => this.freeSeg(s));
    for (const sd of this.sides) cull(sd.list, (p) => this.freePiece(p));
    cull(this.center, (p) => this.freePiece(p)); cull(this.decor, (p) => this.freePiece(p));
    this.updateMarks(back, Math.max(front, playerW + AHEAD + 160));
    this.revealMarks(playerW);
    // animazioni leggere
    for (const p of this.decor) if (p.mesh && p.mesh.userData.sway) p.mesh.rotation.x = Math.sin(clock * 1.3 + p.W0) * 0.04;
    for (const sd of this.sides) for (const p of sd.list) for (const g of p.lamps) g.material.opacity = g.userData.op * (0.85 + Math.sin(clock * 3 + g.userData.ph) * 0.12);
    for (const k in this.waterMat) { const u = this.waterMat[k].userData.u.uFlow.value; u.set(clock * 0.012, -clock * (k === 'river' ? 0.05 : 0.018)); }
    if (this.fallMat.map) this.fallMat.map.offset.y = -clock * 1.6;
    FERN_U.uT.value = clock;   // v5s33: felci che ondeggiano
    WATER_U.uT.value = clock;  // v5s37: acqua delle cascate
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
    for (const k of LIGHT_KEYS) { const a = B.light[k] ?? 0, c = NB.light[k] ?? 0; L[k] = a + (c - a) * t; }
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
// v5s27p: pali di legno alle due estremita' dei fili (il filo non finisce mai nel vuoto). Origine = quota del filo; il palo scende fino a terra.
export function stringPoles(k, L, down = 11.2) {
  for (const sx of [-1, 1]) {
    k.add(G.cyl(0.09, 0.12, down + 0.5, 6), '#5a4330', { x: sx * (L + 0.05), y: -down / 2 + 0.25, flat: true });
    k.add(G.box(0.5, 0.07, 0.07), '#3a2a1e', { x: sx * (L - 0.15), y: 0.02 });   // braccetto
    k.add(G.box(0.2, 0.08, 0.2), '#3a2a1e', { x: sx * (L + 0.05), y: 0.52 });    // cappello
  }
}
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
  stringPoles(k, L);   // v5s27p: ogni filo ancorato a un palo su entrambi i lati
  return k.build();
}
