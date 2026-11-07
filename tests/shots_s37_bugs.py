import asyncio, sys, os
from playwright.async_api import async_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4820/')
TAG = sys.argv[1] if len(sys.argv) > 1 else 'before'
# (name, map, at, marks_local)
JOBS = [
  ('village28', 'village', '20', [28]),
  ('village40', 'village', '20', [40]),
  ('rock409', 'rock', '150', [159]),   # abs ~409
  ('river30', 'river', '20', [30, 96, 128]),
  ('river96', 'river', '80', [96]),
]
JS = """(()=>{const g=window.__frk.game,s=g.sim; s.fuel=100; s.invuln=1;
  if(s.mode==='dance'||s.danceCue) s.skipDance&&s.skipDance();
  if(s.mode==='shop') s.exitShop&&s.exitShop();
  const e=g.world.env; return [e.cur.local, e.cur.b.id, Math.floor(s.runD/10), e.marks?[...e.marks.keys()]:[]]})()"""
async def one(p, name, MAP, AT, MARKS):
  b = await p.chromium.launch(executable_path='/usr/bin/google-chrome',
    args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
  ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, has_touch=True, is_mobile=True)
  pg = await ctx.new_page()
  await pg.goto(f'{URL}?test=1&map={MAP}&at={AT}')
  await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=120000)
  await asyncio.sleep(1.2)
  await pg.click('[data-act=play]')
  mi = 0
  for _ in range(8000):
    loc, bid, meters, marks = await pg.evaluate(JS)
    if mi < len(MARKS) and MARKS[mi] <= loc < 999:
      path = f'screenshots/v5s37-{TAG}-{name}-{int(MARKS[mi])}.png'
      await pg.screenshot(path=path)
      print(TAG, name, MARKS[mi], 'loc', round(loc,1), 'biome', bid, 'm', meters, 'marks', marks, '->', path, flush=True)
      mi += 1
    if mi >= len(MARKS): break
    await asyncio.sleep(0.03)
  await b.close()
async def main():
  async with async_playwright() as p:
    for job in JOBS:
      try: await one(p, *job)
      except Exception as e: print('FAIL', job[0], e, flush=True)
asyncio.run(main())
