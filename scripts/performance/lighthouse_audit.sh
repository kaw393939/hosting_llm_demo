#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://keithwilliams.org}"
MODE="${2:-desktop}" # desktop|mobile
OUT_DIR="${3:-/tmp/lighthouse-reports}"
CHROME_PATH="${CHROME_PATH:-/Applications/Chromium.app/Contents/MacOS/Chromium}"

mkdir -p "$OUT_DIR"
TS="$(date +%F_%H%M%S)"
BASE="${OUT_DIR}/lighthouse-${MODE}-${TS}"
JSON_OUT="${BASE}.json"
HTML_OUT="${BASE}.html"

LIGHTHOUSE_FLAGS=(
  --chrome-path="$CHROME_PATH"
  --only-categories=performance,accessibility,best-practices,seo
)

if [[ "$MODE" == "desktop" ]]; then
  LIGHTHOUSE_FLAGS+=(--preset=desktop)
elif [[ "$MODE" == "mobile" ]]; then
  LIGHTHOUSE_FLAGS+=(--form-factor=mobile --throttling-method=simulate)
else
  echo "Unsupported mode: $MODE (use desktop|mobile)" >&2
  exit 2
fi

npx -y lighthouse "$URL" \
  "${LIGHTHOUSE_FLAGS[@]}" \
  --output=json \
  --output-path="$JSON_OUT" \
  --quiet

npx -y lighthouse "$URL" \
  "${LIGHTHOUSE_FLAGS[@]}" \
  --output=html \
  --output-path="$HTML_OUT" \
  --quiet

python3 - "$JSON_OUT" "$HTML_OUT" <<'PY'
import json,sys
p=sys.argv[1]
h=sys.argv[2]
with open(p) as f:
    d=json.load(f)
cat=d['categories']
aud=d['audits']
print('report_json', p)
print('report_html', h)
print('performance', round(cat['performance']['score']*100))
print('accessibility', round(cat['accessibility']['score']*100))
print('best-practices', round(cat['best-practices']['score']*100))
print('seo', round(cat['seo']['score']*100))
for k in ['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift','interactive']:
    a=aud.get(k)
    if a:
      print(k, a.get('displayValue'))
PY
