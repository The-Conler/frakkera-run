#!/usr/bin/env bash
# Pipeline completa del personaggio v4: Blender headless + MPFB2 -> GLB ottimizzato (meshopt) in public/models/.
# Requisiti: Blender 4.2 LTS con l'estensione MPFB 2.0.8 e gli asset pack CC0 MakeHuman (vedi README),
#            Node con @gltf-transform/cli (npx).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
BLENDER="${BLENDER:-/workspace/tools/blender-4.2.9-linux-x64/blender}"
GT="${GLTF_TRANSFORM:-npx --prefix /workspace/tools/gltf gltf-transform}"
TMP="$ROOT/.tmp/blend"; mkdir -p "$TMP"
"$BLENDER" -b --python "$HERE/step1_human.py"
"$BLENDER" -b "$TMP/step1.blend" --python "$HERE/step2a_regions.py"
python3 "$HERE/make_textures.py"
"$BLENDER" -b "$TMP/step1.blend" --python "$HERE/step2_build.py"
"$BLENDER" -b "$TMP/step2.blend" --python "$HERE/step3_anim.py"
"$BLENDER" -b "$TMP/step3.blend" --python "$HERE/step4_export.py" -- "$TMP/frakkera-man.raw.glb"
$GT meshopt "$TMP/frakkera-man.raw.glb" "$ROOT/public/models/frakkera-man.glb" --level medium
ls -la "$ROOT/public/models/frakkera-man.glb"
