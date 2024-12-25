import React, { useState, useEffect } from 'react';
import './App.css';
import Loader from './Loader';
const BASE_URL = "https://afa-editor.ew.r.appspot.com";

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

// 3. Custom hooks for data fetching and state management
const useTokenIds = () => {
  const [tokenIds, setTokenIds] = useState([]);
  
  useEffect(() => {
    fetch(`${BASE_URL}/api/token-ids`)
      .then(response => response.ok ? response.json() : Promise.reject('Network error'))
      .then(data => {
        const sortedTokenIds = data.map(id => parseInt(id)).sort((a, b) => a - b);
        setTokenIds(sortedTokenIds);
      })
      .catch(error => console.error('Error:', error));
  }, []);

  return tokenIds;
};

function App() {
  // Use custom hooks
  const tokenIds = useTokenIds();
  const [assetState, assetDispatch] = useAssetState(); // Custom hook for managing all asset states
  const { isLoading, showLoader } = useLoadingState(); // Custom hook for loading states

  // 5. Simplified handlers with dispatch
  const handleAssetChange = (type, value) => {
    assetDispatch({ type: 'UPDATE_ASSET', assetType: type, value });
    fetchAsset(assetState.tokenId, { ...assetState.assets, [type]: value });
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

  return (
    <div className="App">
      <Banner />
      
      <AssetDisplay 
        currentImageUrl={assetState.currentImageUrl}
        showLoader={showLoader}
        fade={assetState.fade}
      />

      <div className="dropdown-container">
        <AssetSelector
          label="Select AFA"
          value={assetState.tokenId}
          onChange={e => handleAssetChange('tokenId', e.target.value)}
          options={tokenIds.map(id => ({ value: id, label: id }))}
        />

        <AssetSelector
          label="Outfit"
          value={assetState.assets.outfit}
          onChange={e => handleAssetChange('outfit', e.target.value)}
          options={assetOptions.outfits}
          disabled={!assetState.tokenId || assetState.assets.thirdAsset === 'selfie' || assetState.assets.clubAsset}
        />
        
        {/* Other asset selectors... */}
      </div>

      <Footer />
    </div>
  );
}
export default App;