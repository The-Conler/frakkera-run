# v5s27: capre sarde (salto con zampe raccolte, trotto) e masso d'attesa. Uso: python3 tests/shots_goats_s27.py [porta]
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else '4811'
SC = {
  'roccia': ('rock', 90, "[{kind:'caprarupe',lane:0,side:-1,len:12,at:260},{kind:'caprarupe',lane:2,side:1,len:12,at:420}]", [0.6, 1.3, 1.7, 2.1], None),
  'attraversa': ('rock', 90, "[{kind:'goat',lane:0,len:10,dir:1,vx:30,moving:true,at:190}]", [0.5, 0.9, 1.2], None),
  'primo-piano': ('rock', 90, "[{kind:'goat',lane:1,len:10,dir:1,vx:0,at:60}]", [0.5], [3.5, 2.2, -0.5, 0, 1.2, -6]),
}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for name, (m, at, ents, waits, cam) in [(k, v) for k, v in SC.items() if len(sys.argv) < 3 or k in sys.argv[2:]]:
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://127.0.0.1:{PORT}/?test=1&map={m}&at={at}&lap=0')
            await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
            await asyncio.sleep(1); await pg.click('[data-act=play]')
            for _ in range(8):
                await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.fuel=100; s.invuln=1;})()"); await asyncio.sleep(0.25)
            await pg.evaluate("""(()=>{const g=window.__frk.game, s=g.sim; s.gen.fillUntil=()=>{}; for (const e of s.entities) e.d=-1e9; s.tick(0.016);
              for (const e of %s) { const a=e.at; delete e.at; s.spawn({...e, d:s.T-s.genOffset+a}); } })()""" % ents)
            if cam: await pg.evaluate("(()=>{const g=window.__frk.game; g.world.camOverride=null; window.__cam=%s})()" % cam)
            t = 0; wi = 0
            while wi < len(waits):
                ev = "(()=>{const g=window.__frk.game,s=g.sim; s.fuel=100; s.invuln=0.069; if(window.__cam){ const e=s.entities.find(e=>e.kind==='goat'); const v=e&&g.world.views.get(e.id); if(v){const p=v.root.position,c=window.__cam; g.world.camOverride=[p.x+c[0],c[1],p.z+c[2]-g.world.camPos.z,p.x+c[3],c[4],p.z+c[5]*0-g.world.camPos.z]; s.speed=0;} } })()"
                await pg.evaluate(ev); await asyncio.sleep(0.1); t += 0.1
                if t >= waits[wi]:
                    path = f'screenshots/v5s27-goat-{name}-{wi}.png'; await pg.screenshot(path=path); print(path, errs[:2]); wi += 1
            await ctx.close()
        await b.close()
asyncio.run(main())
