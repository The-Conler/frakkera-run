// =====================================================================
// Mondo 3D cartoon (Three.js): villaggio sardo al tramonto, oggetti di
// gioco, particelle, luce della frakkera, camera in terza persona.
// Legge lo stato di `Sim` e reagisce ai suoi effetti (fx).
// =====================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../config.js';
import { laneX, isMoving } from './sim.js';
import * as T3 from './tex3d.js';
import * as M from './models.js';
import { PointPool, Shards } from './particles.js';
import { Character } from './character.js';
import { rng } from './kit.js';

const U = 0.1;                    // 1 px del mondo 2D = 0.1 unita' 3D (1 m = 1 unita')
const ROAD_W = 11.0;
const WALK_W = 1.45;
const FACADE = ROAD_W / 2 + WALK_W;
const FAR_Z = 185;

const MOODS = {
  menu: { top: '#2a2c6e', mid: '#7a5aa8', hor: '#f39a7c', fog: '#b57c98', hemiS: '#c7b4ff', hemiG: '#6a4a58', hemiI: 1.15, dirC: '#ffb784', dirI: 1.5, moon: 1, sun: 0.35, far: '#c9b6ea', fogNear: 30, fogFar: 150 },
  run: { top: '#4f74c8', mid: '#f2a57e', hor: '#ffd592', fog: '#f4c9a0', hemiS: '#ffe6c4', hemiG: '#7a6658', hemiI: 1.35, dirC: '#ffd49a', dirI: 2.1, moon: 0, sun: 1, far: '#ffffff', fogNear: 40, fogFar: 175 },
  over: { top: '#161a46', mid: '#43357a', hor: '#9a5d7f', fog: '#5a476e', hemiS: '#9b95da', hemiG: '#3a2a3e', hemiI: 0.8, dirC: '#ff9b70', dirI: 0.55, moon: 1, sun: 0.1, far: '#8a80b8', fogNear: 18, fogFar: 110 },
};

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`;
const SKY_FS = `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSunDir; uniform float uSun;
varying vec3 vDir;
void main(){
  float h = vDir.y;
  vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.2, h));
  c = mix(c, uTop, smoothstep(0.16, 0.75, h));
  float s = max(0.0, dot(normalize(vDir), uSunDir));
  c += vec3(1.0, 0.75, 0.45) * pow(s, 18.0) * 0.55 * uSun + vec3(1.0,0.85,0.6) * pow(s, 400.0) * 1.2 * uSun;
  if (h < 0.0) c = mix(uHor, uHor * 0.8, smoothstep(0.0, -0.3, h));
  gl_FragColor = vec4(c, 1.0);
}`;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _right = new THREE.Vector3(), _up = new THREE.Vector3();
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
    this.renderer.setPixelRatio(dpr);
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
    this.buildGround();
    this.buildVillage();
    this.buildFx();
    this.character = new Character(this.scene, 0.11);
    this.charShadow = this.blob(2.4, 1.3);
    this.scene.add(this.charShadow);
    this.shots = new Map();
    this.popupQ = [];
    this.tipW = new THREE.Vector3(0, 4, 0);
    this.muzzleW = new THREE.Vector3(0, 3, 0);
  }

  // ------------------------------------------------------------ materiali
  buildMaterials() {
    this.tex = {
      cobble: T3.cobbleTexture(), slab: T3.slabTexture(), stave: T3.staveTexture(), lid: T3.lidTexture(),
      glow: T3.glowTexture(), blob: T3.blobTexture(), flash: T3.flashTexture(), moon: T3.moonTexture(),
      carpets: [0, 1, 2, 3].map((v) => T3.carpetTexture(v)),
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
    this.geo.carpet = new THREE.PlaneGeometry(2.4, 2.4 * 176 / 256).rotateZ(Math.PI / 2);
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
  blob(w, d) { const m = new THREE.Mesh(this.geo.blob, this.mat.blob); m.scale.set(w, 1, d); m.position.y = 0.025; m.renderOrder = 1; return m; }
  glowSprite(color, size, opacity = 0.8) {
    const m = new THREE.SpriteMaterial({ map: this.tex.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.renderOrder = 15; return s;
  }

  // ------------------------------------------------------------ cielo e luci
  buildSky() {
    this.skyU = {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
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
  }
  buildLights() {
    this.hemi = new THREE.HemisphereLight('#ffe6c4', '#7a6658', 1.35);
    this.dir = new THREE.DirectionalLight('#ffd49a', 2.1);
    this.dir.position.set(-0.55, 0.75, -0.5);
    this.scene.add(this.hemi, this.dir, this.dir.target);
    this.flameLight = new THREE.PointLight('#ff9a45', 18, 9, 1.6);
    this.scene.add(this.flameLight);
  }

  // ------------------------------------------------------------ strada
  buildGround() {
    const L = 264;
    this.tex.cobble.repeat.set(1, L / ROAD_W);
    this.road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, L).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: this.tex.cobble }));
    this.scene.add(this.road);
    this.tex.slab.repeat.set(1, L / 2.9);
    const walkM = new THREE.MeshLambertMaterial({ map: this.tex.slab });
    this.walks = [-1, 1].map((s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(WALK_W, 0.22, L), walkM);
      m.position.set(s * (ROAD_W / 2 + WALK_W / 2), 0.11, 0); this.scene.add(m); return m;
    });
    const curbM = new THREE.MeshLambertMaterial({ color: '#9a8e80' });
    this.curbs = [-1, 1].map((s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, L), curbM);
      m.position.set(s * (ROAD_W / 2 + 0.05), 0.13, 0); this.scene.add(m); return m;
    });
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7d8a4e' }));
    this.base.position.y = -0.06; this.scene.add(this.base);
  }

  // ------------------------------------------------------------ villaggio
  buildVillage() {
    this.housePrefabs = [];
    for (let i = 0; i < 18; i++) this.housePrefabs.push(M.buildHouse(i + 1));
    this.gardenPrefabs = [];
    for (let i = 0; i < 5; i++) this.gardenPrefabs.push(M.buildGarden(i + 1));
    this.bannerGeo = [0, 1, 2, 3].map((i) => M.buildBanner(i + 1, FACADE));
    this.sides = [-1, 1].map((s) => ({ s, list: [], nextZ: 20, r: rng(s > 0 ? 71 : 37) }));
    this.housePool = [];
    this.lampPool = [];
    this.banners = []; this.bannerPool = []; this.nextBanner = -8;
    this.bannerR = rng(55);
  }
  placeHouse(side) {
    const r = side.r;
    const pf = r.chance(0.16) ? r.pick(this.gardenPrefabs) : r.pick(this.housePrefabs);
    let mesh = this.housePool.pop();
    if (!mesh) { mesh = new THREE.Mesh(pf.geom, this.mats2); this.scene.add(mesh); }
    mesh.geometry = pf.geom; mesh.visible = true;
    mesh.position.set(side.s * FACADE, 0, side.nextZ);
    mesh.scale.x = side.s < 0 ? 1 : -1;
    const lamps = [];
    for (const l of pf.lamps) {
      let g = this.lampPool.pop();
      if (!g) { g = this.glowSprite('#ffb85a', 2.6, 0.9); this.scene.add(g); }
      g.visible = true;
      g.position.set(side.s * FACADE - side.s * l.x, l.y, side.nextZ + l.z);
      lamps.push(g);
    }
    side.list.push({ mesh, z0: side.nextZ, w: pf.w, lamps, ph: r() * 6 });
    side.nextZ -= pf.w + (r.chance(0.12) ? 0.5 : 0);
  }
  updateVillage(camZ) {
    for (const side of this.sides) {
      while (side.nextZ > camZ - FAR_Z) this.placeHouse(side);
      while (side.list.length && side.list[0].z0 - side.list[0].w > camZ + 8) {
        const h = side.list.shift();
        h.mesh.visible = false; this.housePool.push(h.mesh);
        for (const g of h.lamps) { g.visible = false; this.lampPool.push(g); }
      }
      for (const h of side.list) for (const g of h.lamps) g.material.opacity = 0.75 + Math.sin(this.clock * 3 + h.ph) * 0.12;
    }
    while (this.nextBanner > camZ - FAR_Z * 0.8) {
      let m = this.bannerPool.pop();
      const geo = this.bannerR.pick(this.bannerGeo);
      if (!m) { m = new THREE.Mesh(geo, [new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), this.mat.unlit]); this.scene.add(m); }
      m.geometry = geo; m.visible = true;
      m.position.set(0, this.bannerR.range(9.3, 10.0), this.nextBanner);
      m.rotation.y = this.bannerR.range(-0.12, 0.12);
      this.banners.push(m);
      this.nextBanner -= this.bannerR.range(26, 40);
    }
    while (this.banners.length && this.banners[0].position.z > camZ + 8) { const m = this.banners.shift(); m.visible = false; this.bannerPool.push(m); }
    for (const m of this.banners) m.rotation.x = Math.sin(this.clock * 1.3 + m.position.z) * 0.04;
  }
  resetVillage(camZ) {
    for (const side of this.sides) {
      for (const h of side.list) { h.mesh.visible = false; this.housePool.push(h.mesh); for (const g of h.lamps) { g.visible = false; this.lampPool.push(g); } }
      side.list = []; side.nextZ = camZ + 20;
    }
    for (const m of this.banners) { m.visible = false; this.bannerPool.push(m); }
    this.banners = []; this.nextBanner = camZ - 8;
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
  createView(kind, e) {
    const root = new THREE.Group();
    const v = { kind, root, body: null, glow: null, shadow: null, t: Math.random() * 6 };
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
    } else if (kind === 'muretto') {
      v.body = new THREE.Mesh(this.geo.wall[e.id % 3], this.mats2); v.shadow = this.blob(3.0, 1.4);
    } else if (kind === 'pozza') {
      v.body = new THREE.Group();
      const rim = new THREE.Mesh(this.geo.puddleRim, this.mat.puddleRim); rim.position.y = 0.03;
      const w = new THREE.Mesh(this.geo.puddle, this.mat.puddle); w.position.y = 0.045;
      rim.renderOrder = 2; w.renderOrder = 3;
      v.body.add(rim, w);
    } else if (kind === 'goat') {
      v.body = new THREE.Mesh(this.geo.goat, this.mats2); v.shadow = this.blob(2.0, 1.1);
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
  narrowView(e) {
    const rows = Math.round((e.len + 6) / WORLD.ROW);
    const side = e.lane === 0 ? -1 : 1;
    const key = `${rows}`;
    let g = this.narrowCache.get(key);
    if (!g) { g = M.buildNarrow(400 + rows, e.len * U, FACADE - (WORLD.LANE_W - 17) * U + 0.3); this.narrowCache.set(key, g); }
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
    if (e.kind === 'narrow') v = this.narrowView(e);
    else {
      const pool = this.pools[e.kind] || (this.pools[e.kind] = []);
      v = pool.pop() || this.createView(e.kind, e);
      if (e.kind === 'tappeto') v.body.material = this.mat.carpet[(e.variant || 0) % 4];
    }
    v.root.visible = true; v.body.visible = true;
    if (v.glow) v.glow.visible = true;
    v.t = Math.random() * 6;
    v.dead = false; v.hitT = 0;
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
    this.pools[v.kind].push(v);
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
      if (e.done && !v.dead && (e.pickup || e.destroyed)) { v.dead = true; v.body.visible = false; if (v.glow) v.glow.visible = false; if (v.shadow) v.shadow.visible = !e.pickup && !e.destroyed; }
      if (v.dead) continue;
      v.t += dt;
      if (e.kind === 'tappeto') {
        v.body.position.y = 0.38 + Math.sin(t * 3.2 + e.d * 0.05) * 0.1;
        v.body.rotation.set(-Math.PI / 2 + 0.22 + Math.sin(t * 2.3 + e.d) * 0.05, 0, Math.sin(t * 1.7 + e.d) * 0.12);
        v.glow.position.y = 0.4;
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
        if (e.moving) { v.body.position.y = Math.abs(Math.sin(t * 12)) * 0.12; v.body.rotation.z = Math.sin(t * 12) * 0.05; }
      }
      if (e.hit && !v.hitT && e.kind !== 'pozza') v.hitT = 0.4;
      if (v.hitT > 0) { v.hitT = Math.max(0, v.hitT - dt); v.body.rotation.z = Math.sin(v.hitT * 40) * v.hitT * 0.4; }
    }
  }

  // ------------------------------------------------------------ effetti di gioco
  onFx(type, d, sim) {
    const pz = -sim.T * U;
    switch (type) {
      case 'spawn': this.spawnView(d); break;
      case 'despawn': this.despawnView(d); break;
      case 'shot': this.shotStart(d); break;
      case 'shotEnd': this.shotEnd(d); break;
      case 'barrel': this.barrelBurst(d); break;
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
      case 'hit': this.addShake(0.35, 0.28); this.smokeAtTip(12); this.burst(this.tipW.x, this.tipW.y, this.tipW.z, COL.spark, 26, 5); break;
      case 'die': this.smokeAtTip(30); break;
      case 'start': case 'attract': this.add.clear(); this.norm.clear(); this.shards.clear(); break;
      default: break;
    }
  }
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
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 5;
      this.shards.emit(p.x + (Math.random() - 0.5) * (big ? 2 : 1), 0.4 + Math.random() * (big ? 2.4 : 1.6), p.z + (Math.random() - 0.5) * (big ? 2 : 1),
        Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s * 0.7 + 2.2, COL.wood[i % 4], 0.7 + Math.random() * 0.7, 1.4 + Math.random() * 0.6);
    }
    for (let i = 0; i < (big ? 8 : 4); i++) this.shards.emit(p.x, 0.5 + Math.random() * 1.4, p.z, (Math.random() - 0.5) * 7, 4 + Math.random() * 4, (Math.random() - 0.5) * 5, COL.iron, 0.9, 1.6);
    for (let i = 0; i < (big ? 40 : 24); i++) this.norm.emit(p.x, 0.8 + Math.random(), p.z, (Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 5 + 1, 0.8, 0.32, 0.18, COL.wine, 1, 12, 0.6);
    for (let i = 0; i < 12; i++) this.norm.emit(p.x + (Math.random() - 0.5) * 1.5, 0.5 + Math.random(), p.z, (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2, 1.1, 1.0, 3.0, COL.dust, 0.5, 0, 1);
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
  updateMood(dt) {
    const tgt = MOODS[this.moodName];
    const k = 1 - Math.exp(-dt * 1.8);
    for (const key in tgt) {
      if (typeof tgt[key] === 'string') this.mood[key].lerp(_c.set(tgt[key]), k);
      else this.mood[key] += (tgt[key] - this.mood[key]) * k;
    }
    const m = this.mood;
    this.skyU.uTop.value.copy(m.top); this.skyU.uMid.value.copy(m.mid); this.skyU.uHor.value.copy(m.hor); this.skyU.uSun.value = m.sun;
    this.scene.fog.color.copy(m.fog); this.scene.fog.near = m.fogNear; this.scene.fog.far = m.fogFar;
    this.hemi.color.copy(m.hemiS); this.hemi.groundColor.copy(m.hemiG); this.hemi.intensity = m.hemiI;
    this.dir.color.copy(m.dirC); this.dir.intensity = m.dirI;
    this.far.material.color.copy(m.far);
    this.moon.material.opacity = m.moon; this.moon.visible = m.moon > 0.02;
    this.stars.material.opacity = m.moon * 0.9;
    this.sunGlow.material.opacity = 0.5 * m.sun;
    for (const c of this.clouds) c.material.color.copy(m.hor).lerp(_c2.set('#ffffff'), 0.35);
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
    this.updateMood(dt);
    // camera: preset per modalita' + inseguimento morbido
    const aspect = this.camera.aspect;
    const wide = Math.max(0, Math.min(1, (aspect - 0.5) / 0.3));
    let cp, cl, fov;
    if (view.cam === 'menu') { cp = _v.set(1.8, 2.2, pz + 16); cl = _v2.set(-0.3, 3.0, pz - 8); fov = 58; }
    else if (view.cam === 'over') { const ox = Math.max(-2.2, Math.min(2.2, px + 2.8)); cp = _v.set(ox, 10, pz + 14); cl = _v2.set(px + 1.0 + (ox - px - 2.8) * 0.3, -5.0, pz - 0.5); fov = 52; }
    else { cp = _v.set(px * 0.55, 6.0 - wide, pz + 9.6 - wide * 1.5); cl = _v2.set(px * 0.3, 1.8, pz - 15); fov = 64 - wide * 6; }
    const k = 1 - Math.exp(-dt * (view.cam === 'run' ? 7 : 2.6));
    this.camPos.lerp(cp, k);
    this.camLook.lerp(cl, k);
    // la camera non resta mai indietro rispetto al corridore
    const lagZ = cp.z - this.camPos.z;
    if (Math.abs(lagZ) > 6) { this.camPos.z = cp.z - Math.sign(lagZ) * 6; this.camLook.z = cl.z - Math.sign(lagZ) * 6; }
    this.camera.fov += (fov - this.camera.fov) * k; this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      const a = this.shakeAmp * Math.max(0, this.shake) * 2.5;
      this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a;
      if (this.shake <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();
    const camZ = this.camera.position.z;
    // cielo, lontananze
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.far.position.set(0, 0, camZ - FAR_Z);
    this.moon.position.set(this.camera.position.x - 70, 150, camZ - 300);
    this.sunGlow.position.set(this.camera.position.x + 60, 16, camZ - 360);
    for (const c of this.clouds) c.position.set(c.userData.x + this.camera.position.x * 0.0 + Math.sin(this.clock * 0.02 + c.userData.y) * 10, c.userData.y, camZ - 320 + c.userData.z);
    // strada (agganciata alla griglia della texture: sembra ferma nel mondo)
    const snap = Math.round(camZ / ROAD_W) * ROAD_W;
    this.road.position.z = snap - 110;
    const snapW = Math.round(camZ / 2.9) * 2.9;
    for (const w of this.walks) w.position.z = snapW - 110;
    for (const c of this.curbs) c.position.z = camZ - 110;
    this.base.position.set(0, -0.06, camZ - 150);
    this.updateVillage(camZ);
    this.animateViews(sim, dt);
    this.dir.position.set(px - 30, 40, pz - 25); this.dir.target.position.set(px, 0, pz);

    // personaggio
    const base = _v3.set(px, 0, pz);
    _right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    _up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const ch = this.character;
    ch.update(dt, view.char);
    ch.sprite.position.copy(base);
    this.charShadow.position.set(px + (view.char.downT > 0 ? 0.6 : 0), 0.03, pz);
    this.charShadow.scale.set(view.char.downT > 0 ? 3.4 : 2.2, 1, 1.3);
    ch.worldOf(this.tipW, base, _right, _up, ch.tip.x, ch.tip.y - 9);
    ch.worldOf(this.muzzleW, base, _right, _up, ch.muzzle.x, ch.muzzle.y);
    const fuelF = view.fuelF;
    const lit = view.char.flameOn;
    const flick = Math.sin(this.clock * 17) * 0.06 + Math.sin(this.clock * 29) * 0.05;
    this.flameLight.position.copy(this.tipW);
    this.flameLight.intensity = lit ? (10 + 18 * fuelF) * (1 + flick) + (this.flashBoost || 0) * 40 : 0;
    this.flashBoost = Math.max(0, (this.flashBoost || 0) - dt * 10);
    this.flameGlow.visible = lit;
    this.flameGlow.position.copy(this.tipW);
    this.flameGlow.scale.setScalar((2.2 + 1.8 * fuelF) * (1 + flick));
    this.groundGlow.visible = lit;
    this.groundGlow.position.set(px, 0.04, pz - 0.5);
    this.groundGlow.material.opacity = 0.18 + 0.2 * fuelF;
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
    this.renderer.render(this.scene, this.camera);
  }

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
      (this.pools[k] || (this.pools[k] = [])).push(v); this.scene.add(v.root); v.root.visible = false;
      if (v.shadow) v.shadow.visible = true; if (v.glow) v.glow.visible = true; if (v.ring) v.ring.visible = true;
    }
    this.scene.background = prevBg;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(prevPR);
    this.renderer.setSize(prevSize.x, prevSize.y, false);
    return out;
  }
}
