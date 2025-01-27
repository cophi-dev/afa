const ETHERSCAN_API_KEY = process.env.REACT_APP_ETHERSCAN_API_KEY;
const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const getAllTransactions = async () => {
    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${CONTRACT_ADDRESS}&page=1&offset=10000&startblock=0&endblock=999999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
    
    try {
        // Add a small delay to respect rate limits
        await delay(200);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '0' && data.message === 'No transactions found') {
            return []; // Return empty array for no transactions
        }
        
        if (data.status === '1' && data.result) {
            return data.result;
        }

        if (data.message === 'NOTOK' || data.result === 'Max rate limit reached') {
            // Wait and retry once if we hit rate limit
            console.log('Hit rate limit, waiting to retry...');
            await delay(1000);
            const retryResponse = await fetch(url);
            const retryData = await retryResponse.json();
            
            if (retryData.status === '1' && retryData.result) {
                return retryData.result;
            }
        }
        
        throw new Error(data.message || 'Failed to fetch transactions');
    } catch (error) {
        console.error('Error fetching transactions:', error);
        // Return empty array instead of throwing
        return [];
    }
};

export const processNFTStatuses = (transactions) => {
    if (!Array.isArray(transactions)) {
        console.error('Invalid transactions data:', transactions);
        return new Map();
    }

    const nftStatuses = new Map();
    
    transactions.forEach(tx => {
        try {
            const tokenId = tx.tokenID;
            const currentStatus = nftStatuses.get(tokenId);
            
            if (!currentStatus || parseInt(tx.blockNumber) > parseInt(currentStatus.blockNumber)) {
                nftStatuses.set(tokenId, {
                    owner: tx.to,
                    timestamp: parseInt(tx.timeStamp),
                    blockNumber: tx.blockNumber
                });
            }
        } catch (error) {
            console.error('Error processing transaction:', tx, error);
        }
    });
    
    return nftStatuses;
};

// Add a new function to check single token mint status
export const checkTokenMintStatus = async (tokenId) => {
    const url = `https://api.etherscan.io/api?module=token&action=tokennfttx&contractaddress=${CONTRACT_ADDRESS}&tokenid=${tokenId}&apikey=${ETHERSCAN_API_KEY}`;
    
    try {
        await delay(200);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '1' && data.result && data.result.length > 0) {
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking token status:', error);
        return false;
    }
}; 