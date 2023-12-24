
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

function getContrastYIQ(rgb) {
    const yiq = ((rgb[0]*299)+(rgb[1]*587)+(rgb[2]*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function App() {
    const [tokenIds, setTokenIds] = useState([]);
    const [tokenId, setTokenId] = useState('');
    const [selectedAsset, setSelectedAsset] = useState('');
    const [secondAsset, setSecondAsset] = useState('');
    const [thirdAsset, setThirdAsset] = useState('');
    const [mouthAsset, setMouthAsset] = useState('');
    const [hatAsset, setHatAsset] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState('./overview.gif'); // New state for the current image URL
    const [showLoader, setShowLoader] = useState(false); // State to control loader visibility
    const [fade, setFade] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const rgbToCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    
    useEffect(() => {
        fetch(`https://afa-editor.ew.r.appspot.com/api/token-ids`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                const sortedTokenIds = data.map(id => parseInt(id)).sort((a, b) => a - b);
                setTokenIds(sortedTokenIds);
            })
            .catch(error => console.error('Error:', error));
    }, []);

    useEffect(() => {
        if (tokenId) {
            fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset);
        }
    }, [tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset]);
    
    const applyFadeEffect = () => {
        setFade(true);
        setTimeout(() => setFade(false), 500); // Adjust this timeout to match your CSS transition
    };
    
    const fetchAsset = (newTokenId, newSelectedAsset, newSecondAsset, newThirdAsset, newMouthAsset, newHatAsset) => {
        setShowLoader(true);
    
        const queryParams = new URLSearchParams({
            tokenId: newTokenId,
            assetType: newSelectedAsset || '',
            secondAssetType: newSecondAsset || '',
            thirdAssetType: newThirdAsset || '',
            mouthAssetType: newMouthAsset || '',
            hatAssetType: newHatAsset || ''
        });
    
        // Start fade-out effect
        setFade('fade-out');
    
        // Construct the URL with query parameters
        const url = `https://afa-editor.ew.r.appspot.com/api/get-asset?${queryParams.toString()}`;
    
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
            const bgColor = rgbToCss(data.background_color);
            const textColor = getContrastYIQ(data.background_color);
            // Apply fade effect
            document.body.classList.add('body-background-fade');
            // Change background color
            document.body.style.backgroundColor = bgColor;
            document.documentElement.style.setProperty('--text-color', textColor);
            // Remove fade effect after transition
            setTimeout(() => {
                document.body.classList.remove('body-background-fade');
            }, 500); // Match this timeout with the transition duration in CSS
        })
        .catch(error => console.error('Error fetching background color:', error))
        .finally(() => setIsLoading(false));
    }
    
    const handleSecondAssetChange = event => {
        const newSecondAsset = event.target.value;
        setSecondAsset(newSecondAsset);
        fetchAsset(tokenId, selectedAsset, newSecondAsset, thirdAsset, mouthAsset, hatAsset);
    };
    
    const handleMouthAssetChange = event => {
        const newMouthAsset = event.target.value;
        setMouthAsset(newMouthAsset);
        fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, newMouthAsset, hatAsset);
    };

    const handleHatAssetChange = event => {
        const newHatAsset = event.target.value;
        setHatAsset(newHatAsset);
        fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, newHatAsset);
    };
    
    const handleThirdAssetChange = event => {
        const newThirdAsset = event.target.value;
        setThirdAsset(newThirdAsset);
    
        if (newThirdAsset === 'selfie') {
            setSecondAsset('');
            setMouthAsset('');
            setSelectedAsset('');    
            // Call fetchAsset after a slight delay to ensure state updates have been processed
            setTimeout(() => {
                fetchAsset(tokenId, '', '', newThirdAsset, hatAsset);
            }, 0);
        }
    };

    const handleTokenChange = event => {
        const newTokenId = event.target.value;
        setTokenId(newTokenId);
    
        // Check if the tokenId has been selected before
        if (!selectedAsset && !secondAsset && !thirdAsset && !mouthAsset&& !hatAsset ) {
            // If selecting tokenId for the first time, default the clothes to "AFA"
            fetchAsset(newTokenId, 'AFA', '', '');
            setSelectedAsset('AFA');
        } else {
            // Maintain the current state of selected assets
            fetchAsset(newTokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset);
        }
    };
    const handleAssetChange = event => {
        setSelectedAsset(event.target.value);
        fetchAsset(tokenId, event.target.value, secondAsset, thirdAsset, mouthAsset, hatAsset);
    };
    return (
        <div className="App">
            <Banner />
            <div id="asset-display" className={fade ? 'fade-effect' : ''}>
                <img src={currentImageUrl} alt="Ape" style={{ maxWidth: '100%', height: 'auto' }} />
                {showLoader && 
                    <div className="loader">
                        processing new perspective...
                    </div>
                }
            </div>

            <div className="dropdown-container">
                    <div className="dropdown-section">
                        <h3 className="dropdown-header">Select AFA</h3>
                        <select value={tokenId} onChange={handleTokenChange} className="dropdown">
                            <option value="">Select Token ID</option>
                            {tokenIds.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Outfit</h3>
                    <select value={secondAsset} onChange={handleSecondAssetChange} className="dropdown" disabled={!tokenId || thirdAsset === 'selfie'}>
                        <option value="">Select</option>
                        <option value="AFA">AFA</option>
                        <option value="sweater">Christmas sweater</option>
                        <option value="bape_coach">Bape Coach Jacket</option>
                        <option value="bape_hoodie_red">Bape Hoodie Red</option>
                        <option value="bape_hoodie_green">Bape Hoodie Green</option>
                        <option value="bape_shirt">Baby Milo Shirt</option>
                        <option value="adidas_hoodie">Adidas Hoodie</option>
                        <option value="adidas_yellow">Adidas Track</option>
                        <option value="jacket">Jacket</option>
                        <option value="naked">No Clothes</option>
                    </select>
                </div>
            </div>
            
            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Mouth</h3>
                    <select value={mouthAsset} onChange={handleMouthAssetChange} className="dropdown" disabled={!tokenId || thirdAsset === 'selfie'}>
                        <option value="">Select</option>
                        <option value="big_smile">Big Smile</option>
                        <option value="tree">Christmas Tree</option>
                    </select>
                </div>

                <div className="dropdown-section">
                    <h3 className="dropdown-header">Hat</h3>
                    <select value={hatAsset} onChange={handleHatAssetChange} className="dropdown" disabled={!tokenId}>
                        <option value="">Select</option>
                        <option value="christmas_hat">Christmas Hat</option>
                    </select>
                </div>
            </div>

            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Hand</h3>
                    <select value={selectedAsset} onChange={handleAssetChange} className="dropdown" disabled={!tokenId || thirdAsset === 'selfie'}>
                        <option value="">Select</option>
                        <option value="cheers">Cheers</option>
                        <option value="peace">Peace</option>
                        <option value="shoe">BAPE shoe</option>
                    </select>
                </div>

                <div className="dropdown-section">
                    <h3 className="dropdown-header">Extra</h3>
                    <select value={thirdAsset} onChange={handleThirdAssetChange} className="dropdown" disabled={!tokenId}>
                        <option value="">Select</option>
                        <option value="snow">Snow</option>
                        <option value="verified">Verified</option>
                        <option value="transparent">Transparent Background</option>
                        <option value="selfie">Selfie Head</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
export default App;