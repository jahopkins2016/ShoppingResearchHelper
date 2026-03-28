const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });

function createIconSvg(size) {
  const fontSize = Math.round(size * 0.45);
  const cy = Math.round(size * 0.55);
  const rx = Math.round(size * 0.2);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">',
    '  <rect width="' + size + '" height="' + size + '" rx="' + rx + '" fill="#2563EB"/>',
    '  <text x="50%" y="' + cy + '" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="' + fontSize + '">S</text>',
    '</svg>'
  ].join('\n');
}

[16, 48, 128].forEach(function(size) {
  fs.writeFileSync(path.join(dir, 'icon' + size + '.png'), createIconSvg(size));
  console.log('Created icon' + size + '.png');
});
