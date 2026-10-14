// Shared "look" encoding for /a/<id>?look=... share pages.
// Keep in sync with src/utils/look.js.
const LOOK_KEYS = ['assetType', 'secondAssetType', 'thirdAssetType', 'mouthAssetType', 'hatAssetType', 'eyesAssetType', 'clubAssetType', 'frame'];
const VALUE_RE = /^[A-Za-z0-9_ .-]{1,64}$/;

function decodeLook(look) {
  const out = {};
  if (!look || typeof look !== 'string' || look.length > 600) return out;
  let text;
  try {
    text = Buffer.from(look.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (e) {
    return out;
  }
  const params = new URLSearchParams(text);
  for (const key of LOOK_KEYS) {
    const value = params.get(key);
    if (value && VALUE_RE.test(value)) out[key] = value;
  }
  return out;
}

function parseId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!/^\d{1,4}$/.test(String(raw == null ? '' : raw))) return null;
  const id = Number(raw);
  return id >= 0 && id <= 9999 ? id : null;
}

module.exports = { LOOK_KEYS, decodeLook, parseId };
