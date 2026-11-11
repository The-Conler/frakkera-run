import './styles.css';
import { Game } from './game/game.js';
import { initUI } from './ui.js';

// ---------------------------------------------------------------------
// Avvio: colonna verticale (su desktop centrata), canvas WebGL Three.js
// e interfaccia HTML sopra.
// ---------------------------------------------------------------------
function viewport() {
  const vv = window.visualViewport;
  return { vw: Math.round(vv ? vv.width : window.innerWidth), vh: Math.round(vv ? vv.height : window.innerHeight) };
}
function computeSize() {
  const { vw, vh } = viewport();
  let fw = vw, fh = vh;
  if (vw / vh > 0.62) fw = Math.round(vh * 0.5625);
  return { w: fw, h: fh };
}
function applyFrame({ w, h }) {
  const f = document.getElementById('frame');
  f.style.width = `${w}px`;
  f.style.height = `${h}px`;
  // unita' UI: scala con la larghezza (riferimento 390 px), limitata
  const u = Math.max(0.5, Math.min(1.25, Math.min(w / 390, h / 760)));   // v5s29 (QA M8): in orizzontale la cornice e' stretta, l'HUD deve rimpicciolirsi
  document.documentElement.style.setProperty('--u', `${u.toFixed(3)}px`);
}

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('italic 800 48px Fraunces'), document.fonts.load('500 16px Outfit'), document.fonts.load('600 16px Outfit'), document.fonts.load('700 16px Outfit')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* font di sistema */ }

  let size = computeSize();
  applyFrame(size);
  const game = new Game(document.getElementById('game'));
  game.resize(size.w, size.h);
  initUI(game);
  game.start();

  let t = null;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => { size = computeSize(); applyFrame(size); game.resize(size.w, size.h); }, 100);
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
