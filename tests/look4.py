"""Screenshot rapidi per iterare sul personaggio v4. Uso: python3 tests/look4.py URL out_prefix [mobile|desktop]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; MOB = (sys.argv[3] if len(sys.argv) > 3 else 'mobile') == 'mobile'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await (b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if MOB else b.new_context(viewport={'width': 1366, 'height': 900}))
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        await pg.goto(URL + '?test=1')
        await pg.wait_for_function('window.__frk && window.__frk.game && (window.__frk.game.world.char3d.ready || window.__frk.game.world.char3d.failed)', timeout=60000)
        dbg = lambda: pg.evaluate('window.__frk.game.world.char3d.debug()')
        await asyncio.sleep(4.5)
        await pg.screenshot(path=OUT + '-menu.png'); print('MENU', await dbg())
        await pg.click('[data-act=play]')
        await asyncio.sleep(2.5)
        await pg.screenshot(path=OUT + '-run.png')
        await pg.keyboard.press('ArrowLeft'); await asyncio.sleep(0.16)
        await pg.screenshot(path=OUT + '-lane.png'); d = await dbg(); print('LANE', d['weights'], d['spring'])
        await asyncio.sleep(1.0)
        await pg.evaluate("(() => { const g = window.__frk.game; g.world.onFx('hit', {}, g.sim); })()")
        await asyncio.sleep(0.22)
        await pg.screenshot(path=OUT + '-stumble.png'); d = await dbg(); print('STUMBLE', d['weights'], d['stumbling'])
        await asyncio.sleep(1.2)
        await pg.evaluate('window.__frk.game.sim.fuel = 0.3')
        for i in range(100):
            await asyncio.sleep(0.1)
            if (await pg.evaluate('window.__frk.state().mode')) != 'run': break
        await asyncio.sleep(0.9)
        await pg.screenshot(path=OUT + '-dying.png'); d = await dbg(); print('DYING', d['state'], d['weights'])
        await asyncio.sleep(2.5)
        await pg.screenshot(path=OUT + '-over.png'); d = await dbg(); print('OVER', d['state'], d['weights'])
        print('REC', (await dbg())['rec']); print('ERRS', errs[:10])
        await b.close()
asyncio.run(main())
