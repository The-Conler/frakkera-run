# v5s21: screenshot della festa a Gadoni (bancarelle, festoni e luci, folla che applaude)
import asyncio, os, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4792/'
SH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'screenshots')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for W, H in ((390, 844), (360, 740)):
            ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script("setInterval(() => { const g = window.__frk && window.__frk.game; if (g && (g.sim.danceCue || g.sim.mode === 'dance')) g.skipDance(); if (g && g.sim.mode === 'shop') g.exitShop(); }, 40)")
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.goto(URL + '?test=1&map=village&at=24')
            await pg.wait_for_function('window.__frk && window.__frk.game.world.char3d.ready && document.querySelector("#loading").classList.contains("hidden")', timeout=40000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            n = 0; cheers = 0
            for i in range(70):
                r = await pg.evaluate("""(() => { const s = window.__frk.game.sim; s.fuel = 100;
                  const st = window.__frk.state(); const f = st.entities.find((e) => e.kind === 'folla' && e.ahead > 20 && e.ahead < 120);
                  if (f && s.targetLane !== f.lane) s.move(Math.sign(f.lane - s.targetLane));
                  return { festa: st.festa, cheers: s.stats.cheers, d: Math.round(s.runD / 10) }; })()""")
                if r['festa'] and i % 8 == 4 and n < 5: await pg.screenshot(path=f'{SH}/v5s21-{W}-festa-{n}.png'); n += 1
                cheers = r['cheers']
                await asyncio.sleep(0.15)
            print(W, 'cheers', cheers, 'shots', n, errs[:3])
            await ctx.close()
        await b.close()
asyncio.run(main())
