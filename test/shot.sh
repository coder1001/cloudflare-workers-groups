#!/usr/bin/env bash
# Screenshot in Store-Groesse (1280x800) von der Mock-Seite.
# Chrome headless schreibt die Datei zuverlaessig, beendet sich danach aber
# nicht immer - deshalb auf die Datei warten und den Prozess dann beenden.
set -uo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$1"; URL="$2"; WAIT="${3:-25}"

rm -f "$OUT"
PROFILE=$(mktemp -d)
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=1280,800 --screenshot="$OUT" \
  --virtual-time-budget=8000 --user-data-dir="$PROFILE" \
  "$URL" >/dev/null 2>&1 &
PID=$!

for _ in $(seq 1 "$WAIT"); do
  [ -s "$OUT" ] && sleep 1 && break
  sleep 1
done
kill "$PID" 2>/dev/null
wait "$PID" 2>/dev/null
rm -rf "$PROFILE"

[ -s "$OUT" ] && echo "ok: $OUT" || { echo "fehlgeschlagen: $OUT"; exit 1; }
