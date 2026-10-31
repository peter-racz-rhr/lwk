#!/usr/bin/env bash
# Builds a static web demo of Ante's UI (browser mock, sample data) for Netlify, Vercel or any host.
# Usage: bash scripts/build-web-demo.sh [out-dir]    (default: build/web-demo)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=app/src/main/assets/web
OUT=${1:-build/web-demo}
rm -rf "$OUT" && mkdir -p "$OUT"
cp -r "$SRC/js" "$SRC/fonts" "$SRC/app.css" "$SRC/fonts.css" "$OUT/"

# Web version of index.html: same app, web CSP (no file:), title, description and icon.
cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0a0a0a">
<title>Ante: screen time you can bet with</title>
<meta name="description" content="Ante gives every app a daily time budget, covers it when the time runs out, and lets you stake minutes at roulette, blackjack, slots, poker and coin flip. Web demo with sample data.">
<meta property="og:title" content="Ante">
<meta property="og:description" content="Daily app limits, and casino tables played with your screen-time minutes. Web demo.">
<meta property="og:type" content="website">
<meta name="robots" content="noindex">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="app.css">
</head>
<body>
<main id="app" aria-live="off"></main>
<div id="overlay"></div>
<noscript><p style="padding:24px;color:#fafafa">Ante needs JavaScript to run.</p></noscript>
<script src="js/games.js"></script>
<script src="js/bridge.js"></script>
<script src="js/sfx.js"></script>
<script src="js/fx.js"></script>
<script src="js/app.js"></script>
</body>
</html>
HTML

cat > "$OUT/favicon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0a0a0a"/><circle cx="32" cy="32" r="21" fill="none" stroke="#fafafa" stroke-width="4"/><path d="M23 20h18v3l-6.5 9 6.5 9v3H23v-3l6.5-9-6.5-9z" fill="#fafafa"/></svg>
SVG

# Hosting config: security headers for Netlify (netlify.toml) and Vercel (vercel.json).
CSP="default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
cat > "$OUT/netlify.toml" <<TOML
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "$CSP"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
TOML
cat > "$OUT/vercel.json" <<JSON
{
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Content-Security-Policy", "value": "$CSP" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "no-referrer" }
    ] }
  ]
}
JSON
# Netlify Drop reads _headers reliably; netlify.toml is used by Git-based Netlify deploys.
cat > "$OUT/_headers" <<HDR
/*
  Content-Security-Policy: $CSP
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
HDR
echo "Built $OUT"
