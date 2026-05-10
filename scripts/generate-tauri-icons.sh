#!/bin/bash
# Generate Tauri icons from the web PWA icon (pwa-512.png)
# Uses Tauri CLI to generate all required sizes

set -e

# Source icon from web manifest
SOURCE="static/png/pwa-512.png"
ICONS_DIR="src-tauri/icons"

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source icon not found at $SOURCE"
  exit 1
fi

echo "Generating Tauri icons from $SOURCE ..."

# Use Tauri CLI to generate all icon sizes
bunx tauri icon "$SOURCE" --output "$ICONS_DIR" 2>/dev/null || {
  echo "Tauri CLI not available, using fallback..."

  # Fallback: manually copy and resize using macOS sips
  mkdir -p "$ICONS_DIR"

  # Copy source as base icon
  cp "$SOURCE" "$ICONS_DIR/icon.png"

  # Resize using sips (macOS built-in)
  sips -z 32 32 "$SOURCE" --out "$ICONS_DIR/32x32.png" > /dev/null 2>&1
  sips -z 128 128 "$SOURCE" --out "$ICONS_DIR/128x128.png" > /dev/null 2>&1
  sips -z 256 256 "$SOURCE" --out "$ICONS_DIR/128x128@2x.png" > /dev/null 2>&1

  echo "Fallback complete. Note: .icns and .ico not generated."
}

echo "Done! Icons generated in $ICONS_DIR"
ls -lh "$ICONS_DIR"
