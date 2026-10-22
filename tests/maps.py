"""v5: visita ogni ambiente di Gadoni con il salto di mappa (?map=...), tiene la fiamma piena
(solo nel test, via window.__frk) e salva screenshot mobile 390x844 in screenshots/v5-<map>-*.png.
Uso: python3 tests/maps.py [--url http://127.0.0.1:4173/] [--maps village,rock] [--dsf 2]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = sys.argv[sys.argv.index('--url') + 1] if '--url' in sys.argv else 'http://127.0.0.1:4173/'
MAPS = (sys.argv[sys.argv.index('--maps') + 1] if '--maps' in sys.argv else 'village,rock,river,viaduct,mine-ext,mine-int,mine-blue').split(',')
DSF = float(sys.argv[sys.argv.index('--dsf') + 1]) if '--dsf' in sys.argv else 2
WAITS = [float(x) for x in (sys.argv[sys.argv.index('--waits') + 1] if '--waits' in sys.argv else '2.5,7').split(',')]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots'); os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
KEEP = "(() => { const g = window.__frk.game; g.sim.fuel = Math.max(g.sim.fuel, %s); g.sim.invuln = 5; })()"
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for mp in MAPS:
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.goto(URL + f'?test=1&fixeddpr&map={mp}')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=30000)
            await pg.wait_for_function('window.__frk.game.world.char3d.ready || window.__frk.game.world.char3d.failed', timeout=30000)
            await asyncio.sleep(1.5)
            await pg.screenshot(path=os.path.join(SHOTS, f'v5-{mp}-menu.png'))
            await pg.click('[data-act=play]')
            t = 0; i = 0
            for w in WAITS:
                while t < w:
                    await pg.evaluate(KEEP % (100 if 'fuel' not in os.environ else os.environ['fuel']))
                    await asyncio.sleep(0.25); t += 0.25
                i += 1
                await pg.evaluate("window.__frk.game.sim.invuln = 0"); await asyncio.sleep(0.12)
                await pg.screenshot(path=os.path.join(SHOTS, f'v5-{mp}-{i}.png'))
            env = await pg.evaluate('window.__frk.game.world.env.debug()')
            perf = await pg.evaluate('window.__frk.perf()')
            out[mp] = {'env': env, 'perf': perf, 'errors': errs[:5]}
            print(mp, json.dumps(out[mp]))
            await ctx.close()
        await b.close()
asyncio.run(main())
