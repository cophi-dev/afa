/**
 * Server-side Etherscan proxy. ETHERSCAN_API_KEY is read at runtime and is
 * never returned to the browser. Deployed as Vercel Serverless Functions.
 *
 * Keep in sync with frontend/lib/chainProxy.js (Vercel Root Directory is frontend).
 */

const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';
const OWNER_OF_SELECTOR = '6352211e';
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const OWNER_CACHE_MAX = 4000;

const ownerCache = new Map();
let transfersCache = null;

function sendJson(res, status, body, cacheControl) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.status(status).send(JSON.stringify(body));
}

function cacheHeader({ browser, cdn, swr }) {
  return `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${swr}`;
}

async function etherscan(params) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    const error = new Error('missing_key');
    error.code = 'missing_key';
    throw error;
  }

  const query = new URLSearchParams({
    chainid: '1',
    apikey: key,
    ...params,
  });
  const response = await fetch(`${ETHERSCAN_V2}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const error = new Error('upstream');
    error.code = 'upstream';
    throw error;
  }
  return response.json();
}

function proxyError(res, error) {
  const missing = error && error.code === 'missing_key';
  return sendJson(
    res,
    missing ? 500 : 502,
    { error: missing ? 'Chain proxy is not configured' : 'Upstream chain lookup failed' },
    'no-store'
  );
}

function isMintedOwner(ownerHex) {
  const value = String(ownerHex || '');
  return value.length >= 42 && value !== '0x' && !/^0x0+$/i.test(value);
}

function rememberOwner(tokenId, minted, ttlMs) {
  if (ownerCache.size >= OWNER_CACHE_MAX) {
    ownerCache.clear();
  }
  ownerCache.set(tokenId, { minted, expires: Date.now() + ttlMs });
}

async function handleOwnerOf(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' }, 'no-store');
  }

  const tokenId = String((req.query && req.query.tokenId) || '').replace(/\D/g, '').slice(0, 5);
  if (!tokenId) {
    return sendJson(res, 400, { error: 'tokenId required' }, 'no-store');
  }

  const hit = ownerCache.get(tokenId);
  if (hit && hit.expires > Date.now()) {
    const policy = hit.minted
      ? cacheHeader({ browser: 60, cdn: 600, swr: 3600 })
      : cacheHeader({ browser: 15, cdn: 30, swr: 120 });
    return sendJson(res, 200, { tokenId, minted: hit.minted }, policy);
  }

  let data;
  try {
    const tokenHex = parseInt(tokenId, 10).toString(16).padStart(64, '0');
    data = await etherscan({
      module: 'proxy',
      action: 'eth_call',
      to: CONTRACT_ADDRESS,
      data: `0x${OWNER_OF_SELECTOR}${tokenHex}`,
      tag: 'latest',
    });
  } catch (error) {
    return proxyError(res, error);
  }

  if (!data || data.status === '0') {
    rememberOwner(tokenId, false, 15 * 1000);
    return sendJson(
      res,
      200,
      { tokenId, minted: false },
      cacheHeader({ browser: 10, cdn: 15, swr: 30 })
    );
  }

  const minted = isMintedOwner(data.result);
  const ttlMs = minted ? 10 * 60 * 1000 : 30 * 1000;
  rememberOwner(tokenId, minted, ttlMs);
  const policy = minted
    ? cacheHeader({ browser: 60, cdn: 600, swr: 3600 })
    : cacheHeader({ browser: 15, cdn: 30, swr: 120 });
  return sendJson(res, 200, { tokenId, minted }, policy);
}

async function handleTransfers(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' }, 'no-store');
  }

  if (transfersCache && transfersCache.expires > Date.now()) {
    return sendJson(
      res,
      200,
      { result: transfersCache.result },
      cacheHeader({ browser: 30, cdn: 60, swr: 300 })
    );
  }

  let data;
  try {
    data = await etherscan({
      module: 'account',
      action: 'tokennfttx',
      contractaddress: CONTRACT_ADDRESS,
      page: '1',
      offset: '10000',
      startblock: '0',
      endblock: '999999999',
      sort: 'asc',
    });
  } catch (error) {
    return proxyError(res, error);
  }

  if (!data || data.status === '0' || !Array.isArray(data.result)) {
    const result = [];
    transfersCache = { result, expires: Date.now() + 15 * 1000 };
    return sendJson(res, 200, { result }, cacheHeader({ browser: 10, cdn: 15, swr: 30 }));
  }

  const result = data.result.map((tx) => ({
    tokenID: tx && tx.tokenID,
    timeStamp: tx && tx.timeStamp,
  }));
  transfersCache = { result, expires: Date.now() + 60 * 1000 };
  return sendJson(
    res,
    200,
    { result },
    cacheHeader({ browser: 30, cdn: 60, swr: 300 })
  );
}

module.exports = {
  handleOwnerOf,
  handleTransfers,
  isMintedOwner,
};
