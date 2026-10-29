"""v5s27: frame time e draw call per mappa a 390x844 (SwiftShader: valori relativi, non assoluti).
Uso: python3 tests/perf_s27.py [url] [etichetta]"""
import asyncio, json, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4811/'
MAPS = [('village', 20), ('village', 150), ('rock', 120), ('river', 60), ('viaduct', 100), ('mine-ext', 60), ('mine-int', 60)]
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for m, at in MAPS:
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            await pg.goto(f'{URL}?test=1&fixeddpr&map={m}&at={at}')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=90000)
            await asyncio.sleep(1.5); await pg.click('[data-act=play]')
            for _ in range(12):
                await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;})()"); await asyncio.sleep(0.25)
            await pg.evaluate("(()=>{const g=window.__frk.game; g.perf.samples.length=0; g.perf.frames=0; g.perf.gap=0; window.__dc=[]; const R=g.world.renderer, o=R.render.bind(R); if(!R.__w){R.__w=1; R.render=(a,c)=>{o(a,c); window.__dc&&window.__dc.push(R.info.render.calls);};}})()")
            for _ in range(16):
                await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;})()"); await asyncio.sleep(0.25)
            st = await pg.evaluate("(()=>{const r=window.__frk.perf(); const d=window.__dc; r.dcAvg=+(d.reduce((a,b)=>a+b,0)/Math.max(1,d.length)).toFixed(1); r.dcMax=Math.max(...d); return r})()")
            out[f'{m}@{at}'] = st; print(m, at, json.dumps(st), flush=True)
            await ctx.close()
        await b.close()
    if len(sys.argv) > 2: json.dump(out, open(f'screenshots/v5s27-perf-{sys.argv[2]}.json', 'w'), indent=1)
asyncio.run(main())
