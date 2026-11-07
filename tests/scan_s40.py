import asyncio, sys, os, json
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4820/')
TAG = sys.argv[1] if len(sys.argv) > 1 else 'before'
SECS = float(os.environ.get('SECS', '26'))
MAPS = os.environ.get('MAPS', 'village,rock,river,viaduct,mine-ext,mine-int,mine-blue').split(',')
LAPS = int(os.environ.get('LAPS', '3'))
SCAN = open('tests/scan_s40.js').read()
KEEP = """(()=>{ if (window.__keep) return; window.__keep = setInterval(()=>{ const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;
  if(s.mode==='dance'&&s.skipDance) s.skipDance(); if(s.mode==='shop'&&s.exitShop) s.exitShop(); }, 50); })()"""
DUMP = """(()=>{const o=window.__s40; return {house:[...o.house.values()], mark:[...o.mark.values()], logs:[...o.logs.values()], frames:o.frames}})()"""
async def one(b, MAP, AT, lap):
  ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page()
  await pg.goto(f'{URL}?test=1&map={MAP}&at={AT}&lap={lap}')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
  await asyncio.sleep(1.0)
  await pg.click('[data-act=play]')
  await pg.evaluate(KEEP)
  t = 0
  while t < SECS:
    await pg.evaluate(SCAN); await asyncio.sleep(0.35); t += 0.35
  r = await pg.evaluate(DUMP); await ctx.close(); return r
async def main():
  res = {}
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for lap in range(LAPS):
      for MAP in MAPS:
        for AT in (['0','120'] if MAP=='village' else ['5']):
          k = f'{MAP}@{AT}L{lap}'
          try: r = await one(b, MAP, AT, lap)
          except Exception as e: print('FAIL', k, e, flush=True); continue
          res[k] = r; print(k, 'frames', r['frames'], 'house', len(r['house']), 'mark', len(r['mark']), 'logs', len(r['logs']), flush=True)
    await b.close()
  json.dump(res, open(f'/tmp/scan40-{TAG}.json','w'), indent=1)
asyncio.run(main())
