// Generates Android launcher icons (mipmap ic_launcher.png at all densities)
// from the same SaveIt SVG used for the Chrome extension. Run from
// extension/ with: node src/generate-android-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const mobileResDir = path.join(
  __dirname, '..', '..', 'mobile_flutter', 'android', 'app', 'src', 'main', 'res'
);

// Android mipmap densities for ic_launcher.png
const densities = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

function createIconSvg(size) {
  const scale = size / 192; // design ref size
  const rx = Math.round(size * 0.22); // rounded-square corner
  const bookmarkScale = (size * 0.62) / 152;
  const tx = Math.round((size - 152 * bookmarkScale) / 2);
  const ty = Math.round((size - 232 * bookmarkScale) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#2563EB"/>
  <g transform="translate(${tx},${ty}) scale(${bookmarkScale.toFixed(4)})">
    <path d="M8 0 Q0 0 0 8 L0 224 L76 174 L152 224 L152 8 Q152 0 144 0 Z" fill="#fff" opacity="0.95"/>
    <path opacity="0.15" d="M16 0 L136 0 L136 60 L16 60 Z" fill="#2563EB"/>
    <circle cx="76" cy="100" r="36" fill="#16A34A"/>
    <polyline points="58,100 72,114 96,84" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function generate() {
  for (const [dir, size] of Object.entries(densities)) {
    const outDir = path.join(mobileResDir, dir);
    fs.mkdirSync(outDir, { recursive: true });
    const svg = Buffer.from(createIconSvg(size));
    const outPath = path.join(outDir, 'ic_launcher.png');
    await sharp(svg).png().toFile(outPath);
    console.log(`Wrote ${outPath} (${size}x${size})`);
  }
}

generate().catch((e) => { console.error(e); process.exit(1); });
