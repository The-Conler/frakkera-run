# feat-village: fotogrammi 390 px di panni, tessitrice, processione e finestre
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4851/'
SC = [  # nome, at (m nel paese), entita' da mettere davanti, attese (s) prima di ogni scatto
  ('panni', 150, "[{kind:'panni',lane:1,len:10,variant:0,ahead:120}]", [0.25, 0.75]),
  ('tessitrice', 160, "[{kind:'tessitrice',lane:0,side:-1,len:16,variant:0,ahead:130}]", [0.3, 0.9]),
  ('processione', 170, "[{kind:'processione',lane:2,len:52,variant:0,ahead:150}]", [0.3, 0.9]),
  ('finestre', 180, "[]", [0.35, 0.8]),
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for lap in (0, 2):
            for name, at, ents, waits in SC:
                ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
                pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(f'{URL}?test=1&map=village&at={at}&lap={lap}')
                await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
                await asyncio.sleep(1); await pg.click('[data-act=play]'); await asyncio.sleep(1.2)
                js = """(()=>{const g=window.__frk.game,s=g.sim; s.invuln=0; s.fuel=100; s.gen.fillUntil=()=>{};
                  for(const e of s.entities) if(!['falo'].includes(e.kind)) { e.done=true; s.fx('despawn',e); } s.entities=s.entities.filter(e=>!e.done);
                  for(const e of %s){const a=e.ahead; delete e.ahead; s.spawn({...e,d:s.T-s.genOffset+a});}
                  if('%s'==='finestre') s.fx('windowCheer',{streak:4}); return s.entities.length})()""" % (ents, name)
                await pg.evaluate(js)
                for i, w in enumerate(waits):
                    await asyncio.sleep(w)
                    await pg.evaluate("window.__frk.game.sim.fuel=100")
                    await pg.screenshot(path=f'screenshots/feat-village-{name}-giro{lap+1}-{i+1}.png')
                print(name, lap + 1, errs[:2]); await ctx.close()
        await b.close()
asyncio.run(main())
