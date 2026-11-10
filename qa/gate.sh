#!/usr/bin/env bash
# v5s46c QA gate permanente. Uso: qa/gate.sh OUTDIR [--quick]
# Costruisce dist (--base /frakkera-run/v5/), lo serve in locale e lancia: test node (tutti + gate-s46c, 60 seed x 3 giri),
# audit geometrico nel browser su tutte le zone (giri 0-2, piu' seed), screenshot a seed fisso (390x844 + 360x640, giri 0-1,
# controllo HUD, foglio provini, ramo caduto forzato), soak (10 partite a 1700 m+, 0 errori). Esce != 0 se qualcosa fallisce.
set -u
cd "$(dirname "$0")/.."
OUT=${1:?OUTDIR}; mkdir -p "$OUT"
GEO_RUNS=${QA_GEO_RUNS:-"12345:0 777:1 4242:2 31337:0 2024:1 99991:2"}
PORT=${QA_PORT:-8761}
npx vite build --base /frakkera-run/v5/ > "$OUT/build.log" 2>&1 || { echo "GATE FAIL: build"; exit 2; }
SRV=$(mktemp -d); mkdir -p "$SRV/frakkera-run"; cp -r dist "$SRV/frakkera-run/v5"
(cd "$SRV" && exec python3 -m http.server "$PORT" > /dev/null 2>&1) & SPID=$!
trap 'kill $SPID 2>/dev/null; rm -rf "$SRV"' EXIT
sleep 1
BASE="http://localhost:$PORT/frakkera-run/v5/"
grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1 > "$OUT/bundle.txt"
# 1) node
: > "$OUT/node.txt"
for f in tests/*.test.mjs; do if timeout 900 node "$f" > "$OUT/node-$(basename "$f").log" 2>&1; then echo "PASS $f" >> "$OUT/node.txt"; else echo "FAIL $f" >> "$OUT/node.txt"; fi; done
echo "node: $(grep -c ^PASS "$OUT/node.txt") pass, $(grep -c ^FAIL "$OUT/node.txt") fail"
# 2) geometria (3 browser alla volta)
rm -f "$OUT"/geo-*.json; i=0
set -- $GEO_RUNS
while [ $# -gt 0 ]; do
  batch="$1 ${2:-} ${3:-}"; shift $(( $# < 3 ? $# : 3 ))
  QA_STEP=${QA_STEP:-20} python3 qa/geo_audit.py "$BASE" "$OUT/geo-$i.json" $batch > "$OUT/geo-$i.log" 2>&1 || echo "geo batch $i exited $?"
  i=$((i+1))
done
# 3) screenshot + HUD
python3 qa/shots.py "$BASE" "$OUT/shots" > "$OUT/shots.log" 2>&1 || echo "shots exited $?"
# 4) soak
python3 qa/soak.py "$BASE" "$OUT/soak.json" > "$OUT/soak.log" 2>&1 || echo "soak exited $?"
# 5) verdetto
python3 qa/eval.py "$OUT"
