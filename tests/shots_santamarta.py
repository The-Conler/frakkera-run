import asyncio, sys
from playwright.async_api import async_playwright
URL='http://127.0.0.1:4797/'
LAP=int(sys.argv[1]) if len(sys.argv)>1 else 0
PRE='' if LAP==0 else f'neve-giro{LAP+1}-'
MARKS=[226,236,242,248,256,264,272] if LAP==0 else [236,248,264]
JS="""(()=>{const g=window.__frk.game,s=g.sim; s.fuel=100; s.invuln=1; if(s.mode==='dance'||s.danceCue) s.skipDance&&s.skipDance(); if(s.mode==='shop') s.exitShop&&s.exitShop(); return g.world.env.cur.bDist%1600})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True)
    pg=await ctx.new_page()
    await pg.goto(f'{URL}?test=1&map=village&at=215&lap={LAP}')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=90000)
    await asyncio.sleep(1); await pg.click('[data-act=play]'); mi=0
    for _ in range(3000):
      loc=await pg.evaluate(JS)
      if mi<len(MARKS) and MARKS[mi]<=loc<999:
        await pg.screenshot(path=f'screenshots/feat-santamarta-{PRE}{MARKS[mi]}m.png'); print(MARKS[mi],loc,flush=True); mi+=1
      if mi>=len(MARKS): break
      await asyncio.sleep(0.03)
    await b.close()
asyncio.run(main())
