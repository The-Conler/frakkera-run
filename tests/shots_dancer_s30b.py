# v5s30b: ballerine + ballerini GLB nel cerchio del ballu tundu
import asyncio, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4811/'
OUT=sys.argv[2] if len(sys.argv)>2 else '/workspace/qa-shots/v5s30'
EXTRA=sys.argv[3] if len(sys.argv)>3 else ''
INFO="""(()=>{const g=window.__frk.game,s=g.sim; s.fuel=100; s.invuln=1; const r=g.world.dance; let gw=0,gm=0,pw=0,pm=0;
 if(r&&r.dancers) for(const d of r.dancers){ {const G=d.fig&&d.fig.name==='fig'; if(d.woman){G?gw++:pw++}else{G?gm++:pm++}} }
 return {mode:s.mode,cue:!!s.danceCue,T:s.T,loc:g.world.env.cur&&g.world.env.cur.local,gw,gm,pw,pm,pend:g.world.dancersPending}})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True)
    pg=await ctx.new_page(); logs=[]
    pg.on('console',lambda m: logs.append(m.text) if ('frakkera' in m.text or m.type=='error') else None)
    await pg.goto(f'{URL}?test=1&map=village&at=100{EXTRA}')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=90000)
    await asyncio.sleep(1); await pg.click('[data-act=play]'); await asyncio.sleep(2); await pg.evaluate('window.__frk.game.sim.startDance(1)')
    shots=0; t0=None
    for i in range(4000):
      info=await pg.evaluate(INFO)
      if i%40==0: print(info,flush=True)
      if info['mode']=='dance':
        if t0 is None: t0=i
        if i-t0 in (25,55,90):
          await pg.screenshot(path=f'{OUT}-dancer-ring-{shots}.png'); print('shot',shots,info,flush=True); shots+=1
        if shots>=3: break
      await asyncio.sleep(0.03)
    print('LOGS',logs[:10])
    await b.close()
asyncio.run(main())
