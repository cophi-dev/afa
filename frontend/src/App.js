import React, { useState, useEffect } from 'react';
import './App.css';
import Loader from './Loader';
import { ethers } from 'ethers';

const BASE_URL = "https://afa-editor.ew.r.appspot.com";
const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';

function Banner() {
    return (
        <div className="banner">
            <a href="http://www.apefacingapes.com" target="_blank" rel="noopener noreferrer">
                <img src="./logo.png" alt="Logo" className="banner-logo" />
            </a>
        </div>
    );
}

// New Footer Component
function Footer() {
    return (
        <footer className="footer">
            <p>© 2024 Ape Facing Apes. All rights reserved.</p>
            <p>© 2024 Yuga Labs, Inc. All marks and assets available are licensed from Yuga Labs, Inc.</p>
        </footer>
    );
}

function getContrastYIQ(rgb) {
    const yiq = ((rgb[0]*299)+(rgb[1]*587)+(rgb[2]*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

// Add the mint status check hook
const useMintStatus = (tokenId) => {
  const [isMinted, setIsMinted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkMintStatus = async () => {
      if (!tokenId) return;
      
      setIsChecking(true);
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          process.env.REACT_APP_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'
        );
        
        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          ['function ownerOf(uint256 tokenId) view returns (address)'],
          provider
        );

        try {
          await contract.ownerOf(tokenId);
          setIsMinted(true);
        } catch (error) {
          setIsMinted(false);
        }
      } catch (error) {
        console.error('Error checking mint status:', error);
        setIsMinted(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkMintStatus();
  }, [tokenId]);

  return { isMinted, isChecking };
};

function App() {
    const [tokenId, setTokenId] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState(null);
    const [fade, setFade] = useState('');
    const [showLoader, setShowLoader] = useState(false);
    const { isMinted, isChecking } = useMintStatus(tokenId);

    const handleTokenSelect = (e) => {
        const newTokenId = e.target.value;
        setTokenId(newTokenId);
        if (newTokenId) {
            fetchAsset(newTokenId);
        }
    };

    const handleAssetSelect = async (assetType, value) => {
        if (!tokenId) return;
        fetchAsset(tokenId, { [assetType]: value });
    };

    const fetchAsset = async (tokenId, assets = {}) => {
        setShowLoader(true);
        setFade('fade-out');

        const queryParams = new URLSearchParams({
            tokenId,
            ...assets
        });

        try {
            const [imageResponse, colorResponse] = await Promise.all([
                fetch(`${BASE_URL}/api/get-asset?${queryParams}`),
                fetch(`${BASE_URL}/api/get-background-color?tokenId=${tokenId}`)
            ]);

            if (imageResponse.ok) {
                const imageBlob = await imageResponse.blob();
                const imageUrl = URL.createObjectURL(imageBlob);
                setCurrentImageUrl(imageUrl);
                setFade('fade-in');
            }

            if (colorResponse.ok) {
                const data = await colorResponse.json();
                if (data.background_color) {
                    document.documentElement.style.setProperty(
                        '--text-color',
                        getContrastYIQ(data.background_color) === 'black' ? 'black' : 'white'
                    );
                }
            }
        } catch (error) {
            console.error('Error:', error);
            setCurrentImageUrl(null);
            setFade('');
        } finally {
            setShowLoader(false);
        }
    };

    return (
        <div className="App">
            <Banner />
            
            <div id="asset-display" className={`fade-effect ${fade}`}>
                {showLoader || isChecking ? (
                    <Loader />
                ) : (
                    currentImageUrl && <img src={currentImageUrl} alt="Asset" />
                )}
            </div>

            <div className="dropdown-container">
                <select 
                    value={tokenId} 
                    onChange={handleTokenSelect}
                    className="dropdown"
                >
                    <option value="">Select Token ID</option>
                    {Array.from({ length: 10000 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                    ))}
                </select>

                {isChecking ? (
                    <div>Checking mint status...</div>
                ) : isMinted ? (
                    <>
                        {/* Add your asset dropdowns here */}
                        <select 
                            onChange={(e) => handleAssetSelect('outfit', e.target.value)}
                            className="dropdown"
                        >
                            <option value="">Select Outfit</option>
                            <option value="sweater">Christmas Sweater</option>
                            <option value="apefest_merch">Apefest Merch</option>
                            {/* Add more outfit options */}
                        </select>
                        {/* Add other asset dropdowns similarly */}
                    </>
                ) : tokenId ? (
                    <div>This token has not been minted yet</div>
                ) : null}
            </div>

            <Footer />
        </div>
    );
}

export default App;