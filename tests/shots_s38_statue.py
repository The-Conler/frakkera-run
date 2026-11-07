# v5s38: Santa Marta GLB in the procession — screenshots + load check
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4851/'
SH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'screenshots')
os.makedirs(SH, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(
            executable_path='/usr/bin/google-chrome',
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        )
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'{URL}?test=1&map=village&at=40&lap=0', wait_until='domcontentloaded')
        await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=90000)
        await pg.wait_for_function('() => window.__frk && window.__frk.game && window.__frk.game.world && window.__frk.game.world.dancersPending === false', timeout=60000)
        await asyncio.sleep(0.4)
        await pg.click('[data-act=play]')
        await asyncio.sleep(1.0)
        info = await pg.evaluate("""() => {
          const g = window.__frk.game, s = g.sim, w = g.world;
          s.invuln = 0; s.fuel = 100; s.gen.fillUntil = () => {};
          for (const e of s.entities) if (e.kind !== 'falo') { e.done = true; s.fx('despawn', e); }
          s.entities = s.entities.filter(e => !e.done);
          s.spawn({ kind: 'processione', lane: 1, d: s.T - s.genOffset + 140, len: 52, variant: 0 });
          for (const [id, v] of w.views) {
            if (v.proc && v.proc.statue) {
              const st = v.proc.statue;
              let tex = 0, vc = 0, meshes = 0;
              st.traverse(o => { if (!o.isMesh) return; meshes++; if (o.material && o.material.map) tex++; if (o.material && o.material.vertexColors) vc++; });
              return { name: st.name, usedGlb: tex > 0, tex, vc, meshes, kids: st.children.map(c => (c.name||'') + ':' + c.type + (c.children? '('+c.children.length+')':'')) };
            }
          }
          return { err: 'no procession view', views: [...w.views.values()].map(v => v.kind) };
        }""")
        print('INFO', info)
        await asyncio.sleep(0.4)
        await pg.evaluate('window.__frk.game.sim.fuel=100')
        await pg.screenshot(path=f'{SH}/v5s38-processione-1.png')
        await asyncio.sleep(0.6)
        await pg.screenshot(path=f'{SH}/v5s38-processione-2.png')
        await pg.evaluate("""() => {
          const g = window.__frk.game, s = g.sim;
          for (const e of s.entities) if (e.kind === 'processione') { e.done = true; s.fx('despawn', e); }
          s.entities = s.entities.filter(e => !e.done);
          s.spawn({ kind: 'processione', lane: 1, d: s.T - s.genOffset + 55, len: 52, variant: 0 });
        }""")
        await asyncio.sleep(0.9)
        await pg.screenshot(path=f'{SH}/v5s38-processione-close.png')
        # mid distance
        await pg.evaluate("""() => {
          const g = window.__frk.game, s = g.sim;
          for (const e of s.entities) if (e.kind === 'processione') { e.done = true; s.fx('despawn', e); }
          s.entities = s.entities.filter(e => !e.done);
          s.spawn({ kind: 'processione', lane: 2, d: s.T - s.genOffset + 90, len: 52, variant: 0 });
        }""")
        await asyncio.sleep(0.8)
        await pg.screenshot(path=f'{SH}/v5s38-processione-mid.png')
        print('errs', errs[:5])
        await ctx.close(); await b.close()

asyncio.run(main())
