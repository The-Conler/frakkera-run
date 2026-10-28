# v5 stage 25: salto, pioggia, nebbia, migliorie nel negozio, icone HUD (390 px)
import asyncio
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4811/'
async def open_(b, q, pre=''):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    if pre: await ctx.add_init_script(pre)
    pg = await ctx.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.goto(URL + '?test=1&' + q)
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
    await asyncio.sleep(1)
    return ctx, pg
KEEP = "(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=0.5;})()"
async def shot(pg, n): await pg.screenshot(path=f'screenshots/feat-power2-{n}.png'); print('shot', n, pg.errs[:2])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        # 1) salto sopra una botte + icone HUD
        ctx, pg = await open_(b, 'map=village&at=20')
        await pg.click('[data-act=play]'); await asyncio.sleep(2.5)
        await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.clearEntities(); s.powerUp('calamita',{}); s.powerUp('finocchio',{}); s.powerUp('scarponi',{}); s.spawn({kind:'botte',lane:s.targetLane,d:s.T-s.genOffset+140,len:14});})()")
        await pg.evaluate("new Promise(res=>{const f=()=>{const s=window.__frk.game.sim; s.fuel=100; const e=s.entities.find(x=>x.kind==='botte'); if(e&&e.d-s.T<34){s.jump(); setTimeout(res,260);} else requestAnimationFrame(f);}; f();})")
        await shot(pg, '01-salto-botte')
        await ctx.close()
        # 2) notte di pioggia (giro 4)
        ctx, pg = await open_(b, 'map=river&at=30&lap=3')
        await pg.click('[data-act=play]'); await asyncio.sleep(3.5); await pg.evaluate(KEEP)
        await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.spawn({kind:'acqua',lane:(s.targetLane+1)%3,d:s.T-s.genOffset+120,len:14});})()")
        await asyncio.sleep(0.6); await shot(pg, '02-pioggia-fiume')
        await ctx.close()
        ctx, pg = await open_(b, 'map=village&at=60&lap=3')
        await pg.click('[data-act=play]'); await asyncio.sleep(3.5); await pg.evaluate(KEEP); await shot(pg, '03-pioggia-paese')
        await ctx.close()
        # 3) nebbia nella valle (fiume, ~558 m)
        ctx, pg = await open_(b, 'map=river&at=36')
        await pg.click('[data-act=play]')
        for _ in range(80):
            await pg.evaluate(KEEP)
            m = await pg.evaluate("window.__frk.game.world.env.cur.bDist")
            if m >= 566: break
            await asyncio.sleep(0.1)
        await asyncio.sleep(0.4); await shot(pg, '04-nebbia-fiume')
        await ctx.close()
        # 4) negozio di Pinu con le migliorie
        ctx, pg = await open_(b, 'map=village&at=0&lap=1', "localStorage.setItem('frakkera.carpets.v1','420'); localStorage.setItem('frakkera.upgrades.v1', JSON.stringify({calamita:1,fiamma:3}));")
        await pg.click('[data-act=play]')
        await pg.wait_for_selector('#shop-offer:not(.hidden)', timeout=30000)
        await pg.dispatch_event('#shop-offer', 'pointerdown'); await asyncio.sleep(1.5)
        await shot(pg, '05-negozio-migliorie')
        await pg.evaluate("(()=>{const el=document.querySelector('#shop-items'); el.scrollTop=9999; const s=document.querySelector('#scr-shop .scroll, .shop-panel'); if(s) s.scrollTop=9999;})()"); await asyncio.sleep(0.3)
        await pg.click('.up-item[data-up=scarponi]'); await asyncio.sleep(0.6); await shot(pg, '06-negozio-comprato')
        await ctx.close()
        # 5) come si gioca
        ctx, pg = await open_(b, '')
        await pg.click('[data-act=howto]'); await asyncio.sleep(0.6)
        await pg.evaluate("(()=>{const s=document.querySelector('#scr-howto .scroll'); const h=[...s.querySelectorAll('h3')].find(x=>x.textContent.includes('salto')); s.scrollTop=h.offsetTop-60;})()"); await asyncio.sleep(0.3)
        await shot(pg, '07-come-si-gioca')
        await ctx.close(); await b.close()
asyncio.run(main())
