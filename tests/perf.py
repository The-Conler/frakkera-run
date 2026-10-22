"""Misura indicativa del tempo di frame in Chrome headless (SwiftShader, rendering software su CPU).
Uso: python3 tests/perf.py [--url http://127.0.0.1:4173/]. I valori su GPU reale sono molto piu' bassi."""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[sys.argv.index('--url') + 1] if '--url' in sys.argv else 'http://127.0.0.1:4173/'
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
async def measure(p, label, q, vp, dsf, mobile):
    b = await p.chromium.launch(executable_path=CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = await b.new_context(viewport=vp, device_scale_factor=dsf, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page()
    await pg.goto(URL + '?test=1' + q)
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=20000)
    await asyncio.sleep(3)
    menu = await pg.evaluate('window.__frk.perf()')
    await pg.click('[data-act=play]')
    await asyncio.sleep(6)
    run = await pg.evaluate('window.__frk.perf()')
    await b.close()
    print(label, json.dumps({'menu': menu, 'run': run}))
async def main():
    async with async_playwright() as p:
        await measure(p, 'mobile 390x844 DPR1.75 fisso', '&fixeddpr', {'width': 390, 'height': 844}, 3, True)
        await measure(p, 'mobile 390x844 DPR1 fisso', '&fixeddpr', {'width': 390, 'height': 844}, 1, True)
        await measure(p, 'desktop 1366x900 DPR1', '&fixeddpr', {'width': 1366, 'height': 900}, 1, False)
asyncio.run(main())
