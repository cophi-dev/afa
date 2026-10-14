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

const X_UTM = { utm_source: 'x', utm_medium: 'social', utm_campaign: 'editor-share' };
// Copy link / native share sheet: destination unknown, so tag it as a link share.
export const LINK_UTM = { utm_source: 'share', utm_medium: 'link', utm_campaign: 'editor-share' };

export const buildSharePageUrl = (tokenId, traits, utm = X_UTM) => {
  const look = encodeLook(traits);
  const query = new URLSearchParams();
  if (look) query.set('look', look);
  Object.entries(utm).forEach(([k, v]) => query.set(k, v));
  return `https://afa-editor.app/a/${tokenId}?${query.toString()}`;
};
