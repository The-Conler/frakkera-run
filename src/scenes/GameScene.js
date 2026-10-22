// =====================================================================
// Scena di gioco: simulazione a passo fisso (indipendente dal frame rate)
// + rendering pixel art. Comunica con l'interfaccia HTML tramite `bus`.
// =====================================================================
import Phaser from 'phaser';
import { SCORE, FUEL, WORLD, PX_PER_METER, PISTOL } from '../config.js';
import { Generator, SOLID, DESTRUCTIBLE, PICKUP_KINDS, difficultyAt, speedAt, lerp } from '../systems/generator.js';
import { randomSeed } from '../systems/rng.js';
import { buildStaticTextures, buildLayoutTextures, HOUSE_VARIANTS, COBBLE_H } from '../art/textures.js';
import { audio } from '../systems/audio.js';
import { getBest, addCarpets, getCarpetTotal } from '../systems/storage.js';
import { bus } from '../bus.js';

const FONT = '"Press Start 2P", monospace';
// semi-larghezze delle hitbox (piu' piccole della grafica: collisioni giuste)
const HALF_W = { muretto: 12, botte: 7, bottecoricata: 11, botti: 12, pozza: 9, narrow: 17, goat: 7, rollbarrel: 7, asfodelo: 10, ferula: 10, tappeto: 11, pistola: 11 };
const ATTRACT_SPEED = 34;
const PLAYER_BACK = 3, PLAYER_FRONT = 5, PLAYER_HALF = 3;
const isMoving = (k) => k === 'goat' || k === 'rollbarrel';

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  // ------------------------------------------------------------ setup
  create() {
    buildStaticTextures(this);
    this.anims.create({ key: 'run', frames: [0, 1, 2, 3].map((f) => ({ key: 'player', frame: f })), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'flame', frames: [0, 1, 2, 3, 4, 5].map((f) => ({ key: 'flame', frame: f })), frameRate: 14, repeat: -1 });
    this.anims.create({ key: 'goat', frames: [0, 1].map((f) => ({ key: 'goat', frame: f })), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'rollbarrel', frames: [0, 1, 2, 3].map((f) => ({ key: 'rollbarrel', frame: f })), frameRate: 12, repeat: -1 });
    for (let v = 0; v < 4; v++) this.anims.create({ key: `tappeto${v}`, frames: [v * 2, v * 2 + 1].map((f) => ({ key: 'tappeto', frame: f })), frameRate: 3, repeat: -1 });
    this.anims.create({ key: 'pistola', frames: [0, 1].map((f) => ({ key: 'pistola', frame: f })), frameRate: 2.5, repeat: -1 });
    this.anims.create({ key: 'muzzle', frames: [0, 1, 2].map((f) => ({ key: 'muzzle', frame: f })), frameRate: 24, repeat: 0 });
    this.anims.create({ key: 'asfodelo', frames: [0, 1].map((f) => ({ key: 'asfodelo', frame: f })), frameRate: 2.5, repeat: -1 });
    this.anims.create({ key: 'ferula', frames: [0, 1].map((f) => ({ key: 'ferula', frame: f })), frameRate: 2.5, repeat: -1 });

    this.mode = 'attract'; // attract | run | dying | over
    this.T = 0;            // distanza percorsa (px)
    this.Tr = 0;
    this.genOffset = 0;
    this.time0 = 0;
    this.entities = [];
    this.houses = { '-1': [], '1': [] };
    this.popups = [];
    this.shots = [];
    this.accum = 0;
    this.debug = new URLSearchParams(location.search).get('debug') || '';
    this.clock = 0;

    this.ground = this.add.tileSprite(0, 0, 10, 10, 'cobble').setOrigin(0, 0).setDepth(0);
    this.curbL = this.add.tileSprite(0, 0, 4, 10, 'curb').setOrigin(0, 0).setDepth(1);
    this.curbR = this.add.tileSprite(0, 0, 4, 10, 'curb').setOrigin(0, 0).setDepth(1);

    this.shadow = this.add.image(0, 0, 'shadow').setDepth(9);
    this.player = this.add.sprite(0, 0, 'player', 0).setOrigin(0.5, 1);
    this.torch = this.add.image(0, 0, 'torch').setOrigin(0.5, 1);
    this.groundLight = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(99).setAlpha(0.2);
    this.dark = null;
    this.flame = this.add.sprite(0, 0, 'flame', 0).setOrigin(0.5, 0.88).setDepth(102).play('flame');
    this.flameGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(101).setAlpha(0.42);

    this.sparks = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 350, max: 900 }, speedX: { min: -22, max: 22 }, speedY: { min: -55, max: -15 },
      gravityY: 60, alpha: { start: 1, end: 0 },
      frequency: 70, quantity: 1, blendMode: 'ADD',
    }).setDepth(103);
    this.embers = this.add.particles(0, 0, 'ember', {
      lifespan: { min: 500, max: 1300 }, speedX: { min: -12, max: 12 }, speedY: { min: -30, max: -5 },
      gravityY: 40, alpha: { start: 1, end: 0 }, frequency: 90, blendMode: 'ADD',
    }).setDepth(103);
    this.smoke = this.add.particles(0, 0, 'puff', {
      lifespan: { min: 600, max: 1200 }, speedX: { min: -10, max: 10 }, speedY: { min: -26, max: -8 },
      alpha: { start: 0.75, end: 0 }, emitting: false,
    }).setDepth(104);
    // v2: schegge di botte, vino, fili di tappeto
    this.debris = this.add.particles(0, 0, 'plank', {
      lifespan: { min: 450, max: 800 }, speed: { min: 50, max: 130 }, angle: { min: 180, max: 360 }, gravityY: 320,
      alpha: { start: 1, end: 0.2 }, emitting: false,
    }).setDepth(104);
    this.debris2 = this.add.particles(0, 0, 'plank2', {
      lifespan: { min: 400, max: 700 }, speed: { min: 40, max: 110 }, angle: { min: 190, max: 350 }, gravityY: 300,
      alpha: { start: 1, end: 0.2 }, emitting: false,
    }).setDepth(104);
    this.hoopbits = this.add.particles(0, 0, 'hoopbit', {
      lifespan: 600, speed: { min: 40, max: 100 }, angle: { min: 200, max: 340 }, gravityY: 300, emitting: false,
    }).setDepth(104);
    this.wine = this.add.particles(0, 0, 'wine', {
      lifespan: { min: 300, max: 600 }, speed: { min: 20, max: 70 }, angle: { min: 0, max: 360 }, gravityY: 120,
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(60);
    this.threads = this.add.particles(0, 0, 'thread', {
      lifespan: { min: 350, max: 650 }, speed: { min: 30, max: 80 }, angle: { min: 0, max: 360 }, gravityY: -20,
      alpha: { start: 1, end: 0 }, tint: [0xb3283a, 0xd9a63a, 0xefe3c6, 0x86202f, 0xf2c95c], emitting: false,
    }).setDepth(104);
    // pistola in mano, vampata, lampo di luce
    this.pistolHand = this.add.image(0, 0, 'pistolhand').setOrigin(0.5, 1).setVisible(false);
    this.muzzle = this.add.sprite(0, 0, 'muzzle', 0).setDepth(106).setVisible(false);
    this.muzzle.on('animationcomplete', () => this.muzzle.setVisible(false));
    this.shotLight = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(101).setAlpha(0).setScale(2.2);
    this.splash = this.add.particles(0, 0, 'drop', {
      lifespan: 380, speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 }, gravityY: 220,
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(60);
    this.burst = this.add.particles(0, 0, 'spark', {
      lifespan: 500, speed: { min: 30, max: 90 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false,
    }).setDepth(104);

    this.relayout(this.scale.width, this.scale.height);
    this.carpetTotal = getCarpetTotal();

    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', (p) => this.onPointerUp(p));
    this.input.keyboard.on('keydown', (e) => this.onKey(e));

    this.resetRunState();
    this.lane = 1; this.px = this.laneX(1); this.targetLane = 1;
    this.scale.on('resize', (gs) => this.relayout(gs.width, gs.height));
    bus.emit('scene-ready', this);
  }

  // ------------------------------------------------------------ layout
  relayout(W, H) {
    this.W = W; this.H = H;
    // prima si eliminano gli oggetti che usano le texture da rigenerare
    for (const s of ['-1', '1']) { this.houses[s].forEach((h) => this.killHouse(h)); this.houses[s] = []; }
    if (this.dark) { this.dark.destroy(); this.dark = null; }
    if (this.vignette) { this.vignette.destroy(); this.vignette = null; }
    this.entities.forEach((e) => { if (e.kind === 'narrow') e.sprite.setTexture('pixel'); });
    const gutter = 4;
    const roadW = WORLD.LANES * WORLD.LANE_W + gutter * 2;
    const roadL = Math.round(W / 2 - roadW / 2);
    this.L = { W, H, gutter, roadW, roadL, roadR: roadL + roadW, sideW: roadL, playerY: Math.round(H * WORLD.PLAYER_Y_RATIO) };
    this.houseMeta = buildLayoutTextures(this, this.L);
    this.ground.setPosition(roadL, 0).setSize(roadW, H);
    this.curbL.setPosition(roadL, 0).setSize(4, H);
    this.curbR.setPosition(this.L.roadR - 4, 0).setSize(4, H);
    this.dark = this.add.image(0, 0, 'dark').setDepth(100);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(105);
    // atmosfera: cenere e braci che volano lente nel vicolo
    if (this.ash) this.ash.destroy();
    this.ash = this.add.particles(0, 0, 'ash', {
      x: { min: 0, max: W }, y: { min: -10, max: H * 0.7 }, lifespan: { min: 2500, max: 4500 },
      speedX: { min: -8, max: 8 }, speedY: { min: 6, max: 18 }, alpha: { start: 0, end: 0.7, ease: 'Sine.easeInOut' },
      frequency: 260, quantity: 1,
    }).setDepth(99);
    if (this.ambEmbers) this.ambEmbers.destroy();
    this.ambEmbers = this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: W }, y: { min: H * 0.4, max: H }, lifespan: { min: 1800, max: 3200 },
      speedX: { min: -6, max: 6 }, speedY: { min: -22, max: -8 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD',
      frequency: 700, quantity: 1,
    }).setDepth(103);
    this.nextHouse = { '-1': this.T - (H - this.L.playerY) - 10, '1': this.T - (H - this.L.playerY) - 40 };
    this.entities.forEach((e) => { if (e.kind === 'narrow') e.sprite.setTexture(e.texKey); });
    this.fillHouses();
  }

  laneX(i) { return this.L.roadL + this.L.gutter + WORLD.LANE_W * (i + 0.5); }
  screenY(d) { return this.L.playerY - (d - this.Tr); }

  // ------------------------------------------------------------ case
  fillHouses() {
    const top = this.T + this.L.playerY + 40;
    for (const s of ['-1', '1']) {
      const side = +s;
      while (this.nextHouse[s] < top) {
        let key;
        if (Math.random() < 0.13) key = `alley${side}`;
        else key = `house${side}_${Math.floor(Math.random() * HOUSE_VARIANTS)}`;
        const meta = this.houseMeta[key];
        const x = side < 0 ? 0 : this.L.roadR;
        const spr = this.add.image(x, 0, key).setOrigin(0, 1).setDepth(5);
        const glows = [];
        meta.windows.forEach((w) => glows.push({ ox: w.x, oy: w.y, img: this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(101).setScale(0.32).setAlpha(0.45), ph: Math.random() * 6 }));
        meta.lamps.forEach((l) => {
          glows.push({ ox: l.x, oy: l.y, img: this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(101).setScale(0.5).setAlpha(0.8), ph: Math.random() * 6 });
          // pozza di luce sulla strada
          const pool = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(101).setScale(1.1, 0.8).setAlpha(0.17);
          glows.push({ ox: side < 0 ? this.L.sideW + 14 : -14, oy: l.y + 6, img: pool, ph: Math.random() * 6, pool: true });
        });
        this.houses[s].push({ spr, d: this.nextHouse[s], h: meta.h, glows, side });
        this.nextHouse[s] += meta.h;
      }
    }
  }
  killHouse(h) { h.spr.destroy(); h.glows.forEach((g) => g.img.destroy()); }

  // ------------------------------------------------------------ partita
  resetRunState() {
    this.score = 0;
    this.metersCredited = 0;
    this.fuel = FUEL.START;
    this.chain = 0;
    this.stats = { pickups: 0, nearMiss: 0, chains: 0, milestones: 0, hits: 0, bonus: 0, carpets: 0, barrels: 0, shots: 0, pistols: 0, survival: 0, capped: 0 };
    this.carpetStreak = 0;
    this.ammo = 0;
    this.fireCd = 0;
    this.recoilT = 0;
    this.shots.forEach((p) => p.spr.destroy()); this.shots = [];
    this.nextSurvival = SCORE.SURVIVAL_EVERY_S;
    this.bonusWin = { idx: -1, sum: 0 };
    this.events = []; // registro eventi per la futura verifica server (replay)
    this.nextMilestone = 0;
    this.lastNearMiss = -99;
    this.invuln = 0;
    this.slowT = 99;
    this.inputs = [];
    this.step = 0;
    this.best = getBest();
    this.bestAnnounced = this.best <= 0;
    this.runTime = 0;
  }

  startRun() {
    this.entities.forEach((e) => this.killEntity(e));
    this.entities = [];
    this.popups.forEach((p) => p.t.destroy()); this.popups = [];
    this.resetRunState();
    this.seed = randomSeed();
    this.gen = new Generator(this.seed, { debugPistol: this.debug.includes('pistol') });
    this.runStartT = this.T;
    this.genOffset = this.T; // il generatore lavora in distanza relativa alla partenza
    this.mode = 'run';
    this.lane = 1; this.targetLane = 1;
    this.player.setAlpha(1).play('run');
    this.flame.setVisible(true); this.sparks.start(); this.embers.start();
    audio.setIntensity(1, 0);
    this.emitHud(true);
  }

  toAttract() {
    this.mode = 'attract';
    this.genOffset = this.T;
    this.score = 0;
    this.entities.forEach((e) => this.killEntity(e));
    this.entities = [];
    this.fuel = FUEL.MAX;
    this.player.setAlpha(1).play('run');
    this.flame.setVisible(true); this.sparks.start(); this.embers.start();
    this.targetLane = 1;
    this.ammo = 0;
    this.shots.forEach((p) => p.spr.destroy()); this.shots = [];
    audio.setIntensity(0);
  }

  killEntity(e) { e.sprite.destroy(); if (e.halo) e.halo.destroy(); }
  log(code, v = 0) { this.events.push([this.step, code, v]); }

  get runD() { return this.T - this.genOffset; } // distanza della partita

  spawn(e) {
    e.d += this.genOffset; // da distanza relativa a assoluta
    e.solid = !!SOLID[e.kind];
    e.hit = false; e.done = false; e.near = false;
    let key = e.kind;
    if (e.kind === 'narrow') {
      const rows = Math.round((e.len + 6) / WORLD.ROW);
      key = `narrow${e.lane === 0 ? -1 : 1}_${rows}`;
      e.texKey = key;
    }
    const spr = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
    if (e.kind === 'narrow') spr.setOrigin(0, 1);
    if (e.kind === 'tappeto') spr.play({ key: `tappeto${e.variant || 0}`, startFrame: Math.floor(Math.random() * 2) });
    else if (this.anims.exists(e.kind)) spr.play({ key: e.kind, startFrame: Math.floor(Math.random() * 2) });
    if (e.kind === 'goat') { e.x = e.dir > 0 ? this.L.roadL - 6 : this.L.roadR + 6; spr.setFlipX(e.dir < 0); }
    if (e.kind === 'rollbarrel') e.x = e.dir > 0 ? this.L.roadL - 6 : this.L.roadR + 6;
    e.sprite = spr;
    if (e.pickup) {
      e.halo = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(101)
        .setTint(e.kind === 'ferula' ? 0xd6e06a : e.kind === 'tappeto' ? 0xff9a6a : e.kind === 'pistola' ? 0xffe08a : 0xfff0c0)
        .setAlpha(0.5).setScale(e.kind === 'pistola' ? 0.6 : e.kind === 'tappeto' ? 0.34 : 0.42);
    }
    this.entities.push(e);
  }

  // ------------------------------------------------------------ input
  move(dir) {
    if (this.mode !== 'run') return;
    const next = Phaser.Math.Clamp(this.targetLane + dir, 0, WORLD.LANES - 1);
    if (next === this.targetLane) return;
    // "per un pelo": ostacoli molto vicini nella corsia che si sta lasciando
    const fromLane = Math.round((this.px - this.laneX(0)) / WORLD.LANE_W);
    const speed = this.currentSpeed || 0;
    const win = speed * SCORE.NEAR_MISS_WINDOW_S;
    for (const e of this.entities) {
      if (!e.solid || e.hit || e.done || e.lane !== fromLane || isMoving(e.kind)) continue;
      const gap = e.d - (this.T + PLAYER_FRONT);
      if (gap >= 0 && gap <= win) e.near = true;
    }
    this.targetLane = next;
    this.inputs.push([this.step, dir]);
  }

  // ------------------------------------------------------------ pistola
  fire() {
    if (this.mode !== 'run') return false;
    if (this.ammo <= 0) return false;
    if (this.fireCd > 0) return false;
    this.ammo--;
    this.fireCd = PISTOL.FIRE_COOLDOWN_S;
    this.recoilT = 0.12;
    this.stats.shots++;
    this.inputs.push([this.step, 'F']);
    const x = Math.round(this.px) - 5;
    const spr = this.add.image(x, 0, 'palla').setDepth(107);
    this.shots.push({ d: this.T + 22, x, spr });
    this.muzzle.setVisible(true).setPosition(x, this.L.playerY - 20).play('muzzle');
    this.shotLight.setAlpha(0.9).setPosition(x, this.L.playerY - 20);
    this.smoke.explode(3, x, this.L.playerY - 20);
    this.cameras.main.shake(60, 0.004);
    audio.shoot();
    if (this.ammo === 0) this.popup('SENZA COLPI', '#c9c0ae', 4);
    return true;
  }

  updateShots(dt) {
    const speed = (this.currentSpeed || 0) + PISTOL.SHOT_SPEED;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const p = this.shots[i];
      p.d += speed * dt;
      let gone = p.d - this.T > this.L.playerY + 30;
      if (!gone) {
        for (const e of this.entities) {
          if (e.done || e.pickup || !e.solid || e.kind === 'goat') continue; // le capre non si toccano
          const ex = isMoving(e.kind) ? e.x : this.laneX(e.lane);
          if (e.d <= p.d + 3 && e.d + e.len + 6 >= p.d && Math.abs(ex - p.x) <= (HALF_W[e.kind] || 10) + 2) {
            if (DESTRUCTIBLE[e.kind]) this.destroyBarrel(e);
            else { // pietra: rimbalzo
              const y = this.screenY(p.d);
              this.burst.explode(6, p.x, y);
              audio.ricochet();
            }
            gone = true;
            break;
          }
        }
      }
      if (gone) { p.spr.destroy(); this.shots.splice(i, 1); }
    }
  }

  destroyBarrel(e) {
    e.done = true; e.destroyed = true; e.sprite.setVisible(false);
    const x = isMoving(e.kind) ? e.x : this.laneX(e.lane);
    const y = this.screenY(e.d) - Math.min(e.len, 30) / 2;
    const big = e.kind === 'botti';
    this.debris.explode(big ? 14 : 8, x, y);
    this.debris2.explode(big ? 10 : 6, x, y);
    this.hoopbits.explode(big ? 6 : 3, x, y);
    this.wine.explode(big ? 16 : 9, x, y + 4);
    this.smoke.explode(4, x, y);
    this.cameras.main.shake(big ? 170 : 120, big ? 0.012 : 0.008);
    const pts = this.addBonus(big ? SCORE.BARREL_GROUP : SCORE.BARREL);
    this.stats.barrels++;
    this.log('b', pts);
    this.popupAt(`+${pts}`, '#ffbf3a', x, y - 10);
    audio.barrelBreak(big);
  }

  onKey(e) {
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') this.move(-1);
    else if (k === 'ArrowRight' || k === 'KeyD') this.move(1);
    else if (k === 'Space' || k === 'KeyW' || k === 'ArrowUp') this.fire();
    else if ((k === 'KeyP' || k === 'Escape') && this.mode === 'run') bus.emit('request-pause');
  }
  onPointerDown(p) { this.ptr = { x: p.x, y: p.y, t: performance.now(), swiped: false }; }
  onPointerMove(p) {
    if (!this.ptr || !p.isDown || this.ptr.swiped) return; // uno swipe = una corsia
    const dx = p.x - this.ptr.x, dy = p.y - this.ptr.y;
    if (Math.abs(dx) >= 9 && Math.abs(dx) > Math.abs(dy) * 1.1) {
      this.move(dx > 0 ? 1 : -1);
      this.ptr.swiped = true;
    } else if (dy <= -12 && Math.abs(dy) > Math.abs(dx) * 1.3) { // swipe verso l'alto = spara
      this.fire();
      this.ptr.swiped = true;
    }
  }
  onPointerUp(p) {
    if (!this.ptr) return;
    const dt = performance.now() - this.ptr.t;
    if (!this.ptr.swiped && dt < 350 && Math.abs(p.x - this.ptr.x) < 9) this.move(p.x < this.W / 2 ? -1 : 1);
    this.ptr = null;
  }

  // ------------------------------------------------------------ loop
  update(time, deltaMs) {
    const dtReal = Math.min(deltaMs / 1000, 0.25); // clamp: niente "salti" dopo lag
    this.accum += dtReal;
    let steps = 0;
    while (this.accum >= WORLD.FIXED_DT && steps < WORLD.MAX_STEPS_PER_FRAME) {
      this.tick(WORLD.FIXED_DT);
      this.accum -= WORLD.FIXED_DT; steps++;
    }
    if (steps >= WORLD.MAX_STEPS_PER_FRAME) this.accum = 0;
    this.render(dtReal);
  }

  tick(dt) {
    this.clock += dt;
    if (this.mode === 'attract') {
      this.currentSpeed = ATTRACT_SPEED;
      this.T += ATTRACT_SPEED * dt;
      this.fuel = FUEL.MAX;
      this.approachLane(dt);
      return;
    }
    if (this.mode === 'over') { this.currentSpeed = 0; return; }
    if (this.mode === 'dying') {
      this.currentSpeed = Math.max(0, (this.currentSpeed || 0) - 260 * dt);
      this.T += this.currentSpeed * dt;
      this.dieT -= dt;
      if (this.dieT <= 0) this.finish();
      return;
    }
    // ---- corsa
    this.step++;
    this.runTime += dt;
    const rd = this.runD;
    if (this.slowT < WORLD.HIT_RECOVER_S) this.slowT += dt;
    const slow = lerp(WORLD.HIT_SLOW, 1, Math.min(1, this.slowT / WORLD.HIT_RECOVER_S));
    const speed = speedAt(rd) * slow;
    this.currentSpeed = speed;
    this.T += speed * dt;
    this.invuln = Math.max(0, this.invuln - dt);

    const diff = difficultyAt(rd);
    this.fuel -= lerp(FUEL.DRAIN_START, FUEL.DRAIN_END, diff) * dt;

    // punteggio legato SOLO alla distanza realmente percorsa
    const meters = Math.floor(this.runD / PX_PER_METER);
    while (this.metersCredited < meters) {
      this.metersCredited++;
      this.score += SCORE.PER_METER;
      this.checkMilestone(this.metersCredited);
    }

    this.approachLane(dt);
    this.gen.fillUntil(this.runD + this.L.playerY + 70, (e) => this.spawn(e));
    this.updateEntities(dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.recoilT = Math.max(0, this.recoilT - dt);
    this.updateShots(dt);
    // bonus sopravvivenza: la fiamma resta accesa
    if (this.runTime >= this.nextSurvival) {
      this.nextSurvival += SCORE.SURVIVAL_EVERY_S;
      const pts = this.addBonus(SCORE.SURVIVAL_BONUS, false); // legato al tempo: fuori dal tetto
      this.stats.survival++;
      this.log('s', pts);
      this.popup(`LA FIAMMA RESISTE +${pts}`, '#ffe589', 24);
      audio.survival();
    }

    if (!this.bestAnnounced && this.score > this.best) {
      this.bestAnnounced = true;
      this.popup('NUOVO RECORD!', '#ffe589', 16);
      audio.record();
    }
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.mode = 'dying';
      this.dieT = WORLD.DYING_S;
      this.shots.forEach((p) => p.spr.destroy()); this.shots = [];
      this.player.anims.stop();
      this.flame.setVisible(false); this.sparks.stop(); this.embers.stop();
      this.smoke.explode(14, this.tipX, this.tipY);
      audio.gameOver();
      audio.setIntensity(0);
    }
  }

  // cambio corsia morbido: scatto rapido all'inizio, assestamento dolce
  approachLane(dt) {
    const tx = this.laneX(this.targetLane);
    const d = tx - this.px;
    if (Math.abs(d) <= WORLD.LANE_SNAP_PX) { this.px = tx; this.vx = 0; return; }
    this.px += d * (1 - Math.exp(-WORLD.LANE_EASE * dt));
    this.vx = Phaser.Math.Clamp(d / WORLD.LANE_W, -1, 1);
  }

  checkMilestone(m) {
    const list = SCORE.MILESTONES;
    let target, bonus;
    if (this.nextMilestone < list.length) { target = list[this.nextMilestone].m; bonus = list[this.nextMilestone].bonus; }
    else {
      const last = list[list.length - 1].m;
      target = last + (this.nextMilestone - list.length + 1) * SCORE.MILESTONE_REPEAT_EVERY;
      bonus = SCORE.MILESTONE_REPEAT_BONUS;
    }
    if (m >= target) {
      this.nextMilestone++;
      const pts = this.addBonus(bonus, false); // legato alla distanza: fuori dal tetto
      this.stats.milestones++;
      this.log('m', pts);
      this.popup(`${target} M  +${pts}`, '#ffbf3a', 12);
      audio.milestone();
    }
  }

  // tutti i bonus passano da qui: tetto per finestra di 10 s (anti-exploit)
  // tetto anti-exploit: al massimo BONUS_CAP_PER_10S punti-azione ogni 10 s di corsa
  addBonus(v, capped = true) {
    if (!capped) { this.score += v; this.stats.bonus += v; return v; }
    const idx = Math.floor(this.runTime / 10);
    if (idx !== this.bonusWin.idx) this.bonusWin = { idx, sum: 0 };
    const room = Math.max(0, SCORE.BONUS_CAP_PER_10S - this.bonusWin.sum);
    const pts = Math.min(v, room);
    if (pts < v) { this.stats.capped += v - pts; this.log('cap', v - pts); }
    this.bonusWin.sum += pts;
    this.score += pts; this.stats.bonus += pts;
    return pts;
  }

  updateEntities(dt) {
    const T = this.T;
    const pBack = T - PLAYER_BACK, pFront = T + PLAYER_FRONT;
    const px = this.px;
    for (const e of this.entities) {
      if (isMoving(e.kind)) {
        const y = this.L.playerY - (e.d - T);
        if (y > -6) e.x += e.vx * e.dir * dt; // si muove solo quando e' visibile
        if (e.kind === 'goat' && !e.bleat && y > 10) { e.bleat = true; audio.goat(); }
      }
      if (e.done) continue;
      const ex = isMoving(e.kind) ? e.x : this.laneX(e.lane);
      const hw = HALF_W[e.kind] || 10;
      const overlapD = e.d <= pFront && e.d + e.len >= pBack;
      if (e.pickup) {
        if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF) { this.collect(e); continue; }
        if (e.d + e.len < pBack) {
          e.done = true;
          if (PICKUP_KINDS[e.kind] === 'fuel') this.chain = 0;
          if (e.kind === 'tappeto') this.carpetStreak = 0;
        }
        continue;
      }
      if (overlapD && Math.abs(ex - px) <= hw + PLAYER_HALF && !e.hit) {
        if (e.kind === 'pozza') { this.hitPuddle(e); continue; }
        if (this.invuln <= 0) { this.hitSolid(e); continue; }
      }
      if (e.d + e.len < pBack) {
        e.done = true;
        if (e.near && !e.hit && this.clock - this.lastNearMiss >= SCORE.NEAR_MISS_COOLDOWN_S) {
          this.lastNearMiss = this.clock;
          const pts = this.addBonus(SCORE.NEAR_MISS);
          this.stats.nearMiss++;
          this.log('n', pts);
          this.popup(`PER UN PELO! +${pts}`, '#fff7d6', 0);
          audio.nearMiss();
        }
      }
    }
    // rimuovi cio' che e' uscito dallo schermo
    const bottom = this.T - (this.H - this.L.playerY) - 70;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.d + e.len < bottom) { this.killEntity(e); this.entities.splice(i, 1); }
    }
  }

  collect(e) {
    e.done = true; e.sprite.setVisible(false);
    if (e.halo) e.halo.setVisible(false);
    const type = PICKUP_KINDS[e.kind];
    if (type === 'carpet') return this.collectCarpet(e);
    if (type === 'pistol') return this.collectPistol(e);
    const add = e.kind === 'ferula' ? FUEL.FERULA : FUEL.ASFODELO;
    this.fuel = Math.min(FUEL.MAX, this.fuel + add);
    const pts = this.addBonus(SCORE.MATERIAL);
    this.stats.pickups++;
    this.log('f', pts);
    this.chain++;
    if (this.chain >= SCORE.CHAIN_SIZE) {
      this.chain = 0;
      const cb = this.addBonus(SCORE.CHAIN_BONUS);
      this.stats.chains++;
      this.log('x', cb);
      this.popup(`CATENA x${SCORE.CHAIN_SIZE}  +${cb}`, '#ffbf3a', 8);
      audio.chain();
    }
    this.popupAt(`+${pts}`, '#ffe589', this.px, this.L.playerY - 30);
    this.burst.explode(12, this.px, this.L.playerY - 10);
    audio.pickup(e.kind);
  }

  collectCarpet(e) {
    this.stats.carpets++;
    this.carpetTotal = addCarpets(1); // salvato subito: non si perde
    const pts = this.addBonus(SCORE.CARPET);
    this.log('c', pts);
    this.threads.explode(10, this.px, this.L.playerY - 6);
    audio.carpet(this.carpetStreak++);
    bus.emit('carpet', { run: this.stats.carpets, total: this.carpetTotal });
  }

  collectPistol() {
    this.ammo = PISTOL.AMMO;
    this.fireCd = 0.15;
    this.stats.pistols++;
    this.log('p', 0);
    this.burst.explode(16, this.px, this.L.playerY - 10);
    this.popup('PISTOLA BROCCU!', '#ffe589', -10);
    this.popup(`${PISTOL.AMMO} COLPI`, '#ecc96a', 4);
    audio.pistolPickup();
  }

  hitPuddle(e) {
    e.hit = true; e.done = true;
    this.log('w', FUEL.HIT_PUDDLE);
    this.fuel -= FUEL.HIT_PUDDLE;
    this.smoke.explode(8, this.tipX, this.tipY);
    this.splash.explode(10, this.px, this.L.playerY);
    this.popupAt('SSSS...', '#9cc3e6', this.px, this.L.playerY - 34);
    audio.puddle();
  }

  hitSolid(e) {
    e.hit = true; e.done = true;
    const loss = isMoving(e.kind) ? FUEL.HIT_GOAT : FUEL.HIT_SOLID;
    this.log('h', loss);
    this.carpetStreak = 0;
    this.fuel -= loss;
    this.stats.hits++;
    this.chain = 0;
    this.invuln = WORLD.HIT_INVULN_S;
    this.slowT = 0;
    this.cameras.main.shake(140, 0.012);
    this.smoke.explode(10, this.tipX, this.tipY);
    this.burst.explode(16, this.tipX, this.tipY);
    if (e.kind === 'goat') { e.vx *= 2.5; }
    audio.hit();
  }

  finish() {
    this.mode = 'over';
    const meters = Math.floor(this.runD / PX_PER_METER);
    bus.emit('gameover', {
      score: this.score, meters, ...this.stats, time: Math.round(this.runTime * 10) / 10,
      seed: this.seed, carpetTotal: this.carpetTotal, debug: this.debug,
      // registro partita per la futura verifica server (Fase 3): seed + input + eventi
      log: { v: 2, seed: this.seed, steps: this.step, inputs: this.inputs.slice(), events: this.events.slice() },
    });
  }

  // ------------------------------------------------------------ popups
  popup(text, color, yOff) {
    this.popupAt(text, color, this.W / 2, Math.round(this.H * 0.3) + yOff, true);
  }
  popupAt(text, color, x, y, center) {
    const t = this.add.text(Math.round(x), Math.round(y), text, {
      fontFamily: FONT, fontSize: '8px', color, resolution: 1,
      shadow: { offsetX: 1, offsetY: 1, color: '#05070f', blur: 0, fill: true },
    }).setOrigin(0.5).setDepth(110);
    if (center) t.setStroke('#05070f', 2);
    this.popups.push({ t, life: center ? 1.3 : 0.8, max: center ? 1.3 : 0.8, vy: center ? -6 : -24 });
  }

  // ------------------------------------------------------------ render
  render(dt) {
    this.Tr = Math.round(this.T);
    const L = this.L;
    const pY = L.playerY;
    this.ground.tilePositionY = -(this.Tr % COBBLE_H);
    this.curbL.tilePositionY = -(this.Tr % 32);
    this.curbR.tilePositionY = -(this.Tr % 32);

    // case
    this.fillHouses();
    const now = this.clock;
    for (const s of ['-1', '1']) {
      const arr = this.houses[s];
      for (let i = arr.length - 1; i >= 0; i--) {
        const h = arr[i];
        const y = this.screenY(h.d);
        if (y - h.h > this.H + 2) { this.killHouse(h); arr.splice(i, 1); continue; }
        h.spr.y = y;
        for (const g of h.glows) {
          g.img.x = h.spr.x + g.ox;
          g.img.y = y - h.h + g.oy;
          if (!g.pool) g.img.setAlpha(0.45 + Math.sin(now * 3 + g.ph) * 0.08);
        }
      }
    }

    // giocatore
    const fuelF = this.fuel / FUEL.MAX;
    const px = Math.round(this.px);
    this.player.setPosition(px, pY + 4).setDepth(10 + (pY + 4) / 1000);
    this.shadow.setPosition(px, pY + 4);
    const speedK = this.currentSpeed || 0;
    if (this.player.anims.isPlaying) this.player.anims.timeScale = Math.max(0.5, speedK / 80);
    if (this.mode === 'run' || this.mode === 'attract') {
      const fr = this.player.anims.currentFrame ? this.player.anims.currentFrame.index : 0;
      if (fr !== this.lastFrame && (fr === 1 || fr === 3) && this.mode === 'run') audio.step(fr === 3);
      this.lastFrame = fr;
    }
    this.player.setAlpha(this.invuln > 0 ? (Math.floor(this.invuln * 14) % 2 ? 0.35 : 1) : 1);
    const sway = Math.sin(now * 7.5) * 0.06 + (this.vx || 0) * -0.12;
    const rot = 0.2 + sway;
    const hx = px + 6, hy = pY - 15;
    this.torch.setPosition(hx, hy + 6).setRotation(rot).setDepth(10.0001 + (pY + 4) / 1000);
    this.tipX = hx + Math.sin(rot) * 27;
    this.tipY = hy + 6 - Math.cos(rot) * 27;
    // scala costante 1: stessa dimensione dei pixel ovunque; il livello del
    // fuoco si legge da luce, scintille e (sotto soglia) dal tremolio
    const fs = this.mode === 'over' || this.mode === 'dying' ? 0 : 1;
    const low = this.fuel < FUEL.LOW_WARNING;
    this.flame.setPosition(Math.round(this.tipX), Math.round(this.tipY) + 2)
      .setAlpha(low ? (Math.sin(now * 23) > -0.3 ? 1 : 0.55) : 1);
    const flick = Math.sin(now * 17) * 0.02 + Math.sin(now * 29) * 0.015;
    const lightK = this.mode === 'over' || this.mode === 'dying' ? 0.55 : 0.75 + 0.45 * fuelF + flick;
    this.dark.setPosition(this.tipX, this.tipY + 14).setScale(lightK);
    this.flameGlow.setPosition(this.tipX, this.tipY - 6).setScale((0.5 + 0.6 * fuelF) * (1 + flick)).setVisible(fs > 0);
    this.groundLight.setPosition(px + 2, pY).setScale((1.3 + 1.3 * fuelF) * (1 + flick * 2), (1.0 + fuelF) * (1 + flick * 2)).setVisible(fs > 0);
    // scintille: piu' fuoco => piu' scintille; si spostano col mondo
    this.sparks.setPosition(this.tipX, this.tipY - 6);
    this.sparks.frequency = Math.round(lerp(260, 40, fuelF));
    this.sparks.gravityY = 40 + speedK * 0.9;
    this.embers.setPosition(this.tipX, this.tipY - 2);
    this.embers.gravityY = 30 + speedK * 0.8;
    // pistola in mano (sprite separato: il personaggio non cambia)
    const armed = this.mode === 'run' && (this.ammo > 0 || this.recoilT > 0);
    const rec = this.recoilT > 0.06 ? 2 : this.recoilT > 0 ? 1 : 0;
    this.pistolHand.setVisible(armed).setPosition(px - 5, pY - 6 + rec).setDepth(10.0002 + (pY + 4) / 1000);
    if (this.muzzle.visible) this.muzzle.setPosition(px - 5, pY - 20 + rec);
    if (this.shotLight.alpha > 0) this.shotLight.setAlpha(Math.max(0, this.shotLight.alpha - dt * 6)).setPosition(px - 5, pY - 20);
    for (const p of this.shots) p.spr.setPosition(p.x, this.screenY(p.d));

    // entita'
    for (const e of this.entities) {
      const y = this.screenY(e.d);
      let x;
      if (e.kind === 'narrow') x = e.lane === 0 ? L.roadL - 2 : L.roadR - (WORLD.LANE_W + L.gutter);
      else if (isMoving(e.kind)) x = Math.round(e.x);
      else x = this.laneX(e.lane);
      e.sprite.setPosition(x, y).setDepth(e.kind === 'narrow' ? 6 : e.kind === 'pistola' ? 100.5 : 10 + y / 1000);
      if (e.pickup) {
        const bob = e.kind === 'tappeto' ? Math.round(Math.sin(now * 3.2 + e.d * 0.05) * 1.4) - 1 : Math.round(Math.sin(now * 4 + e.d) * 1);
        e.sprite.y = y + bob;
        if (e.halo) e.halo.setPosition(x, y - 6).setAlpha(e.done ? 0 : (e.kind === 'pistola' ? 0.55 : 0.32) + Math.sin(now * 5 + e.d) * 0.12);
      }
      if (e.hit && e.kind !== 'pozza') e.sprite.setTint(0x8a6a60);
    }

    // popup
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.t.y += p.vy * dt;
      p.t.setAlpha(Math.min(1, p.life / (p.max * 0.4)));
      if (p.life <= 0) { p.t.destroy(); this.popups.splice(i, 1); }
    }

    audio.fire(fuelF, dt, this.mode === 'run' || this.mode === 'attract');
    if (this.mode === 'run') audio.setIntensity(1, difficultyAt(this.runD));
    this.emitHud(false);
  }

  emitHud(force) {
    const now = performance.now();
    if (!force && now - (this._lastHud || 0) < 66) return;
    this._lastHud = now;
    bus.emit('hud', {
      mode: this.mode,
      score: this.score,
      best: Math.max(this.best, this.mode === 'run' || this.mode === 'dying' || this.mode === 'over' ? this.score : 0),
      meters: Math.floor(Math.max(0, this.runD) / PX_PER_METER),
      fuel: Math.max(0, this.fuel) / FUEL.MAX,
      chain: this.chain,
      carpets: this.mode === 'attract' ? 0 : this.stats.carpets,
      carpetTotal: this.carpetTotal,
      ammo: this.mode === 'run' ? this.ammo : 0,
    });
  }

  // stato leggibile per i test automatici (?test=1)
  debugState() {
    return {
      mode: this.mode, score: this.score, fuel: this.fuel, meters: Math.floor(this.runD / PX_PER_METER),
      lane: this.targetLane, px: this.px, T: this.T, stats: { ...this.stats }, speed: this.currentSpeed, baseSpeed: speedAt(Math.max(0, this.runD)),
      ammo: this.ammo, shotsInFlight: this.shots.length, carpetTotal: this.carpetTotal, events: this.events.length, inputs: this.inputs.length,
      entities: this.entities.filter((e) => !e.done).map((e) => ({ kind: e.kind, lane: e.lane, x: e.x, ahead: e.d - this.T, len: e.len, pickup: !!e.pickup, solid: e.solid, destructible: !!DESTRUCTIBLE[e.kind] })),
    };
  }
}
