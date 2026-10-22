"""v5: inquadrature "da cartolina" dei monumenti di ogni ambiente (per il confronto foto/gioco).
Avvia la corsa con ?map=..&at=.., mette in pausa il gioco (game.pause) e sposta la camera con
world.camOverride (solo test). Salva screenshots/v5-view-<id>.png a 390x844."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = sys.argv[sys.argv.index('--url') + 1] if '--url' in sys.argv else 'http://127.0.0.1:4173/'
DSF = float(sys.argv[sys.argv.index('--dsf') + 1]) if '--dsf' in sys.argv else 2
ONLY = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots')
# id: (map, at, b del soggetto, camera [x,y,dz], target [x,y,dz])  dz relativo alla z del soggetto
VIEWS = {
    'village': ('village', 100, 140, [3.5, 2.6, -8.0], [-20.5, 11.5, -19.0]),
    'rock': ('rock', 120, 450, [-2, 5, 75], [60, 34, 0]),
    'river': ('river', 30, 560, [0, 2.4, 0], [33, 7, -28]),
    'viaduct': ('viaduct', 90, 900, [-1, 3.2, 46], [3, 30, -10]),
    'mine-ext': ('mine-ext', 105, 1150, [0.5, 2.6, 26], [0, 6.5, 0]),
    'mine-int': ('mine-int', 40, 1215, [0.8, 2.2, 6], [0.5, 3.6, -10]),
    'mine-blue': ('mine-blue', 40, 1415, [-0.6, 2.0, 6], [0.5, 3.8, -10]),
}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for vid, (mp, at, bs, cam, tgt) in VIEWS.items():
            if ONLY and vid not in ONLY: continue
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL + f'?test=1&fixeddpr&map={mp}&at={at}')
            await pg.wait_for_function('window.__frk && window.__frk.game.world.char3d.ready', timeout=40000)
            await asyncio.sleep(2.5)
            await pg.click('[data-act=play]')
            for _ in range(10):
                await pg.evaluate("(()=>{const g=window.__frk.game; g.sim.fuel=100; g.sim.invuln=3})()"); await asyncio.sleep(0.2)
            await pg.evaluate("window.__frk.game.pause(); window.__frk.game.sim.invuln = 0")
            js = f"""(()=>{{const w=window.__frk.game.world, e=w.env; const zs=-e.wOf({bs}); const dz = zs - w.camPos.z;
              w.camOverride=[{cam[0]},{cam[1]},dz+({cam[2]}),{tgt[0]},{tgt[1]},dz+({tgt[2]})]; return e.debug()}})()"""
            d = await pg.evaluate(js)
            await asyncio.sleep(2.0)
            out = os.path.join(SHOTS, f'v5-view-{vid}.png')
            await pg.screenshot(path=out)
            print(vid, out, d['marks'], errs[:3])
            await ctx.close()
        await b.close()
asyncio.run(main())
