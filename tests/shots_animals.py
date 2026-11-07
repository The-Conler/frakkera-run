# v5s24: screenshot degli animali (390 px). Uso: python3 tests/shots_animals.py [porta]
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else '4824'
L = 34
SC = {
  'gregge': ('rock', 60, "[{kind:'pastore',lane:0,side:-1,len:12,n:5,at:250},...[0,15,82,97,112].map((o,i)=>({kind:'pecora',lane:0,len:12,dir:1,vx:26,xoff:o,flock:1,variant:i%3,at:240}))]", 1.6),
  'maialetto': ('river', 60, "[{kind:'maialetto',lane:0,len:10,dir:1,vx:40,at:200}]", 1.3),
  'cane': ('village', 60, "[{kind:'cane',lane:0,side:-1,len:10,at:12},{kind:'muretto',lane:1,len:14,at:230}]", 1.4),
  'cane-pastore': ('rock', 120, "[{kind:'canepastore',lane:1,len:8,at:12}]", 1.2),
  'capre-roccia': ('rock', 90, "[{kind:'caprarupe',lane:0,side:-1,len:12,at:200},{kind:'caprarupe',lane:2,side:1,len:12,at:330}]", 1.0),
}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for name, (m, at, ents, wait) in [(k, v) for k, v in SC.items() if len(sys.argv) < 3 or k in sys.argv[2:]]:
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://127.0.0.1:{PORT}/?test=1&map={m}&at={at}&lap=0')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            for _ in range(8):
                await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;})()"); await asyncio.sleep(0.25)
            await pg.evaluate("""(()=>{const g=window.__frk.game, s=g.sim; s.gen.fillUntil=()=>{}; for (const e of s.entities) e.d=-1e9; s.tick(0.016);
              for (const e of %s) { const a=e.at; delete e.at; s.spawn({...e, d:s.T-s.genOffset+a}); } })()""" % ents)
            t = 0
            while t < wait:
                await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=0;})()"); await asyncio.sleep(0.2); t += 0.2
            st = await pg.evaluate("(()=>{const s=window.__frk.game.sim; return {dogT:s.dogT, chase:!!s.chase, ev:s.events.slice(-6).map(e=>e[1]).join(''), n:s.entities.length}})()")
            path = f'screenshots/feat-animals-{name}.png'
            await pg.screenshot(path=path); print(path, st, errs[:2])
            await ctx.close()
        await b.close()
asyncio.run(main())
