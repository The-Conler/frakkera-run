# v5s20: giro di prova (bot + invulnerabilita') per caccia ai bug: screenshot e registro per ambiente
import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4792/'
SH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'screenshots')
TAG = sys.argv[1] if len(sys.argv) > 1 else 'before'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 390
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
BOT = """(inv) => { const g = window.__frk.game, s = g.sim; if (inv) { s.fuel = Math.max(s.fuel, 70); }
  if (s.mode !== 'run') return {mode: s.mode};
  const st = window.__frk.state(); const danger=[0,0,0];
  for (const e of st.entities) { if (e.pickup || !e.solid) continue; if (e.ahead + e.len > -6 && e.ahead < 70 + st.speed*0.4) danger[e.lane] += 10/(1+Math.max(0,e.ahead)/40); }
  let best = s.targetLane, bs = -1e9; for (let l=0;l<3;l++){ let pd=0; for(let k=Math.min(l,s.targetLane);k<=Math.max(l,s.targetLane);k++) pd+=danger[k]; const sc=-pd-Math.abs(l-s.targetLane)*0.2; if(sc>bs){bs=sc;best=l;} }
  if (best !== s.targetLane) s.move(Math.sign(best - s.targetLane));
  return {mode: s.mode, speed: s.currentSpeed, d: s.runD, cart: !!s.cart, hits: s.stats.hits, cz: g.world.camPos.z, cy: g.world.camPos.y, cx: g.world.camPos.x};
}"""
RUNS = {'village': ('village', 2, 34), 'rock': ('rock', 2, 22), 'river': ('river', 2, 22), 'viaduct': ('viaduct', 2, 18),
        'mine-ext': ('mine-ext', 2, 22), 'cart': ('mine-int', 5, 36), 'mine-blue': ('mine-blue', 2, 22)}
async def main():
    report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        for rid, (mp, at, secs) in RUNS.items():
            if ONLY and rid not in ONLY: continue
            ctx = await b.new_context(viewport={'width': W, 'height': 844 if W == 390 else 780}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
            pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type in ('error', 'warning') else None)
            await pg.goto(URL + f'?test=1&map={mp}&at={at}')
            await pg.wait_for_function('window.__frk && window.__frk.game.world.char3d.ready && document.querySelector("#loading").classList.contains("hidden")', timeout=40000)
            await asyncio.sleep(1.0)
            await pg.click('[data-act=play]')
            log = []; t = 0; n = 0
            while t < secs:
                r = await pg.evaluate(BOT, True); r['t'] = round(t, 2); log.append(r)
                if r.get('mode') == 'dance': await pg.evaluate("window.__frk.game.sim.danceInput(['left','down','up','right'][Math.floor(Math.random()*4)])")
                if r.get('mode') == 'shop': await pg.evaluate("window.__frk.game.exitShop()")
                if int(t / 3) != n: n = int(t / 3); await pg.screenshot(path=f'{SH}/v5s20-{TAG}-{W}-{rid}-{n:02d}.png')
                await asyncio.sleep(0.12); t += 0.2
            # salti bruschi di velocita' e camera
            jumps = []
            for a, c in zip(log, log[1:]):
                if 'speed' in a and 'speed' in c and a['mode'] == c['mode'] == 'run':
                    if abs(c['speed'] - a['speed']) > 18: jumps.append(('speed', a['t'], round(a['speed']), round(c['speed'])))
                    if abs(c['cx'] - a['cx']) > 2.5 or abs(c['cy'] - a['cy']) > 1.5: jumps.append(('cam', a['t'], round(a['cx'],1), round(c['cx'],1), round(a['cy'],1), round(c['cy'],1)))
            perf = await pg.evaluate('window.__frk.perf()')
            st = await pg.evaluate("(() => { const s = window.__frk.game.sim; return { mode: s.mode, d: Math.round(s.runD/10), hits: s.stats.hits, carts: s.stats.carts, junctions: s.stats.junctions, deadends: s.stats.deadends, lamps: s.stats.lamps, miners: s.stats.miners, fires: s.stats.fires, bells: s.stats.bells, sweets: s.stats.sweets, dances: s.stats.dances, cart: !!s.cart }; })()")
            report[rid] = {'state': st, 'jumps': jumps[:12], 'modes': sorted(set(x.get('mode') for x in log)), 'perf': perf, 'errors': errs[:8]}
            print(rid, json.dumps(report[rid]))
            await ctx.close()
        await b.close()
    json.dump(report, open(f'/tmp/play_{TAG}_{W}.json', 'w'), indent=1)
asyncio.run(main())
