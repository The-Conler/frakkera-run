#!/usr/bin/env python3
"""v5s46c QA gate - regressione visiva: screenshot a seed fisso in ogni ambiente, giri 0 e 1, a 390x844 e 360x640,
controllo HUD (sovrapposizioni, fuori schermo, testi piccoli, SPARA sulla corsia destra, popup sovrapposti) e foglio provini.
Uso: python3 qa/shots.py BASE_URL OUTDIR"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); PAGE = open(os.path.join(HERE, 'page.js')).read()
BASE, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
SEED = int(os.environ.get('QA_SEED', '4242'))
SPOTS = [int(x) for x in os.environ.get('QA_SPOTS', '20,33,45,72,131,180,190,240,300,400,480,560,620,685,800,850,894,950,1050,1100,1140,1180,1250,1320,1400,1500,1580').split(',')]
VIEWS = [tuple(int(v) for v in x.split('x')) for x in os.environ.get('QA_VIEWS', '390x844,360x640').split(',')]
LAPS = [int(x) for x in os.environ.get('QA_LAPS', '0,1').split(',')]
FORCED = (300, 560)
async def one(p, lap, vw, vh):
  b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
  ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
  pg.on('console', lambda m: errs.append('console.error: ' + m.text[:300]) if m.type == 'error' else None)
  await pg.goto(f"{BASE}?test=1&map=village&lap={lap}&fixeddpr=1", wait_until='domcontentloaded')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=300000)
  await asyncio.sleep(1)
  await pg.evaluate(f"(()=>{{const s=window.__frk.game.sim; const o=s.startRun.bind(s); s.startRun=(x)=>o({SEED});}})()")
  await pg.click('[data-act=play]'); await pg.wait_for_function("window.__frk.game.sim.mode==='run'", timeout=120000)
  await pg.evaluate(PAGE)
  res = []
  for m in SPOTS:
    await pg.evaluate(f"window.__qa.ff({lap*1600+m-5})")
    await pg.evaluate("(()=>{const s=window.__frk.game.sim; if(s.mode==='run'){ s.ammo=Math.max(s.ammo||0,3);} })()")
    await asyncio.sleep(0.9)
    path = f"{OUT}/L{lap}-{vw}x{vh}-{m:04d}.png"
    await pg.screenshot(path=path)
    h = await pg.evaluate("window.__qa.hud()")
    loc = await pg.evaluate("window.__qa.local()")
    res.append({'lap': lap, 'view': f'{vw}x{vh}', 'm': m, 'at': round(loc, 1), 'path': path, 'hud': h})
    if lap == LAPS[0] and m in FORCED:
      # tronco/ramo caduto forzato (roccia e fiume): deve poggiare a terra ai lati della via
      await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.spawn({kind:'ramo', lane:1, d: s.T + 240 - s.genOffset, len:10, variant:0}); })()")
      await pg.evaluate("window.__qa.frames(2)")
      await pg.evaluate("window.__frk.game.paused=true"); await asyncio.sleep(0.8)
      fp = f"{OUT}/ramo-L{lap}-{vw}x{vh}-{m:04d}.png"; await pg.screenshot(path=fp)
      g = await pg.evaluate("window.__qa.ground(40)")
      res.append({'lap': lap, 'view': f'{vw}x{vh}', 'm': m, 'forced': 'ramo', 'path': fp, 'hud': await pg.evaluate("window.__qa.hud()"), 'ground': g})
      await pg.evaluate("window.__frk.game.paused=false")
  await b.close()
  return res, errs
def sheet(rows, out):
  W, H, s = 390, 844, 0.32
  tw, th = int(W * s), int(H * s)
  cols = len(SPOTS); keys = sorted(set((r['lap'], r['view']) for r in rows))
  img = Image.new('RGB', (cols * tw, len(keys) * (th + 14)), 'black'); d = ImageDraw.Draw(img)
  for ki, k in enumerate(keys):
    for ci, m in enumerate(SPOTS):
      r = next((x for x in rows if (x['lap'], x['view']) == k and x['m'] == m and not x.get('forced')), None)
      if not r: continue
      im = Image.open(r['path']).convert('RGB'); im.thumbnail((tw, th))
      img.paste(im, (ci * tw, ki * (th + 14) + 14)); d.text((ci * tw + 2, ki * (th + 14)), f"L{k[0]} {k[1]} {m}m", fill='white')
  forced = [r for r in rows if r.get('forced')]
  if forced:
    big = Image.new('RGB', (img.width, img.height + th + 14), 'black'); big.paste(img, (0, 0)); d = ImageDraw.Draw(big)
    for i, r in enumerate(forced):
      im = Image.open(r['path']).convert('RGB'); im.thumbnail((tw, th)); big.paste(im, (i * tw, img.height + 14)); d.text((i * tw + 2, img.height), f"RAMO L{r['lap']} {r['view']} {r['m']}m", fill='yellow')
    img = big
  img.save(out)
async def main():
  rows = []; errs = []
  async with async_playwright() as p:
    jobs = [one(p, lap, vw, vh) for lap in LAPS for vw, vh in VIEWS]
    for r, e in await asyncio.gather(*jobs): rows += r; errs += e
  sheet(rows, f"{OUT}/contact-sheet.png")
  json.dump({'rows': rows, 'errors': errs}, open(f"{OUT}/shots.json", 'w'), indent=1)
  print(json.dumps({'shots': len(rows), 'errors': len(errs)}))
asyncio.run(main())
