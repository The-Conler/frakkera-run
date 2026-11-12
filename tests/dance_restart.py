# Riavvio pulito e ballu tundu solo nei giri pari (2, 4, 6).
# Il cerchio del ballo vive nel mondo 3D e non seguiva il reset della sim: un rigioca
# durante il ballo, il cue o subito dopo ripartiva ancora nel ballu tundu.
import asyncio
from playwright.async_api import async_playwright

URL = 'http://127.0.0.1:5173/?test=1'

PROBE = """(lap) => {
  const g = window.__frk.game, s = g.sim;
  s.mode = 'run';
  s.dance = null; s.danceCue = null; s.danceLap = -1;
  s.fuel = 100; s.invuln = 5;
  s.mapOffsetM = lap * 1600 + 84 - 4;
  s.genOffset = s.T;
  let mode = s.mode, cue = false;
  for (let i = 0; i < 200 && mode !== 'dance'; i++) {
    s.fuel = 100; s.invuln = 3;
    s.tick(0.05);
    mode = s.mode;
    if (s.danceCue) cue = true;
    if (Math.floor(s.runD / 10) > 14) break;
  }
  const meters = Math.floor(s.runD / 10);
  return { lap, mode, cue, meters, ring: g.world.dance.state };
}"""

CLEAN = """() => {
  const g = window.__frk.game, s = g.sim;
  s.mapOffsetM = 0;
  g.startRun();
  for (let i = 0; i < 8; i++) s.tick(1 / 60);
  return {
    mode: s.mode,
    meters: Math.floor(s.runD / 10),
    dance: !!s.dance,
    cue: !!s.danceCue,
    ring: g.world.dance.state,
    ui: !document.querySelector('#dance-ui').classList.contains('hidden') ? 'shown' : 'hidden',
  };
}"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': 390, 'height': 844})).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.wait_for_function('window.__frk && (window.__frk.game.world.char3d.ready || window.__frk.game.world.char3d.failed)', timeout=30000)
        await pg.click('[data-act=play]')
        await pg.wait_for_function("window.__frk.ui()==='play' && window.__frk.game.sim.mode==='run'", timeout=20000)

        # giri 1..6 (lap 0..5): ballo solo su 2, 4, 6
        for lap in range(6):
            r = await pg.evaluate(PROBE, lap)
            want = lap >= 1 and lap % 2 == 1
            ok = (r['mode'] == 'dance') if want else (r['mode'] == 'run' and not r['cue'])
            print(('PASS' if ok else 'FAIL'), f"giro {lap+1}", r)
            assert ok, r
            await pg.evaluate(CLEAN)

        # rigioca dentro il ballo, appena prima del cue, e subito dopo l'avvio
        async def restart_case(label, setup):
            await pg.evaluate(setup)
            await pg.wait_for_timeout(80)
            c = await pg.evaluate(CLEAN)
            ok = c['mode'] == 'run' and c['meters'] < 2 and not c['dance'] and not c['cue'] and c['ring'] == 'off'
            print(('PASS' if ok else 'FAIL'), label, c)
            assert ok, (label, c)

        await restart_case('durante il ballo', """() => {
          const s = window.__frk.game.sim;
          s.mode = 'run'; s.mapOffsetM = 0; s.danceLap = -1; s.danceCue = null; s.dance = null;
          s.startDance(1);
        }""")
        await restart_case('subito dopo il ballo', """() => {
          const s = window.__frk.game.sim;
          s.mode = 'run'; s.mapOffsetM = 0;
          s.startDance(1);
          s.finishDance(false);
        }""")
        await restart_case('durante il cue', """() => {
          const g = window.__frk.game, s = g.sim;
          s.mode = 'run'; s.mapOffsetM = 0; s.dance = null; s.danceLap = -1;
          s.danceCue = { lap: 1, d0: 400 };
          g.world.onFx('danceCue', { lap: 1 }, s);
        }""")

        # niente panni generati all'inizio del giro 2
        cloth = await pg.evaluate("""() => {
          const g = window.__frk.game;
          g.sim.mapOffsetM = 1600;
          g.startRun();
          const seen = new Set();
          for (let i = 0; i < 900; i++) { g.sim.fuel = 100; g.sim.invuln = 2; g.sim.tick(1/30); g.sim.entities.forEach((e) => seen.add(e.kind)); }
          g.sim.mapOffsetM = 0;
          return { panni: seen.has('panni'), trave: seen.has('trave'), mode: g.sim.mode };
        }""")
        print(('PASS' if not cloth['panni'] else 'FAIL'), 'niente panni al giro 2', cloth)
        assert not cloth['panni'], cloth
        print('ERRS', errs[:4])
        await b.close()

asyncio.run(main())
