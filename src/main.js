import Phaser from 'phaser';
import './styles.css';
import { GameScene } from './scenes/GameScene.js';
import { initUI } from './ui.js';
import { bus } from './bus.js';

// ---------------------------------------------------------------------
// Dimensionamento pixel-perfect: la risoluzione logica (circa 180 px di
// larghezza) viene scelta in modo che ogni pixel di gioco corrisponda a
// un numero INTERO di pixel fisici dello schermo => pixel art nitida.
// ---------------------------------------------------------------------
const MIN_W = 168, MAX_W = 200, MIN_H = 300, MAX_H = 440;

function viewport() {
  const vv = window.visualViewport;
  return { vw: Math.round(vv ? vv.width : window.innerWidth), vh: Math.round(vv ? vv.height : window.innerHeight) };
}

function computeSize() {
  const { vw, vh } = viewport();
  const dpr = Math.min(window.devicePixelRatio || 1, 4);
  // verticale su mobile; su desktop una colonna verticale centrata
  let fw = vw, fh = vh;
  if (vw / vh > 0.62) fw = Math.round(vh * 0.5625);
  const devW = fw * dpr, devH = fh * dpr;
  const k = Math.max(1, Math.floor(devW / MIN_W));
  const W = Math.max(MIN_W, Math.min(MAX_W, Math.round(devW / k)));
  const H = Math.max(MIN_H, Math.min(MAX_H, Math.round(devH / k)));
  let cw = (W * k) / dpr, ch = (H * k) / dpr;
  const s = Math.min(fw / cw, fh / ch, 1.0001);
  cw *= s; ch *= s;
  return { W, H, cw: Math.floor(cw), ch: Math.floor(ch) };
}

function applyFrame({ cw, ch }) {
  const f = document.getElementById('frame');
  f.style.width = `${cw}px`;
  f.style.height = `${ch}px`;
  // unita' UI: pulsanti a misura di pollice anche su frame piccoli
  document.documentElement.style.setProperty('--px', `${Math.max(2, Math.round(cw / 130))}px`);
}

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('16px "Press Start 2P"'), document.fonts.load('20px "VT323"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* si prosegue con i font di sistema */ }

  let size = computeSize();
  applyFrame(size);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: size.W,
    height: size.H,
    backgroundColor: '#070a18',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    audio: { noAudio: true }, // audio gestito da WebAudio (systems/audio.js)
    scale: { mode: Phaser.Scale.NONE },
    input: { activePointers: 2, keyboard: { target: window } },
    disableContextMenu: true,
    render: { powerPreference: 'high-performance', antialias: false, pixelArt: true },
    scene: [GameScene],
  });

  bus.once('scene-ready', (scene) => {
    initUI(game, scene);
    game.scale.refresh();
  });

  let t = null;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const n = computeSize();
      applyFrame(n);
      if (n.W !== size.W || n.H !== size.H) game.scale.resize(n.W, n.H);
      size = n;
      game.scale.refresh();
    }, 120);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // nessuno scroll/zoom accidentale durante la partita
  document.addEventListener('touchmove', (e) => { if (!e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
}

boot();
