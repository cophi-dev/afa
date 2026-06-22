import { debug, error as logError } from '../utils/debug';

const ETHERSCAN_API_KEY = process.env.REACT_APP_ETHERSCAN_API_KEY;
if (!ETHERSCAN_API_KEY) {
  logError('Etherscan API key not found in environment variables');
}

const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';
const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';
const OWNER_OF_SELECTOR = '6352211e';

const buildEtherscanV2Url = (params) => {
  const query = new URLSearchParams({
    chainid: '1',
    apikey: ETHERSCAN_API_KEY,
    ...params,
  });
  return `${ETHERSCAN_V2_BASE}?${query.toString()}`;
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
    const url = buildEtherscanV2Url({
      module: 'account',
      action: 'tokennfttx',
      contractaddress: CONTRACT_ADDRESS,
      page: '1',
      offset: '10000',
      startblock: '0',
      endblock: '999999999',
      sort: 'asc',
    });

    debug('Fetching from URL', url);

    const response = await fetch(url);
    const data = await response.json();

    debug('Etherscan response', data);

    if (data.status === '0') {
      throw new Error(data.result || data.message || 'Etherscan API error');
    }

    return data.result || [];
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

// V1 tokennfttx was deprecated Aug 2025; use V2 eth_call ownerOf for per-token checks.
export const checkTokenMintStatus = async (tokenId) => {
  try {
    const normalized = String(tokenId || '').replace(/[^0-9]/g, '');
    if (!normalized) return false;

    const tokenHex = BigInt(normalized).toString(16).padStart(64, '0');
    const url = buildEtherscanV2Url({
      module: 'proxy',
      action: 'eth_call',
      to: CONTRACT_ADDRESS,
      data: `0x${OWNER_OF_SELECTOR}${tokenHex}`,
      tag: 'latest',
    });
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '0') {
      debug('Etherscan ownerOf check failed', { tokenId: normalized, data });
      return false;
    }

    const ownerHex = String(data.result || '');
    return ownerHex.length >= 42 && ownerHex !== '0x' && !/^0x0+$/i.test(ownerHex);
  } catch (error) {
    logError('Error checking token status:', error);
    return false;
  }
}; 
