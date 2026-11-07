"""Stage 5: confronto prestazioni prima/dopo (nessuno screenshot): per ogni mappa corre 8 s poi campiona 4 s
draw call, triangoli, gap tra frame e CPU per frame. Uso: python3 tests/probe_s5.py URL [URL2]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
MAPS = os.environ.get('MAPS', 'village&at=60,village&at=200,rock&at=100,river&at=100,viaduct&at=100,mine-ext&at=60,mine-int&at=80,mine-blue&at=100').split(',')
KEEP = "(() => { const g = window.__frk.game; g.sim.fuel = Math.max(g.sim.fuel, 100); g.sim.invuln = 5; })()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for url in sys.argv[1:]:
            for mp in MAPS:
                ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
                pg = await ctx.new_page()
                await pg.goto(url + '?test=1&fixeddpr&map=' + mp)
                await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=30000)
                await pg.wait_for_function('window.__frk.game.world.char3d.ready || window.__frk.game.world.char3d.failed', timeout=30000)
                await asyncio.sleep(2); await pg.click('[data-act=play]')
                for _ in range(32): await pg.evaluate(KEEP); await asyncio.sleep(0.25)
                f0 = await pg.evaluate('window.__frk.game.perf.frames'); g0 = await pg.evaluate('window.__frk.game.perf.gap')
                dc = []; tr = []
                for _ in range(16):
                    await pg.evaluate(KEEP); await asyncio.sleep(0.25)
                    i = await pg.evaluate('[window.__frk.game.world.renderer.info.render.calls, window.__frk.game.world.renderer.info.render.triangles]'); dc.append(i[0]); tr.append(i[1])
                f1 = await pg.evaluate('window.__frk.game.perf.frames'); g1 = await pg.evaluate('window.__frk.game.perf.gap')
                pf = await pg.evaluate('window.__frk.perf()')
                print(url[-6:-1], mp, json.dumps({'draw': round(sum(dc) / len(dc)), 'tris': round(sum(tr) / len(tr)), 'gapMs': round((g1 - g0) / max(1, f1 - f0), 1), 'cpuAvg': pf['cpuAvgMs'], 'cpuP95': pf['cpuP95Ms']}), flush=True)
                await ctx.close()
        await b.close()
asyncio.run(main())
