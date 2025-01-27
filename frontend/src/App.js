import React, { useState, useEffect } from 'react';
import './App.css';
import Loader from './Loader';
import { ethers } from 'ethers';

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
    const [eliteTokenIds, setEliteTokenIds] = useState([]); 
    const [isEliteEligible, setIsEliteEligible] = useState(false);
    const [dubaiTokenIds, setDubaiTokenIds] = useState([]); 
    const [isDubaiEligible, setIsDubaiEligible] = useState(false);
    const [tokenId, setTokenId] = useState('');
    const { isMinted, isChecking } = useMintStatus(tokenId);
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
    const [isLoading, setIsLoading] = useState(false);
    const rgbToCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    
    useEffect(() => {
        setIsLoading(true);
        const fetchTokenIds = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://afa-editor.ew.r.appspot.com'}/api/token-ids`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                const sortedTokenIds = data.map(id => parseInt(id)).sort((a, b) => a - b);
                // setTokenIds(sortedTokenIds);
            } catch (error) {
                console.error('Error fetching token IDs:', error);
                // Handle error appropriately
            } finally {
                setIsLoading(false);
            }
        };

        fetchTokenIds();
    }, []);
    useEffect(() => {
        if (tokenId) {
            fetchAsset(tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
        }
    }, [tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset]);
    useEffect(() => {
        if (thirdAsset === 'selfie') {
            setSecondAsset('');
            setMouthAsset('');
            setSelectedAsset('');
        }
    }, [thirdAsset]);
    
    // Fetches elite token IDs once when the component mounts
    useEffect(() => {
        const fetchEliteTokens = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://afa-editor.ew.r.appspot.com'}/api/elite-token-ids`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                setEliteTokenIds(data);
            } catch (error) {
                console.error('Error fetching elite token IDs:', error);
                // Handle error appropriately
            }
        };

        fetchEliteTokens();
    }, []);
    // Fetches dubai token IDs once when the component mounts
    useEffect(() => {
        console.log('Fetching dubai token IDs...');
        const url = 'https://afa-editor.ew.r.appspot.com/api/dubai-token-ids';
        fetch(url)
            .then(response => response.json())
            .then(data => {
                console.log('Parsed JSON data:', data);
                setDubaiTokenIds(data);
            })
            .catch(error => console.error('Error fetching dubai token IDs:', error));
    }, []);
    
    const fetchAsset = (newTokenId, newSelectedAsset, newSecondAsset, newThirdAsset, newMouthAsset, newHatAsset, newEyesAsset, newClubAsset) => {
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
        else fetchAsset(tokenId, selectedAsset, newSecondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
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

    const handleClubAssetChange = event => {
        const newClubAsset = event.target.value;
        setClubAsset(newClubAsset);
    
        if (newClubAsset === ('elite')) {
            setSecondAsset('');
            setHatAsset('');
            setEyesAsset('');
            setSelectedAsset('');    
            
            // Call fetchAsset with the current clubAsset state
            setTimeout(() => {
                fetchAsset(tokenId, '', '', '', '', '', '', newClubAsset);
            }, 0);
        }
        else if (newClubAsset === ('dubai')) {
            setSecondAsset('');
            setHatAsset('');            
            // Call fetchAsset with the current clubAsset state
            setTimeout(() => {
                fetchAsset(tokenId, selectedAsset, '', thirdAsset, mouthAsset, '', eyesAsset, newClubAsset);
            }, 0);
        }
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
    const handleTokenChange = async (event) => {
        const newTokenId = event.target.value;
        console.log(`Token ID selected: ${newTokenId}`);
        setTokenId(newTokenId);

        if (!newTokenId) return;

        // Check if token is minted
        const { isMinted } = await checkMintStatus(newTokenId);
        if (!isMinted) {
            console.log('Token not minted');
            return;
        }

        // Convert both values to strings to ensure proper comparison
        const newIsEliteEligible = eliteTokenIds.includes(newTokenId);
        console.log(`Is token ID ${newTokenId} elite eligible: ${newIsEliteEligible}`);
        setIsEliteEligible(newIsEliteEligible);

        if (clubAsset === 'elite' && !newIsEliteEligible) {
            setClubAsset('');
        }

        const newIsDubaiEligible = dubaiTokenIds.includes(newTokenId);
        console.log(`Is token ID ${newTokenId} dubai eligible: ${newIsDubaiEligible}`);
        setIsDubaiEligible(newIsDubaiEligible);

        if (clubAsset === 'dubai' && !newIsDubaiEligible) {
            setClubAsset('');
        }

        if (!selectedAsset && !secondAsset && !thirdAsset && !mouthAsset && !hatAsset && !eyesAsset && !clubAsset) {
            fetchAsset(newTokenId, 'AFA', '', '');
            setSelectedAsset('AFA');
        } else {
            fetchAsset(newTokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, '');
        }
    };
    const handleAssetChange = event => {
        setSelectedAsset(event.target.value);
        fetchAsset(tokenId, event.target.value, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset);
    };

    const checkMintStatus = async (tokenId) => {
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
                return { isMinted: true };
            } catch (error) {
                return { isMinted: false };
            }
        } catch (error) {
            console.error('Error checking mint status:', error);
            return { isMinted: false };
        }
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
                            {Array.from({ length: 10000 }, (_, i) => (
                                <option key={i} value={i}>{i}</option>
                            ))}
                        </select>
                    </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Outfit</h3>
                    <select value={secondAsset} onChange={handleSecondAssetChange} className="dropdown" disabled={!tokenId || thirdAsset === 'selfie' || clubAsset}>
                        <option value="">Select</option>
                        <option value="sweater">Christmas sweater</option>
                        {/* <option value="bape_blue_shirt">BAPE® x BAYC Hawaiian Shirt Blue</option> */}
                        <option value="apefest_merch">Apefest Merch</option>
                        <option value="tt_hoodie">Top Trader Hoodie</option>
                        <option value="bimmer_jacket">Bimmer Jacket</option>
                        <option value="apechain_hoodie_black">Apechain Hoodie Black</option>
                        <option value="apechain_hoodie_orange">Apechain Hoodie Orange</option>
                        <option value="apechain_hoodie_blue">Apechain Hoodie Blue</option>
                        <option value="apefest_jacket">Apefest Jacket</option>
                        {/* <option value="bape_coach">BAPE® x BAYC Coach Jacket</option> */}
                        {/* <option value="bape_hoodie_green">BAPE® x BAYC Hoodie Green</option> */}
                        {/* <option value="bape_hoodie_red">BAPE® x BAYC Hoodie Red</option> */}
                        {/* <option value="bape_shirt">Baby Milo Shirt</option> */}
                        <option value="cheetah_hoodie">Cheetah Hoodie</option>
                        <option value="naked">No Clothes</option>
                        <option value="french_stripes">French Stripes</option>
                        <option value="cats_shirt">Cool Cats Shirt</option>
                        <option value="singe_hoodie">Singe Hoodie</option>
                        <option value="singe_hoodie_glow">Singe Hoodie Glow</option>
                        <option value="applied_primate_coat">Applied Primate Lab Coat</option>
                        {/* <option value="adidas_hoodie">Adidas Hoodie</option> */}
                        {/* <option value="adidas_yellow">Adidas Track</option> */}
                        <option value="btc_hoodie">BTC Hoodie</option>
                        {/* <option value="magic_eden">Magic Eden</option> */}
                        <option value="jacket">Jacket</option>
                        <option value="blazer">Blazer</option>
                        {/* <option value="49ers">Super Bowl 49ers</option>
                        <option value="chiefs">Super Bowl Chiefs</option> */}
                    </select>
                </div>
            </div>

      <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Mouth</h3>
                    <select value={mouthAsset} onChange={handleMouthAssetChange} className="dropdown" disabled={!tokenId  || clubAsset === 'elite'}>
                        <option value="">Select</option>
                        <option value="tree">Christmas Tree</option>
                        <option value="apechain_grin">Apechain Grin</option>
                        <option value="lollipop">Lollipop</option>
                        <option value="banana_punch_gm">Banana Punch GM</option>
                        <option value="banana_smile">Banana Smile</option>
                        <option value="doodles_rainbow">Doodles Rainbow</option>
                        <option value="big_smile">Big Smile</option>
                    </select>
                </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Hat</h3>
                    <select value={hatAsset} onChange={handleHatAssetChange} className="dropdown" disabled={!tokenId || clubAsset || secondAsset ==  'singe_hoodie_glow' ||  secondAsset ==  'singe_hoodie'}>
                        <option value="">Select</option>
                        <option value="christmas_hat">Christmas Hat</option>
                        <option value="christmas_hat2">Christmas Hat 2</option>
                        <option value="christmas_hat3">Christmas Hat 3</option>
                        <option value="designer_toshiro_hat">Designer Toshiro</option>
                        <option value="apechain_cap">Apechain Hat</option>
                        <option value="apechain_hat_blue">Apechain Hat Blue</option>
                        <option value="apechain_hat_orange">Apechain Hat Orange</option>
                        <option value="beret">Béret</option>
                        <option value="cats_hat">Cool Cats</option>
                        <option value="plunger">Dookey Dash</option>
                        <option value="pudgy_hat">Pudgy Penguins Hat</option>
                        <option value="pudgy_hat2">Pudgy Penguins Hat 2</option>
                        <option value="glitter_cowboy_hat">Glitter Cowboy Hat</option>
                    </select>
                </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Eyes</h3>
                    <select value={eyesAsset} onChange={handleEyesAssetChange} className="dropdown" disabled={!tokenId || clubAsset === 'elite'}>
                        <option value="">Select</option>
                        <option value="apecoin_glasses">Apecoin Glasses</option>
                        <option value="apechain_glasses">Apechain Glasses</option>
                        <option value="vision_pro">Vision Pro</option>
                        <option value="dookey_eyes">Dookey Dash</option>
                        <option value="btc_eyes">BTC Coin</option>
                        <option value="star_glasses">Star Glasses</option>
                    </select>
                </div>
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Extra</h3>
                    <select value={thirdAsset} onChange={handleThirdAssetChange} className="dropdown" disabled={!tokenId || clubAsset === 'elite'}>
                        <option value="">Select</option>
                        <option value="top_trader">Top Trader</option>
                        <option value="top_trader_red">Top Trader Red</option>
                        <option value="unclogged">Unclogged</option>
                        <option value="hex_dark">Hex Dark</option>
                        <option value="hex_light">Hex Light</option>
                        <option value="small_ape" disabled={secondAsset ==  'singe_hoodie_glow' || selectedAsset == 'dookie_dash'}>Tiny AFA</option>
                        <option value="confetti">Confetti</option>
                        <option value="snow">Snow</option>
                        <option value="selfie" disabled={clubAsset === 'dubai'}>Selfie Head</option>
                        <option value="transparent">Transparent Background</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>
            </div>
            <div className="dropdown-container">
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Hand</h3>
                    <select value={selectedAsset} onChange={handleAssetChange} className="dropdown" disabled={!tokenId || thirdAsset === 'selfie' || clubAsset === 'elite'}>
                        <option value="">Select</option>
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
                        {/* <option value="shoe">BAPE® x BAYC Shoe</option> */}
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
                <div className="dropdown-section">
                    <h3 className="dropdown-header">Club Assets</h3>
                    <select value={clubAsset} onChange={handleClubAssetChange} className="dropdown" disabled={!tokenId}>
                        <option value="">Select</option>
                        <option value="dubai" disabled={!isDubaiEligible}>Dubai Ape Yacht Club</option>
                        <option value="elite" disabled={!isEliteEligible}>Elite Apes HK</option>
                    </select>
          </div>
      </div>
      <Footer />
    </div>
  );
}
export default App;