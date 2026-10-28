import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'public/delivery';
await mkdir(directory, { recursive: true });
const manifest = [];
for (let index = 1; index <= 3; index++) {
  const bars = Array.from({ length: 16 }, (_, i) => {
    const height = 80 + ((i * 83 + index * 61) % 290);
    return `<rect x="${i * 80}" y="${600 - height}" width="56" height="${height}" rx="6" fill="#936126" opacity="${0.25 + i / 24}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#f7f3ea"/><circle cx="${900 - index * 80}" cy="190" r="130" fill="#e1c893"/>${bars}<path d="M0 580 L160 480 L320 510 L480 320 L640 380 L800 190 L960 240 L1280 80" fill="none" stroke="#39342b" stroke-width="12"/><path d="M0 630H1280" stroke="#39342b" stroke-width="4"/></svg>`;
  const source = Buffer.from(svg);
  await writeFile(`${directory}/scene-${index}.svg`, source);
  for (const [width, format] of [
    [2400, 'jpeg'],
    [480, 'webp'],
    [960, 'webp'],
    [1280, 'webp'],
    [480, 'avif'],
    [960, 'avif'],
    [1280, 'avif'],
  ]) {
    const body = await sharp(source)
      .resize(width)
      .toFormat(format, { quality: format === 'jpeg' ? 92 : 65 })
      .toBuffer();
    const file = `scene-${index}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
    await writeFile(`${directory}/${file}`, body);
    manifest.push({
      file,
      width,
      height: (width * 9) / 16,
      bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
  }
}
await writeFile(
  `${directory}/manifest.json`,
  JSON.stringify(
    {
      generator: 'scripts/delivery/generate.mjs',
      sharp: sharp.versions.sharp,
      assets: manifest,
    },
    null,
    2,
  ) + '\n',
);
