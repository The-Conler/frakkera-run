#!/usr/bin/env python3
"""v5s46c QA gate - audit geometrico nel browser (SwiftShader).
Uso: python3 qa/geo_audit.py BASE_URL OUT.json [seed:lap ...]
Per ogni seed/giro percorre tutto il giro (0-1600 m) e ogni STEP metri controlla: buchi sotto l'orizzonte,
pannelli piatti di riempimento visibili, luci senza supporto, appoggio a terra, scenografia nelle corsie / sopra la via,
monumento visibile (160-200 m), z-fighting, binari continui (miniera)."""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = open(os.path.join(HERE, 'page.js')).read()
BASE = sys.argv[1]; OUT = sys.argv[2]
RUNS = [tuple(int(x) for x in a.split(':')) for a in sys.argv[3:]] or [(12345, 0)]
STEP = int(os.environ.get('QA_STEP', '20')); TO = int(os.environ.get('QA_TO', '1600')); FROM = int(os.environ.get('QA_FROM', '0'))
MAPS = [('village', 0), ('rock', 250), ('river', 500), ('viaduct', 750), ('mine-ext', 1000), ('mine-int', 1150), ('mine-blue', 1350)]
def zone(m):
  z = 'village'
  for n, a in MAPS:
    if m >= a: z = n
  return z
async def one(p, seed, lap, start):
  b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
  ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
  pg.on('console', lambda m: errs.append('console.error: ' + m.text[:300]) if m.type == 'error' else None)
  mp = zone(start); off = dict(MAPS)[mp]
  await pg.goto(f"{BASE}?test=1&map={mp}&lap={lap}&at={max(0, start - off)}&fixeddpr=1", wait_until='domcontentloaded')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=300000)
  await asyncio.sleep(1)
  await pg.evaluate(f"(()=>{{const s=window.__frk.game.sim; const o=s.startRun.bind(s); s.startRun=(x)=>o({seed});}})()")
  await pg.click('[data-act=play]')
  await pg.wait_for_function("window.__frk.game.sim.mode==='run'", timeout=120000)
  await pg.evaluate(PAGE)
  res = []
  m = start
  while m < TO:
    tgt = lap * 1600 + m
    await pg.evaluate(f"window.__qa.ff({tgt})")
    await pg.evaluate("window.__qa.frames(8)")
    loc = await pg.evaluate("window.__qa.local()")
    z = zone(int(loc))
    r = {'seed': seed, 'lap': lap, 'm': round(loc, 1), 'zone': z}
    try:
      r['voids'] = await pg.evaluate("window.__qa.voids()")
      r['ground'] = await pg.evaluate("window.__qa.ground()")
      if m % 40 == 0:
        r['lamps'] = await pg.evaluate("window.__qa.lamps()")
        r['zfight'] = await pg.evaluate("window.__qa.zfight()")
      r['corridor'] = await pg.evaluate("window.__qa.corridor(%d, {over: %s, allowOver: (P, o) => /mark:santamarta|mark:mineExit|mark:minePortal|tunnel/.test(o.userData.qaTag)})" % (STEP + 40, 'true' if z == 'village' else 'false'))
      if 160 <= loc % 1600 <= 200: r['memorial'] = await pg.evaluate("window.__qa.memorial()")
      if z in ('mine-ext', 'mine-int', 'mine-blue'): r['rails'] = await pg.evaluate(f"window.__qa.rails({lap*1600+loc+2},{min(lap*1600+loc+2+STEP, lap*1600+1598)})")
    except Exception as e:
      r['err'] = str(e)[:300]
    r['mode'] = await pg.evaluate("window.__frk.game.sim.mode")
    res.append(r); print(json.dumps(r)[:600], flush=True)
    m += STEP
  r = {'seed': seed, 'lap': lap, 'errors': errs[:20]}
  res.append(r)
  await b.close(); return res
async def main():
  allr = []
  async with async_playwright() as p:
    for i in range(0, len(RUNS), 3):
      for rr in await asyncio.gather(*[one(p, s, l, FROM) for s, l in RUNS[i:i + 3]]): allr += rr
  json.dump(allr, open(OUT, 'w'))
asyncio.run(main())
