# v5s42c: frakkera sempre in spalla (game over, costumi). Uso: URL=... python3 tests/shots_s42c.py TAG
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4835/'); TAG = sys.argv[1]; D='/workspace/frakkera-run/screenshots'
async def page(b):
  ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page(); await pg.goto(f'{URL}?test=1&map=rock&at=40')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
  await asyncio.sleep(1.5); return ctx, pg
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx, pg = await page(b)
    await pg.click('[data-act=play]'); await asyncio.sleep(1.5)
    await pg.evaluate("window.__frk.game.sim.finish()"); await asyncio.sleep(1.0); o=f'{D}/v5s42c-{TAG}-gameover-1s.png'; await pg.screenshot(path=o); print(o)
    await asyncio.sleep(3.0); o=f'{D}/v5s42c-{TAG}-gameover-4s.png'; await pg.screenshot(path=o); print(o)
    await ctx.close()
    for sk in ['classico','stramaioni']:
      ctx, pg = await page(b)
      await pg.evaluate(f"window.__frk.game.world.setSkin('{sk}')"); await asyncio.sleep(1.5); o=f'{D}/v5s42c-{TAG}-{sk}-menu.png'; await pg.screenshot(path=o); print(o)
      await pg.click('[data-act=play]'); await asyncio.sleep(0.3); await pg.evaluate(f"window.__frk.game.world.setSkin('{sk}'); setInterval(()=>{{const s=window.__frk.game.sim; s.fuel=100;}},50)")
      await asyncio.sleep(2.0); o=f'{D}/v5s42c-{TAG}-{sk}-run.png'; await pg.screenshot(path=o); print(o)
      await ctx.close()
    await b.close()
asyncio.run(main())
