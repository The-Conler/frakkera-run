// =====================================================================
// Interfaccia HTML (menu, HUD, schermate). Tutti i pulsanti sono reali.
// =====================================================================
import { SCORE, FUEL, DEMO_BOARD, PISTOL } from './config.js';
import { wovenBandURL } from './art/textures2.js';
import { bus } from './bus.js';
import { audio } from './systems/audio.js';
import * as store from './systems/storage.js';
import { validateNick, cleanNick } from './systems/nickname.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const ICON = {
  on: '<svg viewBox="0 0 10 10"><path fill="#ffe589" d="M1 4h2v2H1zM3 3h1v4H3zM4 2h1v6H4zM6 4h1v2H6zM7 2h1v1H7zM8 3h1v4H8zM7 7h1v1H7z"/></svg>',
  off: '<svg viewBox="0 0 10 10"><path fill="#8a8399" d="M1 4h2v2H1zM3 3h1v4H3zM4 2h1v6H4z"/><path fill="#e0521a" d="M6 3h1v1H6zM7 4h1v2H7zM8 3h1v1H8zM6 6h1v1H6zM8 6h1v1H8z"/></svg>',
  pause: '<svg viewBox="0 0 10 10"><path fill="#ffe589" d="M2 2h2v6H2zM6 2h2v6H6z"/></svg>',
};

