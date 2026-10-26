// =====================================================================
// Mondo 3D cartoon (Three.js): villaggio sardo al tramonto, oggetti di
// gioco, particelle, luce della frakkera, camera in terza persona.
// Legge lo stato di `Sim` e reagisce ai suoi effetti (fx).
// =====================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD, BIOME_OBST } from '../config.js';
import { laneX, isMoving, ROAD_HALF } from './sim.js';
import { DanceRing } from './dance/dance3d.js';
import { buildMaimoni, buildStramaione, buildGrastula, animateFigure, spindleGeom } from './masks/figures.js';
import * as T3 from './tex3d.js';
import * as M from './models.js';
import { PointPool, Shards } from './particles.js';
import { Character } from './character.js';
import { Character3D } from './character3d.js';
import { Flame3D } from './flame3d.js';
import { rng } from './kit.js';
import { Env } from './biomes/env.js';
import { buildShopRoom } from './shop3d.js';
import { loadPinuGeometry } from './shop/pinu.js';
import { MENU_MOOD, OVER_TINT } from './biomes/config.js';
import { buildVista, VISTA } from './biomes/builders/church.js';
import { SKINS, SHARDS, outcropGeometry } from './biomes/builders/skins.js';

const U = 0.1;                    // 1 px del mondo 2D = 0.1 unita' 3D (1 m = 1 unita')
const ROAD_W = 11.0;
const WALK_W = 1.45;
const FACADE = ROAD_W / 2 + WALK_W;
const FAR_Z = 185;

