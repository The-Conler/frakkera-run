# v5s42b: fiamma incollata alla punta in ogni stato (telefono 390x844). Uso: URL=... python3 tests/shots_s42b.py TAG
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4833/'); TAG = sys.argv[1]; D='/workspace/frakkera-run/screenshots'
async def shot(pg, n):
  await pg.evaluate("(()=>{const s=window.__frk&&window.__frk.game.sim; window.__noinv=1; if(s){s.invuln=0;}})()"); await asyncio.sleep(0.06)
  o=f'{D}/v5s42b-{TAG}-flame-{n}.png'; await pg.screenshot(path=o); print(o, flush=True); await pg.evaluate('window.__noinv=0')
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); await pg.goto(f'{URL}?test=1&map=rock&at=40')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
    await asyncio.sleep(1.5); await shot(pg,'menu')
    await pg.click('[data-act=play]'); await pg.evaluate("window.__keep=setInterval(()=>{const s=window.__frk.game.sim; s.fuel=100; if(!window.__noinv) s.invuln=1;},50)")
    await asyncio.sleep(2); await shot(pg,'run')
    await pg.evaluate("window.__frk.game.sim.jump()"); await asyncio.sleep(0.25); await shot(pg,'jump')
    await asyncio.sleep(0.8); await pg.evaluate("window.__frk.game.sim.move(-1)"); await asyncio.sleep(0.08); await shot(pg,'lane')
    await asyncio.sleep(0.8); await pg.evaluate("window.__frk.game.sim.duck()"); await asyncio.sleep(0.2); await shot(pg,'slide')
    o=f'{D}/v5s42b-{TAG}-flame-closeup.png'; await pg.evaluate("window.__noinv=1;window.__frk.game.sim.invuln=0"); await asyncio.sleep(0.6); await pg.screenshot(path=o, clip={'x':95,'y':380,'width':200,'height':400}); print(o); await pg.evaluate('window.__noinv=0')
    for sk in ['classico','stramaioni']:
      await pg.evaluate(f"window.__frk.game.world.setSkin('{sk}')"); await asyncio.sleep(0.8); await shot(pg, 'skin-'+sk)
    await pg.evaluate("window.__frk.game.world.setSkin('base')")
    await asyncio.sleep(1); await pg.evaluate("window.__frk.game.sim.startDance(0)"); await asyncio.sleep(2.5); await shot(pg,'dance')
    await ctx.close()
    ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); await pg.goto(f'{URL}?test=1&map=rock&at=40')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
    await asyncio.sleep(1.5); await pg.click('[data-act=play]'); await asyncio.sleep(1.5)
    await pg.evaluate("window.__frk.game.sim.finish()"); await asyncio.sleep(1.2); await shot(pg,'gameover-1s')
    await asyncio.sleep(2.5); await shot(pg,'gameover-4s')
    await b.close()
asyncio.run(main())
