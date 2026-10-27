# v5 stage 23c: vicolo delle porte e cappella tonda in fondo al paese (giro 1 e giro 3 con neve)
import asyncio, json, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4793/'
MARKS = [172, 178, 184, 190, 200, 208, 216, 224]
async def main():
    W = 390; bad = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for lap in (0, 2):
            ctx = await b.new_context(viewport={'width': W, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'{URL}?test=1&map=village&at=150&lap={lap}')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            zs = []; mi = 0
            for _ in range(900):
                r = await pg.evaluate("(()=>{const g=window.__frk.game,s=g.sim,w=g.world; s.fuel=100; s.invuln=1; if(s.mode==='dance'||s.danceCue) s.skipDance(); if(s.mode==='shop') s.exitShop(); const c=w.env.cur; return {loc:c.b.id==='village'?c.local:250+c.local, z:w.vista.position.z, x:w.vista.position.x, vis:w.vista.visible, cz:w.camera.position.z}})()")
                if r['vis'] and mi > 0: zs.append((round(r['z'], 2), round(r['x'], 2)))
                if mi < len(MARKS) and r['loc'] >= MARKS[mi]:
                    await pg.screenshot(path=f'screenshots/v5s23c-{W}-giro{lap+1}-{MARKS[mi]}m.png'); print(lap+1, MARKS[mi], json.dumps(r)); mi += 1
                if mi >= len(MARKS): break
                await asyncio.sleep(0.05)
            u = sorted(set(zs)); print('giro', lap+1, 'posizioni distinte del campanile:', u[:3], len(u), errs[:2])
            if len(u) != 1: bad += 1
            await ctx.close()
        await b.close()
    sys.exit(0)
asyncio.run(main())
