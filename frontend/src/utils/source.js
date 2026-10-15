/**
 * Session source for click events: utm_source~utm_campaign of the landing URL, else referrer domain, else 'direct'.
 * Kept in sessionStorage for this tab only (no cookies, no localStorage). Server re-validates it.
 */
const KEY = 'afa.src';
const clean = (v, max) => String(v || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, max);

export const computeSource = (href, referrer, ownHost) => {
  try {
    const url = new URL(href);
    const src = clean(url.searchParams.get('utm_source'), 24);
    if (src) {
      const campaign = clean(url.searchParams.get('utm_campaign'), 32);
      return campaign ? `${src}~${campaign}` : src;
    }
    if (referrer) {
      const host = clean(new URL(referrer).hostname.replace(/^www\./, ''), 48);
      if (host && host !== String(ownHost || '').replace(/^www\./, '')) return host;
    }
  } catch (e) { /* fall through */ }
  return 'direct';
};

export const sessionSource = () => {
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) return stored;
    const value = computeSource(window.location.href, document.referrer, window.location.hostname);
    window.sessionStorage.setItem(KEY, value);
    return value;
  } catch (e) {
    return computeSource(window.location.href, document.referrer, window.location.hostname);
  }
};
