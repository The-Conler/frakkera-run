"""
Test end-to-end di FRAKKERA RUN in un browser headless (Chromium/Chrome).
Avvia prima il server:  npm run build && npm run preview   (porta 4173)
Uso: python3 tests/e2e.py [--url http://127.0.0.1:4173/]
Profili: mobile verticale 390x844 (touch) e desktop 1366x900 (tastiera).
Salva gli screenshot in screenshots/ (prefisso v4-).
v4: personaggio 3D (GLB) e macchina a stati delle animazioni: IDLE nel menu, RUN, cambio corsia, STUMBLE, GAME OVER.
v2/v3: tappeti, pistola Broccu (?debug=pistol), botti distrutte, colpi a zero, riavvio istantaneo,
impostazioni audio/musica, conteggio animato del punteggio, misura del tempo di frame (indicativa).
"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

URL = 'http://127.0.0.1:4173/'
if '--url' in sys.argv: URL = sys.argv[sys.argv.index('--url') + 1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots')
os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')

results = []
PERF = {}
def check(name, cond, info=''):
    results.append((name, bool(cond), info))
    print(('  PASS ' if cond else '  FAIL ') + name + (f'  [{info}]' if info else ''))

# Bot: sceglie la corsia evitando ostacoli e cercando materiali
BOT_JS = """(mode) => {
  const s = window.__frk.state();
  if (s.mode !== 'run') return {dir: 0, s};
  const danger = [0,0,0], want = [0,0,0];
  for (const e of s.entities) {
    let lanes = [e.lane];
    if (e.kind === 'goat' || e.kind === 'rollbarrel') lanes = [0,1,2];
    for (const l of lanes) {
      if (e.pickup) { if (e.ahead > -4 && e.ahead < 150) want[l] += (e.kind === 'pistola' ? 6 : 1) / (1 + Math.max(0, e.ahead) / 60); }
      else if (e.ahead + e.len > -8 && e.ahead < 60 + s.speed * 0.35) danger[l] += 10 / (1 + Math.max(0, e.ahead) / 40);
    }
  }
  const cur = s.lane;
  let best = cur, bestScore = -1e9;
  for (let l = 0; l < 3; l++) {
    // per raggiungere l bisogna attraversare le corsie in mezzo
    let pathDanger = 0;
    for (let k = Math.min(l, cur); k <= Math.max(l, cur); k++) pathDanger += danger[k];
    const sc = want[l] * (mode === 'greedy' ? 3 : 1) - pathDanger * 2 - Math.abs(l - cur) * 0.15;
    if (sc > bestScore) { bestScore = sc; best = l; }
  }
  return {dir: Math.sign(best - cur), s};
}"""

NEAR_JS = """() => {
  const s = window.__frk.state();
  const out = {dir: 0, mode: s.mode, nm: s.stats.nearMiss};
  if (s.mode !== 'run') return out;
  const solid = s.entities.filter(e => e.solid && e.kind !== 'goat' && e.kind !== 'rollbarrel');
  const busy = (l, a0, a1) => s.entities.some(e => !e.pickup && (e.lane === l || e.kind === 'goat' || e.kind === 'rollbarrel') && e.ahead + e.len > a0 && e.ahead < a1);
  const lim = s.speed * 0.24 + 5;
  const mine = solid.find(e => e.lane === s.lane && e.ahead > 11 && e.ahead < lim);
  if (mine) {
    for (const d of [-1, 1]) { const t = s.lane + d; if (t >= 0 && t < 3 && !busy(t, -10, 70)) { out.dir = d; return out; } }
  }
  // altrimenti mettiti davanti a un ostacolo lontano con corsie libere accanto
  if (!solid.some(e => e.lane === s.lane && e.ahead > 0 && e.ahead < 120)) {
    const target = solid.find(e => e.ahead > 60 && e.ahead < 150);
    if (target && !busy(target.lane, -10, target.ahead - 5)) out.dir = Math.sign(target.lane - s.lane);
  }
  if (busy(s.lane, -6, lim * 0.3) ) {
    for (const d of [-1, 1]) { const t = s.lane + d; if (t >= 0 && t < 3 && !busy(t, -10, 60)) { out.dir = d; return out; } }
  }
  return out;
}"""

async def swipe(cdp, x0, y0, x1, y1, steps=6):
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
    for i in range(1, steps + 1):
        x = x0 + (x1 - x0) * i / steps; y = y0 + (y1 - y0) * i / steps
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]})
        await asyncio.sleep(0.012)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

async def run_profile(p, name, mobile):
    print(f'\n=== {name} ===')
    args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
    browser = await p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=args)
    if mobile:
        ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                                        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    else:
        ctx = await browser.new_context(viewport={'width': 1366, 'height': 900}, device_scale_factor=1)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    cdp = await ctx.new_cdp_session(page) if mobile else None
    shot = lambda n: page.screenshot(path=os.path.join(SHOTS, f'v4-{name}-{n}.png'))
    c3 = lambda: page.evaluate('window.__frk.game.world.char3d.debug()')
    state = lambda: page.evaluate('window.__frk.state()')
    ui = lambda: page.evaluate('window.__frk.ui()')
    visible = lambda sel: page.evaluate(f"!document.querySelector('{sel}').classList.contains('hidden')")

    await page.goto(URL + '?test=1')
    await page.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=20000)
    await page.wait_for_timeout(1200)
    check('menu visibile', await visible('#scr-menu'))
    try:
        await page.wait_for_function('window.__frk.game.world.char3d.ready || window.__frk.game.world.char3d.failed', timeout=30000)
    except Exception: pass
    await page.wait_for_timeout(900)
    d = await c3()
    check('v4 modello 3D (GLB) caricato', d['ready'] and not d['failed'], json.dumps(d['stats']))
    check('v4 menu: animazione IDLE', d['state'] == 'idle' and d['weights']['idle'] > 0.9, json.dumps(d['weights']))
    check('v4 budget triangoli personaggio <= 20k', 0 < d['stats']['triangles'] <= 20000, str(d['stats']['triangles']))
    check('v4 clip richieste presenti', all(k in d['stats']['clips'] for k in ['idle', 'run', 'left', 'right', 'stumble', 'gameover']), ','.join(d['stats']['clips']))
    txt = await page.inner_text('#scr-menu')
    check('titolo e sottotitolo', 'FRAKKERA' in txt and 'Quanto lontano riuscirai a portare il fuoco?' in txt)
    no_emoji = await page.evaluate("!/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(document.body.innerText)")
    check('nessuna emoji nel testo', no_emoji)
    sw = await page.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth, document.documentElement.scrollHeight, document.documentElement.clientHeight]')
    check('nessuno scroll di pagina', sw[0] <= sw[1] and sw[2] <= sw[3], str(sw))
    await shot('01-menu')

    # schermate secondarie
    for act, scr, n in [('howto', '#scr-howto', '02-howto'), ('info', '#scr-info', '03-info'), ('board', '#scr-board', '04-classifica')]:
        await page.click(f'#scr-menu [data-act={act}]')
        await page.wait_for_timeout(250)
        check(f'schermata {act}', await visible(scr))
        await shot(n)
        await page.click(f'{scr} [data-act=back]')
        await page.wait_for_timeout(150)
        check(f'indietro da {act}', await visible('#scr-menu'))
    board_txt = await page.evaluate("document.querySelector('#scr-board').innerText")
    check('classifica etichettata DEMO', 'DEMO' in board_txt and 'LA CLASSIFICA' in board_txt)

    # impostazioni: audio e musica
    await page.click('#scr-menu [data-act=settings]')
    await page.wait_for_timeout(250)
    check('schermata impostazioni', await visible('#scr-settings'))
    await shot('04b-impostazioni')
    await page.click('#menu-audio')
    m1 = await page.evaluate("localStorage.getItem('frakkera.mute.v1')")
    off1 = await page.evaluate("!document.querySelector('#menu-audio').classList.contains('on')")
    await page.click('#menu-audio')
    m2 = await page.evaluate("localStorage.getItem('frakkera.mute.v1')")
    check('toggle audio persistito', m1 == '1' and m2 == '0' and off1, f'{m1}/{m2}')
    await page.click('#menu-music')
    u1 = await page.evaluate("localStorage.getItem('frakkera.music.v1')")
    await page.click('#menu-music')
    u2 = await page.evaluate("localStorage.getItem('frakkera.music.v1')")
    check('toggle musica persistito', u1 == '0' and u2 == '1', f'{u1}/{u2}')
    await page.click('#scr-settings [data-act=back]')
    await page.wait_for_timeout(150)
    check('indietro da impostazioni', await visible('#scr-menu'))

    # ---------------------------------------------------------------- partita
    await page.click('[data-act=play]')
    await page.wait_for_timeout(400)
    s0 = await state()
    check('partita avviata', s0['mode'] == 'run' and await visible('#hud'))
    await page.wait_for_timeout(500)
    d = await c3()
    check('v4 corsa: animazione RUN', d['state'] == 'run' and d['weights']['run'] > 0.5 and d['weights']['idle'] < 0.3, json.dumps(d['weights']))
    await page.evaluate('window.__frk.game.world.char3d.resetRec()')

    if mobile:
        box = await page.evaluate("(() => { const r = document.querySelector('#game canvas').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()")
        cx, cy, cw, ch = box
        await page.touchscreen.tap(cx + cw * 0.85, cy + ch * 0.55)
        await page.wait_for_timeout(150)
        l1 = (await state())['lane']
        await swipe(cdp, cx + cw * 0.6, cy + ch * 0.6, cx + cw * 0.3, cy + ch * 0.61)
        await page.wait_for_timeout(150)
        l2 = (await state())['lane']
        check('tocco a destra sposta di corsia', l1 == 2, f'lane={l1}')
        check('swipe a sinistra sposta di corsia', l2 == 1, f'lane={l2}')
        sy = await page.evaluate('window.scrollY')
        check('nessuno scroll durante lo swipe', sy == 0)

    if True:
        # pausa manuale
        await page.click('#hud-pause')
        await page.wait_for_timeout(200)
        a = await state(); await page.wait_for_timeout(800); b = await state()
        check('pausa ferma il gioco', await visible('#scr-pause') and abs(a['T'] - b['T']) < 0.01)
        await shot('07-pausa')
        await page.click('[data-act=resume]')
        await page.wait_for_timeout(1700)
        c = await state(); await page.wait_for_timeout(300); d = await state()
        check('riprendi dopo il conto alla rovescia', d['T'] > c['T'] and await ui() == 'play')
        # pausa automatica quando la pagina va in background
        await page.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'))")
        await page.wait_for_timeout(200)
        check('pausa automatica in background', await ui() == 'pause' and await visible('#scr-pause'))
        await page.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange'))")
        await page.click('[data-act=resume]')
        await page.wait_for_timeout(1500)

    async def press(d):
        if d == 0: return
        if mobile:
            await page.touchscreen.tap(cx + cw * (0.2 if d < 0 else 0.8), cy + ch * 0.6)
        else:
            await page.keyboard.press(['ArrowLeft', 'KeyA'][int(time.time()) % 2] if d < 0 else ['ArrowRight', 'KeyD'][int(time.time()) % 2])

    if not mobile:
        # schivate "all'ultimo istante": resta in corsia finche' l'ostacolo e' vicinissimo
        nm0 = 0
        t_nm = time.time() + 14
        while time.time() < t_nm:
            r = await page.evaluate(NEAR_JS)
            if r['mode'] != 'run' or r['nm'] > nm0: break
            await press(r['dir'])
            await page.wait_for_timeout(15)
        snm = await state()
        check('bonus PER UN PELO assegnato', snm['stats']['nearMiss'] > nm0, f"{nm0} -> {snm['stats']['nearMiss']}")
    t_end = time.time() + 20
    fuel_drop_seen = False
    prev = s0
    shots_done = 0
    lane_shot = False; stumble_shot = False
    samples = []
    while time.time() < t_end:
        r = await page.evaluate(BOT_JS, 'greedy')
        s = r['s']
        if s['mode'] != 'run': break
        if s['stats']['pickups'] == prev['stats']['pickups'] and s['fuel'] < prev['fuel'] - 0.05: fuel_drop_seen = True
        samples.append((s['meters'], s['score'], s['fuel']))
        prev = s
        await press(r['dir'])
        if r['dir'] != 0 and not lane_shot:
            await page.wait_for_timeout(60)
            dd = await c3()
            if dd['weights']['left'] + dd['weights']['right'] > 0.25:
                await shot('05b-cambio-corsia'); lane_shot = True
        if not stumble_shot and s['stats']['hits'] > 0:
            dd = await c3()
            if dd['stumbling']: await shot('05c-inciampo'); stumble_shot = True
        if shots_done == 0 and s['meters'] > 60:
            await shot('05-gioco'); shots_done = 1
        elif shots_done == 1 and s['meters'] > 150:
            await shot('06-gioco-avanzato'); shots_done = 2
        await page.wait_for_timeout(40)
    s1 = await state()
    print('  stato dopo ~20s:', json.dumps({k: s1[k] for k in ['mode', 'score', 'meters', 'fuel', 'speed', 'stats']}))
    check('punteggio aumenta', s1['score'] > s0['score'] + 300, f"{s0['score']} -> {s1['score']}")
    check('distanza aumenta', s1['meters'] > 80, f"{s1['meters']} m")
    check('la fiamma si consuma', fuel_drop_seen)
    check('materiali raccolti', s1['stats']['pickups'] > 0, f"{s1['stats']['pickups']}")
    check('velocita crescente', s1['baseSpeed'] > s0['baseSpeed'], f"{s0['baseSpeed']:.0f} -> {s1['baseSpeed']:.0f}")
    hud_score = await page.inner_text('#hud-score')
    check('HUD mostra il punteggio', hud_score.replace('.', '').isdigit())
    d = await c3()
    check('v4 cambio corsia: clip LEFT/RIGHT fuse con la corsa', d['rec']['lean'] > 0.3, f"max peso lean {d['rec']['lean']:.2f}")
    if not stumble_shot:
        # nessun urto vero durante il bot: si forza solo l'effetto visivo (la logica di collisione non viene toccata)
        await page.evaluate("(() => { const g = window.__frk.game; g.world.onFx('hit', {}, g.sim); })()")
        await page.wait_for_timeout(180)
        await shot('05c-inciampo'); stumble_shot = True
    await page.wait_for_timeout(400)
    d = await c3()
    check('v4 urto: animazione STUMBLE', d['rec']['stumbles'] > 0 and d['rec']['stumble'] > 0.5, f"stumbles={d['rec']['stumbles']} max={d['rec']['stumble']:.2f}")

    # lascia spegnere la fiamma (nessun input)
    t_end = time.time() + 120
    while time.time() < t_end:
        if await visible('#scr-over'): break
        await page.wait_for_timeout(300)
    check('game over compare', await visible('#scr-over'))
    d = await c3()
    check('v4 game over: sequenza run -> over e clip GAMEOVER', 'over' in d['rec']['states'] and d['state'] == 'over' and d['weights']['gameover'] > 0.9, json.dumps(d['rec']['states']))
    fade = await page.evaluate('window.__frk.game.world.flame3d.fade')
    check('v4 game over: la fiamma si spegne in fumo', fade < 0.25, f'{fade:.2f}')
    sf = await state()
    early = int((await page.inner_text('#go-score')).replace('.', '') or 0)
    try:
        await page.wait_for_function("document.querySelector('#go-score').textContent.replace(/\\./g, '') === document.querySelector('#go-score').dataset.final", timeout=4000)
    except Exception: pass
    go_score = (await page.inner_text('#go-score')).replace('.', '')
    check('punteggio finale coerente (dopo il conteggio animato)', go_score == str(sf['score']), f'{go_score} vs {sf["score"]}')
    check('conteggio animato del punteggio', sf['score'] == 0 or early < sf['score'], f'iniziale {early}')
    rank_txt = await page.inner_text('#go-rank')
    check('posizione classifica demo mostrata', 'demo' in rank_txt.lower(), rank_txt)
    best_ls = await page.evaluate("localStorage.getItem('frakkera.best.v1')")
    check('record personale salvato', best_ls is not None and int(best_ls) >= sf['score'], str(best_ls))
    await shot('08-game-over')

    # nickname
    if not await page.is_disabled('#nick'):
        await page.fill('#nick', 'c4zz0')
        await page.click('#nick-form button')
        await page.wait_for_timeout(100)
        msg = await page.inner_text('#nick-msg')
        check('filtro nickname offensivo', 'non ammesso' in msg, msg)
        await page.fill('#nick', 'Tester 1')
        await page.click('#nick-form button')
        await page.wait_for_timeout(100)
        msg = await page.inner_text('#nick-msg')
        check('nickname salvato in classifica demo', 'Salvato' in msg, msg)
        await shot('09-game-over-salvato')
    await page.click('#scr-over [data-act=board]')
    await page.wait_for_timeout(200)
    bt = await page.inner_text('#board-table')
    check('voce presente in classifica', 'TESTER 1' in bt)
    await shot('10-classifica-dopo')
    await page.click('#scr-board [data-act=back]')
    await page.wait_for_timeout(150)
    check('indietro torna al game over', await visible('#scr-over'))

    await page.click('[data-act=retry]')
    await page.wait_for_timeout(600)
    sr = await state()
    check('RIPROVA riavvia la partita', sr['mode'] == 'run' and sr['meters'] < 20 and sr['fuel'] > 90, f"{sr['mode']} {sr['meters']}m")
    await page.wait_for_timeout(500)
    d = await c3()
    check('v4 RIPROVA: il personaggio torna a correre', d['state'] == 'run' and d['weights']['gameover'] < 0.5, json.dumps(d['weights']))
    await page.wait_for_timeout(1500)

    # torna al menu e verifica persistenza dopo ricarica
    best = await page.evaluate("localStorage.getItem('frakkera.best.v1')")
    await page.reload()
    await page.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=20000)
    mb = (await page.inner_text('#menu-best')).replace('.', '')
    check('record personale dopo ricarica', mb == best, f'{mb} vs {best}')

    await v2_section(page, name, mobile, cdp, check, shot, state, visible)

    real_errors = [e for e in errors if 'GL Driver' not in e and 'GPU stall' not in e]
    check('nessun errore in console', not real_errors, '; '.join(real_errors[:5]))
    await browser.close()

AIM_JS = """() => {
  const s = window.__frk.state();
  const out = {dir: 0, fire: false, mode: s.mode, s};
  if (s.mode !== 'run') return out;
  const blocking = (l, a0, a1) => s.entities.some(e => !e.pickup && (e.lane === l || e.kind === 'goat' || e.kind === 'rollbarrel') && e.ahead + e.len > a0 && e.ahead < a1);
  if (s.ammo > 0) {
    const tg = s.entities.filter(e => e.destructible && e.kind !== 'rollbarrel' && e.ahead > 26 && e.ahead < 150).sort((a, b) => a.ahead - b.ahead)[0];
    if (tg) {
      if (tg.lane === s.lane) {
        const wall = s.entities.some(e => !e.pickup && !e.destructible && e.lane === s.lane && e.ahead > 0 && e.ahead < tg.ahead);
        if (!wall && s.shotsInFlight === 0) { out.fire = true; return out; }
      } else {
        const d = Math.sign(tg.lane - s.lane), nl = s.lane + d;
        if (!blocking(nl, -10, 34)) { out.dir = d; return out; }
      }
    }
  }
  return null;
}"""

async def v2_section(page, name, mobile, cdp, check, shot, state, visible):
    print('  -- v2: tappeti / pistola / botti --')
    await page.goto(URL + '?test=1&debug=pistol')
    await page.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=20000)
    await page.wait_for_timeout(600)
    ls0 = int(await page.evaluate("localStorage.getItem('frakkera.carpets.v1') || '0'"))
    menu_c = (await page.inner_text('#menu-carpets')).replace('.', '')
    check('v2 totale tappeti nel menu', menu_c == str(ls0), f'{menu_c} vs {ls0}')
    check('v2 pulsante SPARA nascosto senza pistola', not await visible('#fire-btn'))
    await page.click('[data-act=play]')
    await page.wait_for_timeout(300)
    box = await page.evaluate("(() => { const r = document.querySelector('#game canvas').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()")
    cx, cy, cw, ch = box

    async def press(d):
        if d == 0: return
        if mobile: await page.touchscreen.tap(cx + cw * (0.2 if d < 0 else 0.8), cy + ch * 0.55)
        else: await page.keyboard.press('ArrowLeft' if d < 0 else 'ArrowRight')

    async def fire():
        if mobile:
            await page.touchscreen.tap(*(await page.evaluate("(() => { const r = document.querySelector('#fire-btn').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")))
        else:
            await page.keyboard.press(['Space', 'KeyW', 'ArrowUp'][int(time.time() * 3) % 3])

    got_pistol = False; hud_shot = False; carpets_shot = False; fire_shot = False
    fire_lane_ok = True; shots_fired = 0; zero_checked = False
    t_end = time.time() + 40
    while time.time() < t_end:
        a = await page.evaluate(AIM_JS)
        s = a['s'] if a else await state()
        if s['mode'] != 'run': break
        if s['ammo'] > 0 and not got_pistol:
            got_pistol = True
            check('v2 pistola raccolta: 3 colpi', s['ammo'] == 3, str(s['ammo']))
            await page.wait_for_timeout(120)
            check('v2 HUD colpi visibile', await visible('#hud-ammo'))
            if mobile: check('v2 pulsante SPARA visibile (mobile)', await visible('#fire-btn'))
            pips = await page.evaluate("document.querySelectorAll('#hud-ammo .pips i.on').length")
            check('v2 HUD mostra 3 colpi', pips == 3, str(pips))
        if not carpets_shot and sum(1 for e in s['entities'] if e['kind'] == 'tappeto' and 0 < e['ahead'] < 200) >= 4 and s['stats']['carpets'] > 0:
            await shot('11-gioco-tappeti'); carpets_shot = True
        if got_pistol and not hud_shot and s['ammo'] > 0:
            await shot('12-hud-colpi'); hud_shot = True
        if a and a['fire']:
            lane0 = s['lane']; b0 = s['stats']['barrels']
            await fire(); shots_fired += 1
            await page.wait_for_timeout(60)
            s2 = await state()
            if mobile and s2['lane'] != lane0: fire_lane_ok = False
            if not fire_shot:
                await shot('13-sparo'); fire_shot = True
            # attesa impatto
            for _ in range(28):
                s3 = await state()
                if s3['stats']['barrels'] > b0:
                    if not getattr(v2_section, 'brk_' + name, False):
                        await shot('14-botte-rotta'); setattr(v2_section, 'brk_' + name, True)
                    break
                await page.wait_for_timeout(25)
            s3 = await state()
            if s3['ammo'] == 0 and not zero_checked:
                zero_checked = True
                await page.wait_for_timeout(120)
                check('v2 colpi a zero: HUD colpi nascosto', not await visible('#hud-ammo'))
                check('v2 colpi a zero: pulsante SPARA nascosto', not await visible('#fire-btn'))
            if s3['stats']['barrels'] > 0 and zero_checked and carpets_shot: break
            continue
        if a and a['dir']:
            await press(a['dir'])
        else:
            r = await page.evaluate(BOT_JS, 'greedy')
            await press(r['dir'])
        await page.wait_for_timeout(30)
    s = await state()
    print('  stato v2:', json.dumps({k: s[k] for k in ['mode', 'score', 'meters', 'ammo', 'carpetTotal', 'events', 'stats']}))
    check('v2 pistola raccolta (debug=pistol)', got_pistol)
    check('v2 colpi sparati', s['stats']['shots'] > 0, str(s['stats']['shots']))
    check('v2 botte distrutta', s['stats']['barrels'] > 0, str(s['stats']['barrels']))
    check('v2 colpi arrivati a zero', zero_checked)
    if mobile: check('v2 il tocco su SPARA non cambia corsia', fire_lane_ok)
    check('v2 tappeti raccolti', s['stats']['carpets'] > 0, str(s['stats']['carpets']))
    ls1 = int(await page.evaluate("localStorage.getItem('frakkera.carpets.v1') || '0'"))
    check('v2 totale tappeti persistito', ls1 == ls0 + s['stats']['carpets'], f'{ls0} + {s["stats"]["carpets"]} = {ls1}')
    hc = (await page.inner_text('#hud-carpets')).replace('.', '')
    check('v2 HUD tappeti', abs(int(hc) - s['stats']['carpets']) <= 1, f'{hc} vs {s["stats"]["carpets"]}')
    ins = await page.evaluate("window.__frk.state().inputs")
    check('v2 log eventi/input registrati', s['events'] > 0 and ins > 0, f"events={s['events']} inputs={ins}")
    perf = await page.evaluate('window.__frk.perf()')
    print('  PERF', name, json.dumps(perf))
    PERF[name] = perf
    # muori: nessun input finche' la fiamma si spegne
    t_end = time.time() + 120
    while time.time() < t_end:
        if await visible('#scr-over'): break
        await page.wait_for_timeout(250)
    check('v2 game over', await visible('#scr-over'))
    sf = await state()
    goc = (await page.inner_text('#go-carpets')).replace('.', ''); gob = (await page.inner_text('#go-barrels')).replace('.', '')
    check('v2 game over: tappeti e botti', goc == str(sf['stats']['carpets']) and gob == str(sf['stats']['barrels']), f'{goc}/{gob} vs {sf["stats"]["carpets"]}/{sf["stats"]["barrels"]}')
    await page.wait_for_timeout(2200)
    await shot('15-game-over')
    # riavvio istantaneo
    t0 = time.time()
    if mobile: await page.tap('#btn-retry')
    else: await page.keyboard.press('KeyR')
    await page.wait_for_function("window.__frk.state().mode === 'run'", timeout=3000)
    dt = time.time() - t0
    sr = await state()
    check('v2 riavvio istantaneo (un tocco/tasto)', sr['meters'] < 15 and sr['ammo'] == 0 and sr['stats']['carpets'] == 0 and dt < 1.0, f'{dt*1000:.0f} ms')
    await page.wait_for_timeout(500)
    await page.reload()
    await page.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=20000)
    mc = (await page.inner_text('#menu-carpets')).replace('.', '')
    ls2 = await page.evaluate("localStorage.getItem('frakkera.carpets.v1')")
    check('v2 totale tappeti dopo ricarica', mc == str(ls2) and int(ls2) >= ls1, f'{mc} vs {ls2}')
    await shot('16-menu-dopo')

async def main():
    async with async_playwright() as p:
        only = os.environ.get('E2E_ONLY', '')
        if only in ('', 'mobile'): await run_profile(p, 'mobile', True)
        if only in ('', 'desktop'): await run_profile(p, 'desktop', False)
    failed = [r for r in results if not r[1]]
    print('\nPERF (headless SwiftShader, indicativo):', json.dumps(PERF))
    print(f'\nRISULTATO: {len(results) - len(failed)}/{len(results)} controlli superati')
    for f in failed: print('  FALLITO:', f[0], f[2])
    sys.exit(1 if failed else 0)

asyncio.run(main())
