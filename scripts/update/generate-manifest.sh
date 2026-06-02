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
#
# GITHUB_REPO is provided by CI (e.g. "owner/repo"). Locally it
# defaults to the placeholder in src/lib/updater.svelte.js so the
# generated manifest matches what the dev client will resolve to.
# ==============================================================

set -e

VERSION="${1:-0.1.0}"
NOTES="${2:-Bug fixes and improvements}"
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
MANIFEST_FILE="update.json"
GITHUB_REPO="${GITHUB_REPOSITORY:-stone-releases/placeholder}"

# Platform: only aarch64 Android for now
# Platform key format: android-aarch64 (os-arch)
# URL: GitHub Release asset path. The tag is $VERSION with a 'v' prefix
# (matches `git tag v0.1.3` convention). The asset filename is the APK
# uploaded by build-android.yml's `Upload to release` step.
cat > "$MANIFEST_FILE" << EOF
{
  "version": "${VERSION}",
  "notes": "${NOTES}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "android-aarch64": {
      "url": "https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/stone-${VERSION}.apk",
      "signature": ""
    }
  }
}
EOF

echo "✅ Update manifest generated: $MANIFEST_FILE"
echo "   version:    $VERSION"
echo "   pub_date:   $PUB_DATE"
echo "   platforms:  android-aarch64"
echo "   repo:       ${GITHUB_REPO}"
echo ""
echo "Contents:"
cat "$MANIFEST_FILE"
