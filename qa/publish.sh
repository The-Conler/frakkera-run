#!/usr/bin/env bash
# v5s46c: pubblica v5 SOLO se il gate passa. Uso: qa/publish.sh "v5: stageXX" [OUTDIR]
# Il gate costruisce dist; se fallisce non si copia nulla e non si fa push.
set -u
cd "$(dirname "$0")/.."
MSG=${1:?commit message}; OUT=${2:-/tmp/gate-$(date +%s)}
PAGES=${PAGES_DIR:-/workspace/frakkera-run-pages}
if ! bash qa/gate.sh "$OUT"; then echo "PUBLISH BLOCKED: QA gate failed (see $OUT/gate.json)"; exit 1; fi
BUNDLE=$(cat "$OUT/bundle.txt")
rm -rf "$PAGES/v5" && cp -r dist "$PAGES/v5"
git -C "$PAGES" add -A v5 && git -C "$PAGES" -c user.name="FRAKKERA RUN build" -c user.email="build@frakkera.local" commit -q -m "$MSG" && git -C "$PAGES" push -q origin main || { echo "PUBLISH FAIL: pages push"; exit 3; }
for i in $(seq 1 30); do LIVE=$(curl -s "https://the-conler.github.io/frakkera-run/v5/?nc=$RANDOM" | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1); [ "$LIVE" = "$BUNDLE" ] && break; sleep 20; done
echo "live bundle: $LIVE (expected $BUNDLE)"; [ "$LIVE" = "$BUNDLE" ] || exit 4
