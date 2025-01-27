const ETHERSCAN_API_KEY = process.env.REACT_APP_ETHERSCAN_API_KEY;
const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';

export const getAllTransactions = async () => {
  const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${CONTRACT_ADDRESS}&page=1&offset=10000&startblock=0&endblock=999999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      return data.result;
    }
    throw new Error(data.message || 'Failed to fetch transactions');
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

export const processNFTStatuses = (transactions) => {
  const nftStatuses = new Map();
  
  transactions.forEach(tx => {
    const tokenId = tx.tokenID;
    const currentStatus = nftStatuses.get(tokenId);
    
    if (!currentStatus || parseInt(tx.blockNumber) > parseInt(currentStatus.blockNumber)) {
      nftStatuses.set(tokenId, {
        owner: tx.to,
        timestamp: parseInt(tx.timeStamp),
        blockNumber: tx.blockNumber
      });
    }
  });
  
  return nftStatuses;
}; 