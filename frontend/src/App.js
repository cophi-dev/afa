import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Loader from './Loader';
import { ethers } from 'ethers';

const BASE_URL = "https://afa-editor.ew.r.appspot.com";
const AFA_CONTRACT_ADDRESS = '0x9251dEC8DF720C2ADF3B6f46d968107cbBADf4d4';
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

// 1. Split into components
const AssetSelector = ({ label, value, onChange, options, disabled }) => (
  <div className="dropdown-section">
    <h3 className="dropdown-header">{label}</h3>
    <select 
      value={value} 
      onChange={onChange} 
      className="dropdown" 
      disabled={disabled}
    >
      <option value="">Select</option>
      {options.map(({ value, label, disabled }) => (
        <option key={value} value={value} disabled={disabled}>
          {label}
        </option>
      ))}
    </select>
  </div>
);

// 2. Move asset options to a separate configuration file
const assetOptions = {
  outfits: [
    { value: 'sweater', label: 'Christmas sweater' },
    { value: 'apefest_merch', label: 'Apefest Merch' },
    // ... other outfit options
  ],
  // ... other asset categories
};

// Add this custom hook for checking mint status
const useMintStatus = (tokenId) => {
  const [isMinted, setIsMinted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [owner, setOwner] = useState(null);

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
          const ownerAddress = await contract.ownerOf(tokenId);
          setIsMinted(true);
          setOwner(ownerAddress);
        } catch (error) {
          setIsMinted(false);
          setOwner(null);
        }
      } catch (error) {
        console.error('Error checking mint status:', error);
        setIsMinted(false);
        setOwner(null);
      } finally {
        setIsChecking(false);
      }
    };

    checkMintStatus();
  }, [tokenId]);

  return { isMinted, isChecking, owner };
};

function App() {
  const [tokenId, setTokenId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);
  const [assetState, setAssetState] = useState({
    currentImageUrl: null,
    fade: '',
    assets: {}
  });
  const { isMinted, isChecking, owner } = useMintStatus(tokenId);

  // 5. Simplified handlers with dispatch
  const handleAssetChange = async (type, value) => {
    if (type === 'tokenId') {
      setTokenId(value);
      // Only proceed with asset fetching if the token is minted
      if (isMinted) {
        fetchAsset(value, assetState.assets);
      }
    } else {
      setAssetState(prev => ({
        ...prev,
        assets: { ...prev.assets, [type]: value }
      }));
      if (isMinted) {
        fetchAsset(tokenId, { ...assetState.assets, [type]: value });
      }
    }
  };

  // 6. Improved fetch function with error handling and loading states
  const fetchAsset = async (tokenId, assets) => {
    if (!tokenId) return;

    try {
      setShowLoader(true);
      setFade('fade-out');

      const [imageResponse, colorResponse] = await Promise.all([
        fetchImage(tokenId, assets),
        fetchBackgroundColor(tokenId)
      ]);

      updateUI(imageResponse, colorResponse);
    } catch (error) {
      handleError(error);
    } finally {
      setShowLoader(false);
    }
  };

  // Handle input change
  const handleTokenInput = (e) => {
    const value = e.target.value;
    
    // Only allow numbers and limit to 4 digits (max 9999)
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue.length <= 4) {
      setTokenId(numericValue);
      
      // Generate suggestions
      if (numericValue) {
        const num = parseInt(numericValue);
        if (num >= 0 && num <= 9999) {
          const suggestionList = [];
          // Add exact match if valid
          if (num <= 9999) suggestionList.push(num);
          // Add next few numbers as suggestions
          for (let i = 1; i <= 4; i++) {
            if (num + i <= 9999) suggestionList.push(num + i);
          }
          setSuggestions(suggestionList);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (value) => {
    setTokenId(value.toString());
    setShowSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="App">
      <Banner />
      
      <AssetDisplay 
        currentImageUrl={assetState.currentImageUrl}
        showLoader={isChecking}
        fade={assetState.fade}
      />

      <div className="dropdown-container">
        <div className="token-input-container">
          <input
            type="text"
            value={tokenId}
            onChange={handleTokenInput}
            placeholder="Enter Token ID (0-9999)"
            className="token-input"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions-container" ref={suggestionsRef}>
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {isChecking ? (
          <div>Checking mint status...</div>
        ) : isMinted ? (
          <div>
            <p>Owned by: {owner}</p>
            <AssetSelector
              label="Outfit"
              value={assetState.assets.outfit}
              onChange={e => handleAssetChange('outfit', e.target.value)}
              options={assetOptions.outfits}
              disabled={!tokenId || assetState.assets.thirdAsset === 'selfie' || assetState.assets.clubAsset}
            />
          </div>
        ) : tokenId ? (
          <div>This token has not been minted yet</div>
        ) : null}
      </div>

      <Footer />
    </div>
  );
}
export default App;