// =====================================================================
// Personaggio: gli sprite pixel art ORIGINALI (player, torch, flame e la
// pistola in mano della v2) composti su una canvas esattamente come nella
// versione 2D (stesse posizioni, stessa rotazione oscillante della frakkera,
// stesse animazioni a 4 e 6 frame), poi mostrati come billboard nel 3D con
// filtro NEAREST e senza mipmap. Nessun pixel viene ridisegnato.
// =====================================================================
import * as THREE from 'three';
import { makeTexStore } from './texshim.js';
import { buildCharacterTextures } from '../art/textures.js';
import { pistolTextures } from '../art/textures2.js';

export const CW = 72, CH = 88;     // canvas composita
const AX = 30, AY = 84;             // piede del giocatore (origine 0.5,1 della v2)

export class Character {
  constructor(scene, pxSize = 0.11) {
    this.store = makeTexStore();
    buildCharacterTextures(this.store);
    pistolTextures(this.store);
    this.tex = (k) => this.store.textures.get(k).canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.width = CW; this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true, alphaTest: 0.04, toneMapped: false, fog: false, depthWrite: true });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(AX / CW, (CH - AY) / CH);
    this.pxSize = pxSize;
    this.sprite.scale.set(CW * pxSize, CH * pxSize, 1);
    this.sprite.renderOrder = 5;
    scene.add(this.sprite);
    this.runPhase = 0; this.flamePhase = 0;
    this.frame = 0; this.flameFrame = 0;
    this.tip = { x: 0, y: 0 };    // punta della frakkera in pixel relativi al piede
    this.muzzle = { x: -5, y: -22 };
  }

  // st: { mode, speed, clock, vx, invuln, fuelLow, armed, recoil, flameOn, downT (0..1 posa a terra) }
  update(dt, st) {
    if (st.mode === 'run' || st.mode === 'attract') {
      this.runPhase += dt * 10 * Math.max(0.5, (st.speed || 0) / 80); // anim 'run' 10 fps, timeScale come la v2
    }
    this.frame = Math.floor(this.runPhase) % 4;
    this.flamePhase += dt * 14;                                       // anim 'flame' 14 fps
    this.flameFrame = Math.floor(this.flamePhase) % 6;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CW, CH);
    if (st.downT > 0) { this.drawDown(st.downT); this.texture.needsUpdate = true; return; }
    // stessa logica della v2: sway = sin(t*7.5)*0.06 + vx*-0.12 ; rot = 0.2 + sway
    const sway = Math.sin(st.clock * 7.5) * 0.06 + (st.vx || 0) * -0.12;
    const rot = 0.2 + sway;
    const pl = this.tex('player');
    ctx.globalAlpha = st.invuln > 0 ? (Math.floor(st.invuln * 14) % 2 ? 0.35 : 1) : 1;
    ctx.drawImage(pl, this.frame * 16, 0, 16, 24, AX - 8, AY - 24, 16, 24);
    ctx.globalAlpha = 1;
    // frakkera: origine (0.5,1) in (px+6, pY-9) => (+6, -13) dal piede
    ctx.save(); ctx.translate(AX + 6, AY - 13); ctx.rotate(rot); ctx.drawImage(this.tex('torch'), -4, -30); ctx.restore();
    const tipX = 6 + Math.sin(rot) * 27, tipY = -13 - Math.cos(rot) * 27;
    this.tip.x = tipX; this.tip.y = tipY;
    // pistola in mano (overlay v2), con rinculo
    if (st.armed) {
      const rec = st.recoil > 0.06 ? 2 : st.recoil > 0 ? 1 : 0;
      ctx.drawImage(this.tex('pistolhand'), AX - 5 - 3, AY - 10 + rec - 12);
      this.muzzle.y = -22 + rec;
    }
    // fiamma: posizione (round(tip), round(tip)+2), origine (0.5, 0.88)
    if (st.flameOn) {
      ctx.globalAlpha = st.fuelLow ? (Math.sin(st.clock * 23) > -0.3 ? 1 : 0.55) : 1;
      const fx = Math.round(AX + tipX), fy = Math.round(AY + tipY) + 2;
      ctx.drawImage(this.tex('flame'), this.flameFrame * 20, 0, 20, 30, fx - 10, Math.round(fy - 26.4), 20, 30);
      ctx.globalAlpha = 1;
    }
    this.texture.needsUpdate = true;
  }

  // posa di game over (compromesso): stesso sprite, ruotato a terra, frakkera spenta accanto
  drawDown(k) {
    const ctx = this.ctx;
    const a = -1.45 * Math.min(1, k);
    ctx.save(); ctx.translate(AX + 4, AY); ctx.rotate(a); ctx.drawImage(this.tex('player'), 0, 0, 16, 24, -8, -24, 16, 24); ctx.restore();
    const ta = 0.2 + (1.32 - 0.2) * Math.min(1, k);
    ctx.save(); ctx.translate(AX + 6 + 8 * Math.min(1, k), AY - 13 * (1 - Math.min(1, k)) - 1); ctx.rotate(ta); ctx.drawImage(this.tex('torch'), -4, -30); ctx.restore();
    const tr = ta;
    this.tip.x = 6 + 8 * Math.min(1, k) + Math.sin(tr) * 27; this.tip.y = -13 * (1 - Math.min(1, k)) - 1 - Math.cos(tr) * 27;
  }

  // posizione mondo di un punto della canvas (pixel relativi al piede)
  worldOf(out, base, camRight, camUp, rx, ry) {
    const s = this.pxSize;
    out.copy(base).addScaledVector(camRight, rx * s).addScaledVector(camUp, -ry * s);
    return out;
  }
}
