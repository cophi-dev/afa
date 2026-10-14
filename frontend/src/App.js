import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import { getAllTransactions, getMintedTokenIdsNewestFirst, checkTokenMintStatus } from './services/etherscanService';
import { debug, error as logError } from './utils/debug';

const DEFAULT_API_URL = 'https://afa-editor.ew.r.appspot.com';
const MINT_SITE_URL = 'https://www.apefacingapes.com';
const GRID_VIEW_URL = 'https://afa-progress.com';
const PREVIEW_CONCURRENCY = 4;
const PREVIEW_RETRIES = 2;
const PREVIEW_RETRY_COOLDOWN_MS = 15000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CLAIM_URL = `${MINT_SITE_URL}/claim`;
const LOADER_MESSAGES = [
    'Brewing ape magic...',
    'Polishing pixels...',
    'Mixing fresh traits...',
    'Dialing in drip...',
    'Composing your vibe...',
    'Rendering the flex...'
];
const MINT_GALLERY_SORT = {
    MINT_DATE: 'mintDate',
    TOKEN_ID: 'tokenId',
};

function SiteBar() {
    return (
        <header className="site-bar">
            <a href={MINT_SITE_URL} target="_blank" rel="noopener noreferrer" className="site-bar-brand">
                <img src="./logo-mark.png" alt="Ape Facing Apes" width="240" height="207" className="site-bar-logo" />
                <span className="site-bar-title">Editor</span>
            </a>
            <a href={GRID_VIEW_URL} target="_blank" rel="noopener noreferrer" className="site-bar-link">
                Mint Progress
            </a>
        </header>
    );
}

function Hero({ heroImage, onPick }) {
    return (
        <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
                <h1 id="hero-title" className="hero-title">Dress up your Ape Facing Ape.</h1>
                <p className="hero-lede">
                    Ape Facing Apes are Bored Apes turned to face you. Pick a minted AFA, swap outfits, hats and effects, and download the result.
                </p>
                <button type="button" className="hero-cta" onClick={onPick}>
                    Pick your ape
                </button>
            </div>
            <div className="hero-art">
                <img
                    src={heroImage || './face.png'}
                    alt=""
                    width="1000"
                    height="1000"
                    className={`hero-ape ${heroImage ? '' : 'is-placeholder'}`}
                />
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer className="footer">
            <nav className="footer-nav" aria-label="AFA sites">
                <a href={GRID_VIEW_URL} target="_blank" rel="noopener noreferrer">
                    Mint progress: afa-progress.com
                </a>
                <a href={CLAIM_URL} target="_blank" rel="noopener noreferrer">
                    Mint on apefacingapes.com
                </a>
            </nav>
            <p className="footer-legal">
                © Ape Facing Apes. BAYC marks and assets licensed from Yuga Labs, Inc.
            </p>
        </footer>
    );
}

function MintedGalleryItem({ id, imageUrl, isFailed, isSelected, onSelect, onBecomeVisible }) {
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
            { rootMargin: '300px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [id, onBecomeVisible]);

    return (
        <button
            ref={ref}
            type="button"
            className={`gallery-item ${imageUrl ? 'has-image' : 'is-pending'} ${isFailed ? 'is-failed' : ''} ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onSelect(id)}
            aria-pressed={isSelected}
        >
            <span className="visually-hidden">Select AFA </span>
            <div className="gallery-thumb" aria-hidden={imageUrl ? undefined : true}>
                {imageUrl ? (
                    <img src={imageUrl} alt={`AFA #${id}`} width="1000" height="1000" decoding="async" />
                ) : (
                    <div className={`gallery-skeleton ${isFailed ? 'is-failed' : ''}`}>
                    </div>
                )}
            </div>
            <div className="gallery-meta">
                <span className="gallery-id">#{id}</span>
            </div>
        </button>
    );
}

