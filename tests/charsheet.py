"""Rende col motore del gioco il turnaround e il ciclo di corsa del personaggio 3D. Uso: python3 tests/charsheet.py URL out_turnaround.png out_run.png"""
import asyncio, sys, base64
from playwright.async_api import async_playwright
async def main():
    url, o1, o2 = sys.argv[1], sys.argv[2], sys.argv[3]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 600, 'height': 900})
        await pg.goto(url + '?test=1')
        await pg.wait_for_function('window.__frk && window.__frk.game && window.__frk.game.world.char3d.ready', timeout=60000)
        await asyncio.sleep(1)
        for kind, o, w, h in (('turnaround', o1, 380, 760), ('run', o2, 340, 660), ('closeup', o1.replace('.png', '-close.png'), 380, 560)):
            d = await pg.evaluate(f"window.__frk.game.world.renderCharacterSheet('{kind}', {w}, {h})")
            open(o, 'wb').write(base64.b64decode(d.split(',')[1]))
            print('saved', o)
        await b.close()
asyncio.run(main())
