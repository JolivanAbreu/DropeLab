const sharp = require('sharp');
const { optimizeImage } = require('../integrations/imageOptimizer');

async function makeTestImage({ width, height, format = 'png' }) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })[format]().toBuffer();
}

describe('optimizeImage', () => {
  it('converte pra WebP', async () => {
    const original = await makeTestImage({ width: 800, height: 800 });
    const result = await optimizeImage(original);
    const meta = await sharp(result.buffer).metadata();

    expect(meta.format).toBe('webp');
    expect(result.mimetype).toBe('image/webp');
    expect(result.extension).toBe('.webp');
  });

  it('redimensiona imagem maior que o limite, mantendo a proporção', async () => {
    const original = await makeTestImage({ width: 3200, height: 2400 });
    const result = await optimizeImage(original);
    const meta = await sharp(result.buffer).metadata();

    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(1200);
  });

  it('não aumenta imagem menor que o limite (withoutEnlargement)', async () => {
    const original = await makeTestImage({ width: 400, height: 300 });
    const result = await optimizeImage(original);
    const meta = await sharp(result.buffer).metadata();

    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it('reduz o tamanho do arquivo de forma significativa', async () => {
    const original = await makeTestImage({ width: 2000, height: 2000 });
    const result = await optimizeImage(original);

    expect(result.buffer.length).toBeLessThan(original.length);
  });

  it('aceita JPEG e PNG como entrada', async () => {
    const jpeg = await makeTestImage({ width: 500, height: 500, format: 'jpeg' });
    const png = await makeTestImage({ width: 500, height: 500, format: 'png' });

    const resultJpeg = await optimizeImage(jpeg);
    const resultPng = await optimizeImage(png);

    expect((await sharp(resultJpeg.buffer).metadata()).format).toBe('webp');
    expect((await sharp(resultPng.buffer).metadata()).format).toBe('webp');
  });
});
