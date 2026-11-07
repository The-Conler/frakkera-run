"""v5 stage 5: attraversa ogni confine tra ambienti GIOCANDO normalmente (partenza poco prima del confine
con il salto di mappa, poi corsa reale), registra metriche per frame e un foglio provini per confine.
Uso: python3 tests/transitions.py [--url http://127.0.0.1:4173/] [--tag after] [--only village,rock]
Metriche: tempo di env.update e gap tra frame, distanza costruita davanti vs distanza visibile (nebbia/far)."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
URL = sys.argv[sys.argv.index('--url') + 1] if '--url' in sys.argv else 'http://127.0.0.1:4173/'
TAG = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else 'after'
ONLY = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots'); TMP = os.path.join(SHOTS, 'tmp-trans'); os.makedirs(TMP, exist_ok=True)
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
# (nome, mappa di partenza, metri dentro la mappa, lunghezza mappa)
B = [('village-rock', 'village', 250), ('rock-river', 'rock', 250), ('river-viaduct', 'river', 250), ('viaduct-mineext', 'viaduct', 250),
     ('mineext-mineint', 'mine-ext', 150), ('mineint-mineblue', 'mine-int', 200), ('mineblue-village', 'mine-blue', 250)]
LEAD, AFTER, SHOT = 170, 55, 50   # partenza 170 m prima (regime), fotogrammi da -50 m a +55 m
HOOK = """(() => { const w = window.__frk.game.world, e = w.env; if (e.__rec) return; const rec = e.__rec = [];
  const u = e.update.bind(e); let last = performance.now(), built = 0;
  e.update = (camW, pW, dt, clock) => { const t0 = performance.now(); u(camW, pW, dt, clock); const t1 = performance.now();
    const ahead = (x) => +(x - pW).toFixed(1);
    rec.push({ t: +t0.toFixed(1), gap: +(t0 - last).toFixed(1), ms: +(t1 - t0).toFixed(2), b: +e.cur.bDist.toFixed(1), biome: e.cur.b.id,
      g: ahead(e.gW), s: Math.min(...e.sides.map((s) => ahead(s.cur))), c: ahead(e.cW), fog: +w.scene.fog.far.toFixed(0), far: w.camera.far,
      nb: e.stats.built - built, marks: e.marks.size }); built = e.stats.built; last = t0; };
})()"""
KEEP = "(() => { const g = window.__frk.game; g.sim.fuel = Math.max(g.sim.fuel, 100); g.sim.invuln = 5; return window.__frk.game.world.env.cur.bDist; })()"
async def run(b, name, mp, ln):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL + f'?test=1&fixeddpr&map={mp}&at={ln - LEAD}')
    await pg.wait_for_function('window.__frk && document.querySelector("#loading").classList.contains("hidden")', timeout=30000)
    await pg.wait_for_function('window.__frk.game.world.char3d.ready || window.__frk.game.world.char3d.failed', timeout=30000)
    await asyncio.sleep(2.0)
    await pg.evaluate(HOOK)
    await pg.click('[data-act=play]')
    b0 = await pg.evaluate('window.__frk.game.world.env.cur.bDist'); bnd = b0 + LEAD - 4
    frames = []; i = 0
    while True:
        bd = await pg.evaluate(KEEP)
        if bd > bnd + AFTER or i > 160: break
        if bd < bnd - SHOT: await asyncio.sleep(0.2); continue
        p = os.path.join(TMP, f'{TAG}-{name}-{i:03d}.png'); await pg.screenshot(path=p); frames.append((p, bd - bnd)); i += 1
    rec = await pg.evaluate('window.__frk.game.world.env.__rec')
    perf = await pg.evaluate('window.__frk.perf()')
    await ctx.close()
    # foglio provini: 12 fotogrammi a intervalli regolari attorno al confine
    sel = [frames[int(k * (len(frames) - 1) / 11)] for k in range(12)] if len(frames) >= 12 else frames
    tw, th = 195, 422; sheet = Image.new('RGB', (tw * 6, (th + 22) * 2), '#111')
    d = ImageDraw.Draw(sheet)
    for k, (p, rel) in enumerate(sel):
        im = Image.open(p).convert('RGB').resize((tw, th)); x, y = (k % 6) * tw, (k // 6) * (th + 22)
        sheet.paste(im, (x, y + 22)); d.text((x + 4, y + 4), f'{rel:+.0f} m dal confine', fill='#fff')
    out = os.path.join(SHOTS, f'v5s5-transizione-{name}{"" if TAG == "after" else "-" + TAG}.png'); sheet.save(out)
    run_rec = [r for r in rec if r['b'] > bnd - 60 and r['b'] < bnd + AFTER + 5]
    gaps = sorted(r['gap'] for r in run_rec[2:]) or [0]; ms = sorted(r['ms'] for r in run_rec[2:]) or [0]
    short = [r for r in run_rec if min(r['g'], r['s']) < min(r['fog'], r['far']) - 2 and r['biome'] not in ('mine-int', 'mine-blue')]
    res = {'frames': len(rec), 'shots': len(frames), 'envMsMax': ms[-1], 'envMsP95': ms[int(len(ms) * .95)], 'gapMax': gaps[-1], 'gapP50': gaps[len(gaps) // 2],
           'minAheadGround': min(r['g'] for r in run_rec), 'minAheadSide': min(r['s'] for r in run_rec), 'minVisible': min(min(r['fog'], r['far']) for r in run_rec),
           'framesBuiltShortOfVisible': len(short), 'maxBuiltPerFrame': max(r['nb'] for r in run_rec), 'drawCalls': perf['drawCalls'], 'errors': errs[:3], 'sheet': out}
    print(name, json.dumps(res)); return name, res, rec
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for name, mp, ln in B:
            if ONLY and name not in ONLY: continue
            n, r, rec = await run(b, name, mp, ln); out[n] = r
            json.dump(rec, open(os.path.join(TMP, f'{TAG}-{name}.json'), 'w'))
        await b.close()
    json.dump(out, open(os.path.join(SHOTS, f'v5s5-transizioni-{TAG}.json'), 'w'), indent=1)
asyncio.run(main())
