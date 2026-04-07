const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });

// Square SVG with the SaveIt bookmark logo centered on a rounded-rect background
function createIconSvg(size) {
  const pad = Math.round(size * 0.12);
  const innerW = size - pad * 2;
  const innerH = innerW * (232 / 160); // maintain aspect ratio
  const offsetY = Math.round((size - Math.min(innerH, size - pad * 2)) / 2);
  const scale = Math.min(innerW / 160, (size - pad * 2) / 232);
  const tx = Math.round((size - 160 * scale) / 2);
  const ty = Math.round((size - 232 * scale) / 2);
  const rx = Math.round(size * 0.22);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#2563EB"/>
  <g transform="translate(${tx},${ty}) scale(${scale.toFixed(4)})">
    <path d="M8 0 Q0 0 0 8 L0 224 L76 174 L152 224 L152 8 Q152 0 144 0 Z" fill="#fff" opacity="0.95"/>
    <path opacity="0.15" d="M16 0 L136 0 L136 60 L16 60 Z" fill="#2563EB"/>
    <circle cx="76" cy="100" r="36" fill="#16A34A"/>
    <polyline points="58,100 72,114 96,84" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function generateIcons() {
  for (const size of [16, 48, 128]) {
    const svg = Buffer.from(createIconSvg(size));
    await sharp(svg).png().toFile(path.join(dir, `icon${size}.png`));
    console.log(`Created icon${size}.png (${size}x${size})`);
  }
}

generateIcons().catch(console.error);
