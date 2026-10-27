import asyncio, json, sys
from playwright.async_api import async_playwright
URL='http://127.0.0.1:4792/'
MARKS=[252,264,276,288,300,310,320,334]
JS="""(()=>{const g=window.__frk.game,s=g.sim,w=g.world; s.fuel=100; s.invuln=1; if(s.mode==='dance'||s.danceCue) s.skipDance(); if(s.mode==='shop') s.exitShop();
const c=w.env.cur; const v=w.vista; v.updateMatrixWorld(); const bb=new v.geometry.boundingBox.constructor().copy(v.geometry.boundingBox).applyMatrix4(v.matrixWorld);
const cam=w.camera; const P=(x,y,z)=>{const p=new cam.position.constructor(x,y,z).project(cam); return [Math.round((p.x+1)*195),Math.round((1-p.y)*422),+p.z.toFixed(3)]};
return {loc:c.bDist%1600, wz:+(v.position.z+s.T*0).toFixed(2), vz:+v.position.z.toFixed(2), vx:+v.position.x.toFixed(2), vis:v.visible, camz:+cam.position.z.toFixed(2), bbx:[+bb.min.x.toFixed(1),+bb.max.x.toFixed(1)], bbz:[+bb.min.z.toFixed(1),+bb.max.z.toFixed(1)], scr:P((bb.min.x+bb.max.x)/2,10,(bb.min.z+bb.max.z)/2)}})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for lap in (0,2):
      ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True)
      pg=await ctx.new_page()
      await pg.goto(f'{URL}?test=1&map=village&at=225&lap={lap}')
      await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=60000)
      await asyncio.sleep(1); await pg.click('[data-act=play]'); mi=0
      for _ in range(1500):
        r=await pg.evaluate(JS)
        if mi<len(MARKS) and r['loc']>=MARKS[mi] and r['loc']<999:
          await pg.screenshot(path=f'screenshots/v5s23b-verifica-giro{lap+1}-{MARKS[mi]}m.png'); print(lap+1,MARKS[mi],json.dumps(r),flush=True); mi+=1
        if mi>=len(MARKS): break
        await asyncio.sleep(0.04)
      await ctx.close()
    await b.close()
asyncio.run(main())
