#!/usr/bin/env bash
# Builds and signs an over-the-air UI bundle for Ante.
# Usage: ANTE_OTA_KEY="$(cat ante-ota-private.pem)" ante-android/scripts/ota-publish.sh <out-dir> <owner/repo>
# Writes <out-dir>/web-<version>.zip and <out-dir>/manifest.json. The app only installs a bundle
# whose manifest is signed by the key whose public half is in Ota.kt.
set -euo pipefail
OUT=${1:?out dir}
REPO=${2:?owner/repo}
ROOT=$(git rev-parse --show-toplevel)
WEB="$ROOT/ante-android/app/src/main/assets/web"
OTA_KT="$ROOT/ante-android/app/src/main/java/com/ante/app/Ota.kt"

if [ -z "${ANTE_OTA_KEY:-}" ]; then
  echo "ANTE_OTA_KEY is not set. Add the private key as a repository secret named ANTE_OTA_KEY." >&2
  exit 1
fi

VERSION=$(git -C "$ROOT" log -1 --format=%ct)          # commit time: always grows
MIN_NATIVE=$(sed -n 's/.*const val NATIVE_API = \([0-9]*\).*/\1/p' "$OTA_KT")
[ -n "$MIN_NATIVE" ] || { echo "NATIVE_API not found in Ota.kt" >&2; exit 1; }

mkdir -p "$OUT"
ZIP="$OUT/web-$VERSION.zip"
rm -f "$ZIP"
(cd "$WEB" && zip -qrX "$ZIP" .)
SHA=$(sha256sum "$ZIP" | cut -d' ' -f1)
SIZE=$(stat -c %s "$ZIP")
URL="https://github.com/$REPO/releases/download/web-latest/web-$VERSION.zip"
PAYLOAD="ante-web|$VERSION|$MIN_NATIVE|$SHA|$SIZE|$URL"

KEYFILE=$(mktemp); trap 'rm -f "$KEYFILE"' EXIT
printf '%s\n' "$ANTE_OTA_KEY" > "$KEYFILE"
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -sign "$KEYFILE" | base64 -w0)

cat > "$OUT/manifest.json" <<JSON
{"version":$VERSION,"minNative":$MIN_NATIVE,"url":"$URL","sha256":"$SHA","size":$SIZE,"sig":"$SIG"}
JSON
echo "Built UI bundle $VERSION (native API $MIN_NATIVE, $SIZE bytes)"
