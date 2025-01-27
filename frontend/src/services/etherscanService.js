const ETHERSCAN_API_KEY = process.env.REACT_APP_ETHERSCAN_API_KEY;
if (!ETHERSCAN_API_KEY) {
  console.error('Etherscan API key not found in environment variables');
}

const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';

export const getAllTransactions = async () => {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${CONTRACT_ADDRESS}&page=1&offset=10000&startblock=0&endblock=999999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
    
    console.log('Fetching from URL:', url); // Add this for debugging
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Etherscan response:', data); // Add this for debugging
    
    if (data.status === '0') {
      throw new Error(data.message || 'Etherscan API error');
    }
    
    return data.result || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
};

export const processNFTStatuses = (transactions) => {
  if (!Array.isArray(transactions)) {
    console.error('Transactions is not an array:', transactions);
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

// Keep this function for individual token checks
export const checkTokenMintStatus = async (tokenId) => {
  try {
    const url = `https://api.etherscan.io/api?module=token&action=tokennfttx&contractaddress=${CONTRACT_ADDRESS}&tokenid=${tokenId}&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    return data.status === '1' && data.result && data.result.length > 0;
  } catch (error) {
    console.error('Error checking token status:', error);
    return false;
  }
}; 