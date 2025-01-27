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

// Update the asset options
const assetOptions = {
  outfits: [
    { value: 'sweater', label: 'Christmas sweater' },
    { value: 'apefest_merch', label: 'Apefest Merch' },
    { value: 'tt_hoodie', label: 'TT Hoodie' },
    // ... add all your outfit options
  ],
  mainAssets: [
    { value: 'blever_pass', label: 'Blever Pass' },
    { value: 'gordon', label: 'Gordon' },
    // ... add all your main asset options
  ],
  thirdAssets: [
    { value: 'transparent', label: 'Transparent' },
    { value: 'selfie', label: 'Selfie' },
    // ... add all your third asset options
  ],
  mouthAssets: [
    { value: 'lollipop', label: 'Lollipop' },
    { value: 'banana_punch_gm', label: 'Banana Punch GM' },
    // ... add all your mouth asset options
  ],
  hatAssets: [
    { value: 'designer_toshiro_hat', label: 'Designer Toshiro Hat' },
    { value: 'apechain_cap', label: 'Apechain Cap' },
    // ... add all your hat asset options
  ],
  eyesAssets: [
    { value: 'apecoin_glasses', label: 'Apecoin Glasses' },
    { value: 'apechain_glasses', label: 'Apechain Glasses' },
    // ... add all your eyes asset options
  ],
  clubAssets: [
    { value: 'dubai', label: 'Dubai' },
    { value: 'elite', label: 'Elite' },
    // ... add all your club asset options
  ]
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

// Add the AssetDisplay component
const AssetDisplay = ({ currentImageUrl, showLoader, fade }) => (
  <div id="asset-display" className={`fade-effect ${fade}`}>
    {showLoader ? (
      <div className="loader">Loading...</div>
    ) : (
      currentImageUrl && <img src={currentImageUrl} alt="Asset" />
    )}
  </div>
);

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
  const [showLoader, setShowLoader] = useState(false);
  const [fade, setFade] = useState('');

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

  // Add these utility functions
  const fetchImage = async (tokenId, assets) => {
    const queryParams = new URLSearchParams({
      tokenId,
      ...assets
    });
    
    const response = await fetch(`${BASE_URL}/api/get-asset?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch image');
    return response;
  };

  const fetchBackgroundColor = async (tokenId) => {
    const response = await fetch(`${BASE_URL}/api/get-background-color?tokenId=${tokenId}`);
    if (!response.ok) throw new Error('Failed to fetch background color');
    return response.json();
  };

  const updateUI = async (imageResponse, colorResponse) => {
    if (imageResponse.ok) {
      const imageBlob = await imageResponse.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      setAssetState(prev => ({
        ...prev,
        currentImageUrl: imageUrl,
        fade: 'fade-in'
      }));
    }

    if (colorResponse.background_color) {
      document.documentElement.style.setProperty('--text-color', 
        getContrastYIQ(colorResponse.background_color) === 'black' ? 'black' : 'white'
      );
    }
  };

  const handleError = (error) => {
    console.error('Error:', error);
    setAssetState(prev => ({
      ...prev,
      currentImageUrl: null,
      fade: ''
    }));
  };

  return (
    <div className="App">
      <Banner />
      
      <AssetDisplay 
        currentImageUrl={assetState.currentImageUrl}
        showLoader={isChecking || showLoader}
        fade={fade}
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
          <>
            <p>Owned by: {owner}</p>
            <AssetSelector
              label="Outfit"
              value={assetState.assets.outfit}
              onChange={e => handleAssetChange('outfit', e.target.value)}
              options={assetOptions.outfits}
              disabled={!tokenId || assetState.assets.thirdAsset === 'selfie' || assetState.assets.clubAsset}
            />
            <AssetSelector
              label="Main Asset"
              value={assetState.assets.mainAsset}
              onChange={e => handleAssetChange('mainAsset', e.target.value)}
              options={assetOptions.mainAssets}
              disabled={!tokenId}
            />
            <AssetSelector
              label="Third Asset"
              value={assetState.assets.thirdAsset}
              onChange={e => handleAssetChange('thirdAsset', e.target.value)}
              options={assetOptions.thirdAssets}
              disabled={!tokenId}
            />
            <AssetSelector
              label="Mouth Asset"
              value={assetState.assets.mouthAsset}
              onChange={e => handleAssetChange('mouthAsset', e.target.value)}
              options={assetOptions.mouthAssets}
              disabled={!tokenId}
            />
            <AssetSelector
              label="Hat Asset"
              value={assetState.assets.hatAsset}
              onChange={e => handleAssetChange('hatAsset', e.target.value)}
              options={assetOptions.hatAssets}
              disabled={!tokenId}
            />
            <AssetSelector
              label="Eyes Asset"
              value={assetState.assets.eyesAsset}
              onChange={e => handleAssetChange('eyesAsset', e.target.value)}
              options={assetOptions.eyesAssets}
              disabled={!tokenId}
            />
            <AssetSelector
              label="Club Asset"
              value={assetState.assets.clubAsset}
              onChange={e => handleAssetChange('clubAsset', e.target.value)}
              options={assetOptions.clubAssets}
              disabled={!tokenId}
            />
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