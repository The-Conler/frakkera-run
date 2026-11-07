# v5 stage 24: potenziamenti e ramo caduto (390 px)
import asyncio
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:4811/'
SP = "(k,ahead,lane,extra)=>{const s=window.__frk.game.sim; s.spawn(Object.assign({kind:k,lane:lane??s.targetLane,d:s.T-s.genOffset+ahead,len:k==='ramo'?10:12,pickup:k!=='ramo'},extra||{}));}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'{URL}?test=1&map=rock&at=40')
        await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=60000)
        await asyncio.sleep(1); await pg.click('[data-act=play]'); await asyncio.sleep(2.5)
        keep = "(()=>{const s=window.__frk.game.sim; s.fuel=100;})()"
        async def shot(n): await pg.evaluate(keep); await pg.screenshot(path=f'screenshots/feat-power-{n}.png'); print('shot', n)
        async def spawn(k, a, lane=None): await pg.evaluate(f"({SP})('{k}',{a},{'null' if lane is None else lane})")
        await spawn('calamita', 160); await asyncio.sleep(0.6); await shot('01-calamita')
        await asyncio.sleep(2)
        for i in range(6): await spawn('tappeto', 200 + i * 30, (i % 2) * 2)
        await asyncio.sleep(1.4); await shot('02-calamita-attiva')
        await spawn('finocchio', 160); await asyncio.sleep(0.6); await shot('03-finocchio')
        await asyncio.sleep(2); await shot('04-finocchio-attivo')
        await spawn('scarponi', 160); await asyncio.sleep(0.6); await shot('05-scarponi')
        await asyncio.sleep(2.1); await shot('06-scarponi-attivi')
        await asyncio.sleep(3)
        await pg.evaluate("(()=>{const s=window.__frk.game.sim; s.entities.filter(e=>!e.pickup).forEach(e=>e.done=true);})()")
        await spawn('ramo', 260); await asyncio.sleep(0.9); await shot('07-ramo')
        await pg.evaluate("new Promise(res=>{const f=()=>{const s=window.__frk.game.sim; s.fuel=100; const e=s.entities.find(x=>x.kind==='ramo'&&!x.done&&!x.hit); if(e&&e.d-s.T<60){s.duck(); setTimeout(res,150);} else requestAnimationFrame(f);}; f();})")
        await pg.screenshot(path='screenshots/feat-power-08-ramo-abbassati.png'); print('shot 08')
        st = await pg.evaluate("JSON.stringify(window.__frk.game.sim.stats)")
        print(st, errs[:3])
        await b.close()
asyncio.run(main())
