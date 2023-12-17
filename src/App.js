import React, { useState, useEffect } from 'react';
import './App.css';
import Loader from './Loader';

function Banner() {
    return (
        <div className="banner">
            <img src="./logo.png" alt="Logo" className="banner-logo" />
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
    const [imageUrl, setImageUrl] = useState('./face.png');
    const [fade, setFade] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const rgbToCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    useEffect(() => {
        fetch('/api/token-ids')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                setTokenIds(data); // Assuming data is an array of token IDs
            })
            .catch(error => console.error('Error:', error));
    }, []);

    const fetchAsset = (newTokenId, newSelectedAsset, newSecondAsset, newThirdAsset) => {
        if (newTokenId && (newSelectedAsset || newSecondAsset || newThirdAsset)) {
            setIsLoading(true);

            const assetTypeParam = newSelectedAsset ? `&assetType=${newSelectedAsset}` : '';
            const secondAssetTypeParam = newSecondAsset ? `&secondAssetType=${newSecondAsset}` : '';
            const thirdAssetTypeParam = newThirdAsset ? `&thirdAssetType=${newThirdAsset}` : '';

            fetch(`/api/get-asset?tokenId=${newTokenId}${assetTypeParam}${secondAssetTypeParam}${thirdAssetTypeParam}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.blob();
                })
                .then(blob => {
                    const newImageUrl = URL.createObjectURL(blob);
                    setFade(false); // Reset fade effect
                    setImageUrl(newImageUrl); // Update image URL immediately

                    // Fetch background color
                    fetch(`/api/get-background-color?tokenId=${newTokenId}`)
                        .then(response => response.json())
                        .then(data => {
                            const bgColor = rgbToCss(data.background_color);
                            const textColor = getContrastYIQ(data.background_color);
                            document.body.style.backgroundColor = bgColor;
                            document.documentElement.style.setProperty('--text-color', textColor); // Set CSS variable
                        })
                        .catch(error => console.error('Error fetching background color:', error));
                })
                .catch(error => {
                    console.error('Error:', error);
                    setImageUrl('./face.png');
                })
                .finally(() => setIsLoading(false));
        }
    };

    const handleSecondAssetChange = event => {
        const newSecondAsset = event.target.value;
        setSecondAsset(newSecondAsset);
        setTimeout(() => fetchAsset(tokenId, selectedAsset, newSecondAsset, thirdAsset), 0);
    };

    const handleThirdAssetChange = event => {
        const newThirdAsset = event.target.value;
        setThirdAsset(newThirdAsset);
        setTimeout(() => fetchAsset(tokenId, selectedAsset, secondAsset, newThirdAsset), 0);
    };

    const handleTokenChange = event => {
        const newTokenId = event.target.value;
        setTokenId(newTokenId);
        const defaultAsset = "AFA";
        if (tokenIds.includes(newTokenId)) {
            setSelectedAsset(defaultAsset);
            setSecondAsset('');
            setThirdAsset('');
            fetchAsset(newTokenId, defaultAsset, '', '');
        }
    };

    const handleAssetChange = event => {
        setSelectedAsset(event.target.value);
        fetchAsset(tokenId, event.target.value, secondAsset, thirdAsset);
    };

    return (
        <div className="App">
            <Banner />
            <div id="asset-display" className={fade ? 'fade-effect' : ''} style={{ backgroundColor: isLoading ? document.body.style.backgroundColor : 'transparent' }}>
                {isLoading ? (
                    <Loader />
                ) : (
                    imageUrl && <img src={imageUrl} alt="Ape" style={{ maxWidth: '100%', height: 'auto' }} />
                )}
            </div>
            <div className="dropdown-container">
                {tokenIds.length > 0 && (
                    <div className="dropdown-section">
                        <h3 className="dropdown-header">Select AFA</h3>
                        <select value={tokenId} onChange={handleTokenChange} className="dropdown">
                            <option value="">Select Token ID</option>
                            {tokenIds.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                )}
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Outfit</h3>
                    <select value={secondAsset} onChange={handleSecondAssetChange} className="dropdown">
                        <option value="">Select</option>
                        <option value="AFA">AFA</option>
                        <option value="bape_coach">Bape Coach Jacket</option>
                        <option value="bape_hoodie_red">Bape Hoodie Red</option>
                        <option value="bape_hoodie_green">Bape Hoodie Green</option>
                        <option value="adidas_hoodie">Adidas Hoodie</option>
                        <option value="adidas_yellow">Adidas Track</option>
                        <option value="sweater">Christmas sweater</option>
                    </select>
                </div>
            </div>
            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Extra</h3>
                    <select value={thirdAsset} onChange={handleThirdAssetChange} className="dropdown">
                        <option value="">Select</option>
                        <option value="snow">Snow</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>
            </div>
            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">First Hand</h3>
                    <select value={selectedAsset} onChange={handleAssetChange} className="dropdown">
                        <option value="">Select</option>
                        <option value="cheers">Cheers</option>
                        <option value="peace">Peace</option>
                        <option value="shoe">BAPE shoe</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

export default App;
