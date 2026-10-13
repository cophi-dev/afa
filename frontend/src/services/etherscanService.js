import { error as logError } from '../utils/debug';

const chainProxyUrl = (path) => {
  const base = (process.env.REACT_APP_CHAIN_PROXY_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
};

export const getMintedTokenIdsNewestFirst = (transactions) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const seen = new Set();
  const mintDateOrder = [];
  const sortedAsc = [...transactions].sort(
    (a, b) => Number(a.timeStamp) - Number(b.timeStamp)
  );

  for (const tx of sortedAsc) {
    if (!tx || !tx.tokenID) continue;
    const id = parseInt(tx.tokenID, 10);
    if (Number.isNaN(id) || seen.has(id)) continue;
    seen.add(id);
    mintDateOrder.push(id);
  }

  return [...mintDateOrder].reverse();
};

export const getAllTransactions = async () => {
  try {
    const response = await fetch(chainProxyUrl('/api/chain/transfers'));
    if (!response.ok) {
      throw new Error(`Chain proxy HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.result) ? data.result : [];
  } catch (error) {
    logError('Error fetching transactions:', error);
    return [];
  }
};

export const processNFTStatuses = (transactions) => {
  if (!Array.isArray(transactions)) {
    logError('Transactions is not an array:', transactions);
    return new Map();
  }

  const nftStatuses = new Map();

  transactions.forEach(tx => {
    if (tx && tx.tokenID) {
      const tokenId = parseInt(tx.tokenID);
      nftStatuses.set(tokenId, {
        owner: tx.to,
        timestamp: tx.timeStamp
      });
    }
  });

  return nftStatuses;
};

// Mint status is checked through /api/chain/owner-of so the Etherscan key
// stays on the server (Vercel function in production, Flask in local dev).
export const checkTokenMintStatus = async (tokenId) => {
  try {
    const normalized = String(tokenId || '').replace(/[^0-9]/g, '');
    if (!normalized) return false;

    const response = await fetch(
      chainProxyUrl(`/api/chain/owner-of?tokenId=${encodeURIComponent(normalized)}`)
    );
    if (!response.ok) return false;

    const data = await response.json();
    return Boolean(data && data.minted);
  } catch (error) {
    logError('Error checking token status:', error);
    return false;
  }
};
