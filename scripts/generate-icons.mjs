import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Read the original SVG
const svgPath = path.join(process.cwd(), 'static/icons/logo.svg');
let svgContent = fs.readFileSync(svgPath, 'utf-8');

// Remove the hardcoded width/height and fix viewBox
svgContent = svgContent.replace(/width="32" height="32"/, '');

// Create a centered wrapper SVG with proper padding
// The original SVG is 128x128, we'll center it on a larger canvas
const ICON_SIZE = 128;
const CANVAS_SIZE = 160; // Extra padding
const OFFSET = (CANVAS_SIZE - ICON_SIZE) / 2; // 16px offset each side

const wrapperSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
  <rect width="100%" height="100%" fill="#1B2120" rx="${CANVAS_SIZE * 0.125}"/>
  <g transform="translate(${OFFSET}, ${OFFSET})">
    ${svgContent.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </g>
</svg>
`;

const outputDir = path.join(process.cwd(), 'static/png');
fs.mkdirSync(outputDir, { recursive: true });

// Generate all required sizes
const configs = [
  { size: 192, name: 'pwa-192.png' },
  { size: 512, name: 'pwa-512.png' },
];

async function generate() {
  for (const { size, name } of configs) {
    await sharp(Buffer.from(wrapperSvg))
      .resize(size, size, {
        fit: 'contain',
        background: { r: 27, g: 33, b: 32, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, name));

    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  console.log('\nAll icons generated successfully!');
}

generate().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
