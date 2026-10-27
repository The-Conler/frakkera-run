# v5s20: schermate UI a 360/390 px (menu 5 riquadri, COSTUMI, negozio, game over)
import asyncio, os, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4792/'
SH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'screenshots')
TAG = sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for W, H in ((360, 740), (390, 844)):
            ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script("setInterval(() => { const g = window.__frk && window.__frk.game; if (g && (g.sim.danceCue || g.sim.mode === 'dance')) g.skipDance(); }, 40)")
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL + '?test=1')
            await pg.evaluate("localStorage.clear(); localStorage.setItem('frakkera.collect.v1', JSON.stringify({bell: 2, sweet: 7})); localStorage.setItem('frakkera.carpets.v1', '1234')")
            await pg.reload()
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=40000)
            await asyncio.sleep(1.5)
            await pg.screenshot(path=f'{SH}/v5s20-{TAG}-{W}-ui-menu.png')
            ov = await pg.evaluate("""(() => { const out = []; for (const el of document.querySelectorAll('#scr-menu .tile span, #scr-skins .skin-card *, .btn')) { if (!el.offsetParent) continue; if (el.scrollWidth > el.clientWidth + 1) out.push((el.className||el.tagName)+':'+el.textContent.trim().slice(0,20)); const r = el.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.left < -1) out.push('fuori:'+el.textContent.trim().slice(0,20)); } return out; })()""")
            await pg.click('[data-act=skins]'); await asyncio.sleep(0.5)
            await pg.screenshot(path=f'{SH}/v5s20-{TAG}-{W}-ui-costumi.png')
            ov2 = await pg.evaluate("""(() => { const out = []; for (const el of document.querySelectorAll('#scr-skins *')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push('fuori:'+el.className+':'+el.textContent.trim().slice(0,20)); } return out.slice(0,6); })()""")
            await pg.click('#scr-skins [data-act=back]'); await asyncio.sleep(0.3)
            await pg.click('[data-act=play]'); await asyncio.sleep(3)
            await pg.evaluate("window.__frk.game.enterShop()"); await asyncio.sleep(1.5)
            await pg.screenshot(path=f'{SH}/v5s20-{TAG}-{W}-ui-negozio.png')
            await pg.evaluate("window.__frk.game.exitShop()"); await asyncio.sleep(0.5)
            await pg.evaluate("window.__frk.game.sim.fuel = 0.5")
            await pg.wait_for_function("!document.querySelector('#scr-over').classList.contains('hidden')", timeout=30000); await asyncio.sleep(2.5)
            await pg.screenshot(path=f'{SH}/v5s20-{TAG}-{W}-ui-gameover.png')
            # stato dopo riavvio (niente residui della corsa prima)
            await pg.click('#btn-retry'); await asyncio.sleep(1.5)
            st = await pg.evaluate("(() => { const s = window.__frk.game.sim; return { mode: s.mode, cart: !!s.cart, dance: !!s.dance, shop: !!s.shop, ammo: s.ammo, spk: s.cartSpK, ents: s.entities.length }; })()")
            print(W, 'overflow', ov, ov2, 'restart', st, errs)
            await ctx.close()
        await b.close()
asyncio.run(main())
