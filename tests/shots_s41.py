# v5s41: viadotto prima/dopo (ostacoli forzati: botte coricata, trave, botte che rotola). Uso: URL=... python3 tests/shots_s41.py before|after
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4832/'); TAG = sys.argv[1]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); await pg.goto(f'{URL}?test=1&map=viaduct&at=60')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
    await asyncio.sleep(1); await pg.click('[data-act=play]'); await asyncio.sleep(2.5)
    await pg.evaluate("""(()=>{const s=window.__frk.game.sim; s.invuln=99; s.fuel=100; for(const e of s.entities) if(e.d>=s.T) e.done=true; s.gen.fillUntil=()=>{};
      const d=s.T-s.genOffset; s.spawn({kind:'bottecoricata',lane:0,d:d+190,len:14}); s.spawn({kind:'trave',lane:1,d:d+300,len:8}); s.spawn({kind:'rollbarrel',lane:2,d:d+200,len:12,dir:-1,vx:0}); })()""")
    await asyncio.sleep(0.8)
    out = f'/workspace/frakkera-run/screenshots/v5s41-{TAG}-viaduct.png'; await pg.screenshot(path=out); print(out)
    await b.close()
asyncio.run(main())
