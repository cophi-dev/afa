const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { decodeLook, parseId } = require('../lib/look');

const API_URL = 'https://afa-editor.ew.r.appspot.com';
let logo = null;

module.exports = async (req, res) => {
  const id = parseId(req.query.id);
  if (id == null) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'invalid_id' });
  }
  const look = decodeLook(req.query.look);
  const query = new URLSearchParams({ tokenId: String(id), assetType: look.assetType || 'AFA' });
  Object.entries(look).forEach(([k, v]) => { if (k !== 'assetType' && k !== 'frame') query.set(k, v); });
  try {
    const response = await fetch(`${API_URL}/api/get-asset?${query.toString()}`);
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.startsWith('image/')) throw new Error(`asset ${response.status}`);
    const ape = await sharp(Buffer.from(await response.arrayBuffer())).resize(630, 630, { fit: 'cover' }).png().toBuffer();
    if (!logo) {
      try { logo = await sharp(fs.readFileSync(path.join(process.cwd(), 'public/logo-mark.png'))).resize({ height: 72 }).png().toBuffer(); } catch (e) { logo = false; }
    }
    const layers = [{ input: ape, left: 285, top: 0 }];
    if (logo) layers.push({ input: logo, left: 48, top: 40 });
    const png = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0b0b0c' } })
      .composite(layers)
      .png({ compressionLevel: 9 })
      .toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable');
    return res.status(200).send(png);
  } catch (error) {
    console.error('og look failed', error && error.message);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', 'https://afa-editor.app/og-image.png');
    return res.status(302).end();
  }
};
