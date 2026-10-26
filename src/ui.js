// =====================================================================
// Interfaccia HTML/CSS sopra il canvas 3D: menu, HUD, pannelli, game over.
// Tutti i pulsanti sono elementi reali; le icone sono SVG inline.
// =====================================================================
import { SCORE, FUEL, DEMO_BOARD, PISTOL, SHOP, DANCE } from './config.js';
import { bus } from './bus.js';
import { audio } from './systems/audio.js';
import * as store from './systems/storage.js';
import { validateNick, cleanNick } from './systems/nickname.js';
import { carpetDataURL, carpetURL, carpetsReady } from './game/tex3d.js';
import { BIOMES } from './game/biomes/config.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const use = (id) => `<svg><use href="#${id}"/></svg>`;

export function initUI(game) {
  const screens = ['menu', 'settings', 'howto', 'info', 'board', 'pause', 'over', 'shop'];
  let state = 'menu';
  let backTo = 'menu';
  let lastRun = null;
  let savedThisRun = false;
  let highlightId = null;
  let countdownTimer = null;
  let overShownAt = 0;
  let countRaf = 0;
  let muted = store.getMuted();
  let music = store.getMusic();
  audio.setMuted(muted);
  audio.setMusic(music);

  const show = (name) => {
    screens.forEach((s) => $(`#scr-${s}`).classList.toggle('hidden', s !== name));
    $('#hud').classList.toggle('hidden', !(name === null || name === 'pause'));
    if (name !== null) $('#fire-btn').classList.add('hidden');
    else if ((last.ammo || 0) > 0) $('#fire-btn').classList.remove('hidden');
    if (name !== null) $('#popups').replaceChildren();
    if (name) {
      const first = $(`#scr-${name} .btn`);
      if (first && matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
    }
  };

  // --------------------------------------------------------- audio / musica
  const renderAudio = () => {
    $('#hud-audio').innerHTML = use(muted ? 'i-mute' : 'i-sound');
    $('#hud-audio').setAttribute('aria-label', muted ? 'Attiva audio' : 'Disattiva audio');
    const ma = $('#menu-audio');
    ma.classList.toggle('on', !muted);
    ma.querySelector('.opt-ico use').setAttribute('href', muted ? '#i-mute' : '#i-sound');
    ma.setAttribute('aria-pressed', String(!muted));
    $('#menu-music').classList.toggle('on', music);
    $('#menu-music').setAttribute('aria-pressed', String(music));
    $$('.audio-label').forEach((l) => { l.textContent = muted ? 'AUDIO: NO' : 'AUDIO: SI'; });
  };
  const toggleAudio = () => {
    muted = !muted;
    audio.unlock(); audio.setMuted(muted); store.setMuted(muted);
    renderAudio();
  };
  const toggleMusic = () => {
    music = !music;
    audio.unlock(); audio.setMusic(music); store.setMusic(music);
    renderAudio();
  };
  renderAudio();

  // --------------------------------------------------------- icone 3D e testi di configurazione
  const renderIconImgs = (only) => {
    try {
      const kinds = only || [...new Set($$('img[data-icon]').map((i) => i.dataset.icon))];
      const icons = game.world.renderIcons(kinds, 160);
      $$('img[data-icon]').forEach((img) => { if (icons[img.dataset.icon]) img.src = icons[img.dataset.icon]; });
    } catch (err) { console.warn('icone non disponibili', err); }
  };
  renderIconImgs();
  // tappeti ufficiali Sa Burra: icona dell'interfaccia (HUD, menu, game over) = foto del tappeto vero
  const sym = document.getElementById('i-carpet');
  if (sym) {
    const procedural = sym.innerHTML;
    const probe = new Image();
    probe.onload = () => { sym.innerHTML = `<image href="${carpetDataURL(0)}" x="0" y="5.6" width="24" height="12.8" preserveAspectRatio="xMidYMid meet"/>`; };
    probe.onerror = () => { sym.innerHTML = procedural; };
    probe.src = carpetDataURL(0);
  }
  document.documentElement.style.setProperty('--carpet-band', `url(${new URL(carpetURL(0), document.baseURI).href})`); // assoluto: nel CSS di assets/ un url relativo puntava ad assets/textures (404)
  { const pb = new Image(); pb.onerror = () => { try { document.documentElement.style.setProperty('--carpet-band', `url(${carpetDataURL(0, false)})`); } catch { /* decorazione */ } }; pb.src = carpetURL(0); }
  // quando le texture dei tappeti sono pronte si rifanno le icone 3D del tappeto
  carpetsReady().then(() => { if ($$('img[data-icon="tappeto"]').length) renderIconImgs(['tappeto']); });
  $$('[data-cfg]').forEach((el) => { el.textContent = `${FUEL[el.dataset.cfg]}%`; });
  $$('[data-pistol]').forEach((el) => { el.textContent = `${PISTOL[el.dataset.pistol]}`; });
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
    carpets: $('#hud-carpets'), carpetsCell: $('#hud-carpets-cell'), ammo: $('#hud-ammo'), ammoN: $('#hud-ammo-n'), fire: $('#fire-btn'),
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
      hud.ammoN.textContent = h.ammo;
      setPips(hud.ammo, h.ammo); setPips(hud.fire, h.ammo);
      last.ammo = h.ammo;
    }
    const pct = Math.round(h.fuel * 1000) / 10;
    if (pct !== last.pct) {
      hud.fill.style.width = `calc(${pct}% - 6px)`;
      hud.fuel.classList.toggle('low', h.fuel * 100 < FUEL.LOW_WARNING);
      last.pct = pct;
    }
  });
  bus.on('carpet', () => {
    hud.carpetsCell.classList.remove('bump'); void hud.carpetsCell.offsetWidth; hud.carpetsCell.classList.add('bump');
  });

  // --------------------------------------------------------- popup (testi volanti)
  const popLayer = $('#popups');
  bus.on('popup', (p) => {
    if (state !== 'play' && state !== 'countdown') return;
    while (popLayer.childElementCount > 7) popLayer.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `pop ${p.style || 'white'}`;
    el.textContent = p.text;
    if (p.x != null) { el.style.left = `${Math.max(12, Math.min(88, p.x * 100))}%`; el.style.top = `${Math.max(12, p.y * 100)}%`; }
    else {
      el.classList.add('center');
      const n = popLayer.querySelectorAll('.pop.center').length;
      el.style.top = `${26 + (n % 4) * 7}%`;
    }
    el.addEventListener('animationend', () => el.remove());
    popLayer.appendChild(el);
  });

  const refreshBest = () => {
    $('#menu-best').textContent = fmt(store.getBest());
    $('#menu-carpets').textContent = fmt(store.getCarpetTotal());
  };
  refreshBest();

  // --------------------------------------------------------- flusso di gioco
  function play() {
    // v5s9: se il corridore 3D non e' ancora caricato si aspetta (max 10 s) invece di partire con la fiamma che vola da sola
    const c3 = game.world && game.world.char3d;
    if (c3 && !c3.ready && !c3.failed && performance.now() - (play.t0 ??= performance.now()) < 10000) { $('#loading').classList.remove('hidden'); setTimeout(play, 120); return; }
    play.t0 = undefined; $('#loading').classList.add('hidden');
    if (state === 'over' && performance.now() - overShownAt < 350) return; // anti doppio input
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    audio.unlock();
    cancelCountdown();
    cancelAnimationFrame(countRaf);
    if (game.isPaused()) game.resume();
    savedThisRun = false;
    highlightId = null;
    state = 'play';
    show(null);
    game.startRun();
  }
  function pause() {
    if (state !== 'play' || game.mode !== 'run') return;
    game.pause();
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
      if (n <= 0) { cancelCountdown(); state = 'play'; game.resume(); }
      else { cd.textContent = n; audio.click(); }
    }, 420);
  }
  function quit() {
    cancelCountdown();
    cancelAnimationFrame(countRaf);
    if (game.isPaused()) game.resume();
    game.toAttract();
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
  function back() { state = backTo; show(backTo); }

  bus.on('request-pause', pause);

  // --------------------------------------------------------- v5s11: ballu tundu
  {
    const ui = $('#dance-ui'), skip = $('#dance-skip'), cv = $('#dn-canvas'), jd = $('#dn-judge'), cb = $('#dn-combo');
    const COLS = { left: '#3aa0ff', down: '#2ee6c8', up: '#ff8a3a', right: '#ff4f9a' };
    const DIRS = ['left', 'down', 'up', 'right'];
    const ROT = { left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2, right: 0 };
    let raf = 0;
    const arrow = (x, y, s, dir, col, glow, alpha = 1, fill = false) => {
      x.save(); x.translate(y[0], y[1]); x.rotate(ROT[dir]); x.globalAlpha = alpha;
      x.beginPath(); x.moveTo(s * 0.5, 0); x.lineTo(0, -s * 0.45); x.lineTo(0, -s * 0.18); x.lineTo(-s * 0.48, -s * 0.18); x.lineTo(-s * 0.48, s * 0.18); x.lineTo(0, s * 0.18); x.lineTo(0, s * 0.45); x.closePath();
      x.lineJoin = 'round'; x.shadowColor = col; x.shadowBlur = glow; x.lineWidth = s * 0.09; x.strokeStyle = col;
      if (fill) { x.fillStyle = col + '55'; x.fill(); }
      x.stroke(); x.shadowBlur = 0; x.lineWidth = s * 0.035; x.strokeStyle = '#ffffffcc'; x.stroke(); x.restore();
    };
    const draw = () => {
      const d = game.sim.dance;
      if (!d) { raf = 0; ui.classList.add('hidden'); skip.classList.add('hidden'); return; }
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      const pads = [...document.querySelectorAll('.dn-pad')].map((p) => { const r = p.getBoundingClientRect(), o = cv.getBoundingClientRect(); return [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2, r.width]; });
      if (!pads.length) return;
      const top = H * 0.2, py = pads[0][1], lead = DANCE.LEAD_S;
      const flash = d.last && d.t - d.last.t < 0.18 && d.last.res !== 'miss' ? d.last.dir : -1;
      DIRS.forEach((dir, i) => arrow(x, [pads[i][0], py], pads[i][2] * 0.92, dir, COLS[dir], flash === i ? 30 : 12, 1, flash === i));
      for (const n of d.notes) {
        const dtn = n.t - d.t; if (dtn > lead || dtn < -0.3) continue;
        if (n.res && n.res !== 'miss') continue;
        const y = py - (dtn / lead) * (py - top);
        const dir = DIRS[n.dir];
        arrow(x, [pads[n.dir][0], y], pads[0][2] * 0.8, dir, n.res === 'miss' ? '#777777' : COLS[dir], 14, n.res === 'miss' ? 0.5 : 1, true);
      }
      // battito
      const bt = 60 / ((d.rounds[d.round] || d.rounds[0]).bpm), k = 1 - ((d.t - DANCE.INTRO_S + 99 * bt) % bt) / bt;
      x.globalAlpha = 0.25 * k * k; x.fillStyle = '#ffcc66'; x.fillRect(0, py - 2, W, 4); x.globalAlpha = 1;
      cb.textContent = d.combo >= 2 ? `COMBO x${d.combo}  \u00b7  ${d.pts}` : d.pts ? `${d.pts}` : '';
      $('#dn-round').textContent = d.t < DANCE.INTRO_S ? 'ENTRA NEL CERCHIO...' : `GIRO ${d.round + 1} / ${d.rounds.length}  \u00b7  ${Math.round(d.rounds[d.round].bpm)} BPM`;
    };
    bus.on('danceCue', () => { if (state === 'play') skip.classList.remove('hidden'); });
    bus.on('danceStart', () => { ui.classList.remove('hidden'); skip.classList.remove('hidden'); jd.textContent = ''; cb.textContent = ''; if (!raf) draw(); });
    bus.on('danceEnd', () => { ui.classList.add('hidden'); skip.classList.add('hidden'); cancelAnimationFrame(raf); raf = 0; });
    bus.on('danceJudge', (j) => { jd.textContent = j.res === 'perfect' ? 'PERFETTO!' : j.res === 'good' ? 'BENE' : 'MANCATO'; jd.className = j.res; void jd.offsetWidth; jd.classList.add('dn-pop'); });
    skip.addEventListener('click', (e) => { e.stopPropagation(); game.skipDance(); });
    skip.addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const p of document.querySelectorAll('.dn-pad')) { p.addEventListener('pointerdown', (e) => { e.stopPropagation(); game.danceInput(p.dataset.dir); }); }
  }

  // --------------------------------------------------------- v5s7: Garag di Pinu
  const offerBtn = $('#shop-offer');
  let offerT0 = 0, offerDur = 0, offerRaf = 0;
  const hideOffer = () => { offerBtn.classList.add('hidden'); cancelAnimationFrame(offerRaf); };
  bus.on('shopOffer', (d) => {
    if (state !== 'play') return;
    offerT0 = performance.now(); offerDur = d.s * 1000; offerBtn.classList.remove('hidden');
    const tick = () => { const st = game.debugState(); const k = Math.max(0, st.shopOffer / d.s); $('#shop-offer-bar').style.transform = `scaleX(${k})`; if (k > 0 && st.mode === 'run') offerRaf = requestAnimationFrame(tick); else hideOffer(); };
    tick();
  });
  bus.on('shopOfferEnd', hideOffer);
  const SAY = { tappeti: 'Mi mancano un po\' di tappeti, eh!', tetto: 'Basta cos\u00ec per oggi, torna al prossimo giro!', esaurito: 'Quello l\'ho finito.', pieno: 'Ce l\'hai gi\u00e0, non ti serve!', ok: ['Ottima scelta!', 'Tieni, e occhio alle travi!', 'Fai buona strada!'] };
  const icon = (id) => id === 'scudo' ? '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#c89a5a" stroke="#ffe7b0" stroke-width="1.5"/><path d="M12 6v12M7 10h10" stroke="#6b3a1a" stroke-width="1.6"/></svg>' : `<img src="${carpetDataURL(0)}" data-icon="${id}" alt="" />`;
  function renderShop() {
    const st = game.debugState(), sh = st.shop || { buys: {}, count: 0 };
    $('#shop-total').textContent = fmt(st.carpetTotal);
    $('#shop-count').textContent = sh.count; $('#shop-max').textContent = SHOP.MAX_PER_VISIT;
    const box = $('#shop-items'); box.replaceChildren();
    for (const it of SHOP.ITEMS) {
      const b = document.createElement('button'); b.className = 'shop-item'; b.dataset.item = it.id;
      const left = it.max - (sh.buys[it.id] || 0);
      b.innerHTML = `<span class="si-ico">${icon(it.id)}</span><span><span class="si-name">${it.name}</span><span class="si-desc">${it.desc}${left <= 0 ? ' &middot; preso' : ''}</span></span><span class="si-price">${it.price}<svg><use href="#i-carpet"/></svg></span>`;
      if (left <= 0 || sh.count >= SHOP.MAX_PER_VISIT || st.carpetTotal < it.price) b.disabled = true;
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = game.buyItem(it.id);
        $('#shop-say').textContent = r.ok ? SAY.ok[(game.debugState().shop?.count || 1) - 1] || SAY.ok[0] : SAY[r.why] || 'Non si pu\u00f2.';
        renderShop();
        if (r.ok) { const nb = $(`.shop-item[data-item="${it.id}"]`); nb && nb.classList.add('bought'); }
      });
      box.appendChild(b);
    }
    // icone ufficiali gia' usate altrove (asfodelo, pistola)
    $$('#shop-items img[data-icon]').forEach((im) => { const src = document.querySelector(`.items img[data-icon="${im.dataset.icon}"]`)?.src; if (src) im.src = src; });
  }
  offerBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (state !== 'play' || !game.enterShop()) return;
    hideOffer();
    state = 'shop';
    $('#shop-say').textContent = 'Bentornato, piccioc\u00f9! Cosa ti serve per la strada?';
    renderShop();
    show('shop'); $('#hud').classList.add('hidden'); measureShopUI();
  });
  ['pointerup', 'pointermove', 'click', 'touchstart', 'touchend'].forEach((ev) => offerBtn.addEventListener(ev, (e) => { e.stopPropagation(); if (ev !== 'touchstart') e.preventDefault(); }, { passive: false }));
  $('#scr-shop').addEventListener('pointerdown', (e) => e.stopPropagation());
  // v5s7b: la camera del negozio inquadra la bancarella nello spazio libero tra titolo e pannello
  function measureShopUI() {
    const H = window.innerHeight || 1, top = $('.shop-top').getBoundingClientRect(), pan = $('.shop-panel').getBoundingClientRect();
    game.world.shopUI = { top: Math.min(0.3, (top.bottom + 4) / H), bottom: Math.min(0.5, (H - pan.top + 4) / H) };
  }
  window.addEventListener('resize', () => { if (state === 'shop') measureShopUI(); });
  function leaveShop() {
    if (state !== 'shop') return;
    state = 'shopcount';
    game.leaveShopView();
    show(null);
    let n = 3;
    const cd = $('#countdown'); cd.textContent = n; cd.classList.remove('hidden'); audio.click();
    countdownTimer = setInterval(() => {
      n--;
      if (n <= 0) { cancelCountdown(); state = 'play'; game.exitShop(); }
      else { cd.textContent = n; audio.click(); }
    }, 420);
  }
  $('#shop-exit').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); leaveShop(); });

  // --------------------------------------------------------- game over
  function countUp(el, target) {
    cancelAnimationFrame(countRaf);
    el.dataset.final = String(target);
    const t0 = performance.now() + 450, dur = Math.min(1300, 500 + target / 8);
    const step = (t) => {
      const k = Math.max(0, Math.min(1, (t - t0) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(target * e));
      if (k < 1) countRaf = requestAnimationFrame(step);
      else el.textContent = fmt(target);
    };
    el.textContent = '0';
    countRaf = requestAnimationFrame(step);
  }

  bus.on('gameover', (r) => {
    lastRun = { ...r, id: `${Date.now()}-${r.seed}` };
    const prevBest = store.getBest();
    const dbg = !!r.debug; // partite con ?debug= non entrano in record e classifica
    const isNew = dbg ? false : store.submitBest(r.score);
    if (isNew && prevBest > 0) audio.record();
    state = 'over';
    countUp($('#go-score'), r.score);
    $('#go-dist').textContent = `${fmt(r.meters)} m`;
    $('#go-best').textContent = fmt(store.getBest());
    $('#go-carpets').textContent = fmt(r.carpets);
    $('#go-barrels').textContent = fmt(r.barrels);
    $('#go-total').textContent = fmt(store.getCarpetTotal());
    overShownAt = performance.now();
    $('#go-newrec').classList.toggle('hidden', !(isNew && r.score > 0));
    const rank = r.score > 0 && !dbg ? store.rankFor(r.score) : null;
    $('#go-rank').textContent = dbg ? 'Partita di prova (debug): fuori classifica'
      : rank ? `Posizione #${rank} in classifica demo` : `Fuori dalla top ${DEMO_BOARD.SIZE} demo`;
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
    if (savedThisRun) { setMsg('Punteggio già salvato per questa partita', 'ok'); return; }
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
      return `<tr class="${cls}"><td><span class="medal">${i + 1}</span></td><td>${escapeHtml(e.name)}</td><td>${fmt(e.score)}</td><td>${date}</td></tr>`;
    });
    if (!rows.length) rows.push('<tr class="empty"><td colspan="4">Nessun punteggio: accendi la prima frakkera!</td></tr>');
    $('#board-table').innerHTML = `<thead><tr><th>POS</th><th>NICKNAME</th><th>PUNTI</th><th>DATA</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --------------------------------------------------------- pulsanti
  const actions = {
    play, retry: play, resume, quit, back,
    board: () => open('board'), howto: () => open('howto'), info: () => open('info'), settings: () => open('settings'),
    audio: toggleAudio, music: toggleMusic,
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
  const stop = (e) => e.stopPropagation();
  $('#hud-pause').addEventListener('click', (e) => { e.preventDefault(); pause(); });
  $('#hud-audio').addEventListener('click', (e) => { e.preventDefault(); toggleAudio(); });
  // pulsante SPARA: il tocco non arriva al canvas (niente cambio corsia)
  const fireBtn = $('#fire-btn');
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (game.fire()) { fireBtn.classList.remove('shot'); void fireBtn.offsetWidth; fireBtn.classList.add('shot'); }
  });
  ['pointerup', 'pointermove', 'click', 'touchstart', 'touchend'].forEach((ev) => fireBtn.addEventListener(ev, (e) => { e.stopPropagation(); if (ev !== 'touchstart') e.preventDefault(); }, { passive: false }));
  $$('#hud .round-btn').forEach((b) => b.addEventListener('pointerdown', stop));

  // tastiera globale
  const KEYS_GAME = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (KEYS_GAME.includes(e.code) && (state === 'play' || state === 'countdown')) { e.preventDefault(); return; }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (document.activeElement && document.activeElement.matches('.btn, .tile, .opt')) return; // il browser clicca il pulsante
      if (state === 'menu') { e.preventDefault(); play(); }
      else if (state === 'over') { e.preventDefault(); if (performance.now() - overShownAt > 350) play(); }
      else if (state === 'pause') { e.preventDefault(); resume(); }
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'pause') resume();
      else if (['howto', 'info', 'board', 'settings'].includes(state)) back();
    } else if (e.code === 'KeyR' && state === 'over') {
      if (performance.now() - overShownAt > 350) play();
    } else if (e.code === 'KeyM') toggleAudio();
  });

  // --------------------------------------------------------- pausa automatica / background
  const forcePause = () => {
    pause();
    if (state === 'countdown') { cancelCountdown(); game.pause(); state = 'pause'; show('pause'); }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { forcePause(); audio.setHidden(true); game.setHidden?.(true); }
    else { audio.setHidden(false); game.setHidden?.(false); }
  });
  window.addEventListener('blur', forcePause);
  window.addEventListener('pagehide', forcePause);

  // primo gesto: sblocca l'audio
  const firstGesture = () => { audio.unlock(); };
  window.addEventListener('pointerdown', firstGesture, { once: true, capture: true });
  window.addEventListener('keydown', firstGesture, { once: true, capture: true });

  $('#loading').classList.add('hidden');
  show('menu');

  // v5: menu sviluppatore nascosto (?dev=1): salto diretto a un ambiente di Gadoni
  const qs = new URLSearchParams(location.search);
  if (qs.has('dev')) {
    const box = document.createElement('div');
    box.id = 'dev-maps';
    box.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 64px);z-index:60;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;font:600 12px system-ui;';
    const cur = qs.get('map') || 'village';
    for (const b of BIOMES) {
      const a = document.createElement('a');
      const q = new URLSearchParams(location.search); q.set('map', b.id);
      a.href = '?' + q.toString(); a.textContent = `${b.from} m · ${b.id}`; a.title = b.name;
      a.style.cssText = `padding:6px 9px;border-radius:10px;text-decoration:none;color:#fff;background:${b.id === cur ? '#e8590c' : 'rgba(20,24,60,.78)'};`;
      box.appendChild(a);
    }
    document.body.appendChild(box);
    const menu = $('#scr-menu');
    const sync = () => { box.style.display = menu.classList.contains('hidden') ? 'none' : 'flex'; };
    new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] }); sync();
  }

  if (new URLSearchParams(location.search).has('test')) {
    window.__frk = {
      state: () => game.debugState(), ui: () => state,
      texCanvas: (k) => game.world.character.store.textures.get(k).canvas,
      perf: () => game.perfStats(),
      env: () => game.world.env.debug(),
      game, audio,
    };
  }
}
