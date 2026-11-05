# v5s30c: corridore piu' piccolo e senza frakkera nel cerchio del ballu tundu
import asyncio, sys, json
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4811/'
OUT=sys.argv[2] if len(sys.argv)>2 else '/workspace/qa-shots/v5s30c'
EXTRA=sys.argv[3] if len(sys.argv)>3 else ''
MEAS="""(()=>{const T=window.__frk.THREE; const g=window.__frk.game,w=g.world,s=g.sim,c=w.char3d,r=w.dance;
 const hb=(o)=>{const b=new (c.root.position.constructor===undefined?Object:Object)();return null};
 const box=(o,skip)=>{let mn=1e9,mx=-1e9;o.updateMatrixWorld(true);o.traverse(m=>{if(!m.isMesh||!m.visible)return; if(skip&&skip(m))return; let p=m; while(p){if(!p.visible)return; p=p.parent;}
   const geo=m.geometry; if(!geo.boundingBox)geo.computeBoundingBox(); const bb=geo.boundingBox; for(const y of [bb.min.y,bb.max.y]) for(const x of [bb.min.x,bb.max.x]) for(const z of [bb.min.z,bb.max.z]){const v=bb.min.clone().set(x,y,z).applyMatrix4(m.matrixWorld); mn=Math.min(mn,v.y); mx=Math.max(mx,v.y);} }); return [+mn.toFixed(2),+mx.toFixed(2)];};
 const fr=c.frkParts||[]; const H={mode:s.mode,state:r.state,danceK:c.danceK,scale:c.root.scale.y,frkVis:fr.map(o=>o.visible),frkSkinned:fr.map(o=>!!o.isSkinnedMesh),mascot:c.isMascot,
   player:box(c.root,m=>m.isSkinnedMesh&&!fr.includes(m)?false:false), playerNoFrk:box(c.root,m=>fr.includes(m)), dancers:[]};
 if(r&&r.dancers) for(const d of r.dancers.slice(0,4)) H.dancers.push({woman:d.woman,glb:d.fig&&d.fig.name==='fig',h:box(d.root)});
 return H;})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True)
    pg=await ctx.new_page(); logs=[]
    pg.on('console',lambda m: logs.append(m.text) if ('frakkera' in m.text or m.type=='error') else None)
    await pg.goto(f'{URL}?test=1&map=village&at=100{EXTRA}')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")',timeout=90000)
    await asyncio.sleep(1); await pg.click('[data-act=play]'); await asyncio.sleep(2)
    print('RUN', json.dumps(await pg.evaluate(MEAS)))
    await pg.evaluate('window.__frk.game.sim.startDance(1)')
    shots=0; t0=None; after=False
    for i in range(4000):
      st=await pg.evaluate('(()=>{const g=window.__frk.game; g.sim.fuel=100; g.sim.invuln=1; return [g.sim.mode,g.world.dance.state]})()')
      if st[0]=='dance':
        if t0 is None: t0=i
        if i-t0 in (40,80):
          print('DANCE', json.dumps(await pg.evaluate(MEAS)))
          await pg.screenshot(path=f'{OUT}-dance-player{"" if shots==0 else "-"+str(shots)}.png'); shots+=1
      elif t0 is not None and st[0]=='run' and not after:
        after=True; await asyncio.sleep(2.5); print('AFTER', json.dumps(await pg.evaluate(MEAS))); await pg.screenshot(path=f'{OUT}-after-dance.png'); break
      await asyncio.sleep(0.03)
    print('LOGS',logs[:10])
    await b.close()
asyncio.run(main())
