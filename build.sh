#!/usr/bin/env bash
# Baut das ZIP fuer den Chrome Web Store.
# Drin ist nur, was die Extension zur Laufzeit braucht – Tests, Store-Material
# und Git-Interna bleiben draussen.
set -euo pipefail

cd "$(dirname "$0")"
python3 test/check-manifest.py

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/projektgruppen-cloudflare-$VERSION.zip"

rm -rf dist && mkdir -p dist

zip -r -q "$OUT" \
  manifest.json \
  src/ \
  popup/ \
  icons/ \
  -x '*.DS_Store' 'icons/*.svg'

echo "$OUT"
unzip -l "$OUT"
echo "Groesse: $(du -h "$OUT" | cut -f1)"
