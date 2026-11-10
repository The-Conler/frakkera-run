#!/usr/bin/env python3
"""v5s46c QA gate - soak: N partite vere (bot che sterza, salta, si abbassa, spara) fino a 1700 m+, 0 errori in console.
Fuoco/scudo tenuti pieni (si misura la stabilita', non l'abilita'); il tempo e' accelerato di QA_ACCEL tick per frame.
Uso: python3 qa/soak.py BASE_URL OUT.json"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright
BASE, OUT = sys.argv[1], sys.argv[2]
N = int(os.environ.get('QA_RUNS', '10')); TARGET = float(os.environ.get('QA_TARGET', '1710')); ACCEL = int(os.environ.get('QA_ACCEL', '3')); PAR = int(os.environ.get('QA_PAR', '4'))
STYLES = ['bot', 'left', 'right', 'jumpy', 'bot']
BOT = r'''
(style) => {
  const g = window.__frk.game, s = g.sim;
  const DUCK = {trave:1, ramo:1, panni:1, fune:1};
  const JUMP = {botte:1, bottecoricata:1, muretto:1, sasso:1, botti:1, pozza:1, bagnato:1, rollbarrel:1, fuso:1};
  const LW = 40;
  window.__qa = window.__qa || {acts:0};
  window.__qaT = setInterval(() => {
    if (s.mode === 'dance') { try { s.skipDance(); } catch(e){} return; }
    if (s.mode === 'shop') { try { s.exitShop(); } catch(e){} return; }
    if (s.mode !== 'run') return;
    if (style === 'idle') return;
    const v = Math.max(30, s.currentSpeed || 30), T = s.T;
    if (style === 'jumpy' && Math.random() < 0.08) { s.jump(); return; }
    const lanes = [0,1,2].map(l => {
      let t = 99, k = null;
      for (const e of s.entities) { if (e.done || e.hit || e.pickup) continue;
        const dd = e.d - T; if (dd < -10 || dd > v * 1.6) continue;
        const ex = s.entX(e), lx = (l - 1) * LW; if (Math.abs(ex - lx) > 22 && e.kind !== 'trave' && e.kind !== 'ramo' && e.kind !== 'panni' && e.kind !== 'fune') continue;
        const tt = Math.max(0, dd) / v; if (tt < t) { t = tt; k = e; } }
      return {t, k};
    });
    const cur = s.targetLane, c = lanes[cur];
    if (c.k && DUCK[c.k.kind] && c.t < 0.35) { s.duck(); window.__qa.acts++; return; }
    if (c.k && c.t < 0.9) {
      let best = cur; for (const l of [cur-1, cur+1]) if (l >= 0 && l <= 2 && lanes[l].t > lanes[best].t + 0.05) best = l;
      if (best !== cur) { s.move(best > cur ? 1 : -1); window.__qa.acts++; return; }
      if (JUMP[c.k.kind] && c.t < 0.3) { s.jump(); window.__qa.acts++; return; }
    }
    if (style === 'left' && cur > 0 && !c.k && Math.random() < 0.05) s.move(-1);
    if (style === 'right' && cur < 2 && !c.k && Math.random() < 0.05) s.move(1);
    if (s.ammo > 0 && c.k && c.t < 0.8 && Math.random() < 0.5) try { s.fire(); } catch(e){}
  }, 90);
}
'''
async def run(p, i):
  seed = 1000 + i * 3571; style = STYLES[i % len(STYLES)]
  b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
  ctx = await b.new_context(viewport={'width': 390 if i % 2 == 0 else 360, 'height': 844 if i % 2 == 0 else 640}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page(); errs = []
  warns = []
  pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else (warns.append(m.text[:200]) if m.type == 'warning' else None))
  pg.on('crash', lambda: errs.append('page crashed'))
  pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
  await pg.goto(f'{BASE}?test=1', wait_until='domcontentloaded')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=300000)
  await asyncio.sleep(1)
  await pg.evaluate(f"(()=>{{const s=window.__frk.game.sim; const o=s.startRun.bind(s); s.startRun=(x)=>o({seed});}})()")
  await pg.click('[data-act=play]')
  await pg.wait_for_function("window.__frk.game.sim.mode==='run'", timeout=120000)
  await pg.evaluate("window.__god=setInterval(()=>{const s=window.__frk.game.sim; s.fuel=100; s.shield=1;},30)")
  await pg.evaluate(f"({BOT})('{style}')")
  await pg.evaluate("(n)=>{const s=window.__frk.game.sim; const f=()=>{ window.__fr=(window.__fr|0)+1; if(s.mode==='run') for(let i=0;i<n;i++) s.tick(1/120); requestAnimationFrame(f);}; requestAnimationFrame(f);}", ACCEL)
  t0 = time.time(); m = 0; last = (0, time.time()); modes = set(); stuck = False
  while time.time() - t0 < 2400:
    await asyncio.sleep(3)
    try: st = await asyncio.wait_for(pg.evaluate("(()=>{const g=window.__frk.game,s=g.sim;return {m:s.runD/10+(s.mapOffsetM||0),mode:s.mode,hits:s.stats.hits,paused:g.paused,spd:Math.round(s.currentSpeed||0),fr:window.__fr|0,lost:!!(g.world.renderer.getContext().isContextLost())}})()"), 30)
    except Exception as ex: st = {'m': m, 'mode': 'unresponsive:' + str(ex)[:80]}
    m = st['m']; modes.add(st['mode'])
    if m > last[0] + 1: last = (m, time.time())
    elif time.time() - last[1] > 120: stuck = st; break
    if m >= TARGET: break
  r = {'run': i, 'seed': seed, 'style': style, 'm': round(m, 1), 'secs': round(time.time() - t0), 'modes': sorted(modes), 'stuck': stuck, 'errors': errs[:10], 'warnings': warns[-5:]}
  r['ok'] = m >= TARGET and not errs and not stuck
  print(json.dumps(r), flush=True)
  await b.close(); return r
async def main():
  res = []
  async with async_playwright() as p:
    for k in range(0, N, PAR): res += await asyncio.gather(*[run(p, i) for i in range(k, min(N, k + PAR))])
  json.dump(res, open(OUT, 'w'), indent=1)
  ok = sum(r['ok'] for r in res); print(json.dumps({'runs': len(res), 'pass': ok, 'fail': len(res) - ok}))
  sys.exit(0 if ok == len(res) else 1)
asyncio.run(main())
