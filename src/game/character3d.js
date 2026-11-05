// =====================================================================
// Personaggio 3D (v4): GLB skinnato (MakeHuman/MPFB CC0 + abiti e
// frakkera modellati in Blender) con AnimationMixer e una piccola
// macchina a stati con crossfade:
//   IDLE (menu) -> RUN (velocita' -> timeScale) <-> LEFT/RIGHT (cambio
//   corsia, sincronizzate col passo) + STUMBLE (urto, one-shot) ->
//   GAMEOVER (rallenta, si ferma e pianta la frakkera, clamp finale).
// Sopra le animazioni: molla sull'osso 'carry' (oscillazione ritardata
// della frakkera nei cambi corsia). Nessuna allocazione per frame.
// Drop-in: qualsiasi GLB con le clip idle/run/left/right/stumble/gameover,
// un osso 'carry' (o 'frakkera') e un nodo 'frakkera_tip' funziona.
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { stramaHoodGeom, stramaCloakGeom } from './collect3d.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { buildMascot, MASCOT } from './mascot3d.js';

export const MODEL_URL = `${import.meta.env.BASE_URL}models/frakkera-man.glb`;
export const CHAR_SCALE = 1.6;         // il mondo e' "cartoon": uomo ~2.8 u, frakkera ~5.4 u
const RAISE_TILT = 0.3;
export const CLIP_NAMES = ['idle', 'run', 'left', 'right', 'stumble', 'gameover'];
const FADE = { idle: 0.35, run: 0.25, left: 0.09, right: 0.09, stumble: 0.08, gameover: 0.3 };

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const SEAT_Y = 0.05;
const SEAT = { thigh: -1.35, calf: 1.45, spine: 0 };   // v5s22: posa seduta nel carrello (radianti, asse laterale)
const DUCK_LEAN = 0.32, DUCK_TILT = -0.85;   // v5s6: piega del corpo e inclinazione della frakkera nell'abbassata
const AX_FWD = new THREE.Vector3(0, 0, 1), AX_SIDE = new THREE.Vector3(1, 0, 0);
// v5c: frakkera in spalla per la mascotte (spazio del modello a riposo, metri: y su, +z avanti, -x destra)
const SHOULDER = {
  FRK_K: 0.7, FLAME_K: 0.78,                                         // v5s29b: frakkera della mascotte piu' piccola del 30%
  P: new THREE.Vector3(-0.27, 1.47, -0.07),            // asse del fascio sopra la spalla destra (punto d'appoggio)
  // diagonale "a fucile": la base davanti al fianco destro, la punta sale indietro lungo la schiena
  D_RUN: new THREE.Vector3(-0.14, 0.8, -0.6).normalize(),   // nella corsa (il busto e' piegato in avanti)
  D_IDLE: new THREE.Vector3(-0.16, 0.86, -0.42).normalize(), // da fermo, nel ballo finito e nel game over
  SLIDE: 0.05,
  GRIP_R: [-0.2, new THREE.Vector3(-0.03, 0, 0.09)],   // mano destra: [lungo l'asse dal punto d'appoggio, scostamento]
  GRIP_L: [-0.5, new THREE.Vector3(0.05, -0.02, 0.12)], // mano sinistra, piu' in basso davanti alla pancia
  POLE_R: new THREE.Vector3(-0.65, 1.0, 0.15), POLE_L: new THREE.Vector3(0.55, 0.85, 0.35),
  DUCK_TILT: 0.45,                                      // nell'abbassata il fascio si corica ancora un po' indietro
  STRAIGHT_CALF: 0.55, STRAIGHT_THIGH: 0.85, SPINE_BACK: -0.14, BOB: 0.035,   // corsa piu' dritta e saltellante
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const sstep = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const PISTOL_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // canna +x -> avanti (-z)

export class Character3D {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.ready = false; this.failed = false; this.error = null;
    this.state = 'idle'; this.stateT = 0; this.stumbleT = -1;
    this.actions = {}; this.w = {}; this.tw = {};
    for (const k of CLIP_NAMES) { this.w[k] = k === 'idle' ? 1 : 0; this.tw[k] = 0; }
    this.facing = -0.45;            // ~0 = guarda la camera del menu (+z), PI = corre verso -z
    this.spring = { a: 0, v: 0, p: 0, pv: 0 };
    this.frame = 0; this.phase = 0; this.leanSig = 0;
    this.rec = { lean: 0, stumble: 0, over: 0, idle: 0, run: 0, states: ['idle'], stumbles: 0 };
    this.tipW = new THREE.Vector3(0, 5, 0); this.muzzleW = new THREE.Vector3(0, 2, 0);
    this.stats = { triangles: 0, meshes: 0, bones: 0, clips: [] };
    this.pistol = null;
    if (opts.pistolGeo) {
      this.pistol = new THREE.Mesh(opts.pistolGeo, opts.pistolMat);
      this.pistol.scale.setScalar(0.2); this.pistol.visible = false; this.pistol.frustumCulled = false;
      scene.add(this.pistol);
      this.muzzleLocal = new THREE.Vector3(1.0, 0.32, 0);
    }
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    this.promise = loader.loadAsync(opts.url || MODEL_URL).then((g) => this.setup(g)).catch((e) => {
      this.failed = true; this.error = String(e && e.message || e);
      console.warn('[frakkera] modello 3D non caricato, uso il fallback sprite:', this.error);
    });
  }

  setup(gltf) {
    const m = gltf.scene;
    m.scale.setScalar(CHAR_SCALE);
    let tris = 0, meshes = 0;
    m.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      o.frustumCulled = false;
      const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const mt = o.material;
      if (mt.transparent || mt.alphaTest > 0 || /hair|brow/i.test(mt.name)) { mt.transparent = false; mt.alphaTest = 0.5; mt.depthWrite = true; }
      if (/frakkera/i.test(mt.name)) { mt.roughness = 1; mt.metalness = 0; mt.emissive.setRGB(0.07, 0.045, 0.025); mt.transparent = true; mt.opacity = 1; this.frkMat = mt; (this.frkParts || (this.frkParts = [])).push(o); }
      else {
        if (mt.map) { mt.emissiveMap = mt.map; mt.emissive.setRGB(0.32, 0.27, 0.24); }   // luce di riempimento (il sole e' davanti, la camera dietro)
        (this.bodyMats || (this.bodyMats = [])).push({ mt, col: mt.color.clone(), em: mt.emissive.clone() });
      }
      mt.envMapIntensity = 0;
    });
    this.model = m;
    this.root.add(m);
    m.updateMatrixWorld(true);
    { const J = {}, v = new THREE.Vector3(); m.traverse((o) => { if (o.isBone) { o.getWorldPosition(v); m.worldToLocal(v); J[o.name] = v.toArray(); } }); this.restJ = J; }
    this.classicMeshes = []; m.traverse((o) => { if (o.isSkinnedMesh) this.classicMeshes.push(o); });
    try { this.setupMascot(m, gltf); } catch (e) { console.warn('[frakkera] mascotte non costruita:', e); this.mascot = null; }
    if (this.mascot) { const mt = this.mascot.mat; (this.bodyMats || (this.bodyMats = [])).push({ mt, col: mt.color.clone(), em: mt.emissive.clone() }); }
    this.bones = {
      carry: m.getObjectByName('carry') || m.getObjectByName('frakkera'),
      hand: m.getObjectByName('hand_r'),
      tip: m.getObjectByName('frakkera_tip'),
    };
    this.mixer = new THREE.AnimationMixer(m);
    for (const c of gltf.animations) {
      const a = this.mixer.clipAction(c);
      if (c.name === 'stumble' || c.name === 'gameover') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      a.enabled = true; a.setEffectiveWeight(this.w[c.name] || 0); a.play();
      this.actions[c.name] = a;
    }
    let bones = 0; m.traverse((o) => { if (o.isBone) bones++; });
    this.stats = { triangles: tris, meshes, bones, clips: gltf.animations.map((c) => c.name), mascotTriangles: this.mascot ? this.mascot.triangles : 0 };
    this.stats.classicTriangles = tris;
    this.stats.frakkeraTriangles = (this.frkParts || []).reduce((n, o) => n + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3, 0);
    if (this.mascot) this.applyMascotVis();
    this.ready = !!(this.actions.idle && this.actions.run && this.bones.tip);
    if (this.ready) this.buildSkins();
    this.ready = !!(this.actions.idle && this.actions.run && this.bones.tip);
    if (this.ready) this.setupBurn();
    if (!this.ready) { this.failed = true; this.error = 'GLB senza clip/nodi richiesti'; }
    this.root.visible = this.ready;
  }

  // v5s19: costumi. 'stramaioni': viso nero di fuliggine, stracci scuri, cappuccio e mantello di orbace
  buildSkins() {
    const m = this.model; this.skinParts = [];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
    mat.emissive.setRGB(0.025, 0.022, 0.02); mat.color.setRGB(0.75, 0.75, 0.75);
    const attach = (boneName, geo, pos, sc) => {
      const b = m.getObjectByName(boneName); if (!b) return;
      m.updateMatrixWorld(true);
      const ws = new THREE.Vector3(); b.getWorldScale(ws);
      const o = new THREE.Mesh(geo, mat); o.frustumCulled = false;
      o.scale.setScalar(sc / ws.x); o.position.copy(pos).divideScalar(ws.x);
      o.visible = false; b.add(o); this.skinParts.push(o);
    };
    attach('head', stramaHoodGeom(), new THREE.Vector3(0, 0.06, -0.01), 1.6);
    attach('spine_03', stramaCloakGeom(), new THREE.Vector3(0, 0.25, 0), 1.6);
    if (this.skinId) this.setSkin(this.skinId);
  }
  setSkin(id) {
    this.skinId = id;
    if (!this.model || !this.bodyMats) return;
    const st = id === 'stramaioni';
    const DARK = { skin: '#1c1a18', shirt_trousers: '#2c2824', waistcoat: '#1f1c19', cap: '#1d1a17', shoes: '#151210', hair: '#151312', eyebrows: '#151312' };
    for (const b of this.bodyMats) {
      if (!b.col0) { b.col0 = b.col.clone(); b.em0 = b.em.clone(); }
      const c = st && DARK[b.mt.name];
      if (c) { b.col.set(c); if (b.mt.name === 'skin') b.em.setRGB(0.03, 0.028, 0.026); else b.em.setRGB(0.06, 0.055, 0.05); }
      else { b.col.copy(b.col0); b.em.copy(b.em0); }
      b.mt.color.copy(b.col); b.mt.emissive.copy(b.em);
    }
    for (const o of this.skinParts || []) o.visible = st;
    this.model.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'cap') o.visible = !st; });
    this.applyMascotVis();
  }
  // v5c: la mascotte e' la skin 'base' (default); 'classico' e 'stramaioni' usano il modello umano di prima
  applyMascotVis() {
    const on = this.isMascot = !!this.mascot && (!this.skinId || this.skinId === 'base');
    this.flameScale = on ? SHOULDER.FLAME_K : 1;
    if (!this.mascot) return;
    this.mascot.mesh.visible = on;
    for (const o of this.classicMeshes) o.visible = !on && !(o.material.name === 'cap' && this.skinId === 'stramaioni');
    if (!on) { this.model.position.y = 0; for (const b of this.legBones) b.scale.setScalar(1); this.frkBone.scale.setScalar(1); }
    if (this.stats.classicTriangles) this.stats.triangles = on ? this.mascot.triangles + this.stats.frakkeraTriangles : this.stats.classicTriangles;   // v5s29b: triangoli del personaggio visibile
  }

  setupMascot(m, gltf) {
    this.mascot = buildMascot(m, this.restJ);
    this.legBones = [m.getObjectByName('thigh_l'), m.getObjectByName('thigh_r')];
    const carry = m.getObjectByName('carry'), frk = m.getObjectByName('frakkera'), sp = m.getObjectByName('spine_03'), tip = m.getObjectByName('frakkera_tip');
    this.frkBone = frk; this.frkRest = frk.position.clone(); this.spine3 = sp;
    this.restQ = {}; for (const n of ['thigh_l', 'thigh_r', 'calf_l', 'calf_r']) this.restQ[n] = m.getObjectByName(n).quaternion.clone();
    this.feet = ['foot_l', 'foot_r', 'ball_l', 'ball_r'].map((n) => m.getObjectByName(n));
    this.footH = [this.restJ.foot_l[1], this.restJ.foot_r[1], this.restJ.ball_l[1], this.restJ.ball_r[1]].map((y) => y * MASCOT.LEG_K * CHAR_SCALE);
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
    const Mc = inv.clone().multiply(carry.matrixWorld), Ms = inv.clone().multiply(sp.matrixWorld);
    const pc = new THREE.Vector3(), qc = new THREE.Quaternion(), sc = new THREE.Vector3(); Mc.decompose(pc, qc, sc);
    const tipM = tip.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const A0 = tipM.clone().sub(pc).normalize();
    const S = SHOULDER, iMs = Ms.clone().invert();
    const sh = { qRef: new THREE.Quaternion() };
    sh.axC = tipM.clone().applyMatrix4(Mc.clone().invert()).normalize();
    sh.slide = S.SLIDE;
    // due pose della frakkera in spalla (corsa / ferma), ognuna con le prese delle mani nel riferimento del fascio
    const pose = (D) => {
      const Mn = new THREE.Matrix4().compose(S.P, new THREE.Quaternion().setFromUnitVectors(A0, D).multiply(qc), sc), iMn = Mn.clone().invert();
      const o = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
      iMs.clone().multiply(Mn).decompose(o.p, o.q, new THREE.Vector3());
      const g = (G) => S.P.clone().addScaledVector(D, G[0]).add(G[1]).applyMatrix4(iMn);
      o.gripR = g(S.GRIP_R); o.gripL = g(S.GRIP_L);
      return o;
    };
    sh.run = pose(S.D_RUN); sh.idle = pose(S.D_IDLE);
    sh.poleR = S.POLE_R.clone().applyMatrix4(iMs); sh.poleL = S.POLE_L.clone().applyMatrix4(iMs);
    sh.q = new THREE.Quaternion(); sh.p = new THREE.Vector3(); sh.gR = new THREE.Vector3(); sh.gL = new THREE.Vector3();
    const run = gltf.animations.find((c) => c.name === 'run'), tr = run && run.tracks.find((t) => t.name === 'carry.quaternion');
    if (tr) sh.qRef.fromArray(tr.values, 0); else sh.qRef.copy(carry.quaternion);
    this.sh = sh; this.runK = 0;
    this.arm = {
      r: ['upperarm_r', 'lowerarm_r', 'hand_r'].map((n) => m.getObjectByName(n)),
      l: ['upperarm_l', 'lowerarm_l', 'hand_l'].map((n) => m.getObjectByName(n)),
    };
    this.isMascot = true;
    for (const o of this.classicMeshes) o.visible = false;
  }
  // v5c: il mixer scrive un canale solo se il valore della clip cambia: prima di ogni update si rimettono
  // le ossa ritoccate (frakkera in spalla, IK delle braccia, molla) al valore della clip, cosi' i ritocchi non si sommano
  mix(dt) {
    const T = this.touched || (this.touched = ['carry', 'frakkera', 'upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'spine_01'].map((n) => this.model.getObjectByName(n)).filter(Boolean).map((b) => ({ b, p: b.position.clone(), q: b.quaternion.clone(), ok: false })));
    for (const t of T) if (t.ok) { t.b.position.copy(t.p); t.b.quaternion.copy(t.q); }
    this.mixer.update(dt);
    for (const t of T) { t.p.copy(t.b.position); t.q.copy(t.b.quaternion); t.ok = true; }
  }
  // dopo il mixer: gambe corte, corpo abbassato, frakkera in diagonale sulla spalla (peso w)
  // k: 1 = posa di corsa, 0 = posa da fermo (la frakkera resta SEMPRE in spalla)
  mascotPre(k) {
    if (!this.isMascot) return;
    const S = this.sh, c = this.bones.carry, f = this.frkBone;
    for (const b of this.legBones) b.scale.setScalar(MASCOT.LEG_K);
    // corsa piu' dritta: ginocchia e anche meno piegate, busto un po' indietro (solo grafica)
    const run = this.state === 'run' && !(this.cartK > 0.5);
    if (run) {
      for (const n of ['calf_l', 'calf_r']) { const b = this.model.getObjectByName(n); b.quaternion.slerp(this.restQ[n], 1 - SHOULDER.STRAIGHT_CALF); }
      for (const n of ['thigh_l', 'thigh_r']) { const b = this.model.getObjectByName(n); b.quaternion.slerp(this.restQ[n], 1 - SHOULDER.STRAIGHT_THIGH); }
      const sp1 = this.model.getObjectByName('spine_01');
      sp1.parent.updateWorldMatrix(true, false); sp1.parent.getWorldQuaternion(_q2).invert(); this.model.getWorldQuaternion(_q);
      _v.copy(AX_SIDE).applyQuaternion(_q).applyQuaternion(_q2); _q.setFromAxisAngle(_v, SHOULDER.SPINE_BACK); sp1.quaternion.premultiply(_q);
    }
    // frakkera in spalla: oscillazione della clip solo nella corsa
    _qa.copy(S.qRef).invert().multiply(c.quaternion);
    _qa.copy(_qi.identity().slerp(_qa, k));
    S.q.copy(S.idle.q).slerp(S.run.q, k); S.p.lerpVectors(S.idle.p, S.run.p, k);
    S.gR.lerpVectors(S.idle.gripR, S.run.gripR, k); S.gL.lerpVectors(S.idle.gripL, S.run.gripL, k);
    c.quaternion.copy(S.q).multiply(_qa); c.position.copy(S.p);
    f.position.copy(this.frkRest).addScaledVector(S.axC, S.slide);
    f.scale.setScalar(SHOULDER.FRK_K);
  }
  // piedi a terra: il corpo (gambe corte, pose ritoccate) scende o sale finche' il piede piu' basso tocca il suolo
  mascotGround(phase) {
    const m = this.model;
    if (this.cartK > 0.5) { m.position.y = -this.mascot.drop * CHAR_SCALE * (1 - this.cartK); return; }
    m.position.y = 0; this.root.updateMatrixWorld(true);
    let lo = Infinity;
    this.feet.forEach((b, i) => { b.getWorldPosition(_t); this.root.worldToLocal(_t); lo = Math.min(lo, _t.y - this.footH[i]); });
    const bob = this.state === 'run' ? SHOULDER.BOB * CHAR_SCALE * Math.abs(Math.sin(2 * Math.PI * phase)) : 0;
    m.position.y = -lo + bob;
    this.root.updateMatrixWorld(true);
  }
  // ruota l'osso (in coordinate mondo) perche' la direzione 'from' vada su 'to', con peso w
  rotTo(bone, from, to, w) {
    _qa.setFromUnitVectors(from.normalize(), to.normalize());
    if (w < 1) _qa.copy(_qi.identity().slerp(_qa, w));
    bone.getWorldQuaternion(_qb);
    _qb.premultiply(_qa);
    bone.parent.getWorldQuaternion(_q2);
    bone.quaternion.copy(_q2.invert().multiply(_qb));
    bone.updateMatrixWorld(true);
  }
  // IK a due ossa (spalla-gomito-polso) verso T, gomito verso il polo P
  ik2(ch, T, P, w) {
    const [up, lo, hd] = ch;
    up.getWorldPosition(_a); lo.getWorldPosition(_b); hd.getWorldPosition(_c);
    const a = _a.distanceTo(_b), b = _b.distanceTo(_c);
    _d.subVectors(T, _a); const c = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, _d.length())); _d.normalize();
    const ca = (a * a + c * c - b * b) / (2 * a * c), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    _e.subVectors(P, _a); _e.addScaledVector(_d, -_e.dot(_d)).normalize();
    _p.copy(_a).addScaledVector(_d, a * ca).addScaledVector(_e, a * sa);      // gomito desiderato
    this.rotTo(up, _t.subVectors(_b, _a), _p.sub(_a), w);
    lo.getWorldPosition(_b); hd.getWorldPosition(_c);
    _p.copy(_a).addScaledVector(_d, c);
    this.rotTo(lo, _t.subVectors(_c, _b), _p.sub(_b), w);
  }
  mascotIK(phase) {
    if (!this.isMascot) return;
    const S = this.sh, c = this.bones.carry, M = this.spine3.matrixWorld;
    this.ik2(this.arm.r, S.gR.clone().applyMatrix4(c.matrixWorld), S.poleR.clone().applyMatrix4(M), 1);
    this.ik2(this.arm.l, S.gL.clone().applyMatrix4(c.matrixWorld), S.poleL.clone().applyMatrix4(M), 1);
  }
  // anteprima (scheda del personaggio): stessa posa del gioco per una clip ferma
  posePreview(clip, t) {
    if (!this.isMascot) return;
    const st = this.state; this.state = clip === 'idle' ? 'idle' : 'run';
    this.mascotPre(clip === 'idle' ? 0 : 1); this.mascotGround(t || 0); this.mascotIK(t || 0); this.root.updateMatrixWorld(true);
    this.state = st;
  }

  stumble() {
    if (!this.ready || this.state !== 'run') return;
    this.stumbleT = 0; this.rec.stumbles++;
    const a = this.actions.stumble; if (a) { a.reset(); a.play(); }
  }

  // st: stato del personaggio da game.js (mode, speed, vx, invuln, armed, recoil...)
  update(dt, st, px, pz) {
    if (!this.ready) return;
    const want = st.mode === 'attract' ? 'idle' : (st.mode === 'run' || st.mode === 'dance') ? 'run' : 'over';
    if (want !== this.state) {
      const prev = this.state;
      this.state = want; this.stateT = 0;
      if (want === 'over') { const a = this.actions.gameover; if (a) { a.reset(); a.play(); } this.stumbleT = -1; }
      if (want === 'run' && prev !== 'run') { this.actions.run.time = 0; }
    }
    this.stateT += dt;
    const sd = this.actions.stumble ? this.actions.stumble.getClip().duration : 0.8;
    if (this.stumbleT >= 0) { this.stumbleT += dt; if (this.stumbleT > sd) this.stumbleT = -1; }
    // pesi bersaglio
    const T = this.tw;
    for (const k of CLIP_NAMES) T[k] = 0;
    if (this.state !== 'run') this.lastLane = st.targetLane;
    if (this.state === 'idle') T.idle = 1;
    else if (this.state === 'over') T.gameover = 1;
    else {
      // segnale di inclinazione: sale subito col cambio corsia, poi cala piano (il corpo resta inclinato ~0.35 s)
      let raw = Math.max(-1, Math.min(1, -(st.vx || 0) * 2.2));
      // nuovo cambio di corsia: impulso pieno anche se il frame e' lento e vx e' gia' tornato a 0
      if (st.targetLane !== undefined && this.lastLane !== undefined && st.targetLane !== this.lastLane) {
        raw = st.targetLane < this.lastLane ? 1 : -1; this.leanSig = raw;
        this.kick(raw * 0.9, 0);
      }
      this.lastLane = st.targetLane;
      if (Math.abs(raw) > Math.abs(this.leanSig) || (raw !== 0 && Math.sign(raw) !== Math.sign(this.leanSig))) this.leanSig = raw;
      else this.leanSig += (raw - this.leanSig) * Math.min(1, dt * 3.2);
      const l = this.leanSig;
      const s = this.stumbleT >= 0 && this.stumbleT < sd - 0.22 ? 1 : 0;
      T.stumble = s;
      const r = 1 - s;
      T.left = Math.max(0, l) * r; T.right = Math.max(0, -l) * r; T.run = (1 - Math.abs(l)) * r;
      if (st.cart) { T.idle = T.run + T.left + T.right + T.stumble; T.run = 0; T.left = 0; T.right = 0; T.stumble = 0; }   // v5s20: seduto nel carrello anche cambiando binario o urtando   // v5s18: in piedi nel carrello
    }
    let sum = 0;
    for (const k of CLIP_NAMES) {
      const a = this.actions[k]; if (!a) continue;
      const rate = dt / (T[k] > this.w[k] ? FADE[k] : Math.max(0.12, FADE[k] * 0.8));
      this.w[k] += Math.max(-rate, Math.min(rate, T[k] - this.w[k]));
      sum += this.w[k];
    }
    sum = sum > 1e-4 ? sum : 1;
    for (const k of CLIP_NAMES) { const a = this.actions[k]; if (a) a.setEffectiveWeight(this.w[k] / sum); }
    // registro per i test (massimi raggiunti)
    const R = this.rec;
    R.lean = Math.max(R.lean, this.w.left + this.w.right); R.stumble = Math.max(R.stumble, this.w.stumble);
    R.over = Math.max(R.over, this.w.gameover); R.idle = Math.max(R.idle, this.w.idle); R.run = Math.max(R.run, this.w.run);
    if (R.states[R.states.length - 1] !== this.state) R.states.push(this.state);
    // velocita' della corsa e sincronia del passo
    const sp = st.speed || 0;
    const ts = this.state === 'run' ? 0.95 + Math.max(0, Math.min(1, (sp - 82) / 158)) * 0.55 : 1;
    const run = this.actions.run;
    run.timeScale = st.raise ? 0.62 : ts;          // v5s11: nel ballo passo lento
    for (const k of ['left', 'right']) { const a = this.actions[k]; if (a) { a.timeScale = ts; a.time = run.time; } }
    this.mix(dt);
    this.phase = run.time / run.getClip().duration;
    this.runK += ((this.state === 'run' ? 1 : 0) - this.runK) * Math.min(1, dt * 4);
    this.mascotPre(this.runK);
    this.frame = Math.floor(((this.phase + 0.75) % 1) * 4);
    // posizione e orientamento
    let fTarget = this.state === 'idle' ? -0.45 : this.state === 'over' ? (this.stateT > 1.0 ? Math.PI + 1.15 : Math.PI) : Math.PI;
    fTarget += Math.PI * 2 * Math.round((this.facing - fTarget) / (Math.PI * 2));
    this.facing += (fTarget - this.facing) * Math.min(1, dt * (this.state === 'run' ? 7 : this.state === 'over' ? 1.6 : 2.5));
    this.root.position.set(px, 0, pz);
    this.root.rotation.y = this.facing + (this.state === 'run' ? (st.vx || 0) * 0.22 : 0);
    this.cartK = (this.cartK || 0) + ((st.cart ? 1 : 0) - (this.cartK || 0)) * Math.min(1, dt * 8);
    if (this.cartK > 1e-3) this.root.position.y = SEAT_Y * this.cartK;   // v5s20: dentro il carrello (le gambe restano nascoste dalle sponde)
    if (st.jumpH > 0) { this.root.position.y += st.jumpH * 0.16; }   // v5s25: salto piu' alto e visibile (px -> m)
    if (st.danceRy != null) { this.root.rotation.y = st.danceRy; this.root.position.y = st.danceHop || 0; }   // v5s11: nel cerchio del ballo
    // lampeggio durante l'invulnerabilita'
    this.model.visible = !(st.invuln > 0 && Math.floor(st.invuln * 14) % 2);
    // v5s6: abbassata (swipe giu'): corsa accovacciata = corpo compresso e piegato in avanti,
    // frakkera inclinata in avanti e piu' bassa per passare sotto le travi
    const dk = this.state === 'run' && st.duck > 0 ? 1 : 0;
    this.duckK = (this.duckK || 0) + (dk - (this.duckK || 0)) * Math.min(1, dt * (dk ? 18 : 9));
    const k = this.duckK;
    // v5s27: squash & stretch nel salto: allungato in salita/discesa, schiacciato un attimo all'atterraggio
    const jh = Math.max(0, st.jumpH || 0) / 15, prevJ = this.prevJH || 0;
    if (prevJ > 0.02 && jh <= 0) this.landT = 0.2;
    this.prevJH = jh;
    this.landT = Math.max(0, (this.landT || 0) - dt);
    let jy = 1, jx = 1;
    if (jh > 0) { jy = 1 + 0.12 * (1 - jh); jx = 1 - 0.05 * (1 - jh); }
    else if (this.landT > 0) { const q = Math.sin(Math.PI * (this.landT / 0.2)); jy = 1 - 0.16 * q; jx = 1 + 0.08 * q; }
    this.root.scale.set((1 + 0.08 * k) * jx, (1 - 0.34 * k) * jy, (1 + 0.08 * k) * jx);
    this.model.rotation.x = DUCK_LEAN * k;
    R.duck = Math.max(R.duck || 0, k);
    // molla sull'osso della presa: la frakkera arriva in ritardo nei cambi di corsia
    const sg = this.spring;
    const tgt = this.state === 'run' ? -(st.vx || 0) * 0.16 : 0;
    sg.v += ((tgt - sg.a) * 70 - sg.v * 7.5) * dt; sg.a += sg.v * dt;
    sg.pv += ((0 - sg.p) * 55 - sg.pv * 6) * dt; sg.p += sg.pv * dt;
    const c = this.bones.carry;
    this.raiseK = (this.raiseK || 0) + ((st.raise ? 1 : 0) - (this.raiseK || 0)) * Math.min(1, dt * 4);
    if (c && (Math.abs(sg.a) > 1e-4 || Math.abs(sg.p) > 1e-4 || k > 1e-3 || this.raiseK > 1e-3)) {
      c.parent.updateWorldMatrix(true, false);
      c.parent.getWorldQuaternion(_q2).invert();
      // assi del modello (avanti / lato) nello spazio del genitore dell'osso
      _v.copy(AX_FWD).applyQuaternion(this.root.quaternion).applyQuaternion(_q2);
      _q.setFromAxisAngle(_v, sg.a); c.quaternion.premultiply(_q);
      _v.copy(AX_SIDE).applyQuaternion(this.root.quaternion).applyQuaternion(_q2);
      _q.setFromAxisAngle(_v, sg.p + (this.isMascot ? SHOULDER.DUCK_TILT : DUCK_TILT) * k + RAISE_TILT * this.raiseK); c.quaternion.premultiply(_q);   // v5s11: frakkera alzata nel ballo
    }
    // v5s22: seduto nel carrello: cosce in avanti, ginocchia piegate, busto un po' indietro
    if (this.cartK > 1e-3) {
      const ck = this.cartK;
      const bend = (name, ang) => { const b = this.model.getObjectByName(name); if (!b) return; b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(_q2).invert(); _v.copy(AX_SIDE).applyQuaternion(this.root.quaternion).applyQuaternion(_q2); _q.setFromAxisAngle(_v, ang * ck); b.quaternion.premultiply(_q); };
      this.seatBones = this.seatBones || true;
      bend('thigh_l', SEAT.thigh); bend('thigh_r', SEAT.thigh); bend('calf_l', SEAT.calf); bend('calf_r', SEAT.calf); bend('spine_01', SEAT.spine);
    }
    this.root.updateMatrixWorld(true);
    if (this.isMascot) { this.mascotGround(this.phase); this.mascotIK(this.phase); this.root.updateMatrixWorld(true); }
    this.bones.tip.getWorldPosition(this.tipW);
    // pistola nella mano destra (orientata sempre in avanti)
    if (this.pistol) {
      const on = !!st.armed && this.state === 'run';
      this.pistol.visible = on && this.model.visible;
      if (this.bones.hand) {
        this.bones.hand.getWorldPosition(this.pistol.position);
        this.pistol.position.y += 0.05;
        this.pistol.quaternion.copy(PISTOL_Q);
        this.pistol.rotation.z += (st.recoil > 0 ? 0.35 : 0);
        this.pistol.updateMatrixWorld();
        this.muzzleW.copy(this.muzzleLocal).applyMatrix4(this.pistol.matrixWorld);
      }
    }
  }
  // ---- v5: consumo progressivo della frakkera (taglio nello shader lungo l'asse dei fusti)
  setupBurn() {
    this.keep = 1; this.burnU = [];
    m: for (const o of this.frkParts || []) {
      this.model.updateMatrixWorld(true);
      const g = o.geometry, p = g.attributes.position;
      const tipL = o.worldToLocal(this.bones.tip.getWorldPosition(new THREE.Vector3()));
      g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
      const ax = tipL.clone().sub(c).normalize();
      let mn = Infinity, mx = -Infinity; const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const d = v.sub(c).dot(ax); if (d < mn) mn = d; if (d > mx) mx = d; }
      if (!Number.isFinite(mn)) continue m;
      const base = c.clone().addScaledVector(ax, mn), len = Math.max(0.01, tipL.clone().sub(base).dot(ax));
      const u = { uBase: { value: base }, uAxis: { value: ax }, uLen: { value: len }, uKeep: { value: 1.5 }, uEmber: { value: 1 } };
      this.burnU.push(u);
      if (this.bones.tip.parent === o) this.tipRest = { base, ax, len: tipL.clone().sub(base).dot(ax), off: tipL.clone().sub(base.clone().addScaledVector(ax, tipL.clone().sub(base).dot(ax))) };
      const mt = o.material;
      const prev = mt.onBeforeCompile;
      mt.onBeforeCompile = (sh, r) => {
        prev?.(sh, r);
        Object.assign(sh.uniforms, u);
        sh.vertexShader = 'varying vec3 vFrk;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFrk = position;');
        sh.fragmentShader = 'varying vec3 vFrk; uniform vec3 uBase; uniform vec3 uAxis; uniform float uLen; uniform float uKeep; uniform float uEmber;\n' + sh.fragmentShader
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  float frkH = dot(vFrk - uBase, uAxis) / uLen;\n  if (frkH > uKeep) discard;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float frkC = smoothstep(uKeep - 0.07, uKeep, frkH);\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.035, 0.025), frkC);\n  totalEmissiveRadiance += vec3(1.0, 0.32, 0.05) * smoothstep(uKeep - 0.025, uKeep, frkH) * uEmber * 1.6;');
      };
      mt.customProgramCacheKey = () => 'frkburn';
      mt.needsUpdate = true;
    }
    this.tipNode = this.bones.tip;
  }
  // quota di frakkera rimasta (1 = intera). Il carburante 0..1 la accorcia fino al 38%.
  applyKeep(k) {
    this.keep = k;
    for (const u of this.burnU || []) u.uKeep.value = k >= 0.999 ? 1.5 : k;
    const t = this.tipRest;
    if (t) this.tipNode.position.copy(t.base).addScaledVector(t.ax, t.len * Math.min(1, k + 0.012)).add(t.off);
  }
  setFuel(f, dt) {
    if (!this.ready) return;
    const want = 0.38 + 0.62 * Math.max(0, Math.min(1, f));
    const k = this.keep ?? 1;
    this.applyKeep(k + (want - k) * Math.min(1, dt * (want > k ? 3 : 6)));
    if (this.sootK) this.setSoot(0);
  }
  // game over: la frakkera brucia fino alle mani, il personaggio resta solo annerito dalla fuliggine (cartoon)
  setBurn(keep, soot) {
    if (!this.ready) return;
    if (keep == null) { this.applyKeep(1); this.setSoot(0); return; }
    this.applyKeep(keep); this.setSoot(soot);
  }
  setSoot(k) {
    this.sootK = k;
    for (const b of this.bodyMats || []) { b.mt.color.copy(b.col).multiplyScalar(1 - 0.6 * k); b.mt.emissive.copy(b.em).multiplyScalar(1 - 0.75 * k); }
  }
  // dissolvenza della frakkera quando copre ostacoli in arrivo (0..1)
  setOcclusion(target, dt) {
    if (!this.frkMat) return;
    this.occ = (this.occ ?? 1) + (target - (this.occ ?? 1)) * Math.min(1, dt * 8);
    for (const o of this.frkParts || [this.frkMat && { material: this.frkMat }]) { o.material.opacity = this.occ; o.material.depthWrite = this.occ > 0.95; }
  }
  // impulso alla molla (urti)
  kick(a, p) { this.spring.v += a; this.spring.pv += p; }
  tipWorld(out) { return out.copy(this.tipW); }
  muzzleWorld(out) { return out.copy(this.muzzleW); }
  resetRec() { this.rec = { lean: 0, stumble: 0, over: 0, idle: 0, run: 0, states: [this.state], stumbles: 0 }; }
  debug() {
    const w = {}; for (const k of CLIP_NAMES) w[k] = +this.w[k].toFixed(3);
    w.lean = +this.leanSig.toFixed(3);
    return { ready: this.ready, failed: this.failed, state: this.state, stateT: +this.stateT.toFixed(2), stumbling: this.stumbleT >= 0, weights: w, phase: +this.phase.toFixed(3), facing: +this.facing.toFixed(3), spring: +this.spring.a.toFixed(4), frkOpacity: this.frkMat ? +this.frkMat.opacity.toFixed(2) : null, keep: +(this.keep ?? 1).toFixed(3), soot: +(this.sootK || 0).toFixed(2), burnParts: (this.burnU || []).length, tipOnFrk: !!this.tipRest, rec: this.rec, stats: this.stats };
  }
}
