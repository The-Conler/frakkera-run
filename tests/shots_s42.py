# v5s42: screenshot ai punti segnalati (telefono 390x844). Uso: URL=... python3 tests/shots_s42.py TAG
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4832/'); TAG = sys.argv[1]
JOBS = [('viaduct-rain-5572m', '&map=viaduct&at=22&lap=3', 3.0), ('village-night-5011m', '&map=village&at=200&lap=3', 3.0),
        ('stiddiosa-3916m', '&map=river&at=205&lap=2', 3.0), ('flame-run', '&map=rock&at=40', 2.0)]
ONLY = os.environ.get('ONLY')
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for name, q, wait in JOBS:
      if ONLY and ONLY not in name: continue
      ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
      pg = await ctx.new_page(); await pg.goto(f'{URL}?test=1{q}')
      await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
      await asyncio.sleep(1.5)
      if name.startswith('flame'):
        o = f'/workspace/frakkera-run/screenshots/v5s42-{TAG}-flame-menu.png'; await pg.screenshot(path=o); print(o)
      await pg.click('[data-act=play]'); await pg.evaluate("setInterval(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;},50)")
      await asyncio.sleep(wait)
      o = f'/workspace/frakkera-run/screenshots/v5s42-{TAG}-{name}.png'; await pg.screenshot(path=o); print(o, await pg.evaluate("(()=>{const e=window.__frk.game.world.env;return [e.cur.lap,e.cur.b.id,Math.round(e.cur.local), Math.round(window.__frk.game.sim.runD/10)]})()"))
      if name.startswith('flame'):
        await pg.evaluate("window.__frk.game.sim.jump()"); await asyncio.sleep(0.25); o = f'/workspace/frakkera-run/screenshots/v5s42-{TAG}-flame-jump.png'; await pg.screenshot(path=o); print(o)
        await pg.evaluate("window.__frk.game.sim.move(-1)"); await asyncio.sleep(0.08); o = f'/workspace/frakkera-run/screenshots/v5s42-{TAG}-flame-lane.png'; await pg.screenshot(path=o); print(o)
      await ctx.close()
    await b.close()
asyncio.run(main())
