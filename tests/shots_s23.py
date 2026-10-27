# v5 stage 23: neve per giro. Screenshot v5s23-<W>-giro<N>-<ambiente>.png e controllo livello/fiocchi/errori
import asyncio, json, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4792/'
SHOTS = [(0, 'village', 70), (1, 'village', 70), (1, 'river', 150), (2, 'village', 70), (2, 'rock', 120), (2, 'viaduct', 120), (2, 'mine-ext', 90), (2, 'mine-int', 80), (3, 'river', 60)]
async def main():
    W = int(sys.argv[1]) if len(sys.argv) > 1 else 390
    out = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for lap, m, at in SHOTS:
            ctx = await b.new_context(viewport={'width': W, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'{URL}?test=1&map={m}&at={at}&lap={lap}')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            for _ in range(24):
                await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;})()")
                await asyncio.sleep(0.25)
            await pg.evaluate('window.__frk.game.sim.invuln = 0'); await asyncio.sleep(0.15)
            st = await pg.evaluate("(()=>{const w=window.__frk.game.world; return {lap:w.env.cur.lap, biome:w.env.cur.b.id, ground:+w.snow.ground.toFixed(2), fall:+w.snow.fall.toFixed(2), flakes:w.flakes.visible, n:w.flakes.geometry.attributes.position.count, tunnel:+w.light.tunnel.toFixed(2)}})()")
            await pg.screenshot(path=f'screenshots/v5s23-{W}-giro{lap+1}-{m}.png')
            print(lap + 1, m, json.dumps(st), errs[:2]); out.append(st)
            await ctx.close()
        await b.close()
asyncio.run(main())
