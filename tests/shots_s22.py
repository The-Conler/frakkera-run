# v5s22: carrello (posa seduta, camera, segnali degli scambi) e partenza dolce
import asyncio, os, json
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4792/'
SH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'screenshots')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for W, H in ((390, 844), (360, 740)):
            ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script("navigator.vibrate = (p) => { (window.__vib = window.__vib || []).push(p); return true; }")
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL + '?test=1&map=mine-int&at=8')
            await pg.wait_for_function('window.__frk && window.__frk.game.world.char3d.ready && document.querySelector("#loading").classList.contains("hidden")', timeout=40000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            sp = []; n = 0
            for i in range(160):
                r = await pg.evaluate("""(() => { const s = window.__frk.game.sim; s.fuel = 100;
                  const sc = s.entities.filter((e) => e.kind === 'scambio' && !e.done && e.d - s.T > 0).sort((a, b) => a.d - b.d)[0];
                  if (sc && sc.d - s.T < 150 && !sc.open.includes(s.targetLane)) { const t = sc.open.reduce((b, l) => (Math.abs(l - s.targetLane) < Math.abs(b - s.targetLane) ? l : b), sc.open[0]); s.move(Math.sign(t - s.targetLane)); }
                  return { t: s.runTime, v: s.currentSpeed, cart: !!s.cart, cued: !!(sc && sc.cued), ahead: sc ? sc.d - s.T : 0 }; })()""")
                sp.append(r)
                if r['cart'] and r['cued'] and n < 4 and i % 6 == 0: await pg.screenshot(path=f'{SH}/v5s22-{W}-carrello-{n}.png'); n += 1
                if r['t'] > 0.3 and r['t'] < 0.6 and i < 20 and W == 390: await pg.screenshot(path=f'{SH}/v5s22-{W}-partenza.png')
                await asyncio.sleep(0.12)
            vib = await pg.evaluate("window.__vib || []")
            st = await pg.evaluate("(() => { const s = window.__frk.game.sim; return { j: s.stats.junctions, dead: s.stats.deadends, carts: s.stats.carts }; })()")
            print(W, 'start speeds', [round(x['v']) for x in sp[:8]], st, 'vibrate', vib[:4], errs[:3])
            await ctx.close()
        await b.close()
asyncio.run(main())
