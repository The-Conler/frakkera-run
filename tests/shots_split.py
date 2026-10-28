# v5 split: vicolo e cappella in mezzo alla via: avvicinamento, passaggio a sinistra e a destra
import asyncio, json, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4799/'
SHOTS = {0: [(150, 'avvicinamento-vicolo'), (170, 'vicolo-sinistra'), (190, 'avvicinamento-cappella'), (207, 'cappella-sinistra')],
         2: [(170, 'vicolo-destra'), (179, 'vicolo-destra-porta'), (207, 'cappella-destra')]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for lane, marks in SHOTS.items():
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'{URL}?test=1&map=village&at=140')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=90000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            mi = 0
            for _ in range(1500):
                r = await pg.evaluate("(L)=>{const g=window.__frk.game,s=g.sim,w=g.world; s.fuel=100; s.invuln=1; if(s.mode==='dance'||s.danceCue) s.skipDance(); if(s.mode==='shop') s.exitShop(); const c=w.env.cur; if(c.local>155) s.targetLane=L; return {loc:c.b.id==='village'?c.local:250+c.local, lane:s.targetLane, px:s.px, hits:s.stats.hits, splits:s.stats.splits}}", lane)
                if mi < len(marks) and r['loc'] >= marks[mi][0]:
                    await pg.screenshot(path=f'screenshots/split-{marks[mi][1]}.png'); print(marks[mi], json.dumps(r)); mi += 1
                if mi >= len(marks): break
                await asyncio.sleep(0.04)
            print('lane', lane, 'errs', errs[:2], json.dumps(r))
            await ctx.close()
        await b.close()
asyncio.run(main())
