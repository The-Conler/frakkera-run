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
import { BIOMES, CYCLE, biomeAt, nextBoundary, byId, LAP_NIGHT, NIGHT_MOOD, mapFromURL, RAIL_X } from './config.js';
import { SHOP } from '../../config.js';
import { buildPinuFacade } from '../village3d.js';
import * as M from '../models.js';
import * as BT from './textures.js';
import * as N from './builders/nature.js';
import { loadTower, fitTower, towerModel } from './towerModel.js';
import { loadCliffModels, cliffModels, buildCliffInstances, buildCurtains, fernMaterial, FERN_U } from './stiddiosa3d.js';
import { buildFalls, makeFaceX, stiddiosaFallSpecs, waterMaterial, fxMaterial, WATER_U } from './stiddiosaFalls.js';
import * as S from './builders/structures.js';
import { buildChurchSquare, VISTA } from './builders/church.js';
import { buildVicolo, buildCappella, buildCappellaLeft, cadutiDecals, cadutiStatue } from './builders/gadoni5.js';
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
  const u = { uMapF: { value: o.feather || map }, uWet: { value: 1 }, uMapB: { value: o.mapB || map }, uZ0: { value: 0 }, uZ1: { value: 1 }, uSX: { value: o.sx ?? 1 / 11 }, uSZ: { value: o.sz ?? 1 / 11 }, uX0: { value: o.x0 ?? -5.5 }, uAbs: { value: o.abs ? 1 : 0 }, uFlame: { value: new THREE.Vector3() }, uFlameI: { value: 0 } };
  m.userData.u = u;
  if (o.mapB) m.defines = { BLEND: '' };
  if (o.wet) m.defines = { ...(m.defines || {}), WET: '' };
  if (o.feather) m.defines = { ...(m.defines || {}), FEATHER: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform sampler2D uMapB; uniform sampler2D uMapF; uniform float uZ0, uZ1, uSX, uSZ, uX0, uAbs;\nuniform vec3 uFlame; uniform float uFlameI;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 wuv = vec2((mix(vWP.x, abs(vWP.x), uAbs) - uX0) * uSX, -vWP.z * uSZ);
      vec4 sA = texture2D(map, wuv);
      #ifdef BLEND
        vec4 sB = texture2D(uMapB, wuv);
        float kb = smoothstep(uZ0, uZ1, -vWP.z + (sA.g - 0.45) * 9.0);
        sA = mix(sA, sB, kb);
      #endif
      #ifdef FEATHER
        // v5s46c (6): bordo morbido e irregolare fra strada e ciglio: vicino alla strada il ciglio prende la terra della strada
        // (campionata a specchio oltre il bordo), con un contorno frastagliato invece della riga dritta
        float ax = abs(vWP.x), xr = sign(vWP.x) * (11.0 - ax);
        vec4 sF = texture2D(uMapF, vec2((xr + 5.5) / 11.0, -vWP.z / 11.0));
        float jag = sin(vWP.z * 1.7) * 0.18 + sin(vWP.z * 4.3 + 1.3) * 0.1 + (sA.g - 0.45) * 0.9;
        float kf = 1.0 - smoothstep(5.55, 6.45, ax + jag);
        sA = mix(sA, sF, kf * 0.92);
      #endif
      diffuseColor *= sA;
      float fdL = length(vWP - uFlame);
      diffuseColor.rgb += vec3(1.0, 0.46, 0.14) * uFlameI * exp(-fdL * 0.28);`);
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
  m.customProgramCacheKey = () => (o.mapB ? 'gb' : 'g') + (o.phong ? 'p' : 'l') + (o.wet ? 'w' : '') + (o.feather ? 'f' : '') + 'fl';
  return m;
}
// v5s46d (258): solo i colori dei piloni (strisce di pioggia, muschio in basso). La forma di buildViaduct non si tocca.
function weatherViaduct(geom) {
  if (!geom || !geom.getAttribute) return geom;
  const g = geom.clone();
  const col = g.getAttribute('color'), pos = g.getAttribute('position');
  if (!col || !pos) return geom;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 44) continue;
    const streak = 0.58 + 0.42 * Math.abs(Math.sin(pos.getX(i) * 2.4 + pos.getZ(i) * 0.35 + y * 0.17));
    const foot = y < 6 ? 0.82 : 1;
    col.setXYZ(i, col.getX(i) * streak * foot, col.getY(i) * streak * foot * (y < 4 ? 0.95 : 1), col.getZ(i) * streak * foot * 0.88);
  }
  col.needsUpdate = true;
  return g;
}
function waterMat(normalMap, color, opacity = 0.84, deep = null) {
  const m = new THREE.MeshPhongMaterial({ color, specular: '#fff0d0', shininess: 110, normalMap, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity, depthWrite: false });
  const u = { uFlow: { value: new THREE.Vector2() }, uT: { value: 0 }, uFlame: { value: new THREE.Vector3() }, uFlameI: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform vec2 uFlow;\nvarying float vWX; varying float vWZ;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vec3 wpx = (modelMatrix * vec4(position, 1.0)).xyz; vNormalMapUv = wpx.xz * 0.09 + uFlow; vWX = wpx.x; vWZ = wpx.z;');
    sh.fragmentShader = 'varying float vWX; varying float vWZ;\nuniform float uT; uniform vec3 uFlame; uniform float uFlameI;\n' + sh.fragmentShader;
    if (deep) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float t = smoothstep(${deep.x0.toFixed(1)}, ${deep.x1.toFixed(1)}, abs(vWX));
        diffuseColor.rgb = mix(vec3(${deep.a}), vec3(${deep.b}), t); diffuseColor.a = mix(${opacity.toFixed(2)}, 0.97, t); }`);
    // corrente, schiuma e riflesso della fiamma (v5s46d 283)
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal), 0.0, 1.0), 3.0);
      outgoingLight = mix(outgoingLight, outgoingLight * 0.6 + vec3(0.55, 0.62, 0.6) * 0.35, fr * ${deep ? '0.18' : '0.6'});
      float foam = smoothstep(0.62, 0.92, sin(vWZ * 1.6 + uT * 2.4) * 0.5 + 0.5 + sin(vWX * 0.7 + uT) * 0.15);
      outgoingLight += vec3(0.9, 0.96, 0.95) * foam * 0.22;
      float fd = length(vec2(vWX - uFlame.x, vWZ - uFlame.z));
      outgoingLight += vec3(1.0, 0.45, 0.12) * exp(-fd * 0.18) * uFlameI;
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'water46d' + (deep ? 'D' : '');
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
  valleyRiver: { at: 0, exist: [-160, 290], reveal: { biome: 'viaduct', from: -150, to: -115 } },   // v5s42: prima da -45 m: a Sa Stiddiosa (fine del fiume) a sinistra si vedeva il vuoto grigio
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
    if (typeof window !== 'undefined') loadCliffModels().then((m) => { if (m && this.poolKeep) { for (const g of this.poolKeep.own) g.dispose(); for (const g of this.poolKeep.gpu) g.dispose(); this.poolKeep = null; } if (m && this._camW != null) this.rebuild(null, this._camW); });   // v5s46: la Stiddiosa tenuta da parte era quella senza moduli
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
    this.houseFeet = []; this._footId = 0;   // v5s39: impronte case per escludere alberi/cespugli
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
    for (const b of BIOMES) { const g = b.ground, key = 'f:' + g.shoulder + '|' + g.road;
      if (g.shoulder && !g.curb && this.tex[g.shoulder] && !this.shoulderMat[key]) this.shoulderMat[key] = groundMat(this.tex[g.shoulder], { sx: 1 / 3, sz: 1 / 3, x0: 0, abs: true, feather: this.roadTex[g.road] }); }
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
  // v5s46c (10): c'e' scenografia (muretto, gradini, casa) piu' alta di h sotto l'impronta (x, W)? (raggi dall'alto sui lati e monumenti)
  sideBlocked(x, W, h, r = 0.55) {
    const rc = this._rcS || (this._rcS = new THREE.Raycaster()), dn = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(), objs = [];
    for (const sd of this.sides) for (const p of sd.list) if (p.mesh && p.W0 - 3 <= W && p.W1 + 3 >= W) objs.push(p.mesh);
    for (const [, mk] of this.marks) objs.push(mk.root);
    for (const [, b] of this.batches) if (b.mesh && b.mesh.visible) objs.push(b.mesh);
    if (!objs.length) return false;
    rc.far = 12;
    for (const [dx, dz] of [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r]]) {
      o.set(x + dx, 10, -W + dz); rc.set(o, dn);
      const hh = rc.intersectObjects(objs, true).find((q) => q.object.visible);
      if (hh && hh.point.y > h) return true;
    }
    return false;
  }
  // v5s46d-QA: piano su cui poggia un oggetto di lato (piazzetta, gradino, marciapiede): il piu' alto fra 0 e maxH sotto i punti
  sideFloor(x, W, maxH = 0.5, r = 0.6) {
    const rc = this._rcF || (this._rcF = new THREE.Raycaster()), dn = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(), objs = [];
    for (const sd of this.sides) for (const p of sd.list) if (p.mesh && p.W0 - 3 <= W && p.W1 + 3 >= W) objs.push(p.mesh);
    for (const [, b] of this.batches) if (b.mesh && b.mesh.visible) objs.push(b.mesh);
    if (!objs.length) return null;
    rc.far = maxH + 0.6; const ys = [];
    for (const [dx, dz] of [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r]]) {
      o.set(x + dx, maxH + 0.5, -W + dz); rc.set(o, dn);
      const hh = rc.intersectObjects(objs, true).find((q) => q.object.visible && q.point.y <= maxH);
      if (hh) ys.push(hh.point.y);
    }
    if (!ys.length) return null;
    ys.sort((a, b) => a - b); return ys[Math.floor(ys.length / 2)];
  }
  // v5s46c (13/41): ombre di contatto dichiarate dai Kit (k.shadow) -> macchie morbide del sistema di ombre del mondo
  attachShadows(mesh) {
    const sh = mesh.geometry && mesh.geometry.userData.shadows; if (!sh || !this.world.blob) return;
    const list = [];
    for (const [x, y, z, rx, rz] of sh) { const b = this.world.blob(rx * 2, rz * 2); b.position.set(x, y, z); mesh.add(b); list.push(b); }
    mesh.geometry.addEventListener('dispose', () => { for (const b of list) this.world.blobs && this.world.blobs.delete(b); });
  }
  // v5s46c (6): ciglio con bordo sfumato verso la strada del bioma (una variante per coppia ciglio/strada)
  edgeMat(shoulder, road) {
    const key = 'f:' + shoulder + '|' + road;   // creati in mats(): stanno in shoulderMat (neve e shader pre-compilati come gli altri)
    return this.shoulderMat[key] || this.shoulderMat[shoulder];
  }
  // geometria varia unita (cordoli, terreni ai lati, binari, letto del fiume), lunga 1 m
  misc(bid) {
    if (this.miscGeo.has(bid)) return this.miscGeo.get(bid);
    const g = byId[bid].ground; const k = new Kit(3);
    const one = (w, h, x, y, col) => k.add(G.box(w, h, 1), col, { x, y, z: -0.5 });
    if (g.curb) for (const s of [-1, 1]) one(0.22, 0.26, s * (ROAD_W / 2 + 0.05), 0.13, '#9a8e80');
    if (g.terrain) {
      if (g.left !== 'drop' && !g.mirrorWater) {
        one(80, 0.1, -(9.0 + 40), (g.terrainY ?? -0.06) - 0.05, g.terrain);   // con la valle a sinistra niente terreno piano
        // v5s37: ciglio rialzato sul bordo lontano del terreno paese — nasconde il cielo sotto la mappa (buco a ~28 m)
        if (bid === 'village') {
          // v5s37b: ciglio alto scuro (chiude il cielo a ~28 m). Colori bassi cosi' non sembrano gradoni chiari.
          const rim = -(9.0 + 80);
          for (const [dx, h, col] of [
            [2, 10, '#3a4530'], [10, 18, '#343e2c'], [20, 26, '#2e3728'],
            [32, 34, '#293224'], [46, 42, '#242c20'],
          ]) one(14, h, rim - dx, h * 0.45, col);
        }
      }
      if (!g.right || g.mirrorWater) one(80, 0.1, 9.0 + 40, (g.terrainY ?? -0.06) - 0.05, g.terrain);
    }
    if (g.right === 'water') one(80, 0.1, (6.2 + 40) * (g.mirrorWater ? -1 : 1), -3.2, '#0e6e58');   // v5s28: fiume a sinistra (Sa Stiddiosa)
    if (g.right === 'river') one(80, 0.1, 12 + 40, -6.0, '#5a5a48');
    if (g.rails) for (const lx of RAIL_X)   // v5s45 (13): binario anche sulla corsia sinistra
      for (const s of [-0.52, 0.52]) { one(0.1, 0.12, lx + s, 0.06, '#6a4a32'); one(0.05, 0.03, lx + s, 0.135, g.wet ? '#c4cfee' : '#9a7a62'); }
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
    if (full) { this.fade = 0; this.houseFeet = []; for (const sd of this.sides) sd.cur = W - 40; this.gW = W - 40; this.cW = W - 40; this.dW = W - 30; }
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
    else if (g.shoulder) { const em = g.curb ? this.shoulderMat[g.shoulder] : this.edgeMat(g.shoulder, g.road); add(g.right === 'water' ? this.geo.edgeN : this.geo.edge, em, g.right === 'water' ? 'edgeRn' : 'edgeR'); add(this.geo.edge, em, 'edgeL'); meshes[meshes.length - 1].scale.x = -1; }
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
  // v5s39: registro impronte case (W lungo la via, x locale pezzo: 0 = facciata, negativo = entroterra)
  addHouseFoot(s, W0, w, margin = 1.25) {
    const foot = { s, minW: W0 - margin, maxW: W0 + w + margin, minX: -8.2 - margin * 0.25, maxX: 1.0 + margin * 0.25, id: ++this._footId };
    this.houseFeet.push(foot); return foot;
  }
  dropHouseFoot(foot) { if (!foot) return; const i = this.houseFeet.indexOf(foot); if (i >= 0) this.houseFeet.splice(i, 1); }
  feetFor(s, W0, len, pad = 5) {
    const a = W0 - pad, b = W0 + len + pad;
    return this.houseFeet.filter((f) => f.s === s && f.maxW >= a && f.minW <= b)
      .map((f) => ({ minW: f.minW, maxW: f.maxW, minX: f.minX, maxX: f.maxX }));
  }
  fillSide(sd, front) {
    let guard = 0;
    while (sd.cur < front && guard++ < 60 && !this.over(sd.cur)) {
      const W = sd.cur, i = this.info(W + 0.01);
      const Wb = this.boundaryAfter(W + 0.01);
      const maxLen = Wb - W;
      if (maxLen < 0.5) { sd.cur = Wb + 0.001; continue; }
      // vuoti (piazza della chiesa, piazzale del portale)
      const gaps = (i.b.gaps && i.b.gaps[sd.s < 0 ? 'left' : 'right']) || [];
      let skip = 0, gapA = null, gapZ = null;
      for (const [a, z] of gaps) if (i.local >= a - 0.01 && i.local < z) { skip = z - i.local; gapA = a; gapZ = z; }
      // v5s46d (251): il buco a destra all'inizio del paese e' il Garag di Pinu, non un versante vuoto
      if (skip > 0 && i.b.id === 'village' && sd.s > 0 && gapA != null && gapA < 30) {
        const w = Math.min(skip, Math.max(4, maxLen));
        const lod = W - this.lastPW > LOD_D;
        Kit.lodMin = lod ? LOD_MIN : 0;
        const make = () => buildPinuFacade();
        let geom; try { geom = make(); } finally { Kit.lodMin = 0; }
        this.stats.built++;
        let piece;
        if (lod) { piece = { W0: W, W1: W + w, w, mesh: null, geom, owned: true, lamps: [], make, lod, pinu: true }; this.batchAdd(sd, piece); }
        else { const mesh = new THREE.Mesh(geom, this.mats2); mesh.position.set(sd.s * FACADE, 0, -W); mesh.scale.x = -1; this.scene.add(mesh); piece = { W0: W, W1: W + w, w, mesh, owned: true, lamps: [], make, lod, pinu: true }; }
        piece.lamps.push(this.lamp(sd.s * (FACADE - 0.4), 3.2, -W - w * 0.5, '#ffb060', 2.4, 0.75));
        piece.foot = this.addHouseFoot(sd.s, W, w, 1.2);
        sd.list.push(piece); sd.cur = W + w; continue;
      }
      // v5s37: piazzetta della chiesa a sinistra — non lasciare il vuoto nudo (si vedeva il cielo a ~28 m).
      // Riempie con un versante chiuso in fondo; la chiesa (vista) resta davanti, aperta sulla via.
      if (skip > 0 && i.b.id === 'village' && sd.s < 0 && gapA != null && gapA < 80) {
        const w = Math.min(skip, Math.max(4, Math.min(10, maxLen)));
        // versante chiuso in fondo alla piazzetta (la chiesa/vista resta aperta sulla via)
        const own = (make, ww) => {
          const lod = W - this.lastPW > LOD_D;
          Kit.lodMin = lod ? LOD_MIN : 0; let geom; try { geom = make(); } finally { Kit.lodMin = 0; }
          this.stats.built++;
          if (lod) { const pp = { W0: W, W1: W + ww, w: ww, mesh: null, geom, owned: true, lamps: [], make, lod }; this.batchAdd(sd, pp); return pp; }
          const mesh = new THREE.Mesh(geom, this.mats2); mesh.position.set(sd.s * FACADE, 0, -W); mesh.scale.x = sd.s < 0 ? 1 : -1; this.scene.add(mesh);
          return { W0: W, W1: W + ww, w: ww, mesh, owned: true, lamps: [], make, lod };
        };
        // v5s39: escludi impronte case gia' piazzate + fantasma ai bordi del vuoto (dove riprendono le case)
        const feet = this.feetFor(sd.s, W, w, 8);
        if (gapA != null) feet.push({ minW: gapA - 14, maxW: gapA + 3.5, minX: -8.5, maxX: 1.2 });
        if (gapZ != null) feet.push({ minW: gapZ - 3.5, maxW: gapZ + 14, minX: -8.5, maxX: 1.2 });
        const piazza = i.local < VISTA.AT_M - 8;   // v5s44b: piazzetta aperta fino a vicino alla chiesa (spostata piu' avanti)
        const piece = own(() => N.slopePiece(W, w, piazza ? {
          Hs: 1.1, dist: 18, trees: 0.03, wall: false, rocks: 0.05, ferns: 0.04,
          seed: 77 + Math.floor(W), flowers: 0.62,
          ground: ['#cbbba4', '#d8c8b0', '#b7a88e', '#8a9a56', '#7d8a4e'],
          skirt: -60, footprints: feet,
        } : {
          Hs: 22, dist: 70, trees: 0.22, wall: false, rocks: 0.1, ferns: 0.03,
          seed: 77 + Math.floor(W), flowers: 0.1,
          ground: ['#7d8a4e', '#6e7a3e', '#8a9a56', '#5f6a40', '#9a8f6a'],
          skirt: -70, footprints: feet,
        }), w);
        if (piazza) piece.foot = this.addHouseFoot(sd.s, W, w, 1.8);
        sd.list.push(piece); sd.cur = W + piece.w; continue;
      }
      if (skip > 0) {
        const w = Math.min(skip, Math.max(6, Math.min(12, maxLen)));
        const feet = this.feetFor(sd.s, W, w, 6);
        const lod = W - this.lastPW > LOD_D;
        Kit.lodMin = lod ? LOD_MIN : 0;
        // v5s44b: niente muro-schermo alto 6.5 m sul bordo strada (chiudeva il paese in un
        // corridoio di pietra prima di Santa Marta). Muretto da giardino (~1 m), piu' verde
        // e una collina piu' alta/lontana cosi' il vuoto resta nascosto e Santa Marta si vede.
        const make = () => N.slopePiece(W, w, {
          Hs: 14, dist: 52, trees: sd.s < 0 && i.b.id === 'village' && i.local > 140 && i.local < 230 ? 0 : 0.28, wall: true, wallH: 0.95, rocks: 0.1, ferns: 0.16,   // v5s46b: niente alberi a sinistra davanti al Monumento ai Caduti
          seed: 91 + (Math.floor(W) % 997), flowers: 0.36, fichi: !(sd.s < 0 && i.local > 140 && i.local < 230),
          ground: ['#7d8a4e', '#6e7a3e', '#8a9a56', '#5f6a40', '#9a8f6a'], skirt: -90, footprints: feet,
        });
        let geom; try { geom = make(); } finally { Kit.lodMin = 0; }
        this.stats.built++;
        let piece;
        if (lod) { piece = { W0: W, W1: W + w, w, mesh: null, geom, owned: true, lamps: [], make, lod }; this.batchAdd(sd, piece); }
        else { const mesh = new THREE.Mesh(geom, this.mats2); mesh.position.set(sd.s * FACADE, 0, -W); mesh.scale.x = sd.s < 0 ? 1 : -1; this.scene.add(mesh); piece = { W0: W, W1: W + w, w, mesh, owned: true, lamps: [], make, lod }; }
        piece.foot = this.addHouseFoot(sd.s, W, w, 1.4);
        sd.list.push(piece); sd.cur = W + piece.w; continue;
      }
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
          const feet = this.feetFor(s, W, w, 6);
          return own(() => N.slopePiece(W, w, { Hs: 3, dist: 16, trees: 0.25, wall: true, wallH: 1.1, rocks: 0.1, ferns: 0, seed: 40 + i.lap, flowers: 0.3, fichi: true, ground: ['#7d8a4e', '#6e7a3e', '#8a9a56'], footprints: feet }), w);
        }
        // v5s46d (254): niente due facciate uguali di fila; piu' semi cosi' il lato destro non si ripete
        const span = 36;
        let idx = r.int(span);
        if (sd.prevHouse === idx) idx = (idx + 11) % span;
        sd.prevHouse = idx;
        const pf = r.chance(0.12) ? this.prefab('garden', r.int(8), () => M.buildGarden(r.lastInt + 1)) : this.prefab('house', idx, () => M.buildHouse(idx + 1));
        if (pf.w > lim) { const w = Math.min(lim, 6); const feet = this.feetFor(s, W, w, 6); return own(() => N.slopePiece(W, w, { Hs: 2, dist: 12, trees: 0.2, wall: true, wallH: 1.1, ferns: 0, rocks: 0.1, footprints: feet }), w); }
        return this.placePrefab(sd, W, pf);
      }
      case 'mountain': {        // parete di roccia a destra, muretto e strapiombo sulla valle a sinistra
        if (s > 0) {
          if (loc < 28) { const w = fit(6, 10); return own(() => N.slopePiece(W, w, { Hs: 6 + loc * 0.3, dist: 22, trees: 0.3, rocks: 0.3, wall: loc < 12, seed: 5 }), w); }
          const w = fit(8, 14); return own(() => N.cliffPiece(W, w, { H0: 15, Hamp: 9, lean: 0.22, pal: ['#8f877a', '#9a8c74', '#7a8a52', '#a39484', '#6e7a48', '#b7a48c'], moss: 0.72, ochre: true, seed: 7 + (Math.floor(W) % 97), wall: true }), w);
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
        if (s < 0) {
          // v5s46b: il monte a sinistra non parte piu' con una lastra grigia verticale: prima continua il versante verde
          // del viadotto, poi la roccia cresce piano (da ~5 m a 17 m) con colori caldi, muschio, lecci e cespugli
          if (loc < 30) { const w = fit(8, 12); return own(() => N.slopePiece(W, w, { Hs: 16, dist: 30, trees: 0.22, rocks: 0.5, wall: true, wallH: 0.9, ferns: 0.05, seed: 13, ground: ['#7a7a44', '#6b7a3e', '#8a7a5a', '#9a8f6a', '#6e6a40'], conifers: true, skirt: -50 }), w); }
          const w = fit(8, 13), ramp = Math.min(1, (loc - 30) / 30);
          return own(() => N.cliffPiece(W, w, { H0: 5 + 12 * ramp, Hamp: 2 + 5 * ramp, lean: 0.12 + 0.25 * (1 - ramp), pal: ['#8f877a', '#9a8c74', '#7d7a6a', '#a39a8a', '#868070'], moss: 0.7, mossCol: '#5f7a36', ochre: true, leaf: LEAF.holm, shrubs: 0.8, top: 'trees', seed: 17, solid: 22 }), w);
        }
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
      () => this.markGeom('viaduct', () => weatherViaduct(S.buildViaduct((x) => (x < 0 ? -2 : -5)))),
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
      () => { try { return this.world.warmViews && this.world.warmViews(); } catch (e) { return null; } },   // v5s45
      // v5s45 (QA10 #5/#8): Sa Stiddiosa (parete GLB a istanze, cascate e foschia con shader propri, tende di felci) si costruiva
      // ~450 m prima, cioe' a ~50 m di ogni giro: i suoi 4 programmi si compilavano in corsa. Costruita e disegnata una volta qui.
      () => { if (cliffModels()) return this.warmMark('pool@0'); else Promise.resolve(loadCliffModels()).then(() => idle(() => { if (!this.marks.has('pool@0')) this.warmMark('pool@0'); })); },   // v5s46: con i moduli gia' arrivati (resta pronta per tutti i giri)
      () => this.warmGPU(),
      () => { const p = loadTower(); if (p && p.then) return p.then(() => this.warmGPU()); return null; },
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
      // v5s46c (265): un lavoro puo' restituire una promessa (compilazione in parallelo): il successivo aspetta che finisca
      this._jobT = performance.now(); let res; try { res = jobs.shift()(); } catch (e) { res = null; }
      if (res && res.then) { let go = false; const next = () => { if (go) return; go = true; this._jobT = performance.now(); idle(step); }; res.then(next, next); setTimeout(next, 20000); }
      else idle(step);
    };
    this._warmJobs = jobs;
    idle(step);
  }
  // compila in anticipo TUTTI i materiali degli ambienti (anche i fondi di passaggio tra un ambiente e l'altro),
  // cosi' al confine non c'e' la pausa di compilazione dello shader alla prima apparizione
  // v5s29 (QA M1): disegna una volta, fuori schermo, ogni geometria pesante gia' costruita (buffer e shader pronti sulla GPU)
  warmGPU() {
    const r = this.world.renderer; if (!r) return;
    const geos = new Set([...this.markCache.values()]); for (const p of this.prefabs.values()) if (p && p.geom) geos.add(p.geom);
    const tm = towerModel();
    if (this.mode === 'run') return this.warmGPURun([...geos], tm);
    try {
      const grp = new THREE.Group(); grp.position.set(0, -2000, 0);
      for (const g of geos) { if (!g || !g.attributes) continue; const m = new THREE.Mesh(g, this.mats2); m.frustumCulled = false; grp.add(m); }
      if (tm) { const c = tm.clone(); c.traverse((o) => { o.frustumCulled = false; }); grp.add(c); }
      for (const mat of [this.fallMat, this.mistMat, this.shaftMat]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), mat); m.frustumCulled = false; grp.add(m); }
      this.scene.add(grp);
      r.render(this.scene, this.world.camera);   // v5s45: sul canvas (prima su un render target: varianti 'srgb-linear' inutili, in corsa si ricompilava tutto)
      this.scene.remove(grp);
    } catch (e) { /* solo ottimizzazione */ }
  }
  // v5s46c (265): partenza rapida: il riscaldamento capitava in corsa e disegnava TUTTO in un frame (~45 geometrie, 800k vertici,
  // torre, piu' i programmi ancora da collegare). Sui telefoni lenti era uno scatto lungo, nel soak il frame non finiva piu'
  // e la corsa restava ferma (46 m / 117-121 m). In corsa: prima i programmi in parallelo (compileAsync), poi una geometria per frame.
  warmGPURun(geos, tm) {
    const r = this.world.renderer;
    const items = geos.filter((g) => g && g.attributes).map((g) => () => { const m = new THREE.Mesh(g, this.mats2); m.frustumCulled = false; return m; });
    if (tm) items.push(() => { const c = tm.clone(); c.traverse((o) => { o.frustumCulled = false; }); return c; });
    const pre = new THREE.Group(); if (tm) pre.add(tm.clone());
    for (const mat of [this.fallMat, this.mistMat, this.shaftMat]) if (mat) pre.add(new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), mat));
    return this.compileQuiet(pre).then(() => new Promise((done) => {
      let cur = null;
      const one = () => {
        if (cur) { this.scene.remove(cur); cur = null; }
        if (!items.length) return done();
        try { cur = items.shift()(); cur.position.set(0, -2000, 0); this.scene.add(cur); } catch (e) { cur = null; }
        setTimeout(() => requestAnimationFrame(one), 60);   // disegnata col frame normale, poi tolta
      };
      requestAnimationFrame(one);
    }));
  }
  // compila i materiali di un gruppo staccato (luci e nebbia della scena) senza bloccare il frame
  compileQuiet(obj) {
    const r = this.world.renderer; if (!r) return Promise.resolve();
    try { if (r.compileAsync && r.extensions.has('KHR_parallel_shader_compile')) return r.compileAsync(obj, this.world.camera, this.scene).catch(() => {}); r.compile(obj, this.world.camera, this.scene); } catch (e) { /* solo anticipo */ }
    return Promise.resolve();
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
    if (this.mode === 'run') {   // v5s46c (265): in corsa in parallelo, senza fermare il frame
      return this.compileQuiet(grp).then(() => { geo.dispose(); this.uploadTextures([...mats, ...Object.values(this.world.mat || {})]); });
    }
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
    // v5s40: sicurezza finale: nessuna parte bassa (< 2.6 m) del prefab oltre il bordo della carreggiata;
    // se sporgesse, la casa si sposta verso l'esterno (prima un prefab piu' largo entrava nelle 3 corsie)
    if (pf.inner == null) { let m = -Infinity; const P = pf.geom.attributes.position; for (let j = 0; j < P.count; j++) if (P.getY(j) < 2.6) m = Math.max(m, P.getX(j)); pf.inner = m; }
    const push = Math.max(0, pf.inner - WALK_W);
    mesh.visible = true; mesh.position.set(sd.s * (FACADE + push), 0, -W); mesh.scale.set(sd.s < 0 ? 1 : -1, 1, 1); mesh.rotation.set(0, 0, 0);
    const lamps = [];
    for (const l of pf.lamps) lamps.push(this.lamp(sd.s * FACADE - sd.s * l.x, l.y, -W + l.z, '#ffb85a', 2.6));
    const out = { W0: W, W1: W + pf.w, w: pf.w, mesh, key: pf.key, lamps };
    // v5s39: solo le case (non i giardini) bloccano alberi/cespugli
    if (pf.key && pf.key.startsWith('house')) out.foot = this.addHouseFoot(sd.s, W, pf.w);
    this.attachMural(sd, out);
    return out;
  }
  // murale di Gadoni (l'uomo con la frakkera) sul timpano della casa a sinistra, prima del monumento.
  // Quella faccia guarda chi arriva: si legge dalla via, e non e' la casa dietro il monumento (quella e' tolta).
  attachMural(sd, p) {
    if (sd.s >= 0 || !p.mesh || !p.key || !p.key.startsWith('house')) return;
    const i = this.info(p.W0 + 0.3);
    if (i.b.id !== 'village' || i.local < 170 || i.local > 186) return;
    if (!this.muralMat) {
      const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/gadoni-mural.webp`);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      this.muralMat = new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color('#3a2820'), emissiveMap: tex, emissiveIntensity: 0.32 });
    }
    const mh = 5.15, mw = mh * (768 / 1010);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), this.muralMat);
    // sul filo del timpano verso la via (non 3 m dentro il cortile, dove un albero lo copre)
    m.position.set(p.mesh.position.x - 0.35, 0.85 + mh / 2, -p.W0 + 0.2);
    m.name = 'tolu-mural';
    m.userData.ownGeo = true;
    this.scene.add(m);
    p.extra = p.extra || []; p.extra.push(m);
  }
  // statua vera del monumento (ritaglio con alfa). Stessa convenzione del murale, cosi' il file
  // si trova anche sotto /frakkera-run/v5/. Lambert con una tinta calda: prende il tramonto,
  // non si accende da sola e di notte resta leggibile (il cielo non scende mai a zero).
  statueMaterial() {
    if (this.statueMat) return this.statueMat;
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/memorial-statue.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    // il cartellone guarda la via, quindi il sole (dietro) non lo colpisce: un po' di emissive
    // tiene il bronzo della foto, il Lambert ci aggiunge il tramonto. Niente luce additiva.
    this.statueMat = new THREE.MeshLambertMaterial({
      map: tex, color: '#fff0e4', emissive: '#fff0e4', emissiveMap: tex, emissiveIntensity: 0.38, alphaTest: 0.5,
    });
    return this.statueMat;
  }
  // cartellone cilindrico: ruota solo intorno a Y, verso la camera
  faceBillboards() {
    const cam = this.world.camera.position;
    for (const [, m] of this.marks) {
      const s = m.statue;
      if (!s || !s.parent) continue;
      const wx = s.position.x + (s.parent.position.x || 0);
      const wz = s.position.z + (s.parent.position.z || 0);
      s.rotation.y = Math.atan2(cam.x - wx, cam.z - wz);
    }
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
    if (!this.fillL) {
      this.fillL = [];
      for (let i = 0; i < 3; i++) { const L = new THREE.PointLight('#ffd2a0', 0, 18, 2); this.scene.add(L); this.fillL.push(L); }
    }
    const camP = this.world.camera.position, tun = this.world.light?.tunnel || 0, picks = [];
    if (tun > 0.15) for (const g of this.glows) {
      if (!g.visible || !g.userData.fill) continue;
      const dx = g.position.x - camP.x, dy = g.position.y - camP.y, dz = g.position.z - camP.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 42 * 42) picks.push({ g, d2 });
    }
    picks.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.fillL.length; i++) {
      const L = this.fillL[i], p = picks[i];
      if (!p) { L.intensity = 0; continue; }
      L.position.copy(p.g.position); L.color.copy(p.g.material.color);
      const near = 1 - Math.min(1, Math.sqrt(p.d2) / 30);
      L.distance = 18; L.decay = 2; L.intensity = (2.1 + near * 1.6) * Math.min(1, tun * 1.35);
    }
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
    if (p.foot) this.dropHouseFoot(p.foot);
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
      if (props) { const pm = new THREE.Mesh(props, this.mats2); pm.position.z = -W; pm.userData.ownGeo = true; this.scene.add(pm); this.attachShadows(pm); extra.push(pm); }
      if (i.b.id === 'mine-int' && Math.floor((i.local + len) / 90) > Math.floor(i.local / 90) && i.local > 40) {
        const dm = new THREE.Mesh(this.prefab('drill', 0, () => ({ geom: S.buildDrillMachine(), w: 0, lamps: [] })).geom, this.mats2);
        dm.position.set(-5.4, 0, -(W + len * 0.5)); dm.rotation.y = 0.05; this.scene.add(dm); extra.push(dm);
      }
      const lamps = [];
      for (const [lw, lx, ly] of lampsNear) if (lw >= W && lw < W + len) {
        const g = this.lamp(lx * 0.97, ly, -lw, type === 'blue' ? '#ffc078' : '#ffe0b0', type === 'blue' ? 7.5 : 6.4, type === 'blue' ? 1.05 : 1);
        g.userData.fill = 1; lamps.push(g);
      }
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
      const step = r.range(28, 44);   // v5s36: festoni di scenario piu' radi (prima 18-30)
      const inSquare = this.mode !== 'attract' && i.b.id === 'village' && i.local > 128 && i.local < 200;
      const inFesta = i.b.id === 'village' && i.local >= 30 && i.local < 128;   // v5s36: in festa bastano i festoni di gioco
      const inXmas = i.b.id === 'village' && i.local < 30;   // v5s37: alla partenza bastano le luci a raggiera del campanile
      if (i.b.decor.banners && !inSquare && !inFesta && !inXmas && i.local < 176) {   // v5s23c: niente festoni sopra vicolo e cappella
        const bulbs = i.b.decor.bulbs && r.chance(0.55);
        // v5s46b: niente piu' festoni di bandierine ne' fili di lampadine sopra la via, in nessun giro (richiesta utente).
        // Si consumano gli stessi numeri casuali di prima, cosi' il resto del paese resta identico.
        r.int(4); r.range(0, 1); r.range(0, 1); void bulbs;
        this.decor.push({ W0: W, W1: W + step, mesh: null, lamps: [] });
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
      const mk = this.marks.get(key);
      if (!mk.reused) { const root = mk.root; root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); this.upQ.push(root); }   // v5s46: la Stiddiosa riusata e' gia' sulla GPU
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
    // v5s46 (#5): Sa Stiddiosa (parete a istanze, felci, cascate) costava ~1 s di CPU e si ricostruiva a ~50 m di OGNI giro
    // (lo scatto a 1620-1680 m): ora si costruisce una volta (nel menu) e ad ogni giro si sposta soltanto
    if (id === 'pool' && this.poolKeep) {
      const k = this.poolKeep; this.poolKeep = null;
      k.root.position.z = -W; this.falls = k.falls; this.scene.add(k.root);
      const lamps = k.lampSpec.map(([x, y, z, c, sz, op]) => this.lamp(x, y, z - W, c, sz, op));
      this.marks.set(key, { root: k.root, own: k.own, lamps, gpu: k.gpu, ms: 0, feet: [], pool: k, reused: true });
      return;
    }
    const root = new THREE.Group(); root.position.z = -W;
    const own = [];         // geometrie da liberare
    const lamps = [];
    const mesh = (geom, mat = this.mats2, keep = false) => { const m = new THREE.Mesh(geom, mat); root.add(m); if (!keep) own.push(geom); this.attachShadows(m); return m; };
    // geometria del monumento in cache (solo CPU: alla rimozione si libera la GPU, i dati restano
    // per non ricostruirla a ogni giro). Costruita in coordinate b del giro 0 => indipendente dal giro.
    const Bm = b.from + d.at;
    const cached = (name, make) => { const g = this.markGeom(name, make); m_gpu.push(g); return mesh(g, this.mats2, true); };
    const m_gpu = [];
    const feet = [];
    let statue = null;
    const t0 = performance.now();
    if (id === 'church') {
      const sq = this.prefab('church', 0, () => { const s = buildChurchSquare(1); return { geom: s.geom, w: 0, lamps: s.lamps, houses: s.houses }; });
      mesh(sq.geom, this.mats2, true);
      root.scale.x = -1;                                   // piazza costruita a sinistra, specchiata a destra della via
      // v5s10: stendardo di cuoio dell'Ass. Culturale Maimoni e Grastula (testa di capra), a bordo via
      const ban = buildBanner(this.mats2); ban.scale.x = -1; ban.position.set(6.7, 0, 52);   /* v5s41b: prima 6.0, la base sporgeva ~0.4 m nella corsia sinistra */ ban.rotation.y = 0.4; root.add(ban);
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
      for (const m of cadutiDecals()) { root.add(m); own.push(m.geometry); }
      statue = cadutiStatue(this.statueMaterial());
      root.add(statue); own.push(statue.geometry);
      lamps.push(this.lamp(-7.4, 1.25, -W - 20.4, '#ffc080', 1.5, 0.65));   // v5s46d (276): lumino ai piedi del monumento, non sulla statua
      // v5s44e: impronta del Monumento ai Caduti (lato sinistro, z locale -21 → W+21, ora di sbieco)
      feet.push(this.addHouseFoot(-1, W + 17.5, 9, 1.6));
    } else if (id === 'cappella') {
      // specchiata: la cappella a SINISTRA della via (a destra la coprirebbe la fiamma).
      // A destra, davanti a Santa Marta, solo muretto, erba e un leccio arretrato (niente case).
      root.scale.x = -1;
      cached('cappella', () => buildCappella());
      cached('cappellaL', () => buildCappellaLeft());
      // v5s26: lampioni tolti davanti alla cappella
    } else if (id === 'santamarta') {
      // v5s24: la navata e' al coperto: niente neve per terra (passatoia gialla e cotto restano visibili nei giri di neve)
      if (!this.mats2NoSnow) this.mats2NoSnow = this.mats2.map((m) => m.clone());
      { const g = this.markGeom('santamarta', () => buildSantaMarta(1)); m_gpu.push(g); mesh(g, this.mats2NoSnow, true); }
      for (const [x, y, z, s] of santaMartaLamps()) lamps.push(this.lamp(x, y, z - W, '#e8b080', 1.15 * s, 0.32));
      for (const [x, y, z, s] of santaMartaAisleLamps()) lamps.push(this.lamp(x, y, z - W, '#e8b080', 1.05 * s, 0.28));
      if (!this.burra) this.burra = burraRunner();
      mesh(this.burra.geo, this.burra.mat, true);   // v5s26: tappeto sa burra lungo la navata
      if (!this.fresc) this.fresc = frescoes();
      mesh(this.fresc.geo, this.fresc.mat, true);   // v5s26: affreschi dipinti
      lamps.push(this.lamp(0, 10.6, -W - 0.4, '#ff6644', 5.5, 0.4));   // v5s46d (261): alone del rosone, senza una luce dinamica in piu' (niente ricompilazione shader)
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
        const FS = stiddiosaFallSpecs(fl);
        // v5s37: lascia le felci SUL labbro sopra la cascata (nascondono la cresta); libera solo la colonna d'acqua sotto
        const avoid = FS.map((f) => ({ z: -f.lz, half: f.w * 0.7 + (f.kind === 'trickle' ? 1.2 : 2.4), y0: Math.min(f.y0, f.kind === 'main' ? 42 : 32), yMin: 0 }));
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
      cached('viaduct', () => weatherViaduct(S.buildViaduct((x) => (x < 0 ? -2 : -5))));
    } else if (id === 'valleyRiver') {
      cached('valleyRiverR', () => N.valleyTerrain(Bm - 150, 460, { side: 1, x0: 70, topY: -4.4, floorY: -4.4, dropW: 2, floorW: 30, far: 340, mtnH: 85, seed: 11, trees: 520, relief: 38 })).position.z = Bm;
      cached('valleyRiverL', () => N.valleyTerrain(Bm - 150, 460, { side: -1, x0: 36, topY: 14, floorY: 14, dropW: 2, floorW: 8, far: 320, mtnH: 70, seed: 12, trees: 420, relief: 38 })).position.z = Bm;
    } else if (id === 'minePortal') {
      mesh(this.prefab('portal', 0, () => ({ geom: S.buildMinePortal(5), w: 0, lamps: [] })).geom, this.mats2, true);
      const cart = mesh(this.prefab('cartDecor', 0, () => ({ geom: S.buildMineCartDecor(), w: 0, lamps: [] })).geom, this.mats2, true); cart.position.set(8.6, 0, 7.5); cart.rotation.y = 0.15;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.65), this.signMat || (this.signMat = new THREE.MeshLambertMaterial({ map: BT.mineSignTexture() })));
      sign.position.set(9.6, 11.6, 1.9); sign.rotation.set(0, -0.12, 0.04); root.add(sign); own.push(sign.geometry);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(70, 26), this.netMat || (this.netMat = new THREE.MeshBasicMaterial({ map: (() => { const t = BT.netTexture(); t.repeat.set(18, 7); return t; })(), transparent: true, depthWrite: false, opacity: 0.55 })));
      net.position.set(0, 27, -0.5); net.rotation.x = -0.18; own.push(net.geometry);   // v5s46b: rete paramassi tolta (col versante piu' basso restava sospesa nel cielo)
      lamps.push(this.lamp(0, 7.6, -W - 1.2, '#ffb060', 1.05, 0.22));   // v5s46c: alla lanterna appesa alla volta   // v5s43: bocca del portale, alone piccolo come Su Nascimentu
    } else if (id === 'mineExit') {
      mesh(this.prefab('exit', 0, () => ({ geom: S.buildMineExit(8), w: 0, lamps: [] })).geom, this.mats2, true);
    }
    this.scene.add(root);
    const pool = id === 'pool' ? { root, own, gpu: m_gpu, falls: this.falls, lampSpec: lamps.map((g) => [g.position.x, g.position.y, g.position.z + W, '#' + g.material.color.getHexString(), g.scale.x, g.userData.op]) } : null;
    this.marks.set(key, { root, own, lamps, gpu: m_gpu, ms: performance.now() - t0, feet, pool, statue });
  }
  warmMark(key) {
    const r = this.world.renderer; if (!r || this.marks.has(key)) return;
    try {
      this.buildMark(key);
      const m = this.marks.get(key); const fc = [];
      if (this.mode === 'run') {   // v5s46c (265): in corsa niente disegno forzato di tutta la parete: programmi in parallelo
        m.root.visible = false; for (const g of m.lamps) g.visible = false;
        return this.compileQuiet(m.root).then(() => { if (this.marks.get(key) === m) { m.root.visible = true; this.freeMark(key); this.falls = []; } });
      }
      m.root.traverse((o) => { fc.push([o, o.frustumCulled]); o.frustumCulled = false; });
      r.render(this.scene, this.world.camera);
      for (const [o, f] of fc) o.frustumCulled = f;
    } catch (e) { /* solo anticipo */ }
    this.freeMark(key); this.falls = [];
  }
  freeMark(key) {
    const m = this.marks.get(key); if (!m) return;
    this.scene.remove(m.root);
    if (m.pool) { for (const g of m.lamps) { g.visible = false; this.lampPool.push(g); } this.poolKeep = m.pool; if (this.falls === m.pool.falls) this.falls = []; this.marks.delete(key); return; }   // v5s46: tenuta pronta per il giro dopo
    for (const f of m.feet || []) this.dropHouseFoot(f);
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
    this.faceBillboards();
    // animazioni leggere
    for (const p of this.decor) if (p.mesh && p.mesh.userData.sway) p.mesh.rotation.x = Math.sin(clock * 1.3 + p.W0) * 0.04;
    for (const sd of this.sides) for (const p of sd.list) for (const g of p.lamps) g.material.opacity = g.userData.op * (0.85 + Math.sin(clock * 3 + g.userData.ph) * 0.12);
    for (const k in this.waterMat) {
      const uu = this.waterMat[k].userData.u;
      uu.uFlow.value.set(clock * 0.02, -clock * (k === 'river' ? 0.11 : 0.028));
      if (uu.uT) uu.uT.value = clock;
      const fl = this.world.tipW, fi = this.world.flameI || 0;
      if (uu.uFlame && fl) { uu.uFlame.value.copy(fl); uu.uFlameI.value = fi * (k === 'river' ? 0.55 : 0.35); }
    }
    for (const key in this.roadMat) { const uu = this.roadMat[key].userData.u; if (uu && uu.uFlame && this.world.tipW) { uu.uFlame.value.copy(this.world.tipW); uu.uFlameI.value = (this.world.flameI || 0) * (key === 'cobble' ? 1 : 0.45); } }
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
    const T = B.transitionOut || 45;   // v5s46c (31): passaggi di cielo/nebbia piu' lunghi (prima 30 m: tagli netti di colore)
    let t = this.mode === 'attract' ? 0 : Math.max(0, Math.min(1, (i.local - (len - T)) / T)); t = t * t * (3 - 2 * t);
    const e = B.moodEnd ? Math.min(1, Math.max(0, i.local / len)) : 0;
    const nAt = (l) => LAP_NIGHT[Math.min(LAP_NIGHT.length - 1, l)] || 0;
    const night = nextI === 0 ? nAt(i.lap) + (nAt(i.lap + 1) - nAt(i.lap)) * t : nAt(i.lap);   // v5s46c (31/32): la sera del giro dopo arriva sfumata (prima scattava a meta')
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
    let nk = night * (1 - L.tunnel);
    if (B.nightStart && !(typeof location !== 'undefined' && /[?&]xmas=0/.test(location.search))) { const [a, z] = B.nightStart; const q = Math.max(0, Math.min(1, (z - i.local) / (z - a))); nk = Math.max(nk, 0.82 * q * q * (3 - 2 * q)); }   // v5s37
    if (nk > 0) {
      for (const k of MOOD_KEYS) if (NIGHT_MOOD[k]) out[k].lerp(_c.set(NIGHT_MOOD[k]), nk * 0.94);
      for (const k of ['hemiI', 'dirI', 'moon', 'sun']) out[k] += (NIGHT_MOOD[k] - out[k]) * nk * 0.94;
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