export function initUI(game, scene) {
  const screens = ['menu', 'howto', 'info', 'board', 'pause', 'over'];
  let state = 'menu';
  let backTo = 'menu';
  let lastRun = null;
  let savedThisRun = false;
  let highlightId = null;
  let countdownTimer = null;
  let overShownAt = 0;
  let muted = store.getMuted();
  audio.setMuted(muted);

  const show = (name) => {
    screens.forEach((s) => $(`#scr-${s}`).classList.toggle('hidden', s !== name));
    $('#hud').classList.toggle('hidden', !(name === null || name === 'pause'));
    if (name !== null) $('#fire-btn').classList.add('hidden');
    else if ((last.ammo || 0) > 0) $('#fire-btn').classList.remove('hidden');
    if (name) {
      const first = $(`#scr-${name} .btn`);
      if (first && matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
    }
  };

  // --------------------------------------------------------- audio
  const renderAudio = () => {
    $$('#hud-audio, #menu-audio').forEach((b) => { b.innerHTML = muted ? ICON.off : ICON.on; b.setAttribute('aria-label', muted ? 'Attiva audio' : 'Disattiva audio'); });
    $$('.audio-label').forEach((l) => { l.textContent = muted ? 'AUDIO: NO' : 'AUDIO: SI'; });
  };
  const toggleAudio = () => {
    muted = !muted;
    audio.unlock();
    audio.setMuted(muted);
    store.setMuted(muted);
    renderAudio();
  };
  $('#hud-pause').innerHTML = ICON.pause;
  renderAudio();

  // --------------------------------------------------------- icone dagli sprite del gioco
  const icon = (key, frame = 0) => { try { return game.textures.getBase64(key, frame); } catch { return ''; } };
  $$('img[data-tex]').forEach((img) => { img.src = icon(img.dataset.tex, 0); });
  $$('[data-cfg]').forEach((el) => { el.textContent = `${FUEL[el.dataset.cfg]}%`; });
  $$('[data-pistol]').forEach((el) => { el.textContent = `${PISTOL[el.dataset.pistol]}`; });
  try { document.documentElement.style.setProperty('--woven', `url(${wovenBandURL()})`); } catch { /* decorazione */ }
  const first = SCORE.MILESTONES[0];
  $('#pts-table').innerHTML = [
    ['Ogni metro percorso', `+${SCORE.PER_METER}`],
    ['Fascio di asfodelo o ferula', `+${SCORE.MATERIAL}`],
    ['Tappeto Sa Burra (e +1 collezione)', `+${SCORE.CARPET}`],
    ['Botte distrutta / gruppo di botti', `+${SCORE.BARREL} / ${SCORE.BARREL_GROUP}`],
    [`Fiamma accesa ogni ${SCORE.SURVIVAL_EVERY_S} s`, `+${SCORE.SURVIVAL_BONUS}`],
    ['Ostacolo evitato all\'ultimo istante', `+${SCORE.NEAR_MISS}`],
    [`${SCORE.CHAIN_SIZE} raccolte di fila`, `+${SCORE.CHAIN_BONUS}`],
    [`Traguardi (${first.m} m, ${SCORE.MILESTONES[1].m} m, ...)`, `+${first.bonus}...`],
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');

  // --------------------------------------------------------- HUD
  const hud = {
    score: $('#hud-score'), best: $('#hud-best'), dist: $('#hud-dist'), fill: $('#fuel-fill'), fuel: $('#fuel'),
    carpets: $('#hud-carpets'), carpetsCell: $('#hud-carpets-cell'), ammo: $('#hud-ammo'), fire: $('#fire-btn'),
  };
  const setPips = (root, n) => root.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < n));
  const last = {};
  bus.on('hud', (h) => {
    if (h.score !== last.score) { hud.score.textContent = fmt(h.score); last.score = h.score; }
    if (h.best !== last.best) { hud.best.textContent = fmt(h.best); last.best = h.best; }
    if (h.meters !== last.meters) { hud.dist.textContent = fmt(h.meters); last.meters = h.meters; }
    if (h.carpets !== last.carpets) { hud.carpets.textContent = fmt(h.carpets); last.carpets = h.carpets; }
    if (h.ammo !== last.ammo) {
      const armed = h.ammo > 0;
      hud.ammo.classList.toggle('hidden', !armed);
      hud.fire.classList.toggle('hidden', !armed || state !== 'play');
      setPips(hud.ammo, h.ammo); setPips(hud.fire, h.ammo);
      last.ammo = h.ammo;
    }
    const pct = Math.round(h.fuel * 1000) / 10;
    if (pct !== last.pct) {
      hud.fill.style.width = `calc(${pct}% - 2px)`;
      hud.fuel.classList.toggle('low', h.fuel * 100 < FUEL.LOW_WARNING);
      last.pct = pct;
    }
  });
  bus.on('carpet', () => {
    hud.carpetsCell.classList.remove('bump'); void hud.carpetsCell.offsetWidth; hud.carpetsCell.classList.add('bump');
  });
  const refreshBest = () => {
    $('#menu-best').textContent = fmt(store.getBest());
    $('#menu-carpets').textContent = fmt(store.getCarpetTotal());
  };
  refreshBest();

  // --------------------------------------------------------- flusso di gioco
  function play() {
    if (state === 'over' && performance.now() - overShownAt < 350) return; // anti doppio input
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    audio.unlock();
    cancelCountdown();
    if (scene.scene.isPaused()) scene.scene.resume();
    savedThisRun = false;
    highlightId = null;
    state = 'play';
    show(null);
    scene.startRun();
  }
  function pause() {
    if (state !== 'play' || scene.mode !== 'run') return;
    scene.scene.pause();
    state = 'pause';
    show('pause');
  }
  function cancelCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    $('#countdown').classList.add('hidden');
  }
  function resume() {
    if (state !== 'pause') return;
    audio.unlock();
    state = 'countdown';
    show(null);
    let n = 3;
    const cd = $('#countdown');
    cd.textContent = n; cd.classList.remove('hidden');
    audio.click();
    countdownTimer = setInterval(() => {
      n--;
      if (n <= 0) {
        cancelCountdown();
        state = 'play';
        scene.scene.resume();
      } else { cd.textContent = n; audio.click(); }
    }, 420);
  }
  function quit() {
    cancelCountdown();
    if (scene.scene.isPaused()) scene.scene.resume();
    scene.toAttract();
    state = 'menu';
    refreshBest();
    show('menu');
  }
  function open(name) {
    backTo = state === 'over' ? 'over' : 'menu';
    if (name === 'board') renderBoard();
    state = name;
    show(name);
  }
  function back() {
    state = backTo;
    show(backTo);
  }

  bus.on('request-pause', pause);

  // --------------------------------------------------------- game over
  bus.on('gameover', (r) => {
    lastRun = { ...r, id: `${Date.now()}-${r.seed}` };
    const prevBest = store.getBest();
    const dbg = !!r.debug; // partite con ?debug= non entrano in record e classifica
    const isNew = dbg ? false : store.submitBest(r.score);
    if (isNew && prevBest > 0) audio.record();
    state = 'over';
    $('#go-score').textContent = fmt(r.score);
    $('#go-dist').textContent = `${fmt(r.meters)} M`;
    $('#go-best').textContent = fmt(store.getBest());
    $('#go-carpets').textContent = fmt(r.carpets);
    $('#go-barrels').textContent = fmt(r.barrels);
    $('#go-total').textContent = fmt(store.getCarpetTotal());
    overShownAt = performance.now();
    $('#go-newrec').classList.toggle('hidden', !(isNew && r.score > 0));
    const rank = r.score > 0 && !dbg ? store.rankFor(r.score) : null;
    $('#go-rank').textContent = dbg ? 'Partita di prova (debug): fuori classifica'
      : rank ? `Posizione #${rank} nella classifica demo` : `Fuori dalla top ${DEMO_BOARD.SIZE} demo`;
    const nick = $('#nick');
    nick.value = store.getNick();
    nick.disabled = !rank;
    $('#nick-form button').disabled = !rank;
    $('#nick-form').classList.toggle('hidden', !rank);
    setMsg(rank ? 'Salva il tuo nickname nella classifica demo' : '', '');
    refreshBest();
    show('over');
    $('#btn-retry').focus({ preventScroll: true });
  });

  function setMsg(text, cls) {
    const m = $('#nick-msg');
    m.textContent = text;
    m.className = `nick-msg ${cls}`;
  }

  $('#nick').addEventListener('input', (e) => {
    const c = cleanNick(e.target.value);
    if (c !== e.target.value.toUpperCase()) e.target.value = c;
  });
  $('#nick-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!lastRun) return;
    if (savedThisRun) { setMsg('Punteggio gia\' salvato per questa partita', 'ok'); return; }
    const v = validateNick($('#nick').value);
    if (!v.ok) { setMsg(v.error, 'err'); return; }
    store.setNick(v.nick);
    const pos = store.addToBoard({ name: v.nick, score: lastRun.score, dist: lastRun.meters, id: lastRun.id });
    savedThisRun = true;
    highlightId = lastRun.id;
    $('#nick').blur();
    $('#nick').disabled = true;
    $('#nick-form button').disabled = true;
    setMsg(pos ? `Salvato! Posizione #${pos} (demo)` : 'Salvato', 'ok');
    audio.click();
  });

  // --------------------------------------------------------- classifica demo
  function renderBoard() {
    const list = store.getBoard();
    const rows = list.map((e, i) => {
      const cls = [i < 3 ? `top${i + 1}` : '', e.id && e.id === highlightId ? 'me' : ''].join(' ');
      const date = e.date ? new Date(e.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '<span class="sample">esempio</span>';
      return `<tr class="${cls}"><td>${i + 1}</td><td>${escapeHtml(e.name)}</td><td>${fmt(e.score)}</td><td>${date}</td></tr>`;
    });
    if (!rows.length) rows.push('<tr class="empty"><td colspan="4">Nessun punteggio: accendi la prima frakkera!</td></tr>');
    $('#board-table').innerHTML = `<thead><tr><th>POS</th><th>NICKNAME</th><th>PUNTI</th><th>DATA</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --------------------------------------------------------- pulsanti
  const actions = {
    play, retry: play, resume, quit, back,
    board: () => open('board'), howto: () => open('howto'), info: () => open('info'),
    audio: toggleAudio,
    'reset-board': () => {
      if (confirm('Azzerare la classifica demo su questo dispositivo?')) { store.resetBoard(); highlightId = null; renderBoard(); }
    },
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.act !== 'audio') audio.click();
    actions[b.dataset.act]?.();
  });
  $('#hud-pause').addEventListener('click', (e) => { e.preventDefault(); pause(); });
  // pulsante SPARA: il tocco non arriva al canvas (niente cambio corsia)
  const fireBtn = $('#fire-btn');
  const doFire = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (scene.fire()) { fireBtn.classList.remove('shot'); void fireBtn.offsetWidth; fireBtn.classList.add('shot'); }
  };
  fireBtn.addEventListener('pointerdown', doFire);
  ['pointerup', 'pointermove', 'click', 'touchstart', 'touchend'].forEach((ev) => fireBtn.addEventListener(ev, (e) => { e.stopPropagation(); if (ev !== 'touchstart') e.preventDefault(); }, { passive: false }));
  $('#hud-audio').addEventListener('click', (e) => { e.preventDefault(); toggleAudio(); });
  // non far arrivare i tocchi dei pulsanti HUD al canvas
  $$('#hud .icon-btn').forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));

  // tastiera globale
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && (state === 'play' || state === 'countdown')) { e.preventDefault(); return; }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (document.activeElement && document.activeElement.classList.contains('btn')) return; // il browser clicca il pulsante
      if (state === 'menu') { e.preventDefault(); play(); }
      else if (state === 'over') { e.preventDefault(); if (performance.now() - overShownAt > 350) play(); }
      else if (state === 'pause') { e.preventDefault(); resume(); }
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'pause') resume();
      else if (['howto', 'info', 'board'].includes(state)) back();
    } else if (e.code === 'KeyR' && state === 'over') {
      if (performance.now() - overShownAt > 350) play();
    } else if (e.code === 'KeyM') toggleAudio();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && (state === 'play' || state === 'countdown')) e.preventDefault();
  });

  // --------------------------------------------------------- pausa automatica / background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); if (state === 'countdown') { cancelCountdown(); scene.scene.pause(); state = 'pause'; show('pause'); } audio.setHidden(true); }
    else audio.setHidden(false);
  });
  window.addEventListener('blur', () => {
    pause();
    if (state === 'countdown') { cancelCountdown(); state = 'pause'; show('pause'); }
  });
  window.addEventListener('pagehide', () => pause());

  // primo gesto: sblocca l'audio (atmosfera del menu)
  const firstGesture = () => { audio.unlock(); };
  window.addEventListener('pointerdown', firstGesture, { once: true, capture: true });
  window.addEventListener('keydown', firstGesture, { once: true, capture: true });

  $('#loading').classList.add('hidden');
  show('menu');

  if (new URLSearchParams(location.search).has('test')) {
    window.__frk = { state: () => scene.debugState(), ui: () => state, texCanvas: (k) => game.textures.get(k).getSourceImage() };
  }
}
