import asyncio, os, mimetypes
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOTS={'/sil.html':'/tmp/silroot/sil.html'}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':390,'height':844}); pg.on('pageerror',lambda e:print('ERR',e))
    async def serve(route):
      pth=urlparse(route.request.url).path; f=ROOTS.get(pth) or '/workspace/frakkera-run'+pth
      if not os.path.exists(f): return await route.fulfill(status=404,body='')
      await route.fulfill(status=200,body=open(f,'rb').read(),content_type='text/javascript' if f.endswith('.js') else mimetypes.guess_type(f)[0] or 'text/html')
    await pg.route('http://frk.local/**',serve); await pg.goto('http://frk.local/sil.html')
    await pg.wait_for_function('window.done',timeout=60000); await pg.screenshot(path='/workspace/frakkera-run/screenshots/v5s27k-tower-silhouette.png'); await b.close()
asyncio.run(main())
