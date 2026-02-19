# Lighthouse performance workflow

This platform is built for repeatability. The goal is:
- Make measurable improvements (before/after)
- Keep changes minimal and reversible

## Local prerequisites
- Node.js + npm
- A Chrome/Chromium binary

This repo assumes Chromium is installed at:
- `/Applications/Chromium.app/Contents/MacOS/Chromium`

## Run a Lighthouse audit (CLI)

Convenience script in this repo:
```bash
scripts/performance/lighthouse_audit.sh https://keithwilliams.org desktop
scripts/performance/lighthouse_audit.sh https://keithwilliams.org mobile
```

### Quick audit
```bash
CHROME_PATH="/Applications/Chromium.app/Contents/MacOS/Chromium"
URL="https://keithwilliams.org"

npx -y lighthouse "$URL" \
  --chrome-path="$CHROME_PATH" \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=html \
  --output-path="/tmp/lighthouse-$(date +%F_%H%M%S).html"
```

### Mobile-like throttling
```bash
CHROME_PATH="/Applications/Chromium.app/Contents/MacOS/Chromium"
URL="https://keithwilliams.org"

npx -y lighthouse "$URL" \
  --chrome-path="$CHROME_PATH" \
  --form-factor=mobile \
  --throttling-method=simulate \
  --only-categories=performance \
  --output=html \
  --output-path="/tmp/lighthouse-mobile-$(date +%F_%H%M%S).html"
```

## What to look for
- TTFB / server response time
- Render-blocking resources
- Unused JS/CSS
- Image optimization (sizes, next/image)
- Caching headers (especially `/_next/static/*`)

## Similar tools
- PageSpeed Insights (field + lab blend)
- WebPageTest (waterfalls, repeat-view cache behavior)

## Repeatability tips
- Run 3 times and compare medians.
- Measure after each change (don’t batch changes).
- Keep reports in a non-committed folder (e.g. `/tmp/`).
