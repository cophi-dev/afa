import sharp from 'sharp';
import gifenc from 'gifenc';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  BAYC_BACKGROUNDS,
  faceColorForBackground,
} from './baycBackgroundColors.js';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const framesDir = join(publicDir, 'favicon-frames');
const FACE_PATH = join(publicDir, 'face.png');

function buildIco(buffers) {
  const count = buffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = buffers.map((buf) => {
    const entry = { buf, offset };
    offset += buf.length;
    return entry;
  });

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);

  entries.forEach(({ buf, offset }, i) => {
    const dim = i === 0 ? 16 : 32;
    const base = 6 + i * 16;
    out.writeUInt8(dim, base);
    out.writeUInt8(dim, base + 1);
    out.writeUInt8(0, base + 2);
    out.writeUInt8(0, base + 3);
    out.writeUInt16LE(1, base + 4);
    out.writeUInt16LE(32, base + 6);
    out.writeUInt32LE(buf.length, base + 8);
    out.writeUInt32LE(offset, base + 12);
    buf.copy(out, offset);
  });

  return out;
}

async function tintedFace(faceSize, color) {
  const face = await sharp(FACE_PATH)
    .resize(faceSize, faceSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tinted = Buffer.from(face.data);
  for (let i = 0; i < tinted.length; i += 4) {
    const lum = 0.2126 * tinted[i] + 0.7152 * tinted[i + 1] + 0.0722 * tinted[i + 2];
    if (lum < 48) {
      tinted[i + 3] = 0;
      continue;
    }
    tinted[i] = color.r;
    tinted[i + 1] = color.g;
    tinted[i + 2] = color.b;
    tinted[i + 3] = 255;
  }

  return sharp(tinted, {
    raw: { width: face.info.width, height: face.info.height, channels: 4 },
  }).png().toBuffer();
}

async function renderFrame(size, background) {
  const radius = Math.round(size * 0.16);
  const faceSize = Math.round(size * 0.72);
  const faceColor = faceColorForBackground(background);

  const facePng = await tintedFace(faceSize, faceColor);
  const faceX = Math.round((size - faceSize) / 2);
  const faceY = Math.round((size - faceSize) / 2);

  const canvasSvg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="${background.hex}"/>
    </svg>
  `);

  return sharp(canvasSvg)
    .composite([{ input: facePng, left: faceX, top: faceY }])
    .png()
    .toBuffer();
}

async function buildAnimatedGif(size, delayCs = 18) {
  const encoder = GIFEncoder();
  let sharedPalette = null;

  for (const background of BAYC_BACKGROUNDS) {
    const png = await renderFrame(size, background);
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8Array(data);
    const palette = sharedPalette ?? quantize(rgba, 256);
    if (!sharedPalette) sharedPalette = palette;

    const index = applyPalette(rgba, palette);
    encoder.writeFrame(index, info.width, info.height, {
      palette,
      delay: delayCs,
      dispose: 2,
    });
  }

  encoder.finish();
  return Buffer.from(encoder.bytes());
}

const staticSizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'logo192.png', size: 192 },
  { name: 'logo512.png', size: 512 },
];

const defaultBg = BAYC_BACKGROUNDS[0];
const rendered = new Map();

mkdirSync(framesDir, { recursive: true });
for (let i = 0; i < BAYC_BACKGROUNDS.length; i += 1) {
  const frame = await renderFrame(32, BAYC_BACKGROUNDS[i]);
  writeFileSync(join(framesDir, `${i}.png`), frame);
}

for (const { name, size } of staticSizes) {
  const buf = await renderFrame(size, defaultBg);
  rendered.set(size, buf);
  writeFileSync(join(publicDir, name), buf);
}

writeFileSync(join(publicDir, 'favicon.gif'), await buildAnimatedGif(32));

writeFileSync(
  join(publicDir, 'favicon.ico'),
  buildIco([rendered.get(16), rendered.get(32)])
);

console.log('Generated face.png favicons with BAYC background colors in public/');
console.log(`Wrote ${BAYC_BACKGROUNDS.length} animation frames to public/favicon-frames/`);
