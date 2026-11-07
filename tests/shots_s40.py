# v5s40: screenshot prima/dopo (telefono 390x844). Uso: URL=... python3 tests/shots_s40.py before|after
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4832/'); TAG = sys.argv[1]
OUT = '/workspace/frakkera-run/screenshots'
SEED = """(seed)=>{ const o=crypto.getRandomValues.bind(crypto); crypto.getRandomValues=(a)=>{ if(a instanceof Uint32Array && a.length===1 && !window.__seeded){ window.__seeded=1; a[0]=seed; return a;} return o(a); }; }"""
KEEP = """(t)=>{ const g=window.__frk.game; window.__keep=setInterval(()=>{ const s=g.sim; s.fuel=100; s.invuln=1; if(s.mode==='shop'&&s.exitShop) s.exitShop(); if(t&&s.mode==='run') g.accum+=t; },40); }"""
async def page(b, q, seed=None):
  ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page()
  if seed is not None: await pg.add_init_script(f"({SEED})({seed})")
  await pg.goto(f'{URL}?test=1{q}')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=180000)
  await asyncio.sleep(1.0); await pg.click('[data-act=play]'); return ctx, pg
async def until(pg, js, secs=120):
  for _ in range(int(secs/0.1)):
    if await pg.evaluate(js): return True
    await asyncio.sleep(0.1)
  return False
async def shot(pg, name):
  p = f'{OUT}/v5s40-{TAG}-{name}.png'; await pg.screenshot(path=p); print(p, flush=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    # 1) gregge nel fiume (seed 5): quando la prima pecora e' a ~1.2 s
    ctx, pg = await page(b, '&map=river&at=5', 5); await pg.evaluate(KEEP, 0)
    if await until(pg, "(()=>{const s=window.__frk.game.sim; return s.entities.some(e=>e.kind==='pecora' && e.d-s.T < s.currentSpeed*1.25 && e.d>s.T)})()", 60): await shot(pg, 'flock')
    await ctx.close()
    # 2) capre dalla roccia (forzate: corsie 1 e 2, come il generatore) + ramo caduto (variante 1)
    ctx, pg = await page(b, '&map=rock&at=40', 3); await pg.evaluate(KEEP, 0); await asyncio.sleep(2.5)
    await pg.evaluate("""(()=>{const s=window.__frk.game.sim; s.entities=s.entities.filter(e=>e.d<s.T||e.d>s.T+700); for(const e of s.entities) if(e.d>=s.T && e.d<=s.T+700) e.done=true;
      s.gen.fillUntil=()=>{}; const d=s.T-s.genOffset+260; s.spawn({kind:'caprarupe',lane:1,side:1,d,len:12,animal:99}); s.spawn({kind:'caprarupe',lane:2,side:1,d,len:12,animal:99}); })()""")
    await asyncio.sleep(0.6); await shot(pg, 'rockgoats')
    await pg.evaluate("""(()=>{const s=window.__frk.game.sim; s.spawn({kind:'ramo',lane:1,d:s.T-s.genOffset+300,len:10,variant:1}); })()""")
    await until(pg, "(()=>{const s=window.__frk.game.sim; return s.entities.some(e=>e.kind==='ramo' && e.d-s.T<170)})()", 20); await shot(pg, 'branch')
    await ctx.close()
    # 3) paese al 2o giro (corsa continua, seed 12345): strettoia-casa nella corsia esterna
    ctx, pg = await page(b, '', 12345); await pg.evaluate(KEEP, 0.06)
    await until(pg, "(()=>{const g=window.__frk.game,e=g.world.env; return e.cur.lap>=1 && e.cur.b.id==='village' && e.cur.local>35})()", 600)
    ok = await until(pg, "(()=>{const g=window.__frk.game,s=g.sim,e=g.world.env; if(e.cur.lap<1||e.cur.b.id!=='village') return false; return s.entities.some(x=>x.kind==='narrow' && x.d-s.T>120 && x.d-s.T<320)})()", 40)
    if ok: await pg.evaluate("window.__frk.game.pause()"); await shot(pg, 'village-lap2-narrow')
    else: await pg.evaluate("window.__frk.game.pause()"); await shot(pg, 'village-lap2')
    await ctx.close()
    # 4) partenza dalla miniera (link ?map=mine-blue&at=235) -> banner SA DANZA / BALLU TUNDU
    ctx, pg = await page(b, '&map=mine-blue&at=235'); await pg.evaluate(KEEP, 0)
    if await until(pg, "(()=>[...document.querySelectorAll('*')].some(n=>n.childElementCount===0 && /SA DANZA!|BALLU TUNDU!/.test(n.textContent||'')))()", 60): await asyncio.sleep(0.3); await shot(pg, 'dance-banner')
    await until(pg, "window.__frk.game.sim.mode==='dance'", 30); await asyncio.sleep(1.5); await shot(pg, 'dance-ui')
    await ctx.close(); await b.close()
asyncio.run(main())
