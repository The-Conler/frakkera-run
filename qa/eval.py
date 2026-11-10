#!/usr/bin/env python3
"""v5s46c QA gate - valutazione: legge i risultati (geo, shots, soak, node) e decide PASS/FAIL.
Uso: python3 qa/eval.py OUTDIR   (OUTDIR contiene geo-*.json, shots/shots.json, soak.json, node.txt)
Scrive OUTDIR/gate.json e esce con 1 se anche un solo controllo fallisce."""
import glob, json, os, sys
OUT = sys.argv[1]
checks = {}   # nome -> [pass, fail, esempi]
def rec(name, ok, ex=None):
  c = checks.setdefault(name, [0, 0, []])
  if ok: c[0] += 1
  else:
    c[1] += 1
    if ex is not None and len(c[2]) < 6: c[2].append(ex)
# --- node (test esistenti + gate-s46c)
nt = os.path.join(OUT, 'node.txt')
if os.path.exists(nt):
  for line in open(nt):
    if line.startswith('PASS ') or line.startswith('FAIL '): rec('node:' + os.path.basename(line.split()[1]), line.startswith('PASS'), line.strip())
else: rec('node:missing', False, 'node.txt missing')
# --- geometria
geo = []
for f in sorted(glob.glob(os.path.join(OUT, 'geo-*.json'))): geo += json.load(open(f))
if not geo: rec('geo:missing', False, 'no geo results')
for r in geo:
  where = f"s{r.get('seed')} L{r.get('lap')} {r.get('m')}m {r.get('zone', '')}"
  if 'errors' in r: rec('geo:console-errors', not r['errors'], [where] + r['errors'][:3]); continue
  if 'err' in r: rec('geo:audit-exception', False, [where, r['err']]); continue
  v = r.get('voids')
  if v: rec('geo:see-through-holes', v['holes'] <= 0.001, [where, v]); rec('geo:fill-panels-visible', v['fill'] <= 0.002, [where, v])
  g = r.get('ground')
  if g is not None: rec('geo:grounding', not g['bad'], [where, g['bad'][:4]])
  if 'lamps' in r: rec('geo:lights-without-fixture', not r['lamps']['bad'], [where, r['lamps']['bad'][:4]])
  if 'zfight' in r: rec('geo:z-fighting', not r['zfight']['bad'], [where, r['zfight']['bad'][:4]])
  c = r.get('corridor')
  if c: rec('geo:scenery-in-lanes', not c['lane'], [where, c['lane'][:4]]); rec('rule:nothing-over-village-street', not c['over'], [where, c['over'][:4]])
  if 'memorial' in r and not r['memorial'].get('skip'):
    mm = r['memorial']; rec('rule:memorial-unobstructed', all(x.get('ok') for x in mm.values()), [where, mm])
  if 'rails' in r: rec('geo:mine-rails-continuous', not r['rails']['bad'], [where, r['rails']['bad'][:4]])
# --- screenshot + HUD
sj = os.path.join(OUT, 'shots', 'shots.json')
if os.path.exists(sj):
  S = json.load(open(sj))
  rec('shots:console-errors', not S['errors'], S['errors'][:3])
  for r in S['rows']:
    h = r['hud']; where = f"L{r['lap']} {r['view']} {r['m']}m"
    rec('hud:overlap', not h['over'], [where, h['over']]); rec('hud:offscreen', not h['off'], [where, h['off']])
    rec('hud:text-too-small', not h['small'], [where, h['small'][:3]]); rec('hud:popups-overlap', not h['popOver'], [where, h['popOver']])
    rec('hud:spara-covers-right-lane', h['fireLane'] == 0, [where, h['fireLane']])
  for r in S['rows']:
    if r.get('forced') == 'ramo': rec('shots:fallen-tree-grounded', not [b for b in r['ground']['bad'] if b['kind'] == 'ramo'], [r['path'], r['ground']['bad']])
  rec('shots:fallen-tree-shot', any('ramo' in os.path.basename(p) for p in glob.glob(os.path.join(OUT, 'shots', '*.png'))), 'forced fallen-tree shot missing')
else: rec('shots:missing', False, 'shots.json missing')
# --- soak
sk = os.path.join(OUT, 'soak.json')
if os.path.exists(sk):
  for r in json.load(open(sk)): rec('soak:run-to-1700m-no-errors', r['ok'], r)
else: rec('soak:missing', False, 'soak.json missing')
tot_p = sum(c[0] for c in checks.values()); tot_f = sum(c[1] for c in checks.values())
res = {'pass': tot_f == 0, 'checks_passed': tot_p, 'checks_failed': tot_f, 'by_check': {k: {'pass': v[0], 'fail': v[1], 'examples': v[2]} for k, v in sorted(checks.items())}}
json.dump(res, open(os.path.join(OUT, 'gate.json'), 'w'), indent=1)
for k, v in sorted(checks.items()): print(('PASS ' if v[1] == 0 else 'FAIL ') + f"{k}: {v[0]} ok / {v[1]} fail" + (f"  e.g. {json.dumps(v[2][0])[:300]}" if v[1] else ''))
print(json.dumps({'GATE': 'PASS' if tot_f == 0 else 'FAIL', 'passed': tot_p, 'failed': tot_f}))
sys.exit(0 if tot_f == 0 else 1)
