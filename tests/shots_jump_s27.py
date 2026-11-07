# v5s27: salto leggibile (ombra a terra, squash & stretch, polvere). Uso: python3 tests/shots_jump_s27.py [porta]
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else '4811'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        await pg.goto(f'http://127.0.0.1:{PORT}/?test=1&map=rock&at=90&lap=0')
        await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
        await asyncio.sleep(1); await pg.click('[data-act=play]'); await asyncio.sleep(2)
        # fase del salto tenuta ferma (jumpT bloccato) per fotografare: stacco, culmine, discesa
        for i, ph in enumerate([0.12, 0.5, 0.85]):
            await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; clearInterval(window.__jt); s.jumpCd=0; s.jumpT=0; s.duckT=0; s.jump(); window.__jt=setInterval(()=>{s.jumpT=0.62*(1-%s); s.invuln=0.069;},2);})()" % ph)
            await asyncio.sleep(0.4)
            await pg.screenshot(path=f'screenshots/v5s27-jump-{i}.png'); print(i, await pg.evaluate("window.__frk.game.sim.jumpH"))
        await pg.evaluate("(()=>{const s=window.__frk.game.sim; clearInterval(window.__jt); s.jumpT=0.05;})()")
        await asyncio.sleep(0.08); await pg.screenshot(path='screenshots/v5s27-jump-3-atterraggio.png')
        await b.close()
asyncio.run(main())
