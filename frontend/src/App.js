import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import { getAllTransactions, processNFTStatuses } from './services/etherscanService';
import { debug, error as logError } from './utils/debug';

const DEFAULT_API_URL = 'https://afa-editor.ew.r.appspot.com';
const CLAIM_URL = 'https://www.apefacingapes.com/claim';
const LOADER_MESSAGES = [
    'Brewing ape magic...',
    'Polishing pixels...',
    'Mixing fresh traits...',
    'Dialing in drip...',
    'Composing your vibe...',
    'Rendering the flex...'
];

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

function MintedGalleryItem({ id, imageUrl, isSelected, onSelect, onBecomeVisible }) {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    onBecomeVisible(id);
                }
            },
            { rootMargin: '120px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [id, onBecomeVisible]);

    return (
        <button
            ref={ref}
            type="button"
            className={`gallery-item ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onSelect(id)}
            aria-label={`Select AFA #${id}`}
            aria-pressed={isSelected}
        >
            <div className="gallery-thumb">
                {imageUrl ? (
                    <img src={imageUrl} alt={`AFA #${id}`} loading="lazy" />
                ) : (
                    <div className="gallery-thumb-placeholder">#{id}</div>
                )}
            </div>
            <div className="gallery-meta">
                <span className="gallery-id">#{id}</span>
            </div>
        </button>
    );
}

function App() {
    const apiBaseCandidates = useMemo(() => Array.from(new Set([
        process.env.REACT_APP_API_URL,
        DEFAULT_API_URL
    ].filter(Boolean))), []);

    const fetchFromAnyBase = useCallback(async (pathWithQuery, parser) => {
        let lastError = null;

        for (const baseUrl of apiBaseCandidates) {
            try {
                const response = await fetch(`${baseUrl}${pathWithQuery}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await parser(response);
            } catch (err) {
                lastError = err;
                debug('API base failed, trying next', { baseUrl, pathWithQuery, err });
            }
        }

        throw lastError || new Error('All API bases failed');
    }, [apiBaseCandidates]);

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
    const [loaderMessage, setLoaderMessage] = useState(LOADER_MESSAGES[0]);
    const [fade, setFade] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mintedTokens, setMintedTokens] = useState(new Set());
    const [mintedTokenIds, setMintedTokenIds] = useState([]);
    const [mintPreviewUrls, setMintPreviewUrls] = useState({});
    const [isCheckingMint, setIsCheckingMint] = useState(false);
    const [unmintedTokenId, setUnmintedTokenId] = useState('');
    const suggestionsRef = useRef(null);
    const activeRenderRequestRef = useRef(0);
    const mintPreviewLoadingRef = useRef(new Set());
    const mintPreviewUrlsRef = useRef({});
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
    
    const applyMintedIdList = useCallback((ids) => {
        const numericIds = ids
            .map((id) => parseInt(String(id), 10))
            .filter((id) => !Number.isNaN(id));
        if (numericIds.length === 0) return;
        setMintedTokens(new Set(numericIds));
        setMintedTokenIds(numericIds);
    }, []);

    const verifyTokenMinted = useCallback(async (rawId) => {
        const normalized = String(rawId || '').replace(/[^0-9]/g, '').slice(0, 4);
        if (!normalized) return false;

        try {
            const data = await fetchFromAnyBase(
                `/api/is-minted?tokenId=${encodeURIComponent(normalized)}`,
                (response) => response.json()
            );
            return Boolean(data.minted);
        } catch (error) {
            logError('Mint verification failed; denying access', { tokenId: normalized, error });
            return false;
        }
    }, [fetchFromAnyBase]);

    const fetchMintedTokens = useCallback(async () => {
        try {
            const backendIds = await fetchFromAnyBase(
                '/api/minted-token-ids',
                (response) => response.json()
            );
            if (Array.isArray(backendIds) && backendIds.length > 0) {
                applyMintedIdList(backendIds);
                return;
            }
        } catch (error) {
            debug('Backend mint list unavailable, falling back to Etherscan', error);
        }

        try {
            const transactions = await getAllTransactions();
            const nftStatuses = processNFTStatuses(transactions);
            const minted = new Set(Array.from(nftStatuses.keys()));

            if (minted.size > 0) {
                setMintedTokens(minted);
            }

            if (Array.isArray(transactions) && transactions.length > 0) {
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
                }

                setMintedTokenIds(latestIds);
            }
        } catch (error) {
            logError('Error fetching minted tokens:', error);
        }
    }, [applyMintedIdList, fetchFromAnyBase]);

    // Update the useEffect to only call fetchMintedTokens
    useEffect(() => {
        fetchMintedTokens();
    }, [fetchMintedTokens]);

    const loadMintPreview = useCallback(async (id) => {
        if (mintPreviewUrlsRef.current[id] || mintPreviewLoadingRef.current.has(id)) return;

        mintPreviewLoadingRef.current.add(id);
        try {
            const queryParams = new URLSearchParams({
                tokenId: id,
                assetType: 'AFA'
            });
            const blob = await fetchFromAnyBase(
                `/api/get-asset?${queryParams.toString()}`,
                (response) => response.blob()
            );
            const url = URL.createObjectURL(blob);
            mintPreviewUrlsRef.current[id] = url;
            setMintPreviewUrls((prev) => ({ ...prev, [id]: url }));
        } catch (error) {
            debug('Mint preview failed', { id, error });
        } finally {
            mintPreviewLoadingRef.current.delete(id);
        }
    }, [fetchFromAnyBase]);

    const handleMintPreviewVisible = useCallback((id) => {
        loadMintPreview(id);
    }, [loadMintPreview]);

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
      const requestId = ++activeRenderRequestRef.current;
      setShowLoader(true);
      setLoaderMessage(LOADER_MESSAGES[requestId % LOADER_MESSAGES.length]);
      const resolvedBaseAsset = newSelectedAsset || 'AFA';
    
        const queryParams = new URLSearchParams({
            tokenId: newTokenId,
            assetType: resolvedBaseAsset,
            secondAssetType: newSecondAsset || '',
            thirdAssetType: newThirdAsset || '',
            mouthAssetType: newMouthAsset || '',
            eyesAssetType: newEyesAsset || '',
            hatAssetType: newHatAsset || '',
            clubAssetType: newClubAsset || ''
        });
    
        // Start fade-out effect
      setFade('fade-out');

        fetchFromAnyBase(
            `/api/get-asset?${queryParams.toString()}`,
            (response) => response.blob()
        )
        .then(blob => {
            if (requestId !== activeRenderRequestRef.current) return;
            const newImageUrl = URL.createObjectURL(blob);
    
            // Update the image URL after fade-out transition
            setTimeout(() => {
                if (requestId !== activeRenderRequestRef.current) return;
                setCurrentImageUrl(newImageUrl);
                setFade('fade-in'); // Start fade-in effect
            }, 500);
    
            setShowLoader(false);
        })
        .catch(error => {
            if (requestId !== activeRenderRequestRef.current) return;
            logError('Error fetching asset:', error);
            setCurrentImageUrl('./overview.gif');
            setTokenId('');
            setUnmintedTokenId(String(newTokenId));
            setShowLoader(false);
            setFade('fade-in');
        });
    
        // Fetch background color separately
        fetchFromAnyBase(
            `/api/get-background-color?tokenId=${newTokenId}`,
            (response) => response.json()
        )
        .then(data => {
            if (requestId !== activeRenderRequestRef.current) return;
            const bgColor = `rgb(${data.background_color[0]}, ${data.background_color[1]}, ${data.background_color[2]})`;
            const textColor = getContrastYIQ(data.background_color);
            // Apply fade effect
            document.body.classList.add('body-background-fade');
            // Change full background so it overrides the static gradient
            document.body.style.background = bgColor;
            document.documentElement.style.setProperty('--token-background-color', bgColor);
            document.documentElement.style.setProperty('--text-color', textColor);
            // Remove fade effect after transition
            setTimeout(() => {
                document.body.classList.remove('body-background-fade');
            }, 500); // Match this timeout with the transition duration in CSS
        })
        .catch((error) => logError('Error fetching background color:', error));
    }, [fetchFromAnyBase]);

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
        }
        else if (newSecondAsset === ('singe_hoodie_glow')) {
            setHatAsset('');   
        }
        else {
            debug('[handleSecondAssetChange] Selected secondAsset', newSecondAsset);
        }
    };
    
    const handleMouthAssetChange = event => {
        const newMouthAsset = event.target.value;
        setMouthAsset(newMouthAsset);
    };

    const handleEyesAssetChange = event => {
        const newEyesAsset = event.target.value;
        setEyesAsset(newEyesAsset);
    };
    const handleHatAssetChange = event => {
        const newHatAsset = event.target.value;
        setHatAsset(newHatAsset);
    };

    const handleThirdAssetChange = event => {
        const newThirdAsset = event.target.value;
        setThirdAsset(newThirdAsset);
    
        if (newThirdAsset === 'selfie') {
            setSecondAsset('');
            setMouthAsset('');
            setSelectedAsset('');    
        }
    };
    const handleAssetChange = event => {
        setSelectedAsset(event.target.value);
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

    const resetTraitSelections = useCallback(() => {
        setSecondAsset('');
        setThirdAsset('');
        setMouthAsset('');
        setHatAsset('');
        setClubAsset('');
        setEyesAsset('');
        setSelectedAsset('');
    }, []);

    const handleTokenSubmit = useCallback(async (rawValue) => {
        const value = String(rawValue || '').replace(/[^0-9]/g, '').slice(0, 4);
        if (!value) return false;

        setIsCheckingMint(true);
        setUnmintedTokenId('');
        setTokenInput(value);

        const minted = await verifyTokenMinted(value);
        setIsCheckingMint(false);

        if (!minted) {
            resetTraitSelections();
            setTokenId('');
            setUnmintedTokenId(value);
            setShowSuggestions(false);
            setCurrentImageUrl('./overview.gif');
            return false;
        }

        resetTraitSelections();
        setUnmintedTokenId('');
        setTokenId(value);
        setShowSuggestions(false);
        return true;
    }, [resetTraitSelections, verifyTokenMinted]);

    const handleSuggestionClick = (value) => {
        // Suggestions are derived from minted token data, so select immediately.
        handleTokenSubmit(value);
    };

    // Deep links from mint progress / share URLs, e.g. ?tokenId=482&assetType=AFA
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlTokenId = params.get('tokenId');
        if (!urlTokenId) return;

        const value = String(urlTokenId).replace(/[^0-9]/g, '').slice(0, 4);
        if (!value) return;

        let cancelled = false;

        (async () => {
            const loaded = await handleTokenSubmit(value);
            if (cancelled || !loaded) return;

            const applyTraitParam = (key, setter) => {
                const raw = params.get(key);
                if (raw == null || raw === '') return;
                setter(raw === 'AFA' ? '' : raw);
            };

            applyTraitParam('assetType', setSelectedAsset);
            applyTraitParam('secondAssetType', setSecondAsset);
            applyTraitParam('thirdAssetType', setThirdAsset);
            applyTraitParam('mouthAssetType', setMouthAsset);
            applyTraitParam('hatAssetType', setHatAsset);
            applyTraitParam('eyesAssetType', setEyesAsset);
            applyTraitParam('clubAssetType', setClubAsset);
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount from URL
    }, []);

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
        
        // Keep base hand trait unselected; renderer falls back to AFA automatically.
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
    };

    // Add the new handler function for the Vegas set
    const handleFrameIt = () => {
        if (!tokenId) return; // Do nothing if no token ID is selected

        const frameAsset = 'vintage_frame';

        setThirdAsset(frameAsset);

        debug('[handleFrameIt] Applying frame', {
            tokenId,
            selectedAsset,
            secondAsset,
            thirdAsset: frameAsset,
            mouthAsset,
            hatAsset,
            eyesAsset,
            clubAsset
        });

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

    const traitChips = [
        { key: 'outfit', label: 'Outfit', value: secondAsset, clear: () => setSecondAsset('') },
        { key: 'mouth', label: 'Mouth', value: mouthAsset, clear: () => setMouthAsset('') },
        { key: 'hat', label: 'Hat', value: hatAsset, clear: () => setHatAsset('') },
        { key: 'eyes', label: 'Eyes', value: eyesAsset, clear: () => setEyesAsset('') },
        { key: 'hand', label: 'Hand', value: selectedAsset, clear: () => setSelectedAsset('') },
        { key: 'extra', label: 'Extra', value: thirdAsset, clear: () => setThirdAsset('') }
    ].filter((t) => Boolean(t.value));

  const appClassName = `App ${vegasButtonClicked ? 'vegas-glamour' : ''} ${tokenId ? 'has-token' : ''}`;

  return (
    // Apply glamour class conditionally
    <div className={appClassName}>
      <Banner />
      <main className="studio">
        <section className={`studio-preview ${tokenId ? 'has-token' : ''}`} aria-label="Preview">
          <div className="preview-card">
            <div id="asset-display" className={`${fade || ''} ${showLoader ? 'is-loading' : ''}`}>
              <img src={currentImageUrl} alt="Ape preview" />
              {showLoader && (
                <div className="loader" role="status" aria-live="polite">
                  {loaderMessage}
                </div>
              )}
            </div>
          </div>

          {unmintedTokenId && (
            <div className="claim-prompt" role="alert">
              <p className="claim-prompt-title">
                AFA #{unmintedTokenId} is not minted yet
              </p>
              <p className="claim-prompt-copy">
                Only minted AFAs can be edited. Mint this token to unlock the full editor.
              </p>
              <a
                href={CLAIM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="claim-prompt-cta"
              >
                Mint on apefacingapes.com
              </a>
            </div>
          )}

          {tokenId && traitChips.length > 0 && (
            <div className="trait-chips" aria-label="Selected traits">
              {traitChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="trait-chip"
                  onClick={chip.clear}
                  title={`Clear ${chip.label}`}
                >
                  <span className="trait-chip-label">{chip.label}</span>
                  <span className="trait-chip-x" aria-hidden="true">
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="studio-controls" aria-label="Editor controls">
          {tokenId && (
            <div className="action-dock" aria-label="Quick actions">
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
                >
                  New Perspective 👀
                </button>
                <button
                  onClick={handleFrameIt}
                  className="action-button vegas-button"
                  title="Add Vintage Frame"
                >
                  Frame It
                </button>
              </div>
            </div>
          )}

          <details className={`panel-group token-panel ${!tokenId ? 'token-panel--prominent' : ''}`} open>
            <summary className="panel-summary">{tokenId ? 'Token' : 'Enter Token ID'}</summary>
            <div className="panel-body">
              <div className="dropdown-container dropdown-container--single">
                    <div className="dropdown-section">
                        {tokenId && <h3 className="dropdown-header">Select AFA</h3>}
                        {!tokenId && (
                          <p className="token-help-text">Enter an AFA token ID to load the full editor layout.</p>
                        )}
                        <div className="token-input-container">
                            <div className="token-input-row">
                                <input
                                    type="text"
                                    value={tokenInput}
                                    onChange={handleTokenInput}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleTokenSubmit(tokenInput);
                                        }
                                    }}
                                    placeholder="Enter minted Token ID (0-9999)"
                                    className={`token-input ${isCheckingMint ? 'checking' : ''}`}
                                    disabled={isCheckingMint}
                                    aria-busy={isCheckingMint}
                                />
                            </div>
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
              </div>
            </div>
          </details>

          {tokenId && (
            <>
              <details className="panel-group" open>
                <summary className="panel-summary">Style</summary>
                <div className="panel-body">
                  <div className="dropdown-container">
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
                                disabled={thirdAsset === 'selfie' || clubAsset}
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
                </div>
              </details>

              <details className="panel-group" open>
                <summary className="panel-summary">Accessories</summary>
                <div className="panel-body">
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
                                disabled={clubAsset === 'elite'}
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
                                disabled={clubAsset || secondAsset === 'singe_hoodie_glow' || secondAsset === 'singe_hoodie'}
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
                                disabled={clubAsset === 'elite'}
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
                                disabled={thirdAsset === 'selfie' || clubAsset === 'elite'}
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
                </div>
              </details>

              <details className="panel-group" open>
                <summary className="panel-summary">Effects</summary>
                <div className="panel-body">
                  <div className="dropdown-container">
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
                          disabled={clubAsset === 'elite'}
                        >
                          <option value="">Select</option>
                          <option value="top_trader">Top Trader</option>
                          <option value="top_trader_red">Top Trader Red</option>
                          <option value="unclogged">Unclogged</option>
                          <option value="hex_dark">Hex Dark</option>
                          <option value="hex_light">Hex Light</option>
                          <option
                            value="small_ape"
                            disabled={secondAsset === 'singe_hoodie_glow' || selectedAsset === 'dookie_dash'}
                          >
                            Tiny AFA
                          </option>
                          <option value="confetti">Confetti</option>
                          <option value="snow">Snow</option>
                          <option value="selfie" disabled={clubAsset === 'dubai'}>
                            Selfie Head
                          </option>
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
                </div>
              </details>
            </>
          )}

          <details className="panel-group" open>
            <summary className="panel-summary">
              Minted AFAs{mintedTokenIds.length > 0 ? ` (${mintedTokenIds.length})` : ''}
            </summary>
            <div className="panel-body">
              <section className="gallery">
                {mintedTokenIds.length > 0 ? (
                  <div className="gallery-scroll">
                    <div className="gallery-grid">
                      {mintedTokenIds.map((id) => (
                        <MintedGalleryItem
                          key={id}
                          id={id}
                          imageUrl={mintPreviewUrls[id]}
                          isSelected={String(tokenId) === String(id)}
                          onSelect={handleTokenSubmit}
                          onBecomeVisible={handleMintPreviewVisible}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="gallery-empty">Loading minted AFAs…</p>
                )}
              </section>
            </div>
          </details>
        </section>
      </main>

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