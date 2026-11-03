import asyncio, sys, json
from playwright.async_api import async_playwright
URL='http://frk.local/'
import os, mimetypes
DIST=os.environ.get('DIST','/tmp/dist27f')
# usage: shots_s27.py name map at lap marks(local m, comma) [dpr] [extraJS]
NAME,MAP,AT,LAP=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]); MARKS=[float(m) for m in sys.argv[5].split(',')]
DPR=float(sys.argv[6]) if len(sys.argv)>6 else 1
EXTRA=sys.argv[7] if len(sys.argv)>7 else ''
JS="""(()=>{const g=window.__frk.game,s=g.sim; s.fuel=100; s.invuln=Math.max(s.invuln,0.069); if(s.mode==='dance'||s.danceCue) s.skipDance&&s.skipDance(); if(s.mode==='shop') s.exitShop&&s.exitShop(); %s; window.__vv=[g.world.vista.visible,g.world.vista.position.x,g.world.vista.position.z,g.world.camera.position.z,g.world.vistaAhead]; return [g.world.env.cur.local,g.world.env.cur.b.id,Math.floor(s.T||0)]})()"""%EXTRA
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=DPR,has_touch=True,is_mobile=True)
    pg=await ctx.new_page()
    async def serve(route):
      from urllib.parse import urlparse
      pth=urlparse(route.request.url).path; f=os.path.join(DIST,pth.lstrip('/') or 'index.html')
      if os.path.isdir(f): f=os.path.join(f,'index.html')
      if not os.path.exists(f): return await route.fulfill(status=404,body='')
      await route.fulfill(status=200,body=open(f,'rb').read(),content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
    await pg.route('http://frk.local/**',serve)
    q=f'?test=1&lap={LAP}'+(f'&map={MAP}&at={AT}' if MAP!='none' else '')
    await pg.goto(URL+q)
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=90000)
    await asyncio.sleep(1); await pg.click('[data-act=play]'); mi=0
    for _ in range(6000):
      loc,bid,T=await pg.evaluate(JS)
      if mi<len(MARKS) and MARKS[mi]<=loc<999 and (bid==(sys.argv[8] if len(sys.argv)>8 else bid)):
        await pg.screenshot(path=f'screenshots/v5s27k-{NAME}-{int(MARKS[mi])}.png'); print(MARKS[mi],loc,bid,T,await pg.evaluate('window.__vv'),flush=True); mi+=1
      if mi>=len(MARKS): break
      await asyncio.sleep(0.03)
    await b.close()
asyncio.run(main())
