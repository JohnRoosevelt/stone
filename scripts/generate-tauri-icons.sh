#!/bin/bash
# Generate PWA icons from SVG, then Tauri icons from the PWA icon
# Uses sharp (Node.js) for SVG→PNG, then Tauri CLI for platform icons

set -e

SVG="static/icons/logo.svg"
PNG_DIR="static/png"
ICONS_DIR="src-tauri/icons"

# ── Step 1: Generate PWA PNGs from SVG ─────────────────────────
echo "Generating PWA icons from $SVG ..."
mkdir -p "$PNG_DIR"

node -e "
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('$SVG', 'utf-8');
const buf = Buffer.from(svg);
Promise.all([
  sharp(buf).resize(512, 512).flatten({ background: '#000000' }).toFile('$PNG_DIR/pwa-512.png'),
  sharp(buf).resize(192, 192).flatten({ background: '#000000' }).toFile('$PNG_DIR/pwa-192.png'),
]).then(() => console.log('PWA icons OK')).catch(console.error);
"

# ── Step 2: Generate Tauri icons from PWA 512 ─────────────────────
SOURCE="$PNG_DIR/pwa-512.png"
echo "Generating Tauri icons from $SOURCE ..."

bunx tauri icon "$SOURCE" --output "$ICONS_DIR" 2>/dev/null || {
  echo "Tauri CLI not available, using fallback..."

  # Fallback: manually copy and resize using macOS sips
  mkdir -p "$ICONS_DIR"
  cp "$SOURCE" "$ICONS_DIR/icon.png"
  sips -z 32 32 "$SOURCE" --out "$ICONS_DIR/32x32.png" > /dev/null 2>&1
  sips -z 128 128 "$SOURCE" --out "$ICONS_DIR/128x128.png" > /dev/null 2>&1
  sips -z 256 256 "$SOURCE" --out "$ICONS_DIR/128x128@2x.png" > /dev/null 2>&1
  echo "Fallback complete."
}

echo "Done!"
ls -lh "$ICONS_DIR"
