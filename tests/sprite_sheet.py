"""Esporta un foglio sprite ingrandito (botti, tappeti, pistola, proiettile, vampata) in screenshots/v2-sprites.png."""
import asyncio, base64, io, os
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
URL = 'http://127.0.0.1:4173/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = [  # (chiave, larghezza frame, etichetta)
    ('botte', 18, 'botte'), ('bottecoricata', 26, 'botte coricata'), ('botti', 30, 'gruppo di botti'), ('rollbarrel', 16, 'botte che rotola x4'),
    ('tappeto', 16, 'tappeti Sa Burra: 4 varianti x2'), ('pistola', 18, 'pistola Broccu x2'), ('pistolhand', 6, 'in mano'),
    ('palla', 3, 'colpo'), ('muzzle', 11, 'vampata x3'), ('plank', 0, 'schegge'), ('plank2', 0, ''), ('hoopbit', 0, ''),
]
S = 8
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page()
        await pg.goto(URL + '?test=1')
        await pg.wait_for_function('window.__frk', timeout=20000)
        imgs = {}
        for k, _, _ in ITEMS:
            d = await pg.evaluate("(k) => window.__frk.texCanvas(k).toDataURL()", k)
            imgs[k] = Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')
        await b.close()
    font = ImageFont.load_default()
    rows = [['botte', 'bottecoricata', 'botti', 'rollbarrel'], ['tappeto'], ['pistola', 'pistolhand', 'palla', 'muzzle', 'plank', 'plank2', 'hoopbit']]
    labels = {k: l for k, _, l in ITEMS}
    pad = 24; W = 0; H = pad; placed = []
    for row in rows:
        x = pad; rh = 0
        for k in row:
            im = imgs[k]; w, h = im.size[0] * S, im.size[1] * S
            placed.append((k, x, H, w, h)); x += w + pad * 2; rh = max(rh, h)
        W = max(W, x); H += rh + 40
    sheet = Image.new('RGBA', (W, H), (17, 16, 23, 255))
    dr = ImageDraw.Draw(sheet)
    for k, x, y, w, h in placed:
        sheet.alpha_composite(imgs[k].resize((w, h), Image.NEAREST), (x, y))
        if labels[k]: dr.text((x, y + h + 8), labels[k], fill=(255, 229, 137, 255), font=font)
    out = os.path.join(ROOT, 'screenshots', 'v2-sprites.png')
    sheet.convert('RGB').save(out); print(out, sheet.size)
asyncio.run(main())
