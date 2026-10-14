// Keep in sync with lib/look.js.
export const LOOK_KEYS = ['assetType', 'secondAssetType', 'thirdAssetType', 'mouthAssetType', 'hatAssetType', 'eyesAssetType', 'clubAssetType', 'frame'];

export const encodeLook = (traits) => {
  const params = new URLSearchParams();
  LOOK_KEYS.forEach((key) => {
    if (traits[key]) params.set(key, String(traits[key]));
  });
  const text = params.toString();
  if (!text) return '';
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const buildSharePageUrl = (tokenId, traits) => {
  const look = encodeLook(traits);
  const query = new URLSearchParams();
  if (look) query.set('look', look);
  query.set('utm_source', 'x');
  query.set('utm_medium', 'social');
  query.set('utm_campaign', 'editor-share');
  return `https://afa-editor.app/a/${tokenId}?${query.toString()}`;
};