function MintedGallery({
    mintedCount,
    isLoading,
    sortedIds,
    mintPreviewUrls,
    mintPreviewFailed = {},
    tokenId,
    onSelect,
    onBecomeVisible,
    sort,
    onSort,
    search,
    collapsedLimit = 12,
}) {
    const [showAll, setShowAll] = useState(false);
    const query = '';
    useEffect(() => { setShowAll(false); }, [collapsedLimit, tokenId]);
    const filteredIds = query.trim()
        ? sortedIds.filter((id) => String(id).startsWith(query.trim()))
        : sortedIds;
    const visibleIds = showAll || query.trim() ? filteredIds : filteredIds.slice(0, collapsedLimit);
    const hiddenCount = filteredIds.length - visibleIds.length;
    return (
        <section className="gallery" aria-label="Minted AFAs">
            <div className="gallery-toolbar">
                {search}
                <h2 className="gallery-heading">
                    Minted AFAs{mintedCount > 0 ? ` (${mintedCount})` : ''}
                </h2>
                {!isLoading && (
                    <label className="gallery-sort" htmlFor="mint-gallery-sort">
                        <span className="gallery-sort-label">Sort by</span>
                        <select
                            id="mint-gallery-sort"
                            className="dropdown gallery-sort-select"
                            value={sort}
                            onChange={(event) => onSort(event.target.value)}
                        >
                            <option value={MINT_GALLERY_SORT.MINT_DATE}>Mint date</option>
                            <option value={MINT_GALLERY_SORT.TOKEN_ID}>Token ID</option>
                        </select>
                    </label>
                )}
            </div>
            {isLoading ? (
                <div className="gallery-scroll" aria-busy="true">
                    <p className="visually-hidden">Loading minted AFAs</p>
                    <div className="gallery-grid gallery-grid--skeleton">
                        {Array.from({ length: 8 }, (_, index) => (
                            <div key={index} className="gallery-item gallery-item--skeleton" aria-hidden="true">
                                <div className="gallery-thumb">
                                    <div className="gallery-skeleton" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="gallery-scroll">
                    <div className="gallery-grid">
                        {visibleIds.map((id) => (
                            <MintedGalleryItem
                                key={id}
                                id={id}
                                imageUrl={mintPreviewUrls[id]}
                                isFailed={Boolean(mintPreviewFailed[id])}
                                isSelected={String(tokenId) === String(id)}
                                onSelect={onSelect}
                                onBecomeVisible={onBecomeVisible}
                            />
                        ))}
                    </div>
                    {(hiddenCount > 0 || showAll) && !query.trim() && (
                        <button
                            type="button"
                            className="gallery-toggle"
                            onClick={() => setShowAll((value) => !value)}
                            aria-expanded={showAll}
                        >
                            {showAll ? 'Show fewer' : `Show all ${sortedIds.length} minted apes`}
                        </button>
                    )}
                </div>
            )}
        </section>
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
    const [mintGallerySort, setMintGallerySort] = useState(MINT_GALLERY_SORT.MINT_DATE);
    const [mintPreviewUrls, setMintPreviewUrls] = useState({});
    const [mintPreviewFailed, setMintPreviewFailed] = useState({});
    const [liveMintCount, setLiveMintCount] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`${GRID_VIEW_URL}/api/mints`, { headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (!cancelled && data && Number.isFinite(data.count)) setLiveMintCount(data.count);
            })
            .catch((error) => debug('Live mint count failed', error));
        return () => { cancelled = true; };
    }, []);
    const previewQueueRef = useRef([]);
    const previewActiveRef = useRef(0);
    const previewFailedAtRef = useRef({});
    const [isCheckingMint, setIsCheckingMint] = useState(false);
    const [unmintedTokenId, setUnmintedTokenId] = useState('');
    const [syncPendingTokenId, setSyncPendingTokenId] = useState('');
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
    const [shareNote, setShareNote] = useState('');

  useEffect(() => {
        if (thirdAsset === 'selfie') {
            setSecondAsset('');
            setSelectedAsset('');
        }
    }, [thirdAsset]);
    
    const applyMintedIdList = useCallback((ids) => {
        const seen = new Set();
        const numericIds = [];
        for (const rawId of ids) {
            const id = parseInt(String(rawId), 10);
            if (Number.isNaN(id) || seen.has(id)) continue;
            seen.add(id);
            numericIds.push(id);
        }
        if (numericIds.length === 0) return;
        setMintedTokens(new Set(numericIds));
        setMintedTokenIds(numericIds);
    }, []);

    const verifyTokenMinted = useCallback(async (rawId) => {
        const normalized = String(rawId || '').replace(/[^0-9]/g, '').slice(0, 4);
        if (!normalized) return false;

        const numericId = parseInt(normalized, 10);
        if (!Number.isNaN(numericId) && mintedTokens.has(numericId)) {
            return true;
        }

        try {
            const data = await fetchFromAnyBase(
                `/api/is-minted?tokenId=${encodeURIComponent(normalized)}`,
                (response) => response.json()
            );
            if (Boolean(data.minted)) {
                return true;
            }
        } catch (error) {
            debug('Mint verification API failed, trying Etherscan', { tokenId: normalized, error });
        }

        try {
            return await checkTokenMintStatus(normalized);
        } catch (error) {
            logError('Mint verification failed; denying access', { tokenId: normalized, error });
            return false;
        }
    }, [fetchFromAnyBase, mintedTokens]);

    const fetchMintedTokens = useCallback(async () => {
        const loadChainMintIds = async () => {
            const transactions = await getAllTransactions();
            return getMintedTokenIdsNewestFirst(transactions);
        };

        let backendCount = 0;

        try {
            const backendResult = await fetchFromAnyBase(
                '/api/minted-token-ids',
                (response) => response.json()
            );
            const backendIds = Array.isArray(backendResult) ? backendResult : [];
            if (backendIds.length > 0) {
                applyMintedIdList(backendIds);
                backendCount = backendIds.length;
            }
        } catch (error) {
            debug('Backend mint list unavailable', error);
        }

        if (backendCount === 0) {
            try {
                const chainIds = await loadChainMintIds();
                if (chainIds.length > 0) {
                    applyMintedIdList(chainIds);
                }
            } catch (error) {
                debug('Etherscan mint list unavailable', error);
            }
            return;
        }

        loadChainMintIds()
            .then(async (chainIds) => {
                if (chainIds.length <= backendCount) return;

                try {
                    await fetchFromAnyBase(
                        '/api/minted-token-ids?refresh=1',
                        (response) => response.json()
                    );
                } catch (error) {
                    debug('Backend mint cache refresh failed', error);
                }

                applyMintedIdList(chainIds);
            })
            .catch((error) => {
                debug('Etherscan mint list background refresh failed', error);
            });
    }, [applyMintedIdList, fetchFromAnyBase]);

    const sortedMintGalleryIds = useMemo(() => {
        if (mintGallerySort === MINT_GALLERY_SORT.TOKEN_ID) {
            return [...mintedTokenIds].sort((a, b) => a - b);
        }
        return mintedTokenIds;
    }, [mintedTokenIds, mintGallerySort]);

    // Update the useEffect to only call fetchMintedTokens
    useEffect(() => {
        fetchMintedTokens();
    }, [fetchMintedTokens]);

    const fetchMintPreview = useCallback(async (id) => {
        const previewQuery = new URLSearchParams({
            tokenId: id,
            assetType: 'AFA'
        });
        const fetchPreviewBlob = () => fetchFromAnyBase(
            `/api/get-asset?${previewQuery.toString()}`,
            (response) => response.blob()
        );

        for (let attempt = 0; attempt <= PREVIEW_RETRIES; attempt += 1) {
            try {
                if (attempt === 1) {
                    await fetchFromAnyBase(
                        '/api/minted-token-ids?refresh=1',
                        (response) => response.json()
                    ).catch(() => null);
                }
                const blob = await fetchPreviewBlob();
                if (!blob || blob.size === 0) throw new Error('empty preview');
                return URL.createObjectURL(blob);
            } catch (error) {
                debug('Mint preview attempt failed', { id, attempt, error });
                if (attempt < PREVIEW_RETRIES) await wait(600 * (attempt + 1));
            }
        }
        return null;
    }, [fetchFromAnyBase]);

    const pumpPreviewQueue = useCallback(() => {
        while (previewActiveRef.current < PREVIEW_CONCURRENCY && previewQueueRef.current.length > 0) {
            const id = previewQueueRef.current.shift();
            previewActiveRef.current += 1;
            fetchMintPreview(id)
                .then((url) => {
                    if (url) {
                        mintPreviewUrlsRef.current[id] = url;
                        setMintPreviewUrls((prev) => ({ ...prev, [id]: url }));
                        setMintPreviewFailed((prev) => {
                            if (!prev[id]) return prev;
                            const next = { ...prev };
                            delete next[id];
                            return next;
                        });
                    } else {
                        previewFailedAtRef.current[id] = Date.now();
                        setMintPreviewFailed((prev) => ({ ...prev, [id]: true }));
                    }
                })
                .finally(() => {
                    previewActiveRef.current -= 1;
                    mintPreviewLoadingRef.current.delete(id);
                    pumpPreviewQueue();
                });
        }
    }, [fetchMintPreview]);

    const loadMintPreview = useCallback((id) => {
        if (mintPreviewUrlsRef.current[id] || mintPreviewLoadingRef.current.has(id)) return;
        const failedAt = previewFailedAtRef.current[id];
        if (failedAt && Date.now() - failedAt < PREVIEW_RETRY_COOLDOWN_MS) return;

        mintPreviewLoadingRef.current.add(id);
        previewQueueRef.current.push(id);
        pumpPreviewQueue();
    }, [pumpPreviewQueue]);

    const handleMintPreviewVisible = useCallback((id) => {
        loadMintPreview(id);
    }, [loadMintPreview]);

    useEffect(() => {
        if (mintedTokenIds.length === 0) return;
        sortedMintGalleryIds.slice(0, 12).forEach((id) => {
            loadMintPreview(id);
        });
    }, [mintedTokenIds, sortedMintGalleryIds, loadMintPreview]);

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

        const fetchAssetBlob = () => fetchFromAnyBase(
            `/api/get-asset?${queryParams.toString()}`,
            (response) => response.blob()
        );

        const refreshMintCache = () => fetchFromAnyBase(
            '/api/minted-token-ids?refresh=1',
            (response) => response.json()
        );

        fetchAssetBlob()
        .catch(async (error) => {
            await refreshMintCache();
            return fetchAssetBlob();
        })
        .then(blob => {
            if (requestId !== activeRenderRequestRef.current) return;
            setSyncPendingTokenId('');
            const newImageUrl = URL.createObjectURL(blob);
    
            // Update the image URL after fade-out transition
            setTimeout(() => {
                if (requestId !== activeRenderRequestRef.current) return;
                setCurrentImageUrl(newImageUrl);
                setFade('fade-in'); // Start fade-in effect
            }, 500);
    
            setShowLoader(false);
        })
        .catch(async (error) => {
            if (requestId !== activeRenderRequestRef.current) return;

            let chainMinted = false;
            try {
                chainMinted = await checkTokenMintStatus(String(newTokenId));
            } catch (verifyError) {
                debug('On-chain mint re-check failed', { tokenId: newTokenId, verifyError });
            }

            if (chainMinted) {
                setUnmintedTokenId('');
                setSyncPendingTokenId(String(newTokenId));
                setShowLoader(false);
                setFade('fade-in');
                logError('Asset fetch failed but token is minted on-chain; backend may be out of sync', error);
                return;
            }

            logError('Error fetching asset:', error);
            setSyncPendingTokenId('');
            setCurrentImageUrl('./overview.gif');
            setTokenId('');
            setUnmintedTokenId(String(newTokenId));
            setShowLoader(false);
            setFade('fade-in');
        });
    
        // Fetch background color separately
        const fetchBackgroundColor = () => fetchFromAnyBase(
            `/api/get-background-color?tokenId=${newTokenId}`,
            (response) => response.json()
        );

        fetchBackgroundColor()
        .catch(async () => {
            await refreshMintCache();
            return fetchBackgroundColor();
        })
        .then(data => {
            if (requestId !== activeRenderRequestRef.current) return;
            const [red, green, blue] = data.background_color;
            document.documentElement.style.setProperty(
                '--preview-frame-color',
                `rgb(${red}, ${green}, ${blue})`
            );
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
        setSyncPendingTokenId('');
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
        setSyncPendingTokenId('');
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

        // Pick random extra first to check if it's selfie
        const newThirdAsset = extraOptions.length ? getRandomItem(extraOptions) : '';

        const isSelfie = newThirdAsset === 'selfie';
        const newSecondAsset = isSelfie ? '' : (outfitOptions.length ? getRandomItem(outfitOptions) : '');
        const newMouthAsset = mouthOptions.length ? getRandomItem(mouthOptions) : '';
        const newHatAsset = hatOptions.length ? getRandomItem(hatOptions) : '';
        const newEyesAsset = eyesOptions.length ? getRandomItem(eyesOptions) : '';
        const newSelectedAsset = isSelfie ? '' : (handOptions.length ? getRandomItem(handOptions) : '');

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

    useEffect(() => {
        if (!tokenId) return undefined;
        const next = new URLSearchParams();
        next.set('tokenId', String(tokenId));
        const setIf = (key, value) => {
            if (value) next.set(key, value);
        };
        setIf('assetType', selectedAsset);
        setIf('secondAssetType', secondAsset);
        setIf('thirdAssetType', thirdAsset);
        setIf('mouthAssetType', mouthAsset);
        setIf('hatAssetType', hatAsset);
        setIf('eyesAssetType', eyesAsset);
        setIf('clubAssetType', clubAsset);
        const query = next.toString();
        if (window.location.search === `?${query}`) return undefined;
        window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
        return undefined;
    }, [tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset]);

    useEffect(() => {
        if (!shareNote) return undefined;
        const timerId = window.setTimeout(() => setShareNote(''), 2200);
        return () => window.clearTimeout(timerId);
    }, [shareNote]);

    const handleDownload = () => {
        if (!currentImageUrl.startsWith('blob:')) return;
        const link = document.createElement('a');
        link.href = currentImageUrl;
        link.download = `afa-${tokenId}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleShare = async () => {
        const url = window.location.href;
        const shareData = {
            title: `AFA #${tokenId}`,
            text: `Ape Facing Apes #${tokenId}`,
            url,
        };
        try {
            if (navigator.share) {
                if (currentImageUrl.startsWith('blob:') && typeof navigator.canShare === 'function') {
                    const blob = await fetch(currentImageUrl).then((response) => response.blob());
                    const file = new File([blob], `afa-${tokenId}.png`, { type: blob.type || 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ ...shareData, files: [file] });
                        return;
                    }
                }
                await navigator.share(shareData);
                return;
            }
            await navigator.clipboard.writeText(url);
            setShareNote('Link copied');
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            try {
                await navigator.clipboard.writeText(url);
                setShareNote('Link copied');
            } catch (copyError) {
                debug('Share failed', copyError);
                setShareNote('Copy the page link');
            }
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

  const handlePickYourApe = () => {
    const target = document.getElementById('editor-controls');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const input = document.getElementById('afa-token-id');
      if (input) input.focus({ preventScroll: true });
    }, 450);
  };

  const appClassName = `App ${vegasButtonClicked ? 'vegas-glamour' : ''} ${tokenId ? 'has-token' : ''}`;

  return (
    // Apply glamour class conditionally
    <div className={appClassName}>
      <a className="skip-link" href="#editor-controls">Skip to editor</a>
      <SiteBar />
      {!tokenId && (
        <Hero
          heroImage={sortedMintGalleryIds.length > 0 ? mintPreviewUrls[sortedMintGalleryIds[0]] : null}
          onPick={handlePickYourApe}
        />
      )}
      <main className={`studio ${tokenId ? 'studio--editing' : 'studio--picking'}`}>
        <section className={`studio-preview ${tokenId ? 'has-token' : ''}`} aria-label="Preview">
          <div className="preview-card">
            <div id="asset-display" className={`${fade || ''} ${showLoader ? 'is-loading' : ''}`}>
              <img src={currentImageUrl} alt="Ape preview" width="1200" height="1200" />
              {showLoader && (
                <div className="loader" role="status" aria-live="polite">
                  <div className="loader-progress" aria-hidden="true">
                    <span />
                  </div>
                  <span>{loaderMessage}</span>
                </div>
              )}
            </div>
          </div>

          {tokenId && (
            <div className="preview-actions">
              <button
                type="button"
                className="preview-download"
                onClick={handleDownload}
                disabled={!String(currentImageUrl).startsWith('blob:')}
              >
                Download PNG
              </button>
              <button type="button" className="preview-share" onClick={handleShare}>
                {shareNote || 'Share'}
              </button>
            </div>
          )}

          {syncPendingTokenId && (
            <div className="claim-prompt" role="alert">
              <p className="claim-prompt-title">
                AFA #{syncPendingTokenId} is minted, but preview is unavailable
              </p>
              <p className="claim-prompt-copy">
                The editor confirmed this token on-chain, but the image server has not synced yet. Try again in a minute or contact support if this persists.
              </p>
            </div>
          )}

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
        <section id="editor-controls" className="studio-controls" aria-label="Editor controls">
          {tokenId && (
            <div className="action-dock" aria-label="Quick actions">
              <div className="button-container">
                <button
                  type="button"
                  onClick={handleReset}
                  className="action-button reset-button"
                  title="Clears every trait. Keeps this ape."
                  data-tooltip="Clears every trait. Keeps this ape."
                >
                  Reset traits
                </button>
                <button
                  type="button"
                  onClick={handleRandomize}
                  className="action-button random-button"
                  title="Randomizes outfit, mouth, hat, eyes, hand, and extra."
                  data-tooltip="Randomizes outfit, mouth, hat, eyes, hand, and extra."
                >
                  Randomize 👀
                </button>
                <button
                  type="button"
                  onClick={handleFrameIt}
                  className="action-button vegas-button"
                  title="Adds the vintage frame."
                  data-tooltip="Adds the vintage frame."
                >
                  Add frame
                </button>
              </div>
            </div>
          )}

          <details className={`panel-group token-panel ${!tokenId ? 'token-panel--prominent' : ''}`} open>
            <summary className="panel-summary">{tokenId ? 'Token' : 'Enter Token ID'}</summary>
            <div className="panel-body">
              <p className="token-help-text">Type an ID or pick one below.</p>
              <MintedGallery
                mintedCount={liveMintCount ?? mintedTokens.size}
                isLoading={mintedTokenIds.length === 0}
                sortedIds={sortedMintGalleryIds}
                mintPreviewUrls={mintPreviewUrls}
                mintPreviewFailed={mintPreviewFailed}
                collapsedLimit={tokenId ? 6 : 12}
                tokenId={tokenId}
                onSelect={handleTokenSubmit}
                onBecomeVisible={handleMintPreviewVisible}
                sort={mintGallerySort}
                onSort={setMintGallerySort}
                search={(
                  <div className="token-search">
                    <label className="token-search-label" htmlFor="afa-token-id">Token ID</label>
                    <div className="token-input-container">
                      <div className="token-input-row">
                        <svg className="token-search-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
                          <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          value={tokenInput}
                          onChange={handleTokenInput}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              handleTokenSubmit(tokenInput);
                            }
                          }}
                          id="afa-token-id"
                          size={6}
                          placeholder="0–9999"
                          className={`token-input ${isCheckingMint ? 'checking' : ''}`}
                          disabled={isCheckingMint}
                          aria-busy={isCheckingMint}
                        />
                        <button
                          type="button"
                          className="token-go"
                          onClick={() => handleTokenSubmit(tokenInput)}
                          disabled={isCheckingMint || !String(tokenInput || '').trim()}
                          aria-label="Load this token"
                        >
                          Go
                        </button>
                      </div>
                      {showSuggestions && (
                        <div className="suggestions-container" ref={suggestionsRef} aria-label="Matching token IDs">
                          {suggestions.map((suggestion, index) => (
                            <button
                              type="button"
                              key={suggestion}
                              className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                              onClick={() => handleSuggestionClick(suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              />
            </div>
          </details>

          {tokenId && (
            <>
              <details className="panel-group" open>
                <summary className="panel-summary">Style</summary>
                <div className="panel-body">
                  <div className="dropdown-container">
                    <div className="dropdown-section">
                        <label className="dropdown-header" htmlFor="outfit-select">Outfit</label>
                        <div className="dropdown-with-arrows">
                            <select 
                                id="outfit-select" 
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
                            </select>
                        </div>
                    </div>
                </div>
                </div>
              </details>

              <details className="panel-group" open>
                <summary className="panel-summary">Accessories</summary>
                <div className="panel-body">
                  <div className="dropdown-container dropdown-container--grid">
                    <div className="dropdown-section">
                        <label className="dropdown-header" htmlFor="mouth-select">Mouth</label>
                        <div className="dropdown-with-arrows">
                            <select 
                                id="mouth-select" 
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
                        </div>
                    </div>
                    <div className="dropdown-section">
                        <label className="dropdown-header" htmlFor="hat-select">Hat</label>
                        <div className="dropdown-with-arrows">
                            <select 
                                id="hat-select" 
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
                        </div>
                    </div>
                    <div className="dropdown-section">
                        <label className="dropdown-header" htmlFor="eyes-select">Eyes</label>
                        <div className="dropdown-with-arrows">
                            <select 
                                id="eyes-select" 
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
                        </div>
                    </div>
                    <div className="dropdown-section">
                        <label className="dropdown-header" htmlFor="hand-select">Hand</label>
                        <div className="dropdown-with-arrows">
                            <select 
                                id="hand-select" 
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
                        </div>
                    </div>
                {/* <div className="dropdown-section">
                    <h3 className="dropdown-header">Club Assets</h3>
                    <div className="dropdown-with-arrows">
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
                      <label className="dropdown-header" htmlFor="extra-select">Extra</label>
                      <div className="dropdown-with-arrows">
                        <select
                          id="extra-select"
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
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </>
          )}

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