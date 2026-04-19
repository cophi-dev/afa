import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { getAllTransactions, processNFTStatuses, checkTokenMintStatus } from './services/etherscanService';

const CONTRACT_ADDRESS = '0xfAa0e99EF34Eae8b288CFEeAEa4BF4f5B5f2eaE7';
const RECENT_MINT_LINK_BASE =
    process.env.REACT_APP_TOKEN_LINK_BASE || `https://opensea.io/assets/ethereum/${CONTRACT_ADDRESS}`;

function Banner() {
    return (
        <div className="banner">
            <a href="http://www.apefacingapes.com" target="_blank" rel="noopener noreferrer">
                <img src="./logo.png" alt="Logo" className="banner-logo" />
            </a>
        </div>
    );
}

function Footer() {
    return (
        <footer className="footer">
            <p>© 2024 Ape Facing Apes. All rights reserved.</p>
            <p>© 2024 Yuga Labs, Inc. All marks and assets available are licensed from Yuga Labs, Inc.</p>
        </footer>
    );
}

function getContrastYIQ(rgb) {
    const yiq = ((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function App() {
    const [tokenId, setTokenId] = useState('');
    const [selectedAsset, setSelectedAsset] = useState('');
    const [secondAsset, setSecondAsset] = useState('');
    const [thirdAsset, setThirdAsset] = useState('');
    const [mouthAsset, setMouthAsset] = useState('');
    const [hatAsset, setHatAsset] = useState('');
    const [clubAsset, setClubAsset] = useState('');
    const [eyesAsset, setEyesAsset] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState('./overview.gif'); // New state for the current image URL
    const [showLoader, setShowLoader] = useState(false); // State to control loader visibility
    const [fade, setFade] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mintedTokens, setMintedTokens] = useState(new Set());
    const [recentTokenIds, setRecentTokenIds] = useState([]);
    const [recentImageUrls, setRecentImageUrls] = useState({});
    const suggestionsRef = useRef(null);
    const [isCheckingMint, setIsCheckingMint] = useState(false);
    const [selectedSuggestionIndex] = useState(-1);
    const outfitRef = useRef(null);
    const mouthRef = useRef(null);
    const hatRef = useRef(null);
    const eyesRef = useRef(null);
    const handRef = useRef(null);
    const extraRef = useRef(null);
    const [vegasButtonClicked, setVegasButtonClicked] = useState(false); // State for glamour effect
  
  useEffect(() => {
        if (thirdAsset === 'selfie') {
            setSecondAsset('');
            setMouthAsset('');
            setSelectedAsset('');
        }
    }, [thirdAsset]);
    
    // Move the minted tokens fetch to a separate function
    const fetchMintedTokens = useCallback(async () => {
        try {
            const transactions = await getAllTransactions();
            const nftStatuses = processNFTStatuses(transactions);
            const minted = new Set(Array.from(nftStatuses.keys()));

            if (minted.size > 0) {
                setMintedTokens(minted);
            }

            if (Array.isArray(transactions) && transactions.length > 0) {
                // Sort newest first by timestamp and collect unique token IDs
                const seen = new Set();
                const latestIds = [];
                const sorted = [...transactions].sort(
                    (a, b) => Number(b.timeStamp) - Number(a.timeStamp)
                );

                for (const tx of sorted) {
                    if (!tx || !tx.tokenID) continue;
                    const id = parseInt(tx.tokenID, 10);
                    if (!seen.has(id)) {
                        seen.add(id);
                        latestIds.push(id);
                    }
                    if (latestIds.length >= 9) break;
                }

                setRecentTokenIds(latestIds);
            }
        } catch (error) {
            console.error('Error fetching minted tokens:', error);
        }
    }, []);

    // Update the useEffect to only call fetchMintedTokens
    useEffect(() => {
        fetchMintedTokens();
    }, [fetchMintedTokens]);

    // Load preview images for the latest mints
    useEffect(() => {
        if (!recentTokenIds.length) return;

        const baseUrl = process.env.REACT_APP_API_URL || 'https://afa-editor.ew.r.appspot.com';

        const loadPreviews = async () => {
            try {
                const entries = await Promise.all(
                    recentTokenIds.slice(0, 9).map(async (id) => {
                        try {
                            const queryParams = new URLSearchParams({
                                tokenId: id,
                                assetType: 'AFA'
                            });
                            const url = `${baseUrl}/api/get-asset?${queryParams.toString()}`;
                            const response = await fetch(url);
                            if (!response.ok) return null;
                            const blob = await response.blob();
                            return [id, URL.createObjectURL(blob)];
                        } catch {
                            return null;
                        }
                    })
                );

                const map = {};
                entries.forEach((entry) => {
                    if (!entry) return;
                    const [id, url] = entry;
                    map[id] = url;
                });
                setRecentImageUrls(map);
            } catch (error) {
                console.error('Error loading latest mint previews:', error);
            }
        };

        loadPreviews();
    }, [recentTokenIds]);

    const fetchAsset = useCallback((
        newTokenId,
        newSelectedAsset,
        newSecondAsset,
        newThirdAsset,
        newMouthAsset,
        newHatAsset,
        newEyesAsset,
        newClubAsset
    ) => {
      setShowLoader(true);
    
        const queryParams = new URLSearchParams({
            tokenId: newTokenId,
            assetType: newSelectedAsset || '',
            secondAssetType: newSecondAsset || '',
            thirdAssetType: newThirdAsset || '',
            mouthAssetType: newMouthAsset || '',
            eyesAssetType: newEyesAsset || '',
            hatAssetType: newHatAsset || '',
            clubAssetType: newClubAsset || ''
        });
    
        // Start fade-out effect
      setFade('fade-out');

        const baseUrl = process.env.REACT_APP_API_URL || 'https://afa-editor.ew.r.appspot.com';
        const url = `${baseUrl}/api/get-asset?${queryParams.toString()}`;
    
        fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob();
        })
        .then(blob => {
            const newImageUrl = URL.createObjectURL(blob);
    
            // Update the image URL after fade-out transition
            setTimeout(() => {
                setCurrentImageUrl(newImageUrl);
                setFade('fade-in'); // Start fade-in effect
            }, 500);
    
            setShowLoader(false);
        })
        .catch(error => {
            console.error('Error fetching asset:', error);
            setCurrentImageUrl('./overview.gif'); // Reset to default image on error
      setShowLoader(false);
            setFade('fade-in'); // Start fade-in effect
        });
    
        // Fetch background color separately
        fetch(`https://afa-editor.ew.r.appspot.com/api/get-background-color?tokenId=${newTokenId}`)
        .then(response => response.json())
        .then(data => {
            const bgColor = `rgb(${data.background_color[0]}, ${data.background_color[1]}, ${data.background_color[2]})`;
            const textColor = getContrastYIQ(data.background_color);
            // Apply fade effect
            document.body.classList.add('body-background-fade');
            // Change full background so it overrides the static gradient
            document.body.style.background = bgColor;
            document.documentElement.style.setProperty('--text-color', textColor);
            // Remove fade effect after transition
            setTimeout(() => {
                document.body.classList.remove('body-background-fade');
            }, 500); // Match this timeout with the transition duration in CSS
        })
        .catch(error => console.error('Error fetching background color:', error));
    }, []);

    useEffect(() => {
        if (tokenId) {
            fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
        }
    }, [tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset, fetchAsset]);
    
    
    const handleSecondAssetChange = event => {
        const newSecondAsset = event.target.value;
        setSecondAsset(newSecondAsset);
        
        if (newSecondAsset === ('singe_hoodie')) {
            setHatAsset('');   
            
            // Call fetchAsset with the current clubAsset state
            setTimeout(() => {
                fetchAsset(tokenId, selectedAsset, newSecondAsset, thirdAsset, mouthAsset, '', eyesAsset, clubAsset);
            }, 0);
        }
        else if (newSecondAsset === ('singe_hoodie_glow')) {
            setHatAsset('');   
            
            // Call fetchAsset with the current clubAsset state
            setTimeout(() => {
                fetchAsset(tokenId, selectedAsset, newSecondAsset, thirdAsset, mouthAsset, '', eyesAsset, clubAsset);
            }, 0);
        }
        else {
          console.log('[handleSecondAssetChange] Fetching with secondAsset:', newSecondAsset); // Log before fetch
          fetchAsset(tokenId, selectedAsset, newSecondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
        }
    };
    
    const handleMouthAssetChange = event => {
        const newMouthAsset = event.target.value;
        setMouthAsset(newMouthAsset);
        fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, newMouthAsset, hatAsset, eyesAsset, clubAsset);
    };

    const handleEyesAssetChange = event => {
        const newEyesAsset = event.target.value;
        setEyesAsset(newEyesAsset);
        fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, newEyesAsset, clubAsset);
    };
    const handleHatAssetChange = event => {
        const newHatAsset = event.target.value;
        setHatAsset(newHatAsset);
        fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, newHatAsset, eyesAsset, clubAsset);
    };

    const handleThirdAssetChange = event => {
        const newThirdAsset = event.target.value;
        setThirdAsset(newThirdAsset);
    
        if (newThirdAsset === 'selfie') {
            setSecondAsset('');
            setMouthAsset('');
            setSelectedAsset('');    
            
            // Call fetchAsset with the current hatAsset state
            setTimeout(() => {
                fetchAsset(tokenId, '', '', newThirdAsset, '', hatAsset, eyesAsset, '');
            }, 0);
        }
    };
    const handleAssetChange = event => {
        setSelectedAsset(event.target.value);
        fetchAsset(tokenId, event.target.value, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
    };

    const handleTokenInput = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        setTokenInput(value);
        
        if (value) {
            const suggestions = Array.from(mintedTokens)
                .filter(id => id.toString().startsWith(value))
                .sort((a, b) => a - b)  // Simple numeric sort
                .slice(0, 5);
            
            setSuggestions(suggestions);
            setShowSuggestions(suggestions.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = async (value) => {
        const tokenId = parseInt(value);
        setTokenInput(value);
        setTokenId(value);
        setShowSuggestions(false);
        setIsCheckingMint(true);

        try {
            const isMinted = await checkTokenMintStatus(tokenId);
            if (!isMinted) {
                console.log('Token not minted');
                return;
            }

            // Fetch the initial image
            if (!selectedAsset && !secondAsset && !thirdAsset && !mouthAsset && !hatAsset && !eyesAsset && !clubAsset) {
                fetchAsset(value, 'AFA', '', '');
                setSelectedAsset('AFA');
            } else {
                fetchAsset(value, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
            }
        } finally {
            setIsCheckingMint(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleReset = () => {
        // Keep the token ID and input
        // const tokenId and tokenInput stay the same
        
        // Reset all other states
        setSelectedAsset('');
        setSecondAsset('');
        setThirdAsset('');
        setMouthAsset('');
        setHatAsset('');
        setClubAsset('');
        setEyesAsset('');
        
        // Fetch the initial image with just the token ID
        if (tokenId) {
            fetchAsset(tokenId, 'AFA', '', '');
            setSelectedAsset('AFA');
        }
    };

    const handleRandomize = () => {
        if (!tokenId) return;

        // Helper function to get random item from array
        const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

        // Helper function to get available options from a select element
        const getAvailableOptions = (selectRef) => {
            if (!selectRef.current) return [];
            return Array.from(selectRef.current.options)
                .filter(option => option.value && !option.disabled)
                .map(option => option.value);
        };

        // Get all available options for each category
        const outfitOptions = getAvailableOptions(outfitRef);
        const mouthOptions = getAvailableOptions(mouthRef);
        const hatOptions = getAvailableOptions(hatRef);
        const eyesOptions = getAvailableOptions(eyesRef);
        const handOptions = getAvailableOptions(handRef);
        const extraOptions = getAvailableOptions(extraRef);

        // Set random values (only if options are available)
        const newSecondAsset = outfitOptions.length ? getRandomItem(outfitOptions) : '';
        const newMouthAsset = mouthOptions.length ? getRandomItem(mouthOptions) : '';
        const newHatAsset = hatOptions.length ? getRandomItem(hatOptions) : '';
        const newEyesAsset = eyesOptions.length ? getRandomItem(eyesOptions) : '';
        const newSelectedAsset = handOptions.length ? getRandomItem(handOptions) : '';
        const newThirdAsset = extraOptions.length ? getRandomItem(extraOptions) : '';

        // Update states
        setSecondAsset(newSecondAsset);
        setMouthAsset(newMouthAsset);
        setHatAsset(newHatAsset);
        setEyesAsset(newEyesAsset);
        setSelectedAsset(newSelectedAsset);
        setThirdAsset(newThirdAsset);

        // Fetch the asset with new random traits
        fetchAsset(
            tokenId,
            newSelectedAsset,
            newSecondAsset,
            newThirdAsset,
            newMouthAsset,
            newHatAsset,
            newEyesAsset,
            clubAsset
        );
    };

    // Add the new handler function for the Vegas set
    const handleFrameIt = () => {
        if (!tokenId) return; // Do nothing if no token ID is selected

        const frameAsset = 'vintage_frame';

        setThirdAsset(frameAsset);

        fetchAsset(
            tokenId,
            selectedAsset,
            secondAsset,
            frameAsset,
            mouthAsset,
            hatAsset,
            eyesAsset,
            clubAsset
        );

        console.log('[handleFrameIt] Applying frame:', { 
          tokenId,
          selectedAsset,
          secondAsset,
          thirdAsset: frameAsset,
          mouthAsset,
          hatAsset,
          eyesAsset,
          clubAsset
        }); // Log before fetch

        setVegasButtonClicked(true);
        setTimeout(() => setVegasButtonClicked(false), 1000);
    };

    const navigateDropdown = (selectRef, direction) => {
        if (!selectRef.current) return;
        
        const select = selectRef.current;
        const options = Array.from(select.options).filter(option => !option.disabled);
        const currentIndex = options.findIndex(option => option.value === select.value);
        
        let newIndex;
        if (direction === 'next') {
            newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : currentIndex;
        } else {
            newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
        }
        
        if (newIndex !== currentIndex) {
            select.value = options[newIndex].value;
            
            // Trigger the appropriate onChange event based on which dropdown is being navigated
            if (select === outfitRef.current) {
                handleSecondAssetChange({ target: { value: options[newIndex].value } });
            } else if (select === mouthRef.current) {
                handleMouthAssetChange({ target: { value: options[newIndex].value } });
            } else if (select === hatRef.current) {
                handleHatAssetChange({ target: { value: options[newIndex].value } });
            } else if (select === eyesRef.current) {
                handleEyesAssetChange({ target: { value: options[newIndex].value } });
            } else if (select === handRef.current) {
                handleAssetChange({ target: { value: options[newIndex].value } });
            } else if (select === extraRef.current) {
                handleThirdAssetChange({ target: { value: options[newIndex].value } });
            }
        }
    };

    // Helper function to check if navigation is possible
    const canNavigate = (selectRef, direction) => {
        if (!selectRef.current || !tokenId) return false;
        
        const select = selectRef.current;
        const options = Array.from(select.options).filter(option => !option.disabled);
        const currentIndex = options.findIndex(option => option.value === select.value);
        
        if (direction === 'next') {
            return currentIndex < options.length - 1;
        } else {
            return currentIndex > 0;
        }
    };

  return (
    // Apply glamour class conditionally
    <div className={`App ${vegasButtonClicked ? 'vegas-glamour' : ''}`}>
      <Banner />
            <div id="asset-display" className={fade ? 'fade-effect' : ''}>
                <img src={currentImageUrl} alt="Ape" style={{ maxWidth: '100%', height: 'auto' }} />
                {showLoader && 
                    <div className="loader">
                        processing new perspective...
                    </div>
                }
            </div>

            {/* Move button container here */}
            <div className="button-container">
                <button 
                    onClick={handleReset}
                    className="action-button reset-button"
                    title="Reset all selections"
                >
                    Reset All
                </button>
                <button 
                    onClick={handleRandomize}
                    className="action-button random-button"
                    title="Randomize traits"
                    disabled={!tokenId}
                >
                    New Perspective 👀
                </button>
                <button
                    onClick={handleFrameIt}
                    className="action-button vegas-button"
                    title="Add Vintage Frame"
                    disabled={!tokenId}
                >
                    Frame It
                </button>
            </div>

            <div className="dropdown-container">
                    <div className="dropdown-section">
                        <h3 className="dropdown-header">Select AFA</h3>
                        <div className="token-input-container">
                            <input
                                type="text"
                                value={tokenInput}
                                onChange={handleTokenInput}
                                placeholder="Enter Token ID (0-9999)"
                                className={`token-input ${isCheckingMint ? 'checking' : ''}`}
                                disabled={isCheckingMint}
                            />
                            {showSuggestions && (
                                <div className="suggestions-container" ref={suggestionsRef}>
                                    {suggestions.map((suggestion, index) => (
                                        <div
                                            key={suggestion}
                                            className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                        >
                                            {suggestion}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Outfit</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(outfitRef, 'prev')}
                            disabled={!canNavigate(outfitRef, 'prev')}
                        >
                            ◀
                        </button>
                        <select 
                            ref={outfitRef} 
                            value={secondAsset} 
                            onChange={handleSecondAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId || thirdAsset === 'selfie' || clubAsset}
                        >
                            <option value="">Select</option>
                            <option value="apefest_merch_2025">Apefest Merch 2025</option>
                            <option value="vegas">Vegas BAYC</option>
                            <option value="german_ape_club_clothes">German Ape Club</option>
                            <option value="mindfully_bored_hoodie">Mindfully Bored Hoodie</option>
                            <option value="ape_solar_hoodie_black">Ape Solar Hoodie Black</option>
                            <option value="ape_solar_hoodie_blue">Ape Solar Hoodie Blue</option>
                            <option value="apefest_merch">Apefest Merch</option>
                            <option value="tt_hoodie">Top Trader Hoodie</option>
                            <option value="bimmer_jacket">Bimmer Jacket</option>
                            <option value="apechain_hoodie_black">Apechain Hoodie Black</option>
                            <option value="apechain_hoodie_orange">Apechain Hoodie Orange</option>
                            <option value="apechain_hoodie_blue">Apechain Hoodie Blue</option>
                            <option value="apefest_jacket">Apefest Jacket</option>
                            <option value="cheetah_hoodie">Cheetah Hoodie</option>
                            <option value="naked">No Clothes</option>
                            <option value="french_stripes">French Stripes</option>
                            <option value="cats_shirt">Cool Cats Shirt</option>
                            <option value="singe_hoodie">Singe Hoodie</option>
                            <option value="singe_hoodie_glow">Singe Hoodie Glow</option>
                            <option value="applied_primate_coat">Applied Primate Lab Coat</option>
                            <option value="btc_hoodie">BTC Hoodie</option>
                            <option value="jacket">Jacket</option>
                            <option value="blazer">Blazer</option>
                            <option value="cool_hat">Cool Hat</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(outfitRef, 'next')}
                            disabled={!canNavigate(outfitRef, 'next')}
                        >
                            ▶
                        </button>
                    </div>
                </div>
            </div>

            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Mouth</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(mouthRef, 'prev')}
                            disabled={!canNavigate(mouthRef, 'prev')}
                        >
                            ◀
                        </button>
                        <select 
                            ref={mouthRef} 
                            value={mouthAsset} 
                            onChange={handleMouthAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId || clubAsset === 'elite'}
                        >
                            <option value="">Select</option>
                            <option value="apechain_grin">Apechain Grin</option>
                            <option value="lollipop">Lollipop</option>
                            <option value="banana_punch_gm">Banana Punch GM</option>
                            <option value="banana_smile">Banana Smile</option>
                            <option value="doodles_rainbow">Doodles Rainbow</option>
                            <option value="big_smile">Big Smile</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(mouthRef, 'next')}
                            disabled={!canNavigate(mouthRef, 'next')}
                        >
                            ▶
                        </button>
                    </div>
                </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Hat</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(hatRef, 'prev')}
                            disabled={!canNavigate(hatRef, 'prev')}
                        >
                            ◀
                        </button>
                        <select 
                            ref={hatRef} 
                            value={hatAsset} 
                            onChange={handleHatAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId || clubAsset || secondAsset === 'singe_hoodie_glow' || secondAsset === 'singe_hoodie'}
                        >
                            <option value="">Select</option>
                            <option value="vegas">Vegas BAYC</option>
                            <option value="german_ape_club_hat">German Ape Club</option>
                            <option value="mindfully_bored_cap">Mindfully Bored Cap</option>
                            <option value="apechain_cap">Apechain Hat</option>
                            <option value="apechain_hat_blue">Apechain Hat Blue</option>
                            <option value="apechain_hat_orange">Apechain Hat Orange</option>
                            <option value="designer_toshiro_hat">Designer Toshiro</option>
                            <option value="beret">Béret</option>
                            <option value="cats_hat">Cool Cats</option>
                            <option value="plunger">Dookey Dash</option>
                            <option value="pudgy_hat">Pudgy Penguins Hat</option>
                            <option value="pudgy_hat2">Pudgy Penguins Hat 2</option>
                            <option value="glitter_cowboy_hat">Glitter Cowboy Hat</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(hatRef, 'next')}
                            disabled={!canNavigate(hatRef, 'next')}
                        >
                            ▶
                        </button>
                    </div>
                </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Eyes</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(eyesRef, 'prev')}
                            disabled={!canNavigate(eyesRef, 'prev')}
                        >
                            ◀
                        </button>
                        <select 
                            ref={eyesRef} 
                            value={eyesAsset} 
                            onChange={handleEyesAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId || clubAsset === 'elite'}
                        >
                            <option value="">Select</option>
                            <option value="vegas">Vegas BAYC</option>
                            <option value="apecoin_glasses">Apecoin Glasses</option>
                            <option value="apechain_glasses">Apechain Glasses</option>
                            <option value="vision_pro">Vision Pro</option>
                            <option value="dookey_eyes">Dookey Dash</option>
                            <option value="btc_eyes">BTC Coin</option>
                            <option value="star_glasses">Star Glasses</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(eyesRef, 'next')}
                            disabled={!canNavigate(eyesRef, 'next')}
                        >
                            ▶
                        </button>
                    </div>
                </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Extra</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(extraRef, 'prev')}
                            disabled={!canNavigate(extraRef, 'prev')}
                        >
                            ◀
                        </button>
                        <select 
                            ref={extraRef} 
                            value={thirdAsset} 
                            onChange={handleThirdAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId || clubAsset === 'elite'}
                        >
                            <option value="">Select</option>
                            <option value="top_trader">Top Trader</option>
                            <option value="top_trader_red">Top Trader Red</option>
                            <option value="unclogged">Unclogged</option>
                            <option value="hex_dark">Hex Dark</option>
                            <option value="hex_light">Hex Light</option>
                            <option value="small_ape" disabled={secondAsset === 'singe_hoodie_glow' || selectedAsset === 'dookie_dash'}>Tiny AFA</option>
                            <option value="confetti">Confetti</option>
                            <option value="snow">Snow</option>
                            <option value="selfie" disabled={clubAsset === 'dubai'}>Selfie Head</option>
                            <option value="transparent">Transparent Background</option>
                            <option value="verified">Verified</option>
                            <option value="vintage_frame">Vintage Frame</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(extraRef, 'next')}
                            disabled={!canNavigate(extraRef, 'next')}
                        >
                            ▶
                        </button>
                    </div>
                </div>
            </div>
            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Hand</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(handRef, 'prev')}
                            disabled={!canNavigate(handRef, 'prev')}
                        >
                            ◀
                        </button>
                        <select 
                            ref={handRef} 
                            value={selectedAsset} 
                            onChange={handleAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId || thirdAsset === 'selfie' || clubAsset === 'elite'}
                        >
                            <option value="">Select</option>
                            <option value="dr_bombay_strawberry_cream">Dr. Bombay Strawberry Cream</option>
                            <option value="dr_bombay_baked_blueberry_muffin">Dr. Bombay Baked Blueberry Muffin</option>
                            <option value="dr_bombay_iced_out_orange">Dr. Bombay Iced Out Orange</option>
                            <option value="dr_bombay_peanut_butter">Dr. Bombay Peanut Butter</option>
                            <option value="vegas">Vegas BAYC</option>
                            <option value="ape_solar_sun_hand">Ape Solar Sun Hand</option>
                            <option value="blever_pass">Blever Pass</option>
                            <option value="gordon">Gordon ❤️</option>
                            <option value="dookie_dash">Dookie Dash</option>
                            <option value="smartphone_gm">Smartphone GM</option>
                            <option value="sardines">Lisbon Sardines</option>
                            <option value="ramen">Ramen Bowl</option>
                            <option value="pray">Pray</option>
                            <option value="basketball">Basketball</option>
                            <option value="shiny-gm">GM</option>
                            <option value="pipe">Pipe</option>
                            <option value="thumbsup">Thumbs Up</option>
                            <option value="magic_eden">Magic Eden</option>
                            <option value="gm_espresso">GM Espresso</option>
                            <option value="peace">Peace</option>
                            <option value="cheers" disabled={clubAsset === 'dubai'}>Cheers</option>
                            <option value="banana">Banana Hand</option>
                            <option value="otherside">Otherside Bottle</option>
                            <option value="apecoin_hands1">Apecoin Hands 1</option>
                            <option value="apecoin_hands2">Apecoin Hands </option>
                            <option value="moon_coffee">Moon Coffee Company</option>
                            <option value="candle">Candle</option>
                            <option value="balloon_fireworks">Balloon & Fireworks</option>
                            <option value="fireworks">Fireworks</option>
                            <option value="baguette">Baguette</option>
                            <option value="clubhouse">Clubhouse Sketch</option>
                            <option value="matchstick">Matchstick</option>
                            <option value="balloon_moon">2024 Balloon</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => navigateDropdown(handRef, 'next')}
                            disabled={!canNavigate(handRef, 'next')}
                        >
                            ▶
                        </button>
                    </div>
                </div>
                {/* <div className="dropdown-section">
                    <h3 className="dropdown-header">Club Assets</h3>
                    <div className="dropdown-with-arrows">
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => {
                                const clubRef = { current: document.querySelector('select[value="' + clubAsset + '"]') };
                                navigateDropdown(clubRef, 'prev');
                            }}
                            disabled={!tokenId}
                        >
                            ◀
                        </button>
                        <select 
                            value={clubAsset} 
                            onChange={handleClubAssetChange} 
                            className="dropdown" 
                            disabled={!tokenId}
                            title={!tokenId ? "Enter a token ID first" : ""}
                        >
                            <option value="">Select</option>
                            <option 
                                value="dubai" 
                                disabled={!isDubaiEligible}
                                title={!isDubaiEligible ? "This token is not eligible for Dubai club" : ""}
                            >
                                Dubai Ape Yacht Club
                            </option>
                            <option value="elite" disabled={!isEliteEligible}>Elite Apes HK</option>
                            <option value="ape_solar_sun_hand">Ape Solar Sun Hand</option>
                        </select>
                        <button 
                            className="dropdown-arrow" 
                            onClick={() => {
                                const clubRef = { current: document.querySelector('select[value="' + clubAsset + '"]') };
                                navigateDropdown(clubRef, 'next');
                            }}
                            disabled={!tokenId}
                        >
                            ▶
                        </button>
                    </div>
                </div> */}
            </div>

            {recentTokenIds.length > 0 && (
                <section className="gallery">
                    <h3 className="gallery-title">Latest mints</h3>
                    <div className="gallery-grid">
                        {recentTokenIds.slice(0, 9).map((id) => (
                            <div key={id} className="gallery-item">
                                <a
                                    className="gallery-link"
                                    href={`${RECENT_MINT_LINK_BASE}/${id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open AFA #${id}`}
                                >
                                    <div className="gallery-thumb">
                                        {recentImageUrls[id] ? (
                                            <img
                                                src={recentImageUrls[id]}
                                                alt={`AFA #${id}`}
                                            />
                                        ) : (
                                            <div className="gallery-thumb-placeholder">
                                                #{id}
                                            </div>
                                        )}
                                    </div>
                                </a>
                                <div className="gallery-meta">
                                    <a
                                        className="gallery-id"
                                        href={`${RECENT_MINT_LINK_BASE}/${id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        #{id}
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

      {/* Remove original button container */}
      {/* <div className="button-container">
        <button 
            onClick={handleReset}
            className="action-button reset-button"
            title="Reset all selections"
        >
            Reset All
        </button>
        <button 
            onClick={handleRandomize}
            className="action-button random-button"
            title="Randomize traits"
            disabled={!tokenId}
        >
            New Perspective 👀
        </button>
        <button
            onClick={handleSelectVegas}
            className="action-button vegas-button"
            title="Select Vegas Set"
            disabled={!tokenId}
        >
            Vegas Set
        </button>
    </div> */}
      <Footer />
    </div>
  );
}
export default App;