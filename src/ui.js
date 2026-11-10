// =====================================================================
// Interfaccia HTML/CSS sopra il canvas 3D: menu, HUD, pannelli, game over.
// Tutti i pulsanti sono elementi reali; le icone sono SVG inline.
// =====================================================================
import { SCORE, FUEL, DEMO_BOARD, PISTOL, SHOP, DANCE, SKINS, UPGRADES, POWER } from './config.js';
import { bus } from './bus.js';
import { audio } from './systems/audio.js';
import * as store from './systems/storage.js';
import { validateNick, cleanNick } from './systems/nickname.js';
import { carpetDataURL, carpetURL, carpetsReady } from './game/tex3d.js';
import { BIOMES, biomeAt } from './game/biomes/config.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const use = (id) => `<svg><use href="#${id}"/></svg>`;

export function initUI(game) {
  const screens = ['menu', 'skins', 'settings', 'howto', 'info', 'board', 'pause', 'over', 'shop'];
  let state = 'menu';
  let backTo = 'menu';
  let pausedAt = -1e9;
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
    // v5s24: potenziamenti attivi con il tempo che resta
    for (const [id, key, max] of [['#hud-magnet', 'magnetT', 10], ['#hud-fennel', 'fennelT', 5], ['#hud-boots', 'bootsT', 4]]) {
      const v = h[key] || 0, el = $(id); if (!el) continue;
      const sec = Math.ceil(v);
      if (sec !== last[key]) { el.classList.toggle('hidden', v <= 0); el.querySelector('.ptime').textContent = sec; last[key] = sec; }
      if (v > 0) el.querySelector('.pbar i').style.width = `${Math.round((v / max) * 100)}%`;
    }
    const pct = Math.round(h.fuel * 1000) / 10;
    if (pct !== last.pct) {
      hud.fill.style.width = `calc(${pct}% - 6px)`;
      hud.fuel.classList.toggle('low', h.fuel * 100 < FUEL.LOW_WARNING);
      hud.fuel.classList.toggle('crit', h.fuel * 100 < FUEL.LOW_WARNING / 2);   // v5s46 (111): sotto meta' soglia lampeggia piu' in fretta
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
      // v5s26: primo posto libero (mai due testi centrali sovrapposti, es. PIU' VELOCE! e SCAMBIO!)
      const used = new Set([...popLayer.querySelectorAll('.pop.center')].map((q) => q.dataset.slot));
      let slot = 0; while (used.has(String(slot)) && slot < 5) slot++;
      if (slot >= 5) { popLayer.querySelector('.pop.center')?.remove(); slot = 0; }
      el.dataset.slot = String(slot); el.style.top = `${26 + slot * 8}%`;
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
    // v5s45 (QA10 #8): si aspetta anche la fine del pre-riscaldamento (shader e geometrie): prima finiva nei primi 50 m di corsa
    // v5s9: se il corridore 3D non e' ancora caricato si aspetta (max 10 s) invece di partire con la fiamma che vola da sola
    const c3 = game.world && game.world.char3d;
    if (((c3 && !c3.ready && !c3.failed) || game.world.dancersPending || (game.world.env && game.world.env._warm && !game.world.env._warmDone)) && performance.now() - (play.t0 ??= performance.now()) < 14000) { $('#loading').classList.remove('hidden'); setTimeout(play, 120); return; }
    // v5s45 (QA10 #5): le icone 3D del Garage di Pinu si disegnano qui, dietro la schermata di caricamento (prima al primo
    // arrivo da Pinu sul giro 2: ridimensionava il renderer e compilava 4 shader => scatto di ~2-9 s a 1620-1680 m)
    if (!play.icons) { play.icons = true; try { icon('pistola'); } catch (err) { /* solo anticipo */ } }
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
    state = 'pause'; pausedAt = performance.now();   // v5s27p: lo stesso Esc che mette in pausa non deve anche riprendere
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
    // v5s46 (166): 3-2-1 piu' leggibile (ogni numero "salta" fuori), poi VIA! mentre la corsa riparte
    let n = 3;
    const cd = $('#countdown');
    const pop = (txt) => { cd.textContent = txt; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); };
    pop(n); cd.classList.remove('hidden', 'go');
    audio.click();
    countdownTimer = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(countdownTimer); countdownTimer = null; state = 'play'; game.resume();
        cd.classList.add('go'); pop('VIA!'); audio.click();
        setTimeout(() => { if (!countdownTimer) { cd.classList.add('hidden'); cd.classList.remove('go'); } }, 380);
      } else { pop(n); audio.click(); }
    }, 560);
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
    if (name === 'skins') renderSkins();
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
    // v5s44: al rientro in paese PIÙ VELOCE! e l'offerta di Pinu stavano nello stesso punto
    popLayer.querySelectorAll('.pop.speed').forEach((el) => el.remove());
    offerT0 = performance.now(); offerDur = d.s * 1000; offerBtn.classList.remove('hidden');
    const tick = () => { const st = game.debugState(); const k = Math.max(0, st.shopOffer / d.s); $('#shop-offer-bar').style.transform = `scaleX(${k})`; if (k > 0 && st.mode === 'run') offerRaf = requestAnimationFrame(tick); else hideOffer(); };
    tick();
  });
  bus.on('shopOfferEnd', hideOffer);
  const SAY = { tappeti: 'Mi mancano un po\' di tappeti, eh!', tetto: 'Basta cos\u00ec per oggi, torna al prossimo giro!', esaurito: 'Quello l\'ho finito.', pieno: 'Ce l\'hai gi\u00e0, non ti serve!', ok: ['Ottima scelta!', 'Tieni, e occhio alle travi!', 'Fai buona strada!'] };
  // v5s15: icone 3D nitide (render una volta), descrizioni chiare e stati posseduto / limite
  let shopIcons = null;
  const icon = (id) => {
    if (!shopIcons) { try { shopIcons = game.world.renderShopIcons(192); } catch (err) { shopIcons = {}; console.warn('icone negozio', err); } }
    return shopIcons[id] ? `<img src="${shopIcons[id]}" alt="" />` : use(id === 'pistola' ? 'i-pistol' : id === 'scudo' ? 'i-crown' : 'i-flame');
  };
  const DESC = {
    pistola: () => `<b>+3 colpi</b> per far saltare le botti (max ${SHOP.AMMO_CAP})`,
    asfodelo: () => '<b>Fiamma piena</b> subito',
    scudo: () => '<b>Para 1 urto</b> contro botti e travi',
  };
  let lastBuy = null;
  function renderShop() {
    const st = game.debugState(), sh = st.shop || { buys: {}, count: 0 };
    $('#shop-total').textContent = fmt(st.carpetTotal);
    $('#shop-count').textContent = sh.count; $('#shop-max').textContent = SHOP.MAX_PER_VISIT;
    $$('#shop-pips i').forEach((p, i) => p.classList.toggle('on', i < sh.count));
    const limit = sh.count >= SHOP.MAX_PER_VISIT;
    const box = $('#shop-items'); box.replaceChildren();
    for (const it of SHOP.ITEMS) {
      const b = document.createElement('button'); b.className = 'shop-item'; b.dataset.item = it.id;
      const got = sh.buys[it.id] || 0, left = it.max - got;
      const full = (it.id === 'pistola' && st.ammo >= SHOP.AMMO_CAP) || (it.id === 'asfodelo' && st.fuel >= FUEL.MAX - 0.5) || (it.id === 'scudo' && st.shield > 0);
      const poor = st.carpetTotal < it.price;
      let tag = '', cls = '';
      if (left <= 0) { tag = 'PRESO'; cls = 'owned'; }
      else if (limit) { tag = 'LIMITE'; cls = 'limit'; }
      else if (full) { tag = it.id === 'scudo' ? 'ATTIVO' : 'PIENO'; cls = 'full'; }
      else if (poor) { tag = `MANCANO ${it.price - st.carpetTotal}`; cls = 'poor'; }
      if (cls) b.classList.add(cls);
      b.innerHTML = `<span class="si-ico">${icon(it.id)}${got ? `<i class="si-own">${got}/${it.max}</i>` : ''}</span>`
        + `<span class="si-text"><span class="si-name">${it.name}</span><span class="si-desc">${DESC[it.id] ? DESC[it.id]() : it.desc}</span></span>`
        + (tag ? `<span class="si-tag">${tag}</span>` : `<span class="si-price">${it.price}<svg><use href="#i-carpet"/></svg></span>`);
      if (left <= 0 || limit || poor) b.disabled = true;
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = game.buyItem(it.id);
        const say = $('#shop-say');
        say.textContent = r.ok ? SAY.ok[(game.debugState().shop?.count || 1) - 1] || SAY.ok[0] : SAY[r.why] || 'Non si pu\u00f2.';
        say.classList.remove('say-pop'); void say.offsetWidth; say.classList.add('say-pop');
        renderShop();
        const nb = $(`.shop-item[data-item="${it.id}"]`);
        if (r.ok) {
          nb && nb.classList.add('bought');
          if (nb) { const f = document.createElement('span'); f.className = 'si-fly'; f.textContent = `-${it.price}`; nb.appendChild(f); }
          const w = $('.shop-wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump');
        } else if (nb) { nb.classList.remove('nope'); void nb.offsetWidth; nb.classList.add('nope'); }
      });
      box.appendChild(b);
    }
    // v5s25: migliorie permanenti (3 livelli, salvate in locale, fuori dal tetto per visita)
    const h = document.createElement('div'); h.className = 'up-head'; h.textContent = 'MIGLIORIE PER SEMPRE'; box.appendChild(h);
    const UPICO = { calamita: 'i-magnet', finocchio: 'i-fennel', scarponi: 'i-boots', fiamma: 'i-flame' };
    const BASE = { calamita: POWER.MAGNET_S, finocchio: POWER.FENNEL_S, scarponi: POWER.BOOTS_S };
    for (const u of UPGRADES) {
      const lvl = (st.up && st.up[u.id]) || 0, max = lvl >= 3, price = u.prices[Math.min(2, lvl)];
      const now = u.unit === '%' ? (lvl ? `-${Math.round(u.add * lvl * 100)}% consumo` : 'consumo normale') : `${(BASE[u.id] + u.add * lvl).toFixed(1).replace('.0', '')} s`;
      const b = document.createElement('button'); b.className = 'shop-item up-item'; b.dataset.up = u.id;
      const poor = !max && st.carpetTotal < price;
      if (max) b.classList.add('owned'); else if (poor) b.classList.add('poor');
      b.innerHTML = `<span class="si-ico">${use(UPICO[u.id])}</span>`
        + `<span class="si-text"><span class="si-name">${u.name}</span><span class="si-desc">${now} <span class="up-lv">${[0, 1, 2].map((i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></span></span>`
        + (max ? '<span class="si-tag">MAX</span>' : poor ? `<span class="si-tag">MANCANO ${price - st.carpetTotal}</span>` : `<span class="si-price">${price}<svg><use href="#i-carpet"/></svg></span>`);
      if (max || poor) b.disabled = true;
      b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = game.buyUpgrade(u.id); const say = $('#shop-say');
        say.textContent = r.ok ? `Livello ${r.level}: lavoro fatto bene!` : SAY[r.why] || 'Non si pu\u00f2.';
        renderShop();
        if (r.ok) { const w = $('.shop-wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); }
      });
      box.appendChild(b);
    }
  }
  // v5s45 (#10): l'offerta di Pinu si apre con un tocco (rilascio senza spostamento); uno swipe che parte sopra
  // il banner arriva al gioco (prima entrava subito nel negozio e il salto andava perso)
  let offerDown = null;
  offerBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); offerDown = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  offerBtn.addEventListener('pointerup', (e) => {
    const d = offerDown; offerDown = null;
    if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
    e.preventDefault(); e.stopPropagation();
    if (state !== 'play' || !game.enterShop()) return;
    hideOffer();
    state = 'shop';
    $('#shop-say').textContent = 'Bentornato, piccioc\u00f9! Cosa ti serve per la strada?';
    renderShop();
    show('shop'); $('#hud').classList.add('hidden'); measureShopUI();
  });
  ['click', 'touchend'].forEach((ev) => offerBtn.addEventListener(ev, (e) => { e.preventDefault(); }, { passive: false }));
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

  const ZONE = { village: 'Gadoni', rock: 'La roccia', river: 'Il fiume', viaduct: 'Il viadotto', 'mine-ext': 'Miniera', 'mine-int': 'Galleria', 'mine-blue': 'Galleria blu' };
  function confetti(on) {
    const box = $('#go-confetti'); box.replaceChildren();
    if (!on) return;
    const cols = ['#ffd24a', '#c0283c', '#f3e8cc', '#2f8f6a', '#ff8a3a'];
    for (let i = 0; i < 26; i++) {
      const c = document.createElement('i');
      c.style.cssText = `left:${50 + (i % 2 ? 1 : -1) * (4 + (i * 37) % 44)}%;background:${cols[i % cols.length]};--dx:${((i * 53) % 120) - 60}px;--dy:${-60 - (i * 29) % 90}px;--r:${(i * 71) % 360}deg;animation-delay:${0.9 + (i % 6) * 0.04}s`;
      box.appendChild(c);
    }
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
    { const el = $('#go-reason'); el.textContent = r.reason || ''; el.classList.toggle('hidden', !r.reason); }   // v5s45 (18): 'Ciccio ti ha preso!'
    $('#go-best').textContent = fmt(store.getBest());
    $('#go-carpets').textContent = fmt(r.carpets);
    $('#go-barrels').textContent = fmt(r.barrels);
    { const bi = biomeAt((r.meters || 0) + (r.log?.mapOffsetM || 0)); $('#go-biome').textContent = (ZONE[bi.b.id] || bi.b.name) + (bi.lap ? ` · giro ${bi.lap + 1}` : ''); }
    $('#go-total').textContent = fmt(store.getCarpetTotal());
    overShownAt = performance.now();
    const rec = isNew && r.score > 0;
    $('#go-newrec').classList.toggle('hidden', !rec);
    $('#scr-over').classList.toggle('is-rec', rec);
    confetti(rec);
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

  // --------------------------------------------------------- v5s19: costumi
  function renderSkins() {
    const c = store.getCollection(), un = store.getUnlocked(), cur = store.getSkin();
    $('#coll-bell').textContent = c.bell; $('#coll-sweet').textContent = c.sweet;
    $('#skin-list').innerHTML = SKINS.map((k) => {
      const owned = un.includes(k.id), can = c.bell >= k.cost.bell && c.sweet >= k.cost.sweet;
      let btn;
      if (cur === k.id) btn = '<span class="skin-tag on">IN USO</span>';
      else if (owned) btn = `<button class="btn btn-primary small" data-skin="${k.id}" data-op="use">SCEGLI</button>`;
      else if (can) btn = `<button class="btn btn-primary small" data-skin="${k.id}" data-op="buy">SBLOCCA</button>`;
      else { const mb = Math.max(0, k.cost.bell - c.bell), ms = Math.max(0, k.cost.sweet - c.sweet); btn = `<span class="skin-tag">MANCANO ${mb ? `${mb}${use('i-bell')}` : ''} ${ms ? `${ms}${use('i-sweet')}` : ''}</span>`; }   // v5s20: solo quello che manca
      const cost = owned ? '' : `<div class="skin-cost">${k.cost.bell}${use('i-bell')} ${k.cost.sweet}${use('i-sweet')}</div>`;
      return `<div class="skin-card ${cur === k.id ? 'sel' : ''} ${owned ? '' : 'locked'}" data-id="${k.id}"><div class="skin-ico skin-${k.id}">${use(k.id === 'base' || k.id === 'classico' ? 'i-flame' : 'i-mask')}</div><div class="skin-txt"><b>${k.name}</b><p>${k.desc}</p>${cost}</div><div class="skin-act">${btn}</div></div>`;
    }).join('');
  }
  $('#skin-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-skin]'); if (!b) return;
    const k = SKINS.find((x) => x.id === b.dataset.skin); if (!k) return;
    if (b.dataset.op === 'buy') {
      const c = store.getCollection(); if (c.bell < k.cost.bell || c.sweet < k.cost.sweet) return;
      store.unlockSkin(k.id); audio.pistolPickup?.();
    } else audio.click();
    store.setSkin(k.id); game.setSkin(k.id); renderSkins();
  });
  bus.on('collect', () => { if (state === 'skins') renderSkins(); });

  // --------------------------------------------------------- pulsanti
  const actions = {
    play, retry: play, resume, quit, back,
    board: () => open('board'), howto: () => open('howto'), info: () => open('info'), settings: () => open('settings'), skins: () => open('skins'),
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
      if (state === 'pause') { if (performance.now() - pausedAt > 250) resume(); }
      else if (['howto', 'info', 'board', 'settings', 'skins'].includes(state)) back();
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
