# v5s27p: Esc mette in pausa (non riprende subito); dal menu si riparte da zero. Uso: DIST=dist python3 tests/e2e_quit_menu.py
import asyncio, os, mimetypes
from urllib.parse import urlparse
from playwright.async_api import async_playwright
import sys
DIST=os.environ.get('DIST','/tmp/dist27p_local')
J="(()=>{const g=window.__frk.game,s=g.sim;return {T:s.T|0,runD:(s.T-s.genOffset)|0,score:s.score,mode:s.mode,paused:g.paused,ents:s.entities.length,env:g.world.env.debug?g.world.env.debug():null}})()"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':390,'height':844})
    async def serve(route):
      pth=urlparse(route.request.url).path; f=os.path.join(DIST,pth.lstrip('/') or 'index.html')
      if os.path.isdir(f): f=os.path.join(f,'index.html')
      if not os.path.exists(f): return await route.fulfill(status=404,body='')
      await route.fulfill(status=200,body=open(f,'rb').read(),content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
    await pg.route('http://frk.local/**',serve)
    await pg.goto('http://frk.local/?test=1')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=90000)
    await asyncio.sleep(1); await pg.click('[data-act=play]')
    for _ in range(80):
      await pg.evaluate("window.__frk.game.sim.fuel=100;window.__frk.game.sim.invuln=1"); await asyncio.sleep(0.1)
    r=await pg.evaluate(J); print('run',{k:r[k] for k in r if k!='env'}, r['env'] and (r['env']['biome'],r['env']['local']))
    await pg.keyboard.press('Escape'); await asyncio.sleep(0.8); st=await pg.evaluate('window.__frk.game.paused'); assert st, 'Esc non mette in pausa';  await pg.click('#scr-pause [data-act=quit]'); await asyncio.sleep(1)
    r=await pg.evaluate(J); print('menu',{k:r[k] for k in r if k!='env'}, r['env'] and (r['env']['biome'],r['env']['local']))
    await pg.screenshot(path='/tmp/q_menu.png')
    await pg.click('#scr-menu [data-act=play]'); await asyncio.sleep(1.0)
    r=await pg.evaluate(J); print('again',{k:r[k] for k in r if k!='env'}, r['env'] and (r['env']['biome'],r['env']['local']))
    assert r['mode']=='run' and r['runD']<60 and r['score']<60 and not r['paused'] and r['env']['local']<10, r
    print('OK: Esc -> pausa resta in pausa; ESCI AL MENU -> GIOCA = corsa nuova dall inizio'); await b.close()
asyncio.run(main())
