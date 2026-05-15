#!/bin/bash
# ==============================================================
# Generate updater manifest for Android APK auto-update
#
# This script creates update.json that the Tauri updater plugin
# reads to check for new versions.
#
# Usage: bash scripts/update/generate-manifest.sh <version> <notes>
#   version: e.g. "0.1.3"
#   notes:   optional release notes (default: "Bug fixes and improvements")
# ==============================================================

set -e

VERSION="${1:-0.1.0}"
NOTES="${2:-Bug fixes and improvements}"
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
MANIFEST_FILE="update.json"

# Platform: only aarch64 Android for now
# Platform key format: android-aarch64 (os-arch)
cat > "$MANIFEST_FILE" << EOF
{
  "version": "${VERSION}",
  "notes": "${NOTES}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "android-aarch64": {
      "url": "https://r2.lelexue.cn/apk/stone-latest.apk",
      "signature": ""
    }
  }
}
EOF

echo "✅ Update manifest generated: $MANIFEST_FILE"
echo "   version:    $VERSION"
echo "   pub_date:   $PUB_DATE"
echo "   platforms:  android-aarch64"
echo ""
echo "Contents:"
cat "$MANIFEST_FILE"
