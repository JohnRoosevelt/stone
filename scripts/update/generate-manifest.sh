#!/bin/bash
# ==============================================================
# Generate updater manifest for Android APK + macOS DMG auto-update
#
# Creates update.json that the Tauri updater plugin + the web /my +
# /download pages read to know the latest version + asset URLs +
# sizes. The artifact URLs always point to the R2 `stone-latest.*`
# aliases so a single canonical file is what every client resolves
# (R2 edge is fast in China, GitHub Releases is the mirror for
# history / non-CN users).
#
# Usage: bash scripts/update/generate-manifest.sh <version> <notes> <apk_path> [dmg_path]
#   version:  e.g. "0.2.1"
#   notes:    optional release notes
#   apk_path: path to the built APK (size read from disk)
#   dmg_path: optional, path to DMG (size read from disk if present)
#
# If a path is missing or unreadable, that platform's entry is
# omitted (zero-byte size == skip). No jq dependency — pure heredoc
# with size interpolation, so the script works on minimal CI images
# and on dev machines that don't have jq installed.
# ==============================================================

set -e

VERSION="${1:-0.1.0}"
NOTES="${2:-Bug fixes and improvements}"
APK_PATH="${3:-}"
DMG_PATH="${4:-}"
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

R2_PUBLIC="${R2_PUBLIC:-https://r2.lelexue.cn}"

# Cross-platform byte size: GNU stat, BSD stat, then wc.
file_size() {
  local f="$1"
  if [ -z "$f" ] || [ ! -f "$f" ]; then
    echo 0
    return
  fi
  stat -c%s "$f" 2>/dev/null \
    || stat -f%z "$f" 2>/dev/null \
    || wc -c < "$f" | tr -d ' '
}

APK_SIZE=$(file_size "$APK_PATH")
DMG_SIZE=$(file_size "$DMG_PATH")

# Build the platforms object. Each entry is omitted if size is 0
# (file missing or unreadable). Trailing comma is handled by the
# join step below.
PLATFORM_BLOCKS=()
[ "$APK_SIZE" -gt 0 ] && PLATFORM_BLOCKS+=("\"android-aarch64\": {
    \"url\": \"${R2_PUBLIC}/apk/stone-latest.apk\",
    \"size\": ${APK_SIZE},
    \"signature\": \"\"
  }")
[ "$DMG_SIZE" -gt 0 ] && PLATFORM_BLOCKS+=("\"darwin-universal\": {
    \"url\": \"${R2_PUBLIC}/apk/stone-latest.dmg\",
    \"size\": ${DMG_SIZE},
    \"signature\": \"\"
  }")

# Join blocks with commas.
PLATFORMS=""
for i in "${!PLATFORM_BLOCKS[@]}"; do
  if [ "$i" -gt 0 ]; then
    PLATFORMS+=",
    "
  fi
  PLATFORMS+="${PLATFORM_BLOCKS[$i]}"
done

cat > update.json << EOF
{
  "version": "${VERSION}",
  "notes": "${NOTES}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    ${PLATFORMS}
  }
}
EOF

echo "✅ Update manifest generated: update.json"
echo "   version:    $VERSION"
echo "   pub_date:   $PUB_DATE"
echo "   apk_size:   $APK_SIZE bytes"
echo "   dmg_size:   $DMG_SIZE bytes"
echo ""
echo "Contents:"
cat update.json
