import asyncio, sys
from playwright.async_api import async_playwright
URL='http://127.0.0.1:4794/'; MARKS=[int(x) for x in sys.argv[2].split(',')]; LAP=int(sys.argv[1]); AT=int(sys.argv[3]) if len(sys.argv)>3 else 170
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True)
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto(f'{URL}?test=1&map=village&at={AT}&lap={LAP}')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=60000)
    await asyncio.sleep(1); await pg.click('[data-act=play]'); mi=0
    for _ in range(1500):
      loc=await pg.evaluate("(()=>{const g=window.__frk.game,s=g.sim,w=g.world; s.fuel=100; s.invuln=1; if(s.mode==='dance'||s.danceCue) s.skipDance(); if(s.mode==='shop') s.exitShop(); const c=w.env.cur; return c.b.id==='village'?c.local:250+c.local})()")
      if loc>=MARKS[mi]:
        await pg.screenshot(path=f'/tmp/p23c-g{LAP+1}-{MARKS[mi]}.png'); print(MARKS[mi],round(loc,1)); mi+=1
        if mi>=len(MARKS): break
      await asyncio.sleep(0.04)
    print('errs',errs[:3]); await b.close()
asyncio.run(main())
