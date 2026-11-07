# v5s40: una corsa CONTINUA di N giri (turbo), scansione di case/prefab nelle corsie e tronchi fuori posto, per giro
import asyncio, sys, os, json
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4820/')
TAG = sys.argv[1] if len(sys.argv) > 1 else 'before'
LAPS = int(os.environ.get('LAPS', '5')); TURBO = float(os.environ.get('TURBO', '0.06'))
SCAN = open('tests/scan_s40.js').read()
KEEP = """(()=>{ if (window.__keep) return; const g=window.__frk.game; window.__keep = setInterval(()=>{ const s=g.sim; s.fuel=100; s.invuln=1;
  if(s.mode==='dance'&&s.skipDance) s.skipDance(); if(s.mode==='shop'&&s.exitShop) s.exitShop(); if(s.mode==='run') g.accum += %s; }, 40); })()""" % TURBO
ST = "(()=>{const e=window.__frk.game.world.env; return [e.cur.lap, e.cur.b.id, Math.round(e.cur.local), window.__frk.game.sim.mode]})()"
DUMP = """(()=>{const o=window.__s40; return {house:[...o.house.values()], mark:[...o.mark.values()], logs:[...o.logs.values()], frames:o.frames}})()"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = await ctx.new_page()
    await pg.goto(f'{URL}?test=1')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
    await asyncio.sleep(1.0); await pg.click('[data-act=play]'); await pg.evaluate(KEEP)
    last = None
    while True:
      await pg.evaluate(SCAN); st = await pg.evaluate(ST)
      if st[0] != last: print('lap', st, flush=True); last = st[0]
      if st[0] >= LAPS or st[3] in ('over',): break
      await asyncio.sleep(0.25)
    r = await pg.evaluate(DUMP); await b.close()
  json.dump(r, open(f'/tmp/scan40long-{TAG}.json','w'), indent=1)
  print('house', len(r['house']), 'mark', len(r['mark']), 'logs', len(r['logs']))
asyncio.run(main())
