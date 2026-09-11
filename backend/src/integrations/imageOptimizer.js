const sharp = require('sharp');

const MAX_WIDTH = 1600;
const QUALITY = 82;

async function optimizeImage(buffer) {
  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  return { buffer: optimized, mimetype: 'image/webp', extension: '.webp' };
}

module.exports = { optimizeImage };