// v5: luce e nebbia arrivano dagli ambienti (biomes/config.js); qui solo menu e game over
const MOODS = { menu: MENU_MOOD, over: OVER_TINT.mood };

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`;
const SKY_FS = `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uFog; uniform vec3 uSunDir; uniform float uSun;
varying vec3 vDir;
void main(){
  float h = vDir.y;
  vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.2, h));
  c = mix(c, uTop, smoothstep(0.16, 0.75, h));
  float s = max(0.0, dot(normalize(vDir), uSunDir));
  c += vec3(1.0, 0.75, 0.45) * pow(s, 18.0) * 0.55 * uSun + vec3(1.0,0.85,0.6) * pow(s, 400.0) * 1.2 * uSun;
  // sotto l'orizzonte (dove non c'e' terreno) il colore della nebbia: un vuoto si legge come lontananza velata, non come cielo
  if (h < 0.0) c = mix(uHor, uFog, smoothstep(0.0, -0.035, h));
  gl_FragColor = vec4(c, 1.0);
}`;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _right = new THREE.Vector3(), _up = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c3 = new THREE.Vector3();
const _c = new THREE.Color(), _c2 = new THREE.Color();
const COL = {
  spark: new THREE.Color('#ffb347'), spark2: new THREE.Color('#ffe08a'), ember: new THREE.Color('#ff7a2a'),
  smoke: new THREE.Color('#8f8a90'), smokeD: new THREE.Color('#55505a'), dust: new THREE.Color('#d8c8b0'),
  wine: new THREE.Color('#6e1428'), wood: [new THREE.Color('#a8672f'), new THREE.Color('#8f5426'), new THREE.Color('#b5733a'), new THREE.Color('#6b3c1b')],
  iron: new THREE.Color('#33302e'), gold: new THREE.Color('#ffd25a'), water: new THREE.Color('#bfe2ff'),
  carpet: [new THREE.Color('#c0283c'), new THREE.Color('#e0a93a'), new THREE.Color('#f3e8cc'), new THREE.Color('#8e1f33'), new THREE.Color('#f6cf5e')],
  green: new THREE.Color('#d8f07a'), white: new THREE.Color('#fff6e0'),
};

export class World {
  constructor(container) {
    this.container = container;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 1.5, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setPixelRatio(dpr); this.maxPR = dpr;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 0.5, 0.3, 520);
    this.scene.fog = new THREE.Fog('#f4c9a0', 40, 175);
    this.mood = {}; this.moodName = 'menu';
    for (const k in MOODS.menu) this.mood[k] = typeof MOODS.menu[k] === 'string' ? new THREE.Color(MOODS.menu[k]) : MOODS.menu[k];
    this.clock = 0;
    this.shake = 0; this.shakeAmp = 0;
    this.camPos = new THREE.Vector3(0, 4, 10); this.camLook = new THREE.Vector3(0, 2, 0);
    this.views = new Map();
    this.pools = {};
    this.buildMaterials();
    this.buildSky();
    this.buildLights();
    this.bannerMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.env = new Env(this);           // v5: ambienti di Gadoni a tratti (terreno, lati, galleria, monumenti)
    this.light = { flameDist: 11, flameK: 1, mineral: 0, lamp: 0, darkByFuel: 0, tunnel: 0, exposure: 1.05 };
    this.amb = {}; this.farVis = 1; this.tgt = {}; this.burnT = -1;
    this.buildFx();
    this.character = new Character(this.scene, 0.11);          // fallback (sprite v3) finche' il GLB non e' pronto
    this.char3d = new Character3D(this.scene, { pistolGeo: this.geo.pistol, pistolMat: this.mats2 });
    this.flame3d = new Flame3D(this.scene);
    this.charShadow = this.blob(2.4, 1.3);
    this.scene.add(this.charShadow);
    this.shots = new Map();
    this.popupQ = [];
    this.dance = new DanceRing(this);      // v5s11: ballu tundu
    loadPinuGeometry();                    // v5s11b: Pinu (GLB) caricato in anticipo
    this.tipW = new THREE.Vector3(0, 4, 0);
    this.muzzleW = new THREE.Vector3(0, 3, 0);
  }

  // ------------------------------------------------------------ materiali
  buildMaterials() {
    this.tex = {
      cobble: T3.cobbleTexture(), slab: T3.slabTexture(), stave: T3.staveTexture(), lid: T3.lidTexture(),
      glow: T3.glowTexture(), blob: T3.blobTexture(), flash: T3.flashTexture(), moon: T3.moonTexture(),
      carpets: [0, 1, 2, 3].map((v) => T3.loadCarpetTexture(v, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()))),
    };
    this.mat = {
      lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
      unlit: new THREE.MeshBasicMaterial({ vertexColors: true }),
      stave: new THREE.MeshLambertMaterial({ map: this.tex.stave }),
      lid: new THREE.MeshLambertMaterial({ map: this.tex.lid }),
      iron: new THREE.MeshLambertMaterial({ color: '#3a3432' }),
      chock: new THREE.MeshLambertMaterial({ color: '#6b4426' }),
      puddle: new THREE.MeshPhongMaterial({ color: '#8fb9d8', specular: '#ffffff', shininess: 90, transparent: true, opacity: 0.86, depthWrite: false }),
      puddleRim: new THREE.MeshLambertMaterial({ color: '#7d756b', transparent: true, opacity: 0.6, depthWrite: false }),
      carpet: this.tex.carpets.map((t) => new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide })),
      blob: new THREE.MeshBasicMaterial({ map: this.tex.blob, transparent: true, depthWrite: false, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: '#ffd45a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      shot: new THREE.MeshBasicMaterial({ color: '#fff2b0' }),
    };
    this.mats2 = [this.mat.lit, this.mat.unlit];
    this.geo = {};
    const B = M.barrelGeometry(1.8, 0.62, 0.16);
    this.geo.barrelBody = B.body; this.geo.barrelLid = B.lid; this.geo.barrelHoops = mergeGeometries(B.hoops);
    this.geo.blob = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.geo.wall = [M.buildStoneWall(1), M.buildStoneWall(2), M.buildStoneWall(3)];
    this.geo.goat = M.buildGoat();
    this.geo.asfodelo = M.buildAsphodel();
    this.geo.ferula = M.buildFerula();
    this.geo.pistol = M.buildPistol();
    this.geo.carpet = new THREE.PlaneGeometry(2.7, 2.7 / T3.CARPET_ASPECT).rotateZ(Math.PI / 2);   // proporzioni del tappeto vero
    this.geo.chock = new THREE.BoxGeometry(0.3, 0.3, 0.9);
    this.geo.ring = new THREE.TorusGeometry(0.95, 0.06, 6, 28);
    this.geo.shot = new THREE.SphereGeometry(0.16, 8, 6);
    const pz = new THREE.CircleGeometry(1, 20);
    const pos = pz.attributes.position; const pr = rng(9);
    for (let i = 1; i < pos.count; i++) { const k = 1 + (pr() - 0.5) * 0.35; pos.setXY(i, pos.getX(i) * k * 1.15, pos.getY(i) * k * 0.85); }
    this.geo.puddle = pz.rotateX(-Math.PI / 2);
    this.geo.puddleRim = new THREE.CircleGeometry(1.25, 20).rotateX(-Math.PI / 2);
    this.narrowCache = new Map();
  }
  // v5s14: le ombre "a macchia" di ostacoli e raccoglibili sono segnaposto (Object3D, nessun draw call): a ogni frame
  // le loro matrici finiscono in UNA InstancedMesh (prima: una mesh e un draw call per ciascuna, ~60 nel paese)
  blob(w, d) {
    const m = new THREE.Object3D(); m.scale.set(w, 1, d); m.position.y = 0.025; m.userData.blob = true;
    (this.blobs || (this.blobs = new Set())).add(m); return m;
  }
  flushBlobs() {
    if (!this.blobs) return;
    let im = this.blobMesh;
    if (!im) { im = this.blobMesh = new THREE.InstancedMesh(this.geo.blob, this.mat.blob, 384); im.frustumCulled = false; im.renderOrder = 1; im.count = 0; this.scene.add(im); }
    let n = 0; const max = im.instanceMatrix.count;
    for (const b of this.blobs) {
      let q = b, ok = true; while (q) { if (!q.visible) { ok = false; break; } if (q === this.scene) break; q = q.parent; }
      if (!ok || q !== this.scene) continue;
      if (n >= max) break;
      b.updateWorldMatrix(true, false); im.setMatrixAt(n++, b.matrixWorld);
    }
    im.count = n; im.instanceMatrix.needsUpdate = true;
  }
  glowSprite(color, size, opacity = 0.8) {
    const m = new THREE.SpriteMaterial({ map: this.tex.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.renderOrder = 15; return s;
  }

  // ------------------------------------------------------------ cielo e luci
  buildSky() {
    this.skyU = {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.25, 0.08, -1).normalize() }, uSun: { value: 1 },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false }));
    sky.renderOrder = -10;
    this.sky = sky; this.scene.add(sky);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.moon, transparent: true, fog: false, depthWrite: false, toneMapped: false }));
    this.moon.scale.set(26, 26, 1); this.scene.add(this.moon);
    this.sunGlow = this.glowSprite('#ffd38a', 120, 0.55); this.scene.add(this.sunGlow);
    // nuvole morbide
    this.clouds = [];
    const cr = rng(4);
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: '#ffd7c4', transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
      c.scale.set(cr.range(60, 110), cr.range(12, 20), 1);
      c.userData = { x: cr.range(-200, 200), y: cr.range(55, 120), z: cr.range(-60, 40) };
      this.clouds.push(c); this.scene.add(c);
    }
    // stelle (solo al crepuscolo)
    const sg = new THREE.BufferGeometry(); const sp = [];
    const sr = rng(8);
    for (let i = 0; i < 160; i++) { const a = sr() * Math.PI * 2, e = sr.range(0.25, 1.2); sp.push(Math.cos(a) * Math.cos(e) * 450, Math.sin(e) * 450, Math.sin(a) * Math.cos(e) * 450); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff6dd', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
    this.far = new THREE.Mesh(M.buildFar(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.scene.add(this.far);
    // v5s12: campanile + chiesa rosa centrati in fondo alla via del paese (segue la camera come il fondale)
    this.vista = new THREE.Mesh(buildVista(1), this.mats2); this.scene.add(this.vista);
  }
  buildLights() {
    this.hemi = new THREE.HemisphereLight('#ffe6c4', '#7a6658', 1.35);
    this.dir = new THREE.DirectionalLight('#ffd49a', 2.1);
    this.dir.position.set(-0.55, 0.75, -0.5);
    this.scene.add(this.hemi, this.dir, this.dir.target);
    this.flameLight = new THREE.PointLight('#ff9a45', 18, 9, 1.6);
    this.scene.add(this.flameLight);
  }

  // ------------------------------------------------------------ effetti
  buildFx() {
    this.add = new PointPool(this.scene, 700, true);
    this.norm = new PointPool(this.scene, 500, false);
    this.shards = new Shards(this.scene, 160);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.flash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.flash.visible = false; this.flash.renderOrder = 30; this.scene.add(this.flash);
    this.flashT = 0;
    this.flameGlow = this.glowSprite('#ffae4a', 3.2, 0.55); this.scene.add(this.flameGlow);
    this.groundGlow = new THREE.Mesh(this.geo.blob, new THREE.MeshBasicMaterial({ map: this.tex.glow, color: '#ff9a40', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.groundGlow.position.y = 0.04; this.groundGlow.scale.set(6, 1, 6); this.scene.add(this.groundGlow);
    this.sparkAcc = 0; this.ambAcc = 0;
  }

  // ------------------------------------------------------------ viste delle entita'
  makeBarrel(lying) {
    const g = new THREE.Group();
    const b = new THREE.Group();
    b.add(new THREE.Mesh(this.geo.barrelBody, this.mat.stave), new THREE.Mesh(this.geo.barrelLid, this.mat.lid), new THREE.Mesh(this.geo.barrelHoops, this.mat.iron));
    if (lying) {
      b.rotation.z = Math.PI / 2; b.position.set(0.9, 0.78, 0);
      g.userData.inner = b;
    }
    g.add(b);
    return g;
  }
  // v5: aspetto dell'ostacolo secondo l'ambiente (stessa collisione, vedi biomes/builders/skins.js)
  createSkinned(kind, skin, sk) {
    const root = new THREE.Group();
    const v = { kind, root, body: null, glow: null, shadow: null, t: Math.random() * 6, skin };
    if (kind === 'trave') {
      v.body = new THREE.Mesh(sk.make(false), this.mats2); v.shadow = this.blob(12.8, 1.3);
    } else if (kind === 'sasso') {
      v.body = new THREE.Mesh(sk.make(false), this.mats2); v.shadow = this.blob(2.8, 2.8);  // ombra = avviso prima della caduta
      const wm = this.mat.warn || (this.mat.warn = new THREE.MeshBasicMaterial({ color: '#ff5a2a', transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      const ring = new THREE.Mesh(this.geo.ring, wm); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(1.5); ring.renderOrder = 4; v.warn = ring; root.add(ring);
    } else if (kind === 'bagnato') {
      v.body = new THREE.Group();
      const w = new THREE.Mesh(this.geo.puddle, this.mat.wet || (this.mat.wet = Object.assign(this.mat.puddle.clone(), {})));
      this.mat.wet.color.set('#5fd0c0'); w.position.y = 0.04; w.scale.set(1.25, 1, 1.25); w.renderOrder = 3;
      v.body.add(w, new THREE.Mesh(sk.make(false), this.mats2)); v.water = w;
    } else if (kind === 'rollbarrel') {
      v.body = new THREE.Group();
      const b = new THREE.Mesh(sk.make(true), this.mats2);
      const pivot = new THREE.Group(); pivot.add(b); pivot.rotation.x = Math.PI / 2; pivot.position.y = 0.78;
      v.spin = pivot; v.body.add(pivot); v.shadow = this.blob(1.9, 2.4);
    } else {
      v.body = new THREE.Mesh(sk.make(false), this.mats2);
      const sh = { botte: [2.0, 2.0], botti: [3.6, 4.4], bottecoricata: [3.0, 1.8], muretto: [3.0, 1.4], goat: [2.0, 1.1] }[kind] || [2, 2];
      v.shadow = this.blob(sh[0], sh[1]);
    }
    root.add(v.body); if (v.shadow) root.add(v.shadow);
    this.scene.add(root);
    return v;
  }
  createView(kind, e, skin = null) {
    if (!skin) skin = { sasso: 'fallRock', bagnato: 'wetStone', trave: 'beamTrunk' }[kind] || null;
    const sk = skin && SKINS[skin];
    if (sk && sk.make && kind !== 'narrow') return this.createSkinned(kind, skin, sk);
    const root = new THREE.Group();
    const v = { kind, root, body: null, glow: null, shadow: null, t: Math.random() * 6, skin };
    if (kind === 'botte') { v.body = this.makeBarrel(false); v.shadow = this.blob(2.0, 2.0); }
    else if (kind === 'bottecoricata') {
      v.body = new THREE.Group();
      const b = this.makeBarrel(true); b.scale.set(1, 1, 1.15);
      v.body.add(b);
      for (const x of [-0.55, 0.55]) { const c = new THREE.Mesh(this.geo.chock, this.mat.chock); c.position.set(x, 0.15, 0); c.rotation.z = Math.PI / 4; c.scale.set(1, 1, 1); v.body.add(c); }
      v.shadow = this.blob(2.8, 1.8);
    } else if (kind === 'botti') {
      v.body = new THREE.Group();
      const spots = [[-0.75, 0, 0.9], [0.75, 0, 0.9], [-0.75, 0, -0.9], [0.75, 0, -0.9]];
      for (const [x, y, z] of spots) { const b = this.makeBarrel(false); b.position.set(x, y, z); b.rotation.y = Math.random() * 6; v.body.add(b); }
      const top = this.makeBarrel(true); top.position.set(0, 1.78, 0); top.rotation.y = Math.PI / 2; top.scale.setScalar(0.92);
      v.body.add(top);
      v.shadow = this.blob(3.6, 4.4);
    } else if (kind === 'rollbarrel') {
      v.body = new THREE.Group();
      const b = new THREE.Group();
      b.add(new THREE.Mesh(this.geo.barrelBody, this.mat.stave), new THREE.Mesh(this.geo.barrelLid, this.mat.lid), new THREE.Mesh(this.geo.barrelHoops, this.mat.iron));
      b.position.y = -0.9;
      const pivot = new THREE.Group(); pivot.add(b); pivot.rotation.x = Math.PI / 2; pivot.position.y = 0.78;
      v.spin = pivot; v.body.add(pivot);
      v.shadow = this.blob(1.9, 2.4);
    } else if (kind === 'rollin') {
      // v5s6: botte coricata di traverso che rotola lungo la corsia verso il giocatore
      v.body = new THREE.Group();
      const b = new THREE.Group();
      b.add(new THREE.Mesh(this.geo.barrelBody, this.mat.stave), new THREE.Mesh(this.geo.barrelLid, this.mat.lid), new THREE.Mesh(this.geo.barrelHoops, this.mat.iron));
      b.position.y = -0.9;
      const inner = new THREE.Group(); inner.add(b); inner.rotation.z = Math.PI / 2;
      const spin = new THREE.Group(); spin.add(inner); spin.position.y = 0.78;
      v.spin = spin; v.body.add(spin);
      v.shadow = this.blob(2.4, 1.9);
    } else if (kind === 'muretto') {
      v.body = new THREE.Mesh(this.geo.wall[e.id % 3], this.mats2); v.shadow = this.blob(3.0, 1.4);
    } else if (kind === 'pozza') {
      v.body = new THREE.Group();
      const rim = new THREE.Mesh(this.geo.puddleRim, this.mat.puddleRim); rim.position.y = 0.03;
      let pm = this.mat.puddle;
      if (sk && sk.puddle) { pm = this.mat['puddle_' + skin] || (this.mat['puddle_' + skin] = Object.assign(this.mat.puddle.clone(), {})); pm.color.set(sk.puddle); }
      const w = new THREE.Mesh(this.geo.puddle, pm); w.position.y = 0.045;
      rim.renderOrder = 2; w.renderOrder = 3;
      v.body.add(rim, w);
    } else if (kind === 'goat') {
      v.body = new THREE.Mesh(this.geo.goat, this.mats2); v.shadow = this.blob(2.0, 1.1);
    } else if (kind === 'maimoni') {               // v5s10: maschere di Gadoni
      v.fig = buildMaimoni(this.mats2); v.body = v.fig.root; v.fig.root.scale.setScalar(1.12); v.shadow = this.blob(1.6, 1.3);
    } else if (kind === 'fune') {
      v.body = new THREE.Group();
      const HX = WORLD.LANE_W * U - 0.15;
      v.figs = [0, 1].map((i) => { const f = buildStramaione(this.mats2, (e.id + i) % 4); f.holdRope = true; f.root.position.x = i ? HX : -HX; if (i) f.root.scale.x = -1; v.body.add(f.root); return f; });
      for (const f of v.figs) { f.arms[1].rotation.z = 0.75; f.arms[1].rotation.x = -0.25; f.root.scale.y = f.root.scale.z = 1.12; f.root.scale.x *= 1.12; }
      const pts = []; const X0 = HX - 1.0;
      for (let i = 0; i <= 12; i++) { const q = i / 12; pts.push(new THREE.Vector3(-X0 + 2 * X0 * q, 1.32 - Math.sin(q * Math.PI) * 0.16, 0.2)); }
      v.rope = new THREE.Mesh(this.geo.ropeG || (this.geo.ropeG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.065, 6)), this.mat.rope || (this.mat.rope = new THREE.MeshLambertMaterial({ color: '#c9b088' })));
      v.body.add(v.rope);
      v.shadow = this.blob(9.2, 1.0);
    } else if (kind === 'fuso') {
      v.body = new THREE.Group();
      v.fig = buildGrastula(this.mats2); v.fig.fig.scale.setScalar(1.12); v.body.add(v.fig.root);
      v.spin = new THREE.Mesh(spindleGeom(), this.mats2); v.body.add(v.spin);
      const wm = this.mat.warn || (this.mat.warn = new THREE.MeshBasicMaterial({ color: '#ff5a2a', transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      const ring = new THREE.Mesh(this.geo.ring, wm); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(1.3); ring.renderOrder = 4; v.warn = ring; v.body.add(ring);
      v.gshadow = this.blob(1.4, 1.2); v.body.add(v.gshadow);
    } else if (kind === 'asfodelo' || kind === 'ferula') {
      v.body = new THREE.Group();
      const m = new THREE.Mesh(this.geo[kind], this.mats2); m.rotation.z = 1.0; m.position.set(-0.55, -0.3, 0);
      v.body.add(m);
      v.glow = this.glowSprite(kind === 'ferula' ? '#f2ff9a' : '#fff1cf', 3.0, 0.55);
      v.shadow = this.blob(1.6, 1.0);
    } else if (kind === 'tappeto') {
      v.body = new THREE.Mesh(this.geo.carpet, this.mat.carpet[(e.variant || 0) % 4]);
      v.glow = this.glowSprite('#ff7a5a', 2.6, 0.32);
      v.shadow = this.blob(2.2, 1.4);
    } else if (kind === 'pistola') {
      v.body = new THREE.Group();
      const m = new THREE.Mesh(this.geo.pistol, this.mats2); m.scale.setScalar(1.25); v.body.add(m);
      const ring = new THREE.Mesh(this.geo.ring, this.mat.ring); ring.rotation.x = Math.PI / 2; ring.position.y = -0.7; v.ring = ring; v.body.add(ring);
      v.glow = this.glowSprite('#ffd24a', 4.6, 0.85);
      v.shadow = this.blob(1.8, 1.8);
    }
    root.add(v.body);
    if (v.shadow) root.add(v.shadow);
    if (v.glow) root.add(v.glow);
    this.scene.add(root);
    return v;
  }
  narrowView(e, skin) {
    const rows = Math.round((e.len + 6) / WORLD.ROW);
    const side = e.lane === 0 ? -1 : 1;
    const sk = skin && SKINS[skin];
    const key = `${rows}|${sk && sk.narrow ? skin : 'house'}`;
    let g = this.narrowCache.get(key);
    const width = FACADE - (WORLD.LANE_W - 17) * U + 0.3;
    if (!g) { g = sk && sk.narrow ? outcropGeometry(400 + rows, e.len * U, width, sk.narrow.pal, sk.narrow) : M.buildNarrow(400 + rows, e.len * U, width); this.narrowCache.set(key, g); }
    const mesh = new THREE.Mesh(g, this.mats2);
    const root = new THREE.Group(); root.add(mesh);
    mesh.scale.x = side < 0 ? 1 : -1;
    const inner = Math.abs(laneX(e.lane)) - 17; // bordo interno (px)
    root.userData.x = side * inner * U;
    this.scene.add(root);
    return { kind: 'narrow', root, body: mesh, side };
  }
  spawnView(e) {
    let v;
    const skin = this.env.skin(e.kind, (e.d + (e.len || 0) / 2) * U);
    if (e.kind === 'narrow') v = this.narrowView(e, skin);
    else {
      const pk = e.kind + '|' + (skin || '');
      const pool = this.pools[pk] || (this.pools[pk] = []);
      v = pool.pop() || this.createView(e.kind, e, skin);
      v.poolKey = pk;
      if (e.kind === 'tappeto') v.body.material = this.mat.carpet[(e.variant || 0) % 4];
    }
    v.root.visible = true; v.body.visible = true;
    if (v.glow) v.glow.visible = true;
    v.t = Math.random() * 6;
    v.dead = false; v.hitT = 0; v.fallT = 0; v.landFx = false; v.flyT = 0;
    if (e.kind === 'botte' || e.kind === 'muretto') v.body.rotation.y = (e.id * 1.37) % 6.28 * (e.kind === 'botte' ? 1 : 0.06);
    this.views.set(e.id, v);
    this.placeView(e, v);
  }
  despawnView(e) {
    const v = this.views.get(e.id);
    if (!v) return;
    this.views.delete(e.id);
    v.root.visible = false;
    if (v.kind === 'narrow') { this.scene.remove(v.root); return; }
    const pk = v.poolKey || v.kind;
    (this.pools[pk] || (this.pools[pk] = [])).push(v);
  }
  clearViews() { for (const [id] of this.views) this.despawnView({ id }); this.views.clear(); }
  placeView(e, v) {
    const zc = -(e.d + e.len / 2) * U;
    if (v.kind === 'narrow') { v.root.position.set(v.root.userData.x, 0, -e.d * U); return; }
    const x = (isMoving(e.kind) ? e.x : laneX(e.lane)) * U;
    v.root.position.set(x, 0, zc);
  }
  animateViews(sim, dt) {
    const t = this.clock;
    for (const e of sim.entities) {
      const v = this.views.get(e.id);
      if (!v) continue;
      this.placeView(e, v);
      // inquadratura del game over: niente ostacoli addosso al personaggio caduto
      const ahead = e.d - sim.T;
      v.root.visible = !(this.moodName === 'over' && !e.pickup && ahead + (e.len || 0) > -210 && ahead < 70);
      if (e.done && !v.dead && (e.pickup || e.destroyed)) { v.dead = true; v.body.visible = false; if (v.glow) v.glow.visible = false; if (v.warn) v.warn.visible = false; if (v.shadow) v.shadow.visible = !e.pickup && !e.destroyed; }
      if (v.dead) continue;
      v.t += dt;
      if (e.kind === 'tappeto') {
        v.body.position.y = 0.38 + Math.sin(t * 3.2 + e.d * 0.05) * 0.1;
        v.body.rotation.set(-Math.PI / 2 + 0.22 + Math.sin(t * 2.3 + e.d) * 0.05, 0, Math.sin(t * 1.7 + e.d) * 0.12);
        v.glow.position.y = 0.4; v.glow.material.opacity = 0.32 * (1 + this.light.tunnel * 1.3);
        if (v.shadow) v.shadow.visible = true;
      } else if (e.kind === 'asfodelo' || e.kind === 'ferula') {
        v.body.position.y = 0.9 + Math.sin(t * 3 + e.d) * 0.15;
        v.body.rotation.y = t * 1.4 + e.d;
        v.glow.position.y = 1.2;
      } else if (e.kind === 'pistola') {
        v.body.position.y = 1.25 + Math.sin(t * 3.5) * 0.18;
        v.body.rotation.y = t * 2.4;
        v.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
        v.glow.position.y = 1.3; v.glow.material.opacity = 0.7 + Math.sin(t * 7) * 0.2;
        if (Math.random() < dt * 6) this.add.emit(v.root.position.x + (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.6, v.root.position.z + (Math.random() - 0.5) * 1.2, 0, 0.8, 0, 0.7, 0.22, 0.05, COL.gold, 1);
      } else if (e.kind === 'rollbarrel') {
        if (e.moving) v.spin.rotation.z -= (e.vx * e.dir * U / 0.78) * dt;
      } else if (e.kind === 'goat') {
        v.body.rotation.y = e.dir > 0 ? 0 : Math.PI;
        if (e.scared) {
          // colpita dalla pistola: balzo spaventato, capriola e via di corsa in una nuvola di polvere (niente sangue)
          v.scT = (v.scT || 0) + dt; const q = v.scT;
          v.body.position.y = q < 0.7 ? Math.sin((q / 0.7) * Math.PI) * 1.8 : Math.abs(Math.sin(t * 16)) * 0.15;
          v.body.rotation.z = q < 0.7 ? (q / 0.7) * Math.PI * 2 * (e.dir > 0 ? -1 : 1) : 0;
          if (Math.random() < dt * 20) this.norm.emit(v.root.position.x, 0.3, v.root.position.z, (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, 1.0, 0.8, 2.2, COL.dust, 0.5, 0, 1);
          if (q > 1.4 && !v.dead) { v.dead = true; v.body.visible = false; if (v.shadow) v.shadow.visible = false; this.dustPuff(v.root.position.x, v.root.position.z, 14); }
        } else if (e.moving) { v.body.position.y = Math.abs(Math.sin(t * 12)) * 0.12; v.body.rotation.z = Math.sin(t * 12) * 0.05; }
      } else if (e.kind === 'rollin') {
        // v5s6: rotola verso di te (polvere e rombo come avviso)
        if (e.moving) {
          const vz = BIOME_OBST.ROLL_K * (sim.currentSpeed || 0) * U;
          if (v.spin) v.spin.rotation.x += (vz / 0.78) * dt; else v.body.position.y = Math.abs(Math.sin(t * 24)) * 0.05;
          const p = v.root.position;
          if (Math.random() < dt * 22) this.norm.emit(p.x + (Math.random() - 0.5) * 1.6, 0.25, p.z - 0.9, (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.8, -0.6, 0.9, 0.7, 1.8, COL.dust, 0.45, 0, 1);
          if (!v.spin && Math.random() < dt * 10) this.add.emit(p.x + (Math.random() < 0.5 ? -0.6 : 0.6), 0.15, p.z + 0.6, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, 1.5, 0.3, 0.14, 0.03, COL.spark, 1, 6, 2);
        }
      } else if (e.kind === 'maimoni') {
        // v5s10: carica a saltelli, piegato in avanti, si volta verso dove corre; campanacci che ballano
        const f = v.fig;
        f.root.rotation.y = e.moving && !e.done ? (e.dir > 0 ? 0.9 : -0.9) : 0;
        animateFigure(f, v.t * (e.moving ? 11 : 5), e.moving ? 0.75 : 0.25, e.moving ? 0.28 : 0.06);
      } else if (e.kind === 'fune') {
        for (let i = 0; i < 2; i++) animateFigure(v.figs[i], v.t * 4 + i * 1.7, 0.3, 0.07);
        v.rope.rotation.x = Math.sin(v.t * 3) * 0.04; v.rope.position.y = Math.sin(v.t * 4) * 0.04;
      } else if (e.kind === 'fuso') {
        // v5s10: sa Grastula a bordo strada; segno a terra, poi il fuso vola sulla corsia e resta li'
        const side = e.side || 1, gx = side * (ROAD_HALF * U + 1.3) - laneX(e.lane) * U;
        const f = v.fig; f.root.position.set(gx, 0, 0); f.root.rotation.y = -side * 0.9;
        animateFigure(f, v.t * 3, 0.15, 0.03);
        v.gshadow.position.set(gx, 0.025, 0);
        if (e.warned && !e.landed) { v.warn.visible = true; v.warn.scale.setScalar(1.1 + 0.35 * (0.5 + 0.5 * Math.sin(t * 12))); }
        else v.warn.visible = false;
        if (!e.landed) {
          f.arms[1].rotation.x = e.warned ? -2.2 - Math.sin(v.t * 9) * 0.3 : -0.3; f.hand.visible = true; v.spin.visible = false;
        } else {
          v.flyT += dt; const q = Math.min(1, v.flyT / 0.4);
          f.hand.visible = false; f.arms[1].rotation.x = -0.8 * (1 - q);
          v.spin.visible = true;
          v.spin.position.set(gx * (1 - q), 2.6 * (1 - q) + Math.sin(q * Math.PI) * 2.2 + 0.08 * q, 0);
          v.spin.rotation.set(q < 1 ? v.flyT * 14 : Math.PI / 2, 0, q < 1 ? v.flyT * 9 : 0.4);
          if (q >= 1 && !v.landFx) { v.landFx = true; const p = v.root.position; this.dustPuff(p.x, p.z, 10); }
        }
      } else if (e.kind === 'sasso') {
        // v5s6: prima solo l'ombra che pulsa sulla corsia, poi il masso cade e resta li'
        if (!e.landed) {
          v.body.visible = false;
          const k = 0.7 + Math.sin(t * 10) * 0.18; v.shadow.scale.set(2.8 * k, 1, 2.8 * k);
          if (v.warn) { v.warn.visible = true; v.warn.scale.setScalar(1.2 + 0.4 * k); }
        } else {
          v.fallT += dt; const q = Math.min(1, v.fallT / 0.4);
          if (v.warn) v.warn.visible = false;
          v.body.visible = true; v.body.position.y = 18 * (1 - q * q); v.body.rotation.x = (1 - q) * 2.5;
          v.shadow.scale.set(2.8, 1, 2.8);
          if (q >= 1 && !v.landFx) { v.landFx = true; const p = v.root.position; this.dustPuff(p.x, p.z, 24); this.addShake(0.16, 0.14); }
        }
      }
      if (e.hit && !v.hitT && e.kind !== 'pozza' && e.kind !== 'bagnato' && !e.ducked) v.hitT = 0.4;
      if (v.hitT > 0) { v.hitT = Math.max(0, v.hitT - dt); v.body.rotation.z = Math.sin(v.hitT * 40) * v.hitT * 0.4; }
    }
  }

  // ------------------------------------------------------------ effetti di gioco
  onFx(type, d, sim) {
    const pz = -sim.T * U;
    switch (type) {
      case 'spawn': this.spawnView(d); break;
      case 'danceCue': case 'danceStart': case 'danceBeat': case 'danceEnd': case 'danceJudge': this.dance.on(type, d, sim); break;
      case 'despawn': this.despawnView(d); break;
      case 'shot': this.shotStart(d); break;
      case 'shotEnd': this.shotEnd(d); break;
      case 'barrel': this.barrelBurst(d); break;
      case 'goatScared': {
        const p = this.views.get(d.e.id)?.root.position || _v.set(d.x * U, 0, -d.e.d * U);
        this.dustPuff(p.x, p.z, 26); this.burst(p.x, 1.2, p.z, COL.spark2, 10, 4);
        this.popWorld(`+${d.pts}`, p.x, 2.6, p.z, 'barrel');
        break;
      }
      case 'ricochet': this.burst(d.x * U, 1.8, -d.d * U, COL.spark2, 14, 4); break;
      case 'carpet': {
        const p = this.views.get(d.e.id)?.root.position || _v.set(sim.px * U, 0, pz);
        for (let i = 0; i < 22; i++) {
          const c = COL.carpet[i % COL.carpet.length];
          (i % 2 ? this.add : this.norm).emit(p.x, 0.7, p.z, (Math.random() - 0.5) * 6, Math.random() * 5 + 2, (Math.random() - 0.5) * 6, 0.7, 0.35, 0.1, c, 1, 7, 1.5);
        }
        this.popWorld(`+${d.pts}`, p.x, 1.8, p.z, 'carpet');
        break;
      }
      case 'fuel': {
        const p = this.views.get(d.e.id)?.root.position || _v.set(sim.px * U, 0, pz);
        this.burst(p.x, 1.0, p.z, d.e.kind === 'ferula' ? COL.green : COL.white, 24, 5);
        this.burst(p.x, 1.0, p.z, COL.spark, 14, 3);
        this.popWorld(`+${d.pts}`, p.x, 2.2, p.z, 'fuel');
        break;
      }
      case 'pistol': {
        const p = this.views.get(d.e.id)?.root.position || _v.set(sim.px * U, 0, pz);
        this.burst(p.x, 1.3, p.z, COL.gold, 40, 6);
        break;
      }
      case 'puddle': {
        const x = sim.px * U;
        for (let i = 0; i < 26; i++) this.norm.emit(x + (Math.random() - 0.5), 0.2, pz, (Math.random() - 0.5) * 5, Math.random() * 5 + 2, (Math.random() - 0.5) * 3, 0.6, 0.28, 0.12, COL.water, 0.9, 14, 0.5);
        this.smokeAtTip(10);
        this.popWorld('SSSS...', x, 3.2, pz, 'water');
        break;
      }
      case 'hit': {
        this.addShake(0.35, 0.28); this.smokeAtTip(12);
        const t = this.tipW;
        this.burst(t.x, t.y + 0.5, t.z, COL.spark, 34, 5.5); this.burst(t.x, t.y + 0.3, t.z, COL.ember, 22, 3.5);
        this.char3d.stumble(); this.char3d.kick((Math.random() < 0.5 ? -1 : 1) * 1.6, 2.2);
        break;
      }
      case 'slip': {
        const x = sim.px * U;
        for (let i = 0; i < 22; i++) this.norm.emit(x + (Math.random() - 0.5), 0.2, pz, (Math.random() - 0.5) * 4, Math.random() * 3 + 1.5, (Math.random() - 0.5) * 3, 0.5, 0.25, 0.1, COL.water, 0.9, 14, 0.5);
        this.char3d.kick((Math.random() < 0.5 ? -1 : 1) * 0.8, 0.6);
        break;
      }
      case 'duck': { const x = sim.px * U; this.dustPuff(x, pz + 0.4, 6); break; }
      case 'die': this.smokeAtTip(30); this.burnT = 0; this.burnKeep = this.char3d.keep ?? 1; break;
      case 'start': case 'attract':
        this.add.clear(); this.norm.clear(); this.shards.clear();
        if (type === 'start') this.env.startRun(sim.T * U); else this.env.toAttract(sim.T * U);
        this.burnT = -1; this.char3d.setBurn?.(null, 0);
        break;
      default: break;
    }
  }
  shopNod() { if (this.shopRoom) this.shopRoom.nod(); }
  dustPuff(x, z, n) { for (let i = 0; i < n; i++) this.norm.emit(x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 0.8, z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 3, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4, 1.1, 1.0, 3.0, COL.dust, 0.55, 0, 1); }
  burst(x, y, z, color, n, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = sp * (0.4 + Math.random() * 0.6);
      const k = Math.sqrt(1 - u * u);
      this.add.emit(x, y, z, Math.cos(a) * k * s, u * s + sp * 0.4, Math.sin(a) * k * s, 0.5 + Math.random() * 0.4, 0.32, 0.04, color, 1, 6, 2);
    }
  }
  smokeAtTip(n) {
    const p = this.tipW;
    for (let i = 0; i < n; i++) this.norm.emit(p.x + (Math.random() - 0.5) * 0.4, p.y + Math.random() * 0.4, p.z, (Math.random() - 0.5) * 0.8, 1 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 0.8, 0.5, 2.0, i % 2 ? COL.smoke : COL.smokeD, 0.55, -0.3, 0.6);
  }
  addShake(t, amp) { this.shake = Math.max(this.shake, t); this.shakeAmp = Math.max(this.shakeAmp * (this.shake > 0 ? 1 : 0), amp); }
  barrelBurst(d) {
    const v = this.views.get(d.e.id);
    const p = v ? v.root.position : _v.set(d.x * U, 0, 0);
    const big = d.big;
    const n = big ? 34 : 18;
    const sh = SHARDS[(v && v.skin && SKINS[v.skin] && SKINS[v.skin].shards) || 'barrel'] || SHARDS.barrel;
    const pc = sh.cols || (sh.cols = sh.pieces.map((c) => new THREE.Color(c)));
    const ironC = sh.ironC || (sh.ironC = new THREE.Color(sh.iron)), splC = sh.splC || (sh.splC = new THREE.Color(sh.splash)), dustC = sh.dustC || (sh.dustC = new THREE.Color(sh.dust));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 5;
      this.shards.emit(p.x + (Math.random() - 0.5) * (big ? 2 : 1), 0.4 + Math.random() * (big ? 2.4 : 1.6), p.z + (Math.random() - 0.5) * (big ? 2 : 1),
        Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s * 0.7 + 2.2, pc[i % pc.length], 0.7 + Math.random() * 0.7, 1.4 + Math.random() * 0.6);
    }
    for (let i = 0; i < (big ? 8 : 4); i++) this.shards.emit(p.x, 0.5 + Math.random() * 1.4, p.z, (Math.random() - 0.5) * 7, 4 + Math.random() * 4, (Math.random() - 0.5) * 5, ironC, 0.9, 1.6);
    for (let i = 0; i < (big ? 40 : 24); i++) this.norm.emit(p.x, 0.8 + Math.random(), p.z, (Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 5 + 1, 0.8, 0.32, 0.18, splC, 1, 12, 0.6);
    for (let i = 0; i < 12; i++) this.norm.emit(p.x + (Math.random() - 0.5) * 1.5, 0.5 + Math.random(), p.z, (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2, 1.1, 1.0, 3.0, dustC, 0.5, 0, 1);
    this.burst(p.x, 1.2, p.z, COL.spark2, 18, 6);
    this.addShake(big ? 0.4 : 0.3, big ? 0.5 : 0.35);
    this.popWorld(`+${d.pts}`, p.x, 3.0, p.z, 'barrel');
  }
  shotStart(p) {
    let s = this.shotPool?.pop();
    if (!s) { s = new THREE.Mesh(this.geo.shot, this.mat.shot); const g = this.glowSprite('#ffcf6a', 1.6, 0.9); s.add(g); this.scene.add(s); }
    s.visible = true;
    this.shots.set(p.id, { mesh: s, p });
    s.position.copy(this.muzzleW);
    this.flash.visible = true; this.flashT = 0.09;
    this.flash.position.copy(this.muzzleW);
    this.flash.material.rotation = Math.random() * 6;
    this.flashBoost = 1;
    this.burst(this.muzzleW.x, this.muzzleW.y, this.muzzleW.z, COL.spark2, 12, 4);
    for (let i = 0; i < 6; i++) this.norm.emit(this.muzzleW.x, this.muzzleW.y, this.muzzleW.z, (Math.random() - 0.5) * 1.5, 0.5 + Math.random(), -1 - Math.random(), 0.9, 0.5, 1.6, COL.smoke, 0.5, -0.2, 1);
    this.addShake(0.12, 0.12);
  }
  shotEnd(p) {
    const s = this.shots.get(p.id);
    if (!s) return;
    this.shots.delete(p.id);
    s.mesh.visible = false;
    (this.shotPool || (this.shotPool = [])).push(s.mesh);
  }
  popWorld(text, x, y, z, style) { this.popupQ.push({ text, x, y, z, style }); }

  // ------------------------------------------------------------ frame
  setMood(name) { this.moodName = name; }
  // bersaglio: ambiente nel punto del giocatore (+ menu al crepuscolo nel paese, + tinta del game over)
  updateMood(dt, fuelF = 1) {
    const env = this.env, tgt = this.tgt;
    env.moodAt(env.cur.bDist, tgt);
    if (this.moodName === 'menu' && env.cur.b.id === 'village') {
      for (const k in MENU_MOOD) { if (typeof MENU_MOOD[k] === 'string') tgt[k].set(MENU_MOOD[k]); else tgt[k] = MENU_MOOD[k]; }
    } else if (this.moodName === 'over') {
      const ok = OVER_TINT.k * (1 - tgt.light.tunnel);
      for (const k in OVER_TINT.mood) { const v = OVER_TINT.mood[k]; if (typeof v === 'string') tgt[k].lerp(_c.set(v), ok); else tgt[k] += (v - tgt[k]) * ok; }
    }
    const k = 1 - Math.exp(-dt * 1.8);
    for (const key in tgt) {
      const v = tgt[key];
      if (v && v.isColor) { if (!this.mood[key]) this.mood[key] = v.clone(); this.mood[key].lerp(v, k); }
      else if (typeof v === 'number') { if (key === 'farVis') this.farVis += (v - this.farVis) * k; else this.mood[key] = (this.mood[key] ?? v) + (v - (this.mood[key] ?? v)) * k; }
    }
    for (const key in tgt.light) this.light[key] = (this.light[key] ?? tgt.light[key]) + (tgt.light[key] - (this.light[key] ?? tgt.light[key])) * Math.min(1, k * 1.6);
    for (const key in tgt.amb) this.amb[key] = (this.amb[key] ?? 0) + (tgt.amb[key] - (this.amb[key] ?? 0)) * k;
    const m = this.mood, L = this.light;
    // in miniera il buio cresce quando la frakkera si consuma
    const dark = L.darkByFuel * (1 - fuelF);
    this.skyU.uTop.value.copy(m.top); this.skyU.uMid.value.copy(m.mid); this.skyU.uHor.value.copy(m.hor); this.skyU.uFog.value.copy(m.fog); this.skyU.uSun.value = m.sun;
    this.scene.fog.color.copy(m.fog); this.scene.fog.near = m.fogNear * (1 - dark * 0.4); this.scene.fog.far = m.fogFar * (1 - dark * 0.55);
    this.hemi.color.copy(m.hemiS); this.hemi.groundColor.copy(m.hemiG); this.hemi.intensity = m.hemiI * (1 - dark * 0.5);   // v5s9: il buio cresce col fuoco che cala, ma non scende sotto la meta'
    this.dir.color.copy(m.dirC); this.dir.intensity = m.dirI;
    this.far.material.color.copy(m.far);
    this.moon.material.opacity = m.moon; this.moon.visible = m.moon > 0.02 && L.tunnel < 0.98;
    this.stars.material.opacity = m.moon * 0.9;
    this.sunGlow.material.opacity = 0.5 * m.sun; this.sunGlow.visible = L.tunnel < 0.98;
    for (const c of this.clouds) { c.material.color.copy(m.hor).lerp(_c2.set('#ffffff'), 0.35); c.visible = L.tunnel < 0.98; }
  }

  setPixelRatio(pr) {
    this.renderer.setPixelRatio(pr);
    if (this.w) this.resize(this.w, this.h);
  }
  resize(w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`; this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const ph = h * this.renderer.getPixelRatio();
    this.add.uniforms.uScale.value = ph * 0.9; this.norm.uniforms.uScale.value = ph * 0.9;
  }

  render(sim, dt, view) {
    this.clock += dt;
    const pz = -sim.T * U, px = sim.px * U;
    this.updateMood(dt, view.fuelF);
    const dpos = this.dance.update(dt, sim);
    // camera: preset per modalita' + inseguimento morbido
    const aspect = this.camera.aspect;
    const wide = Math.max(0, Math.min(1, (aspect - 0.5) / 0.3));
    let cp, cl, fov;
    if (view.cam === 'menu') { cp = _v.set(0.6 + wide * 1.2, 2.2 + wide * 0.4, pz + 12.6 - wide * 3); cl = _v2.set(0.05 - wide * 0.8, 3.0 + wide * 0.3, pz); fov = 58; }   // v5s8: piu' indietro, frakkera e fiamma intere sotto il logo
    else if (view.cam === 'dance' && this.dance.state !== 'off') { cp = _v; cl = _v2; fov = this.dance.camera(cp, cl); }
    else if (view.cam === 'over') { cp = _v.set(px * 0.45 + 2.0, 4.2, pz + 15.5); cl = _v2.set(px, -2.6, pz); fov = 52; }
    else {
      // per ambiente (config.light.camLook/camFov): un po' piu' larga e meno inclinata dove i monumenti devono entrare in verticale
      const L = this.light || {}, por = 1 - wide;
      cp = _v.set(px * 0.82 - 0.6, 6.4 - wide, pz + 9.4 - wide * 1.5); cl = _v2.set(px * 0.55 - 0.1, 1.8 + (L.camLook || 0) * por, pz - 15); fov = 64 - wide * 6 + (L.camFov || 0) * por;
      if (L.camYaw) { cl.x += L.camYaw * por; cp.x -= L.camYaw * 0.3 * por; }   // v5s6: solo la piscina guarda un po' verso l'acqua a destra
    }
    const k = 1 - Math.exp(-dt * (view.cam === 'run' ? 7 : 2.6));
    this.camPos.lerp(cp, k);
    this.camLook.lerp(cl, k);
    // la camera non resta mai indietro rispetto al corridore
    const lagZ = cp.z - this.camPos.z;
    if (Math.abs(lagZ) > 6 && view.cam !== 'dance') { this.camPos.z = cp.z - Math.sign(lagZ) * 6; this.camLook.z = cl.z - Math.sign(lagZ) * 6; }
    this.camera.fov += (fov - this.camera.fov) * k; this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      const a = this.shakeAmp * Math.max(0, this.shake) * 2.5;
      this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a;
      if (this.shake <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(this.camLook);
    // solo test/screenshot (?test): inquadratura libera relativa alla camera di gioco
    if (this.camOverride) { const o = this.camOverride; this.camera.position.set(o[0], o[1], this.camPos.z + o[2]); this.camera.lookAt(o[3], o[4], this.camPos.z + o[5]); }
    this.camera.updateMatrixWorld();
    const camZ = this.camera.position.z;
    // cielo, lontananze
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.far.visible = this.farVis > 0.01;
    this.far.position.set(0, -70 * (1 - this.farVis), camZ - FAR_Z);
    this.vista.visible = this.farVis > 0.02;
    this.vista.position.set(VISTA.X, -60 * (1 - this.farVis) ** 0.7, this.camPos.z - VISTA.D - 40 * (1 - this.farVis));
    this.moon.position.set(this.camera.position.x - 70, 150, camZ - 300);
    this.sunGlow.position.set(this.camera.position.x + 60, 16, camZ - 360);
    for (const c of this.clouds) c.position.set(c.userData.x + this.camera.position.x * 0.0 + Math.sin(this.clock * 0.02 + c.userData.y) * 10, c.userData.y, camZ - 320 + c.userData.z);
    // v5: ambienti a tratti (terreno, lati, galleria, monumenti)
    this.env.update(-camZ, sim.T * U, dt, this.clock);
    this.animateViews(sim, dt);
    this.dir.position.set(px - 30, 40, pz - 25); this.dir.target.position.set(px, 0, pz);

    // personaggio: modello 3D (v4) oppure sprite di riserva (v3) se il GLB non e' (ancora) disponibile
    const base = _v3.set(px, 0, pz);
    _right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    _up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const ch = this.character, c3 = this.char3d;
    const use3d = c3.ready;
    ch.sprite.visible = !use3d;
    // v5: la frakkera si accorcia col carburante; a zero brucia fino alle mani (game over senza crudezze)
    const fuelF0 = view.fuelF;
    let burnLit = false;
    if (this.burnT >= 0) {
      this.burnT += dt;
      const t = Math.min(1, this.burnT / 0.6), e = t * t * (3 - 2 * t);
      c3.setBurn?.((this.burnKeep ?? 0.4) + (0.1 - (this.burnKeep ?? 0.4)) * e, Math.max(0, Math.min(1, (this.burnT - 0.3) / 0.8)));
      burnLit = this.burnT < 0.3;          // la fiamma divampa un attimo, poi resta la brace che consuma il fascio
      if (this.burnT > 0.5 && this.burnT < 3.2 && Math.random() < dt * 14) this.norm.emit(px + (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.6, pz + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5, 1 + Math.random(), (Math.random() - 0.5) * 0.4, 1.6, 0.7, 2.4, Math.random() < 0.5 ? COL.smoke : COL.smokeD, 0.5, -0.2, 0.5);
      if (this.burnT < 0.7 && Math.random() < dt * 30) { const t2 = this.tipW; this.add.emit(t2.x + (Math.random() - 0.5) * 0.5, t2.y, t2.z, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5), 0.5, 0.2, 0.03, COL.ember, 1, -0.5, 0.8); }
    } else if (use3d && c3.setFuel) c3.setFuel(view.cam === 'menu' ? 1 : fuelF0, dt);
    if (use3d) {
      if (dpos) { view.char.danceRy = dpos.ry; view.char.danceHop = dpos.hop; } else view.char.danceRy = null;
      c3.update(dt, view.char, dpos ? dpos.x : px, dpos ? dpos.z : pz);
      c3.tipWorld(this.tipW);
      if (view.char.armed) c3.muzzleWorld(this.muzzleW);
      else this.muzzleW.set(px - 0.5, 2.0, pz - 0.8);
      this.charShadow.position.set(dpos ? dpos.x : px, 0.03, (dpos ? dpos.z : pz) - 0.2);
      this.charShadow.scale.set(2.3, 1, 2.0);
      c3.setOcclusion(view.cam === 'run' && this.occludes(px, pz) ? 0.38 : 1, dt);
    } else {
      ch.update(dt, view.char);
      ch.sprite.position.copy(base);
      this.charShadow.position.set(px + (view.char.downT > 0 ? 0.6 : 0), 0.03, pz);
      this.charShadow.scale.set(view.char.downT > 0 ? 3.4 : 2.2, 1, 1.3);
      ch.worldOf(this.tipW, base, _right, _up, ch.tip.x, ch.tip.y - 9);
      ch.worldOf(this.muzzleW, base, _right, _up, ch.muzzle.x, ch.muzzle.y);
    }
    const fuelF = this.burnT >= 0 && burnLit ? Math.max(0.35, 1 - this.burnT) : view.fuelF;
    const lit = view.char.flameOn || burnLit;
    const flick = Math.sin(this.clock * 17) * 0.06 + Math.sin(this.clock * 29) * 0.05;
    this.flame3d.update(dt, this.camera, this.tipW, fuelF, use3d && lit, view.char.fuelLow, -(view.char.vx || 0) * 0.5);
    this.flameLight.position.copy(this.tipW); if (use3d) this.flameLight.position.y += 0.9;
    const L = this.light, dark = L.darkByFuel * (1 - fuelF);
    this.flameLight.distance = L.flameDist * (1 - dark * 0.45);
    this.flameLight.intensity = lit ? (10 + 18 * fuelF) * L.flameK * (1 + flick) + (this.flashBoost || 0) * 40 : 0;
    for (const k in this.env.tunnelMat) { const u = this.env.tunnelMat[k].userData.u; u.uLamp.value = L.lamp; u.uMineral.value = L.mineral * (0.92 + Math.sin(this.clock * 1.3) * 0.08); }
    this.renderer.toneMappingExposure = L.exposure * (0.15 + 0.85 * this.env.fade);
    this.flashBoost = Math.max(0, (this.flashBoost || 0) - dt * 10);
    this.flameGlow.visible = lit;
    this.flameGlow.position.copy(this.tipW); if (use3d) this.flameGlow.position.y += 0.9;
    this.flameGlow.scale.setScalar((2.2 + 1.8 * fuelF) * (1 + flick));
    this.groundGlow.visible = lit;
    this.groundGlow.position.set(dpos ? dpos.x : px, 0.04, (dpos ? dpos.z : pz) - 0.5);
    this.groundGlow.material.opacity = (0.18 + 0.2 * fuelF) * (1 + L.tunnel * 0.9);
    // scintille dalla fiamma (piu' fuoco => piu' scintille)
    if (lit) {
      this.sparkAcc += dt * (8 + 30 * fuelF);
      while (this.sparkAcc > 1) {
        this.sparkAcc -= 1;
        const t = this.tipW;
        const hot = Math.random() < 0.5;
        this.add.emit(t.x + (Math.random() - 0.5) * 0.4, t.y + 0.4 + Math.random() * 0.5, t.z, (Math.random() - 0.5) * 1.6, 1.5 + Math.random() * 2.5, (Math.random() - 0.3) * 1.2 + (view.speed || 0) * U * 0.25,
          0.6 + Math.random() * 0.7, hot ? 0.2 : 0.14, 0.03, hot ? COL.spark : COL.ember, 1, -0.6, 0.8);
      }
    }
    if (!lit && view.smoke) {
      this.ambAcc += dt * 9;
      while (this.ambAcc > 1) { this.ambAcc -= 1; const t = this.tipW; this.norm.emit(t.x, t.y + 0.2, t.z, (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, 2.2, 0.4, 2.4, COL.smoke, 0.5, -0.1, 0.3); }
    }
    // braci e polline nell'aria
    if (Math.random() < dt * 3) this.add.emit(px + (Math.random() - 0.5) * 14, 0.5 + Math.random() * 5, pz - Math.random() * 30, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4, 0, 3, 0.12, 0.05, COL.ember, 0.8, 0, 0);
    // colpi in volo
    for (const [, s] of this.shots) {
      const x = s.p.x * U, z = -s.p.d * U;
      s.mesh.position.set(x, this.muzzleW.y * 0.6 + 1.2 * 0.4, z);
      this.add.emit(x + (Math.random() - 0.5) * 0.1, s.mesh.position.y, z + 0.4, 0, 0, 0, 0.25, 0.3, 0.02, COL.spark2, 0.9, 0, 0);
    }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.position.copy(this.muzzleW); this.flash.scale.setScalar(1.4 + (0.09 - this.flashT) * 8); if (this.flashT <= 0) this.flash.visible = false; }
    this.add.update(dt); this.norm.update(dt); this.shards.update(dt);
    if (this.shopView) {   // v5s7: dentro il Garag di Pinu (scena a parte)
      if (!this.renderer.shadowMap.enabled) { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }   // v5s7b: ombre solo nel negozio (la strada non ha luci con ombre)
      const sh = this.shopRoom || (this.shopRoom = buildShopRoom());
      const sz = this.renderer.getSize(this._sz || (this._sz = new THREE.Vector2()));
      sh.update(dt, sz.x / Math.max(1, sz.y), this.shopUI);
      if (sh.render) sh.render(this.renderer, sz); else this.renderer.render(sh.scene, sh.camera);
      return;
    }
    this.flushBlobs();
    this.renderer.render(this.scene, this.camera);
  }

  // foglio del personaggio renderizzato col motore del gioco (turnaround / ciclo di corsa) -> dataURL PNG
  renderCharacterSheet(kind = 'turnaround', w = 360, h = 640) {
    const c3 = this.char3d;
    if (!c3.ready) return null;
    const sc = new THREE.Scene();
    sc.background = new THREE.Color('#e4d6c2');
    sc.add(new THREE.HemisphereLight('#fff3e0', '#7a6660', 1.5));
    const d1 = new THREE.DirectionalLight('#fff0dc', 2.6); d1.position.set(3, 6, 6); sc.add(d1);
    const d2 = new THREE.DirectionalLight('#ffc890', 1.1); d2.position.set(-5, 3, -4); sc.add(d2);
    const ground = new THREE.Mesh(this.geo.blob, this.mat.blob); ground.scale.set(3.2, 1, 2.4); sc.add(ground);
    const parent = c3.root.parent, pos = c3.root.position.clone(), rot = c3.root.rotation.y, fParent = this.flame3d.group.parent;
    sc.add(c3.root); sc.add(this.flame3d.group);
    c3.root.position.set(0, 0, 0);
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    const views = kind === 'run'
      ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ clip: 'run', t: i / 8, rot: -Math.PI / 2 }))
      : [{ clip: 'idle', t: 0, rot: 0 }, { clip: 'idle', t: 0, rot: -Math.PI / 2 }, { clip: 'idle', t: 0, rot: Math.PI }, { clip: 'run', t: 0.25, rot: Math.PI * 0.8 }];
    const out = document.createElement('canvas'); out.width = w * views.length; out.height = h;
    const ctx = out.getContext('2d');
    const prevSize = new THREE.Vector2(); this.renderer.getSize(prevSize);
    const prevPR = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    const acts = c3.actions;
    views.forEach((v, i) => {
      for (const k in acts) acts[k].setEffectiveWeight(0);
      const a = acts[v.clip]; a.setEffectiveWeight(1); a.time = v.t * a.getClip().duration;
      c3.mixer.update(0);
      c3.root.rotation.y = v.rot; c3.root.updateMatrixWorld(true);
      c3.bones.tip.getWorldPosition(_v);
      if (kind === 'closeup') { cam.position.set(0, 2.2, 7.4); cam.lookAt(0, 1.75, 0); } else if (kind === 'run') { cam.position.set(-1.5, 3.9, 17.5); cam.lookAt(-1.5, 3.7, 0); } else { cam.position.set(0, 3.6, 16.5); cam.lookAt(0, 3.3, 0); }
      cam.updateMatrixWorld();
      this.flame3d.fade = 1; this.flame3d.update(0.016, cam, _v, 1, true, false, 0);
      this.renderer.render(sc, cam);
      ctx.drawImage(this.renderer.domElement, i * w, 0);
    });
    parent.add(c3.root); fParent.add(this.flame3d.group);
    c3.root.position.copy(pos); c3.root.rotation.y = rot;
    this.renderer.setPixelRatio(prevPR); this.renderer.setSize(prevSize.x, prevSize.y, false);
    return out.toDataURL('image/png');
  }

  // la frakkera (dalle mani alla punta, in coordinate schermo) copre un oggetto in arrivo?
  occludes(px, pz) {
    const asp = this.camera.aspect;
    _a.set(px, 3.0, pz).project(this.camera);
    _b.copy(this.tipW); _b.y += 1.2; _b.project(this.camera);
    const sx = (_b.x - _a.x) * asp, sy = _b.y - _a.y, L2 = sx * sx + sy * sy || 1;
    for (const v of this.views.values()) {
      if (!v.root.visible) continue;
      const p = v.root.position;
      if (p.z > pz - 2.5 || p.z < pz - 80) continue;
      _c3.set(p.x, 1.0, p.z).project(this.camera);
      const qx = (_c3.x - _a.x) * asp, qy = _c3.y - _a.y;
      const t = Math.max(0, Math.min(1, (qx * sx + qy * sy) / L2));
      const dx = qx - sx * t, dy = qy - sy * t;
      if (dx * dx + dy * dy < 0.016) return true;
    }
    return false;
  }

  stepFrame() { return this.char3d.ready ? this.char3d.frame : this.character.frame; }

  // proiezione per i popup HTML (0..1 nello schermo)
  project(x, y, z, out) {
    _v.set(x, y, z).project(this.camera);
    out.x = (_v.x + 1) / 2; out.y = (1 - _v.y) / 2; out.vis = _v.z < 1;
    return out;
  }

  // icone 3D per l'interfaccia (renderizzate una volta all'avvio)
  renderIcons(kinds, size = 160) {
    const out = {};
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#fff1dc', '#5a4a5a', 1.6));
    const dl = new THREE.DirectionalLight('#ffe0b0', 2.2); dl.position.set(2, 3, 4); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const prevSize = new THREE.Vector2(); this.renderer.getSize(prevSize);
    const prevPR = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);
    const prevBg = this.scene.background;
    for (const k of kinds) {
      const v = this.createView(k, { id: 1, variant: 1 });
      this.scene.remove(v.root);
      if (v.shadow) v.shadow.visible = false;
      if (v.glow) v.glow.visible = false;
      if (v.ring) v.ring.visible = false;
      sc.add(v.root);
      const box = new THREE.Box3().setFromObject(v.body);
      const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()).length();
      if (k === 'tappeto') v.body.rotation.set(-Math.PI / 2 + 0.9, 0, 0);
      cam.position.set(c.x + s * 0.9, c.y + s * 0.75, c.z + s * 1.7); cam.lookAt(c);
      this.renderer.render(sc, cam);
      out[k] = this.renderer.domElement.toDataURL('image/png');
      sc.remove(v.root);
      v.poolKey = k + '|'; (this.pools[v.poolKey] || (this.pools[v.poolKey] = [])).push(v); this.scene.add(v.root); v.root.visible = false;
      if (v.shadow) v.shadow.visible = true; if (v.glow) v.glow.visible = true; if (v.ring) v.ring.visible = true;
    }
    this.scene.background = prevBg;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(prevPR);
    this.renderer.setSize(prevSize.x, prevSize.y, false);
    return out;
  }
}
