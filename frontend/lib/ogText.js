const fs = require('fs');
const path = require('path');

let font = null;
const loadFont = () => {
  if (!font) {
    const opentype = require('opentype.js');
    const buf = fs.readFileSync(path.join(__dirname, 'fonts', 'Inter-SemiBold.ttf'));
    font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
};

// Glyph-by-glyph layout (avoids opentype.js GSUB features Inter trips on).
const advance = (f, text, size) => {
  let w = 0;
  for (const ch of text) w += (f.charToGlyph(ch).advanceWidth || 0) * (size / f.unitsPerEm);
  return w;
};
const pathData = (f, text, x, y, size) => {
  let cx = x;
  let d = '';
  for (const ch of text) {
    const g = f.charToGlyph(ch);
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth || 0) * (size / f.unitsPerEm);
  }
  return d;
};
const wrap = (f, text, size, max) => {
  const lines = [];
  let line = '';
  text.split(' ').forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && advance(f, next, size) > max) { lines.push(line); line = word; } else line = next;
  });
  if (line) lines.push(line);
  return lines;
};

/** SVG overlay for the right text column, matching the afa-progress card. */
const textColumnSvg = ({ title, footer, x, width = 1200, height = 630 }) => {
  const f = loadFont();
  const lines = wrap(f, title, 54, width - x - 60).slice(0, 3);
  const titlePaths = lines.map((l, i) => `<path fill="#ffffff" d="${pathData(f, l, x, 250 + i * 62, 54)}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${titlePaths}<path fill="#f5c542" d="${pathData(f, footer, x, 560, 24)}"/></svg>`);
};

module.exports = { textColumnSvg };
