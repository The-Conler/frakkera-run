"""OBSOLETO dalla v4: il personaggio non e' piu' lo sprite pixel art ma un modello 3D (GLB).
Tenuto solo come riferimento storico per la v3 (tag v3); non fa parte della suite di test.
"""
"""Hash del pixel output degli sprite protetti (player, torch, flame).
Uso: python3 tests/sprite_hash.py [url]  -> stampa JSON con gli hash."""
import asyncio, sys, json, hashlib
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 390, 'height': 844})
        await pg.goto(URL + '?test=1')
        await pg.wait_for_function('window.__frk', timeout=20000)
        data = await pg.evaluate("""() => {
          const out = {};
          for (const k of ['player', 'torch', 'flame']) {
            const c = window.__frk.texCanvas(k);
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            out[k] = [c.width, c.height, Array.from(d).join(',')];
          }
          return out;
        }""")
        print(json.dumps({k: [v[0], v[1], hashlib.sha256(v[2].encode()).hexdigest()[:16]] for k, v in data.items()}))
        await b.close()
asyncio.run(main())
