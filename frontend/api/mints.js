// Same-origin proxy for the authoritative mint list (afa-mint-progress.vercel.app/api/mints
// sends no CORS headers). Validates completeness: minted.length === count.
const SOURCE = 'https://afa-mint-progress.vercel.app/api/mints';

const load = async () => {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(SOURCE, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`mints ${response.status}`);
      const data = await response.json();
      const minted = Array.isArray(data.minted) ? data.minted.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 9999) : [];
      const count = Number(data.count);
      if (!Number.isInteger(count) || minted.length !== count) throw new Error(`incomplete ${minted.length}/${count}`);
      return { count, minted };
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastError;
};

module.exports = async (req, res) => {
  try {
    const body = await load();
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(body);
  } catch (error) {
    console.error('mints proxy failed', error && error.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'mints_unavailable' });
  }
};
