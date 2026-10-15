import { holdBackground, releaseBackground, backgroundHeld, onBackgroundRelease, fetchWithTimeout } from './utils/apiLane';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import { getAllTransactions, getMintedTokenIdsNewestFirst, checkTokenMintStatus } from './services/etherscanService';
import { debug, error as logError } from './utils/debug';
import AssetStrip from './AssetStrip';
import { track } from './utils/track';
import { buildShareText, buildXIntentUrl } from './utils/shareText';
import { assetLabel } from './utils/assetLabels';
import { renderApefestLaunch } from './utils/apefestLaunch';
import { drawApefestText, canvasToBlob, loadImage, loadApefestFonts, APEFEST_CRT, APEFEST_PAGE_SCAN, APEFEST_JUMP, buildApefestShareText, apefestUnmintedText } from './utils/apefest';

// ApeFest (10.17): while true, the "Add frame" button becomes the ApeFest toggle.
// Set to false after ApeFest to restore "Add frame"; nothing else needs to change.
const APEFEST_ENABLED = true;
// ApeFest default period. Official ApeFest 2026 weekend: Oct 15-18 (apefest.com, @BoredApeYC).
// Rollback 2 days after the end: from 20.10.2026 00:00 Berlin the hero shows the normal look again,
// 'OPEN YOUR APE' is back and the mode is opt-in only (toggle). Overrides for testing:
// ?apefestDefault=on|off, or env REACT_APP_APEFEST_DEFAULT=on|off.
export const APEFEST_DEFAULT_UNTIL = '2026-10-20T00:00:00+02:00';
function readApefestDefault() {
    const norm = (v) => (v === 'on' || v === 'off' ? v : null);
    try {
        const q = norm(new URLSearchParams(window.location.search).get('apefestDefault'));
        if (q) return q === 'on';
    } catch (e) { /* no window */ }
    const env = norm(process.env.REACT_APP_APEFEST_DEFAULT);
    if (env) return env === 'on';
    return Date.now() < Date.parse(APEFEST_DEFAULT_UNTIL);
}
const APEFEST_DEFAULT_ON = APEFEST_ENABLED && readApefestDefault();
// After the rollback the opt-in uses its own key, so the auto-on '1' from ApeFest week doesn't carry over.
const APEFEST_STORE_KEY = APEFEST_DEFAULT_ON ? 'afa.apefest' : 'afa.apefest.optin';

const DEFAULT_API_URL = 'https://afa-editor.ew.r.appspot.com';
const MINT_SITE_URL = 'https://www.apefacingapes.com';
const GRID_VIEW_URL = 'https://afa-mint-progress.vercel.app';
const PREVIEW_CONCURRENCY = 2;
const PREVIEW_RETRIES = 2;
const PREVIEW_RETRY_COOLDOWN_MS = 15000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SUGGESTION_LIMIT = 20;
// Phillipp 14.10: all 'Mint to reveal' CTAs go to /claim (no id param; the site doesn't read it).
const MINT_URL = 'https://www.apefacingapes.com/claim?utm_source=afa-editor&utm_medium=referral&utm_campaign=unminted-preview';
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
            <a href="/" className="site-bar-brand" aria-label="AFA Editor home">
                <img src="./logo-mark.png" alt="Ape Facing Apes" width="240" height="207" className="site-bar-logo" />
                <span className="site-bar-title">Editor</span>
            </a>
            <a href={GRID_VIEW_URL} target="_blank" rel="noopener noreferrer" className="site-bar-link">
                Mint Progress
            </a>
        </header>
    );
}

// Hero auto-swap (Design spec 14.10). One random MINTED ape per load stays as base;
// one trait layer changes per step, cumulative, then hold and reset.
const HERO_STEP_MS = 1200;
const HERO_HOLD_MS = 1000;
// Curated: strong silhouettes only.
const HERO_POOL = {
    hat: ['glitter_cowboy_hat', 'german_ape_club_hat', 'beret', 'pudgy_hat', 'cats_hat', 'vegas'],
    outfit: ['vegas', 'cheetah_hoodie', 'french_stripes', 'blazer', 'apefest_jacket'],
    eyes: ['star_glasses', 'vision_pro', 'btc_eyes'],
    hand: ['banana', 'basketball', 'candle', 'fireworks', 'gm_espresso', 'balloon_moon'],
    mouth: ['lollipop', 'banana_smile', 'big_smile'],
};
const HERO_ORDER = ['hat', 'outfit', 'eyes', 'hand', 'hat', 'mouth'];
const HERO_PARAM = { hat: 'hatAssetType', outfit: 'secondAssetType', eyes: 'eyesAssetType', hand: 'assetType', mouth: 'mouthAssetType' };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Builds the 6 cumulative looks for one cycle: [{ look, cat, value }].
function buildHeroSteps() {
    const look = {};
    const usedHat = new Set();
    return HERO_ORDER.map((cat) => {
        let options = HERO_POOL[cat];
        if (cat === 'hat') options = options.filter((v) => !usedHat.has(v));
        const value = pick(options);
        if (cat === 'hat') usedHat.add(value);
        look[cat] = value;
        return { look: { ...look }, cat, value };
    });
}
const lookParams = (look) => {
    const out = {};
    Object.entries(look || {}).forEach(([cat, v]) => { if (v) out[HERO_PARAM[cat]] = v; });
    if (!out.assetType) out.assetType = 'AFA';
    return out;
};
// /api/get-asset answers with Cache-Control: no-cache, so a plain <img> preload would be
// fetched again on display. Preload into a blob URL instead and show that (instant swap).
const preloadImage = async (url) => {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blobUrl = URL.createObjectURL(await res.blob());
        const img = new Image();
        img.src = blobUrl;
        if (img.decode) await img.decode().catch(() => {});
        return blobUrl;
    } catch (e) {
        return url;
    }
};

// Hero in ApeFest mode (Phillipp 15.10): every frame gets the launch look. Server asset with a
// transparent background -> launch render in the worker -> exact pixels as BMP blob URL (no PNG encode).
// The worker is serial; renders queue up while the previous cycle is on screen.
const heroApefestFrame = async (url) => {
    const u = new URL(url, window.location.href);
    u.searchParams.set('thirdAssetType', 'transparent');
    const res = await fetch(u.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const canvas = await renderApefestLaunch(await res.blob(), 'square');
    const blob = canvas.apefestBmp || await canvasToBlob(canvas);
    return URL.createObjectURL(blob);
};

function Hero({ apiBase, mintedIds, onSubmitId, onOpenLook, onExplore, apefest = false, explore = false }) {
    const [value, setValue] = useState('');
    const [heroId, setHeroId] = useState(null);
    useEffect(() => {
        if (heroId == null && mintedIds.length) setHeroId(pick(mintedIds));
    }, [heroId, mintedIds]);
    const urlFor = useCallback((look) => {
        const q = new URLSearchParams({ tokenId: String(heroId), ...lookParams(look) });
        return `${apiBase}/api/get-asset?${q.toString()}`;
    }, [apiBase, heroId]);

    const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const [steps, setSteps] = useState(null);      // current cycle
    const [ready, setReady] = useState(false);     // all 6 preloaded
    const [stepIdx, setStepIdx] = useState(-1);    // -1 = original ape
    const [layers, setLayers] = useState({ a: null, b: null, front: 'a' });
    const [stopped, setStopped] = useState(false);
    const hoverRef = useRef(false);
    const inViewRef = useRef(true);
    const stageRef = useRef(null);

    // Cycles: build + preload all 6 looks first. The next cycle preloads during the
    // current one, so the reset to the original ape is short.
    const nextCycleRef = useRef(null);
    const baseSrcRef = useRef(null);
    const prevStepsRef = useRef(null);
    const baseReadyRef = useRef(null);
    const prepareCycle = useCallback(() => {
        const next = buildHeroSteps();
        const load = apefest
            ? (url) => heroApefestFrame(url).catch(() => preloadImage(url))
            : preloadImage;
        const done = (apefest && baseReadyRef.current ? baseReadyRef.current : Promise.resolve())
            .then(() => Promise.all(next.map((st) => load(urlFor(st.look)))))
            .then((srcs) => next.map((st, i) => ({ ...st, src: srcs[i] })));
        nextCycleRef.current = done;
        return done;
    }, [urlFor, apefest]);
    const startCycle = useCallback(async () => {
        const pending = nextCycleRef.current || prepareCycle();
        nextCycleRef.current = null;
        setReady(false);
        const next = await pending;
        // Free the previous cycle's blob URLs once they are off screen.
        const old = prevStepsRef.current;
        prevStepsRef.current = next;
        if (old) window.setTimeout(() => old.forEach((st) => { if (st.src && st.src.startsWith('blob:')) URL.revokeObjectURL(st.src); }), 3000);
        setSteps(next);
        setReady(true);
    }, [prepareCycle]);

    useEffect(() => {
        if (heroId == null) return;
        setStepIdx(-1);
        nextCycleRef.current = null;
        let cancelled = false;
        if (apefest) {
            // ApeFest: never show the plain ape; the base frame renders first, the cycle after it.
            baseSrcRef.current = null;
            setLayers({ a: null, b: null, front: 'a' });
            baseReadyRef.current = heroApefestFrame(urlFor(null))
                .catch(() => preloadImage(urlFor(null)))
                .then((src) => {
                    baseSrcRef.current = src;
                    if (!cancelled) setLayers((prev) => (prev.a || prev.b ? prev : { a: src, b: null, front: 'a' }));
                });
        } else {
            baseReadyRef.current = null;
            baseSrcRef.current = urlFor(null);
            setLayers({ a: baseSrcRef.current, b: null, front: 'a' });
            preloadImage(urlFor(null)).then((src) => { baseSrcRef.current = src; });
        }
        startCycle();
        return () => { cancelled = true; };
    }, [heroId, urlFor, startCycle, apefest]);

    // Reduced motion: show the full look statically.
    useEffect(() => {
        if (reduceMotion && ready && steps) {
            setStepIdx(steps.length - 1);
            setLayers({ a: steps[steps.length - 1].src || urlFor(steps[steps.length - 1].look), b: null, front: 'a' });
        }
    }, [reduceMotion, ready, steps, urlFor]);

    // Pause when out of viewport.
    useEffect(() => {
        const el = stageRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return undefined;
        const io = new IntersectionObserver(([e]) => { inViewRef.current = e.isIntersecting; }, { threshold: 0.1 });
        io.observe(el);
        return () => io.disconnect();
    }, [heroId]);

    useEffect(() => {
        if (reduceMotion || stopped || !ready || !steps) return undefined;
        const isLast = stepIdx === steps.length - 1;
        const delay = isLast ? HERO_STEP_MS + HERO_HOLD_MS : HERO_STEP_MS;
        let timer = null;
        const tick = () => {
            if (document.hidden || hoverRef.current || !inViewRef.current) { timer = window.setTimeout(tick, 250); return; }
            const show = (url) => setLayers((prev) => (prev.front === 'a' ? { ...prev, b: url, front: 'b' } : { ...prev, a: url, front: 'a' }));
            if (isLast) {
                // Reset to the original ape, then prepare a fresh cycle.
                show(baseSrcRef.current || urlFor(null));
                setStepIdx(-1);
                startCycle();
            } else {
                show(steps[stepIdx + 1].src || urlFor(steps[stepIdx + 1].look));
                setStepIdx(stepIdx + 1);
                if (stepIdx + 1 === 2 && !nextCycleRef.current) prepareCycle();
            }
        };
        timer = window.setTimeout(tick, delay);
        return () => window.clearTimeout(timer);
    }, [reduceMotion, stopped, ready, steps, stepIdx, urlFor, startCycle, prepareCycle]);

    const current = steps && stepIdx >= 0 ? steps[stepIdx] : null;
    const currentLook = current ? current.look : {};
    const openThis = () => {
        if (heroId == null) return;
        setStopped(true);
        onOpenLook(String(heroId), currentLook);
    };
    const onStageClick = () => {
        // Mobile: tap stops the swap and opens this ape with the current look.
        if (window.matchMedia('(hover: none)').matches) openThis();
    };

    const submit = (e) => {
        e.preventDefault();
        const id = value.replace(/[^0-9]/g, '').slice(0, 4);
        if (explore) {
            // ApeFest CTA: typed ID, otherwise the ape currently shown in the hero.
            if (id) onExplore(id, null);
            else if (heroId != null) { setStopped(true); onExplore(String(heroId), currentLook); }
            return;
        }
        if (id) onSubmitId(id);
        else document.getElementById('hero-token-id')?.focus();
    };
    const tryRandom = () => {
        if (!mintedIds.length) return;
        const id = String(pick(mintedIds));
        setValue(id);
        onSubmitId(id);
    };
    const catLabel = { hat: 'Hat', outfit: 'Outfit', eyes: 'Eyes', hand: 'Hand', mouth: 'Mouth' };

    return (
        <section className="hero hero--try" aria-labelledby="hero-title">
            <div className="hero-copy">
                <p className="hero-eyebrow">AFA Editor</p>
                <h1 id="hero-title" className="hero-title">Dress up your Ape Facing Ape.</h1>
                <p className="hero-lede">Pick an ape, try on hats, outfits and effects.</p>
                <div className="hero-art">
                    <div className="hero-stage" ref={stageRef} onClick={onStageClick}
                        onMouseEnter={() => { hoverRef.current = true; }} onMouseLeave={() => { hoverRef.current = false; }}
                        data-apefest={apefest ? 'on' : undefined}
                        role="img" aria-label={heroId != null ? `AFA #${heroId} trying on traits` : 'Loading ape'}>
                        {layers.a && <img src={layers.a} alt="" width="480" height="480" decoding="sync"
                            className={`hero-ape ${layers.front === 'a' ? 'is-front' : ''}`} />}
                        {layers.b && <img src={layers.b} alt="" width="480" height="480" decoding="sync"
                            className={`hero-ape ${layers.front === 'b' ? 'is-front' : ''}`} />}
                    </div>
                    {heroId != null && (
                        <div className="hero-caption">
                            <span className="hero-caption-left">
                                <span className="hero-caption-name">AFA #{heroId}</span>
                                {reduceMotion ? (
                                    <span className="hero-caption-trait"> · styled</span>
                                ) : (
                                    <span className="hero-caption-trait" key={stepIdx}>
                                        {' · '}<span className="hero-caption-cat">{current ? catLabel[current.cat] : 'Original'}</span>
                                        {current && <>{' · '}<span className="hero-caption-val">{assetLabel(current.cat, current.value) || current.value}</span></>}
                                    </span>
                                )}
                            </span>
                            <button type="button" className="hero-style-link" onClick={openThis}>Style this ape →</button>
                        </div>
                    )}
                </div>
                <form className="hero-form" onSubmit={submit} role="search">
                    <label htmlFor="hero-token-id" className="visually-hidden">Ape ID</label>
                    <input id="hero-token-id" className="hero-input" inputMode="numeric" autoComplete="off"
                        placeholder="Ape ID, e.g. 2388" value={value}
                        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} />
                    {explore
                        ? <button type="submit" className="hero-cta hero-cta--apefest">Explore ApeFest mode</button>
                        : <button type="submit" className="hero-cta">Open your ape</button>}
                </form>
                <button type="button" className="hero-random" onClick={tryRandom} disabled={!mintedIds.length}>
                    or try a random one
                </button>
                <p className="hero-secondary">
                    Not minted yet? Try it on anyway. Your Ape stays blurred until it's yours.{' '}
                    <a href={MINT_URL} target="_blank" rel="noopener noreferrer" onClick={() => track('mint_cta_click')}>Mint to reveal</a> →
                </p>
            </div>
        </section>
    );
}

const TRAIT_CATEGORIES = [
    ['outfit', 'Outfit'], ['mouth', 'Mouth'], ['hat', 'Hat'], ['eyes', 'Eyes'], ['hand', 'Hand'], ['extra', 'Extra'],
];

// Mobile (<768) mini preview bar: appears under the site bar once <20% of the big preview is visible.
// ApeFest list (Phillipp 15.10: light-background tiles came out near-black): the old mean-luminance
// normalisation was dominated by the background, so apes on light backgrounds were darkened (k~0.73).
// Now like the launch pipeline: key the background (corner colour) to black and normalise the APE
// only (80th percentile -> TILE_APE_P80), giving a grey image the duotone maps evenly. Runs once per
// tile, queued one per task so a burst of loads never blocks a frame.
const TILE_APE_P80 = 0.95;
const tileQueue = [];
let tileQueueBusy = false;
function runTileQueue() {
    if (tileQueueBusy) return;
    const job = tileQueue.shift();
    if (!job) return;
    tileQueueBusy = true;
    setTimeout(() => {
        Promise.resolve().then(job).catch(() => null).then(() => { tileQueueBusy = false; runTileQueue(); });
    }, 0);
}
function processTileForApefest(img) {
    const W = Math.min(256, img.naturalWidth || 256);
    const c = document.createElement('canvas'); c.width = W; c.height = W;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, W, W);
    const im = x.getImageData(0, 0, W, W); const d = im.data;
    const cs = Math.max(2, Math.round(W * 0.06));
    const bgs = [[], [], []];
    for (const [ox, oy] of [[0, 0], [W - cs, 0]]) {
        for (let yy = oy; yy < oy + cs; yy += 1) for (let xx = ox; xx < ox + cs; xx += 1) {
            const i = (yy * W + xx) * 4; bgs[0].push(d[i]); bgs[1].push(d[i + 1]); bgs[2].push(d[i + 2]);
        }
    }
    const med = (a) => { a.sort((m, n) => m - n); return a[a.length >> 1]; };
    const bg = bgs.map(med);
    const n = W * W; const lum = new Float32Array(n); const mask = new Float32Array(n); const hist = new Uint32Array(256); let cnt = 0;
    for (let k = 0, i = 0; k < n; k += 1, i += 4) {
        const dist = (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2])) / 765;
        const m = Math.min(1, Math.max(0, (dist - 0.03) / 0.07));
        const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        lum[k] = L; mask[k] = m;
        if (m > 0.5) { hist[Math.min(255, Math.round(L * 255))] += 1; cnt += 1; }
    }
    let p80 = 0.7;
    if (cnt > n * 0.05) { let acc = 0; for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= cnt * 0.8) { p80 = v / 255; break; } } }
    const kf = Math.min(1.8, Math.max(0.8, TILE_APE_P80 / Math.max(0.05, p80)));
    for (let k = 0, i = 0; k < n; k += 1, i += 4) {
        const g = Math.round(255 * Math.min(1, lum[k] * kf) * mask[k]);
        d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return new Promise((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : null), 'image/webp', 0.9));
}

function MiniPreviewBar({ visible, tokenId, imageUrl, previewOnly, lastTrait, onJump }) {
    const name = previewOnly ? `Ape #${tokenId}` : `AFA #${tokenId}`;
    return (
        <div className={`mini-bar ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
            <button type="button" className="mini-bar-main" onClick={onJump} tabIndex={visible ? 0 : -1}
                aria-label={`Back to ${name} preview`}>
                <span className={`mini-bar-thumb ${previewOnly ? 'is-blurred' : ''}`}>
                    {String(imageUrl).startsWith('blob:') && <img key={imageUrl} src={imageUrl} alt="" width="56" height="56" />}
                </span>
                <span className="mini-bar-text">
                    <span className="mini-bar-name">{name}</span>
                    {lastTrait && <span className="mini-bar-trait">{lastTrait}</span>}
                </span>
            </button>
        </div>
    );
}

function Footer() {
    return (
        <footer className="footer">
            <nav className="footer-nav" aria-label="AFA sites">
                <a href={GRID_VIEW_URL} target="_blank" rel="noopener noreferrer">
                    Mint progress: afa-mint-progress.vercel.app
                </a>
                <a href={`${MINT_SITE_URL}/`} target="_blank" rel="noopener noreferrer">
                    Mint on apefacingapes.com
                </a>
            </nav>
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

    // A failed tile used to stay dark forever: the observer only fires on entering the
    // viewport, so nothing re-requested it after the cooldown. Retry while it is on screen.
    useEffect(() => {
        if (!isFailed) return undefined;
        const t = setTimeout(() => {
            const r = ref.current && ref.current.getBoundingClientRect();
            if (r && r.bottom > -300 && r.top < window.innerHeight + 300) onBecomeVisible(id);
        }, PREVIEW_RETRY_COOLDOWN_MS + 500);
        return () => clearTimeout(t);
    }, [isFailed, id, onBecomeVisible]);

    const [festUrl, setFestUrl] = useState(null);
    useEffect(() => () => { if (festUrl) URL.revokeObjectURL(festUrl); }, [festUrl]);
    const onThumbLoad = (e) => {
        const img = e.currentTarget;
        if (img.dataset.fest === img.src) return;
        img.dataset.fest = img.src;
        tileQueue.push(() => processTileForApefest(img).then((u) => { if (u) setFestUrl(u); }));
        runTileQueue();
    };

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
                    <>
                        <img src={imageUrl} alt={`AFA #${id}`} width="1000" height="1000" decoding="async" onLoad={onThumbLoad}
                            className={festUrl ? 'has-fest' : undefined} />
                        {festUrl && <img src={festUrl} alt="" aria-hidden="true" width="1000" height="1000" decoding="async" className="gallery-thumb-fest" />}
                    </>
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

// Hard timeout per API call: a stalled render no longer hangs the loader (#4381 ~50s).
const API_TIMEOUT_MS = 20000;
const RENDER_CACHE = (typeof window !== 'undefined' && window.caches)
    ? window.caches.open('afa-renders-v1').catch(() => null) : null;

function App() {
    const apiBaseCandidates = useMemo(() => Array.from(new Set([
        process.env.REACT_APP_API_URL,
        DEFAULT_API_URL
    ].filter(Boolean))), []);

    const fetchFromAnyBase = useCallback(async (pathWithQuery, parser) => {
        let lastError = null;

        for (const baseUrl of apiBaseCandidates) {
            try {
                const url = `${baseUrl}${pathWithQuery}`;
                // Renders are deterministic per URL but the server sends no-cache and re-renders each time
                // (2-4s, ~400KB). Keep them in Cache Storage so repeat views/visits don't hit the server.
                const cacheable = RENDER_CACHE && /^\/api\/get-asset(-preview)?\?/.test(pathWithQuery);
                if (cacheable) {
                    const hit = await RENDER_CACHE.then((c) => c && c.match(url)).catch(() => null);
                    if (hit) return await parser(hit);
                }
                const response = await fetchWithTimeout(url, API_TIMEOUT_MS);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                if (cacheable) RENDER_CACHE.then((c) => c && c.put(url, response.clone())).catch(() => null);
                return await parser(response);
            } catch (err) {
                lastError = err;
                debug('API base failed, trying next', { baseUrl, pathWithQuery, err });
            }
        }

        throw lastError || new Error('All API bases failed');
    }, [apiBaseCandidates]);

    const [tokenId, setTokenId] = useState('');
    const [selectNonce, setSelectNonce] = useState(0);
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
    // Unminted IDs: editable, but only ever rendered as a server-side blurred preview.
    const [previewOnly, setPreviewOnly] = useState(false);
    const previewOnlyRef = useRef(false);
    previewOnlyRef.current = previewOnly;
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
    const [shareNoteFading, setShareNoteFading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    // ApeFest look: minted apes only (unminted stay server-side blurred, no sharp pixels reach the browser).
    // ApeFest mode is ON by default for every visitor and stays on across ape/ID switches.
    // Turning it off is remembered in this browser (localStorage); ?mode=apefest always turns it on.
    const [apefest, setApefest] = useState(() => {
        try {
            if (new URLSearchParams(window.location.search).get('mode') === 'apefest') return true;
            const stored = window.localStorage.getItem(APEFEST_STORE_KEY);
            return APEFEST_DEFAULT_ON ? stored !== '0' : stored === '1';
        } catch (e) { return APEFEST_DEFAULT_ON; }
    });
    useEffect(() => {
        try { window.localStorage.setItem(APEFEST_STORE_KEY, apefest ? '1' : '0'); } catch (e) { /* storage blocked */ }
    }, [apefest]);
    const apefestRef = useRef(APEFEST_ENABLED && apefest);
    const apefestSrcRef = useRef(null);
    const apefestPngRef = useRef(null); // Promise<Blob> PNG of the shown ApeFest frame (download/share)
    const fadeStartRef = useRef(0);
    const [apefestBusy, setApefestBusy] = useState(false);
    useEffect(() => { apefestRef.current = APEFEST_ENABLED && apefest; }, [apefest]);
    useEffect(() => { if (APEFEST_ENABLED) loadApefestFonts(); }, []);
    useEffect(() => { setDownloaded(false); }, [tokenId]);

  useEffect(() => {
        if (thirdAsset === 'selfie') {
            setSecondAsset('');
            setSelectedAsset('');
        }
    }, [thirdAsset]);
    
    const authoritativeMintsRef = useRef(new Set());
    const [mintListReady, setMintListReady] = useState(false);

    // Source of truth for "is minted": afa-mint-progress.vercel.app/api/mints via the
    // same-origin /api/mints proxy (complete list, count-checked, retried).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
                try {
                    const response = await fetch('/api/mints');
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    if (!Array.isArray(data.minted) || data.minted.length !== data.count) throw new Error('incomplete');
                    if (cancelled) return;
                    authoritativeMintsRef.current = new Set(data.minted.map(Number));
                    setMintedTokens((prev) => new Set([...prev, ...authoritativeMintsRef.current]));
                    setMintedTokenIds((prev) => {
                        const have = new Set(prev);
                        const missing = [...authoritativeMintsRef.current].filter((id) => !have.has(id)).sort((a, b) => b - a);
                        return missing.length ? [...prev, ...missing] : prev;
                    });
                    setMintListReady(true);
                    return;
                } catch (error) {
                    debug('Mint list (afa-progress) attempt failed', { attempt, error });
                    await wait(800 * (attempt + 1));
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

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
        // Merge, never replace: a later, incomplete source (e.g. a partial Etherscan
        // tx scan) must not drop IDs an earlier source (backend list, afa-progress) had.
        // Mints are permanent, so a union is always correct.
        setMintedTokens((prev) => new Set([...numericIds, ...prev, ...authoritativeMintsRef.current]));
        setMintedTokenIds((prev) => {
            const extra = [...new Set([...prev, ...authoritativeMintsRef.current])]
                .filter((id) => !seen.has(id))
                .sort((a, b) => b - a);
            return extra.length ? [...numericIds, ...extra] : numericIds;
        });
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
            assetType: 'AFA',
            size: '256' // list tiles: small WebP from the server
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
        if (backgroundHeld()) return; // main preview first
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

    useEffect(() => onBackgroundRelease(pumpPreviewQueue), [pumpPreviewQueue]);

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
      holdBackground();
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
      fadeStartRef.current = Date.now();

        const isPreviewOnly = previewOnlyRef.current;
        // Unminted: the server-blurred preview gets the look on top (never a sharp image).
        const isApefest = APEFEST_ENABLED && apefestRef.current;
        // ApeFest: background off (transparent), every other asset stays; the look is applied last, client-side.
        // Unminted keeps the original background: the launch key (afa key_reply) removes it to #0b0b0c.
        if (isApefest && !isPreviewOnly) queryParams.set('thirdAssetType', 'transparent');
        const fetchAssetBlob = () => fetchFromAnyBase(
            `/api/${isPreviewOnly ? 'get-asset-preview' : 'get-asset'}?${queryParams.toString()}`,
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
        .then(async (rawBlob) => {
            if (requestId !== activeRenderRequestRef.current) return;
            let blob = rawBlob;
            apefestSrcRef.current = null;
            if (isApefest) {
                const img = await loadImage(URL.createObjectURL(rawBlob));
                // Minted: exact launch-post render (afa's scene maths, bit-exact, in a worker).
                // Unminted (blurred preview): editor look on top of the server blur.
                const square = await renderApefestLaunch(rawBlob, 'square', { unminted: isPreviewOnly, tokenId: newTokenId });
                // Show the exact pixels at once (BMP); encode the PNG for download/share afterwards.
                blob = square.apefestBmp || await canvasToBlob(square);
                apefestPngRef.current = null;
                if (square.apefestBmp) {
                    let png = null;
                    apefestPngRef.current = () => { if (!png) png = canvasToBlob(square); return png; };
                    setTimeout(() => { if (apefestPngRef.current) apefestPngRef.current(); }, 1200);
                }
                apefestSrcRef.current = { img, blob: rawBlob };
                if (requestId !== activeRenderRequestRef.current) return;
            }
            setSyncPendingTokenId('');
            const newImageUrl = URL.createObjectURL(blob);
    
            // Update the image URL after the fade-out transition (no extra wait if it already finished)
            setTimeout(() => {
                if (requestId !== activeRenderRequestRef.current) return;
                setCurrentImageUrl(newImageUrl);
                setFade('fade-in'); // Start fade-in effect
            }, Math.max(0, 500 - (Date.now() - fadeStartRef.current)));
    
            setShowLoader(false);
            releaseBackground();
        })
        .catch(async (error) => {
            releaseBackground();
            if (requestId !== activeRenderRequestRef.current) return;
            if (isPreviewOnly) {
                logError('Blurred preview failed', error);
                setShowLoader(false);
                setFade('fade-in');
                return;
            }

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

        // Unminted: the server answers 403 NOT_MINTED here by design; don't ask (and don't retry).
        if (isPreviewOnly) return;
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
    }, [tokenId, selectedAsset, secondAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, clubAsset, fetchAsset, apefest]);
    
    
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

    const buildSuggestions = useCallback((value) => {
        if (!value) return [];
        const minted = Array.from(mintedTokens)
            .map(Number)
            .filter((id) => id.toString().startsWith(value))
            .sort((a, b) => a - b);
        const exact = Number(value);
        const head = exact <= 9999 ? [exact] : [];
        const mintedRest = minted.filter((id) => id !== exact);
        // Unminted IDs are only offered once the full mint list is known,
        // so nothing minted is ever mislabelled "Preview".
        const rest = [];
        if (mintListReady) {
            const mintedSet = new Set(minted);
            for (let mult = 10; mult <= 1000 && rest.length < SUGGESTION_LIMIT; mult *= 10) {
                for (let k = 0; k < mult && rest.length < SUGGESTION_LIMIT; k += 1) {
                    const id = exact * mult + k;
                    if (id <= 9999 && !mintedSet.has(id)) rest.push(id);
                }
            }
        } else if (!mintedTokens.has(exact)) {
            head.length = 0; // exact unminted match waits for the list too
        }
        return [...head, ...mintedRest, ...rest].slice(0, SUGGESTION_LIMIT);
    }, [mintedTokens, mintListReady]);

    useEffect(() => {
        if (!tokenInput) return;
        const next = buildSuggestions(tokenInput);
        setSuggestions(next);
    }, [mintListReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTokenInput = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        setTokenInput(value);
        
        if (value) {
            const suggestions = buildSuggestions(value);
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
        setSelectNonce((n) => n + 1);

        setIsCheckingMint(true);
        setUnmintedTokenId('');
        setSyncPendingTokenId('');
        setTokenInput(value);

        const minted = await verifyTokenMinted(value);
        setIsCheckingMint(false);

        if (!minted) {
            resetTraitSelections();
            setUnmintedTokenId('');
            setSyncPendingTokenId('');
            setDownloaded(false);
            previewOnlyRef.current = true;
            setPreviewOnly(true);
            setTokenId(value);
            track('ape_select', 'unminted');
            setShowSuggestions(false);
            return true;
        }

        resetTraitSelections();
        previewOnlyRef.current = false;
        setPreviewOnly(false);
        setUnmintedTokenId('');
        setSyncPendingTokenId('');
        setTokenId(value);
        setShowSuggestions(false);
        track('ape_select', 'minted');
        return true;
    }, [resetTraitSelections, verifyTokenMinted]);

    // Hero "Style this ape": open a minted ape with the hero's current look.
    const handleOpenLook = useCallback(async (id, look) => {
        const ok = await handleTokenSubmit(id);
        if (!ok || !look) return;
        if (look.hat) setHatAsset(look.hat);
        if (look.outfit) setSecondAsset(look.outfit);
        if (look.eyes) setEyesAsset(look.eyes);
        if (look.hand) setSelectedAsset(look.hand);
        if (look.mouth) setMouthAsset(look.mouth);
    }, [handleTokenSubmit]);

    // Hero 'EXPLORE APEFEST MODE': open the ape with ApeFest mode on.
    const handleExplore = useCallback((id, look) => {
        track('apefest_toggle', 'on');
        apefestRef.current = APEFEST_ENABLED;
        setApefest(true);
        handleOpenLook(id, look);
    }, [handleOpenLook]);

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
        setShareNoteFading(false);
        // Design: visible ~4s, then 200ms fade-out.
        const fadeId = window.setTimeout(() => setShareNoteFading(true), 4000);
        const timerId = window.setTimeout(() => { setShareNote(''); setShareNoteFading(false); }, 4200);
        return () => { window.clearTimeout(fadeId); window.clearTimeout(timerId); };
    }, [shareNote]);

    // Hero/first impression (no ape picked yet) stays calm: the mode only shows once an ape is loaded.
    const apefestActive = APEFEST_ENABLED && apefest && !!tokenId;

    // Extra download for X: 1600x900 (primary output stays 1000x1000).
    const handleDownloadWide = async () => {
        if (!apefestActive || !apefestSrcRef.current) return;
        track('download', 'wide');
        setApefestBusy(true);
        try {
            let wide;
            wide = await renderApefestLaunch(apefestSrcRef.current.blob, 'wide', { unminted: previewOnly, tokenId });
            drawApefestText(wide.getContext('2d'), 'wide', previewOnly ? apefestUnmintedText(tokenId) : {});
            const blob = await canvasToBlob(wide);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `afa-${tokenId}-apefest-16x9.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
        } finally {
            setApefestBusy(false);
        }
    };

    useEffect(() => {
        document.body.classList.toggle('apefest-body', apefestActive);
        return () => document.body.classList.remove('apefest-body');
    }, [apefestActive]);

    const handleDownload = async () => {
        if ((previewOnly && !apefestActive) || !currentImageUrl.startsWith('blob:')) return;
        track('download', 'square');
        const link = document.createElement('a');
        let href = currentImageUrl;
        if (apefestActive && apefestPngRef.current) {
            href = URL.createObjectURL(await apefestPngRef.current());
            setTimeout(() => URL.revokeObjectURL(href), 4000);
        }
        link.href = href;
        link.download = apefestActive ? `afa-${tokenId}-apefest.png` : `afa-${tokenId}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setDownloaded(true);
    };

    // Unminted IDs: thumbnails come from the server already blurred
    // (/api/get-asset-preview), so no sharp ape or asset layer reaches the client.
    const stripTokenId = tokenId;
    const stripEndpoint = previewOnly ? 'get-asset-preview' : 'get-asset';

    const shareText = useMemo(() => (apefestActive ? buildApefestShareText(tokenId, !previewOnly) : buildShareText({
        tokenId,
        traits: {
            outfit: secondAsset,
            hand: selectedAsset,
            extra: thirdAsset,
            mouth: mouthAsset,
            hat: hatAsset,
            eyes: eyesAsset,
        },
        framed: vegasButtonClicked,
        minted: !previewOnly,
    })), [apefestActive, tokenId, secondAsset, selectedAsset, thirdAsset, mouthAsset, hatAsset, eyesAsset, vegasButtonClicked, previewOnly]);
    const xShareUrl = useMemo(() => buildXIntentUrl(shareText), [shareText]);

    // Share = text + image, no URL (Phillipp). iOS share targets (incl. X) often drop
    // `text` when `files` is present, so the text is ALWAYS copied to the clipboard first
    // (inside the user gesture) and a paste hint is shown.
    const copyShareText = async () => {
        try { await navigator.clipboard.writeText(shareText); return true; } catch (e) { return false; }
    };
    const shareImageWithText = async () => {
        const copied = await copyShareText();
        if (navigator.share && typeof navigator.canShare === 'function' && String(currentImageUrl).startsWith('blob:')) {
            const blob = apefestActive && apefestPngRef.current ? await apefestPngRef.current() : await fetch(currentImageUrl).then((r) => r.blob());
            const file = new File([blob], `afa-${tokenId}.png`, { type: blob.type || 'image/png' });
            if (navigator.canShare({ files: [file], text: shareText })) {
                if (copied) setShareNote('Text copied, paste it into your post');
                await navigator.share({ files: [file], text: shareText });
                return true;
            }
        }
        if (navigator.share) {
            await navigator.share({ text: shareText });
            return true;
        }
        return false;
    };

    const handleShareOnX = async (event) => {
        track('share', 'x');
        const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (!isTouch || !navigator.share) return; // desktop: plain X intent link (text only)
        event.preventDefault();
        try {
            if (!(await shareImageWithText())) window.open(xShareUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            window.open(xShareUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleShare = async () => {
        track('share', 'link');
        try {
            if (await shareImageWithText()) return;
            if (await copyShareText()) setShareNote('Text copied, paste it into your post');
            window.open(xShareUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            debug('Share failed', error);
            if (await copyShareText()) setShareNote('Text copied, paste it into your post');
        }
    };



  // Phillipp: selecting an ID (autofill, gallery tile, hero input) brings the preview
  // to the top of the viewport, below the sticky site bar. Reduced motion = instant jump.
  useEffect(() => {
    if (!tokenId) return;
    const raf = window.requestAnimationFrame(() => {
      const target = document.querySelector('.studio-preview');
      if (!target) return;
      const bar = document.querySelector('.site-bar');
      const offset = (bar ? bar.getBoundingClientRect().height : 0) + 12;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [tokenId, selectNonce]);

  // Caption under the main preview: all currently selected assets (empty = Original).
  const selectedTraits = useMemo(() => {
    const now = { outfit: secondAsset, mouth: mouthAsset, hat: hatAsset, eyes: eyesAsset, hand: selectedAsset, extra: thirdAsset };
    return TRAIT_CATEGORIES.filter(([key]) => now[key]).map(([key, title]) => [key, title, now[key]]);
  }, [secondAsset, mouthAsset, hatAsset, eyesAsset, selectedAsset, thirdAsset]);

  // Mobile: assets max 2 lines; overflow collapses into "+N" (Design #22).
  const captionTraitsRef = useRef(null);
  const [captionHidden, setCaptionHidden] = useState(0);
  useEffect(() => { setCaptionHidden(0); }, [selectedTraits]);
  useLayoutEffect(() => {
    const el = captionTraitsRef.current;
    if (!el || !window.matchMedia('(max-width: 767px)').matches) return;
    const items = [...el.children];
    if (!items.length) return;
    const tops = [];
    items.filter((n) => !n.hidden).forEach((n) => {
      const t = n.getBoundingClientRect().top;
      if (!tops.some((x) => Math.abs(x - t) < 8)) tops.push(t);
    });
    if (tops.length > 2 && captionHidden < selectedTraits.length) setCaptionHidden((n) => n + 1);
  }, [captionHidden, selectedTraits, tokenId, previewOnly]);
  useEffect(() => {
    const onResize = () => setCaptionHidden(0);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Last changed trait for the mini bar ("Hat · Party Hat").
  const [lastTrait, setLastTrait] = useState('');
  const prevTraitsRef = useRef(null);
  useEffect(() => {
    const now = { outfit: secondAsset, mouth: mouthAsset, hat: hatAsset, eyes: eyesAsset, hand: selectedAsset, extra: thirdAsset };
    const prev = prevTraitsRef.current;
    prevTraitsRef.current = now;
    if (!prev) return;
    const changed = TRAIT_CATEGORIES.find(([key]) => prev[key] !== now[key]);
    if (!changed) return;
    const [key, title] = changed;
    const v = now[key];
    setLastTrait(v ? `${title} · ${assetLabel(key, v) || v}` : `${title} · None`);
  }, [secondAsset, mouthAsset, hatAsset, eyesAsset, selectedAsset, thirdAsset]);
  useEffect(() => { setLastTrait(''); }, [tokenId]);

  // Expose the sticky header height to CSS (sticky preview top, scroll-margin).
  useEffect(() => {
    const bar = document.querySelector('.site-bar');
    if (!bar) return undefined;
    const apply = () => document.documentElement.style.setProperty('--site-bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    if (ro) ro.observe(bar);
    window.addEventListener('resize', apply);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', apply); };
  }, []);

  const [miniVisible, setMiniVisible] = useState(false);
  useEffect(() => {
    if (!tokenId || typeof IntersectionObserver === 'undefined') { setMiniVisible(false); return undefined; }
    const target = document.getElementById('asset-display');
    if (!target) return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    let ratio = 1;
    // ApeFest: the claim sits at the top of the image, so the mini bar takes over as soon as
    // the image top slides under the site bar (never a cropped claim); otherwise the <20% rule.
    const claimHidden = () => {
        if (!apefestActive) return false;
        const bar = document.querySelector('.site-bar');
        const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
        const r = target.getBoundingClientRect();
        return r.top < barBottom - 1 && r.bottom > barBottom;
    };
    const update = () => setMiniVisible(mq.matches && (ratio < 0.2 || claimHidden()));
    const io = new IntersectionObserver(([entry]) => { ratio = entry.intersectionRatio; update(); },
      { threshold: [0, 0.2, 0.5, 1] });
    io.observe(target);
    mq.addEventListener('change', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { io.disconnect(); mq.removeEventListener('change', update); window.removeEventListener('scroll', update); };
  }, [tokenId, apefestActive]);

  const scrollToPreview = useCallback(() => {
    const target = document.querySelector('.studio-preview');
    if (!target) return;
    const bar = document.querySelector('.site-bar');
    const offset = (bar ? bar.getBoundingClientRect().height : 0) + 12;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const appClassName = `App ${vegasButtonClicked ? 'vegas-glamour' : ''} ${tokenId ? 'has-token' : ''} ${apefestActive ? 'apefest-mode' : ''} ${previewOnly ? 'is-unminted' : ''}`;

  return (
    // Apply glamour class conditionally
    <div className={appClassName} style={apefestActive ? { '--crt': APEFEST_CRT, '--scan': APEFEST_PAGE_SCAN, '--jump': APEFEST_JUMP } : undefined}>
      {apefestActive && (
        // Tile duotone, dark like the main preview: coloured backgrounds land ~#2a0608-#4a0a0e,
        // only the brightest outlines/highlights reach #e1141e-#ff5a4f. Shadows #0b0b0c.
        // Picker variant adds ~15% luminance contrast so outlines/patterns stay readable.
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <filter id="apefest-duo" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.043 0.07 0.1 0.13 0.16 0.19 0.22 0.25 0.29 0.45 0.95" />
              <feFuncG type="table" tableValues="0.043 0.028 0.024 0.024 0.026 0.03 0.034 0.038 0.044 0.06 0.33" />
              <feFuncB type="table" tableValues="0.047 0.032 0.03 0.032 0.036 0.04 0.044 0.05 0.056 0.08 0.29" />
            </feComponentTransfer>
          </filter>
          <filter id="apefest-duo-pick" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="1.15" intercept="-0.075" />
              <feFuncG type="linear" slope="1.15" intercept="-0.075" />
              <feFuncB type="linear" slope="1.15" intercept="-0.075" />
            </feComponentTransfer>
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.043 0.07 0.1 0.13 0.16 0.19 0.22 0.25 0.29 0.45 0.95" />
              <feFuncG type="table" tableValues="0.043 0.028 0.024 0.024 0.026 0.03 0.034 0.038 0.044 0.06 0.33" />
              <feFuncB type="table" tableValues="0.047 0.032 0.03 0.032 0.036 0.04 0.044 0.05 0.056 0.08 0.29" />
            </feComponentTransfer>
          </filter>
          <filter id="apefest-duo-asset" colorInterpolationFilters="sRGB">
            {/* Asset picker: brighter mids (~+25%) + stronger local contrast so patterns and the Eyes variants separate; still dark red. */}
            <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="1.35" intercept="-0.17" />
              <feFuncG type="linear" slope="1.35" intercept="-0.17" />
              <feFuncB type="linear" slope="1.35" intercept="-0.17" />
            </feComponentTransfer>
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.043 0.1 0.16 0.23 0.3 0.37 0.45 0.55 0.7 0.88 1" />
              <feFuncG type="table" tableValues="0.043 0.03 0.028 0.03 0.034 0.04 0.048 0.058 0.075 0.1 0.33" />
              <feFuncB type="table" tableValues="0.047 0.034 0.032 0.035 0.04 0.045 0.054 0.064 0.085 0.12 0.29" />
            </feComponentTransfer>
          </filter>
        </svg>
      )}
      {apefestActive && previewOnly && (
        // Unminted picker tiles (server-blurred assets): own brighter curve so they read as soft red glowing shapes.
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <filter id="apefest-duo-blur" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.05 0.14 0.24 0.34 0.43 0.52 0.6 0.68 0.76" />
              <feFuncG type="table" tableValues="0.045 0.035 0.035 0.04 0.045 0.05 0.06 0.075 0.12" />
              <feFuncB type="table" tableValues="0.05 0.04 0.04 0.045 0.05 0.055 0.065 0.08 0.11" />
            </feComponentTransfer>
          </filter>
        </svg>
      )}
      {apefestActive && (
        // Page CRT layer (same APEFEST_CRT as the baked image). Sits below the preview column
        // and the mini bar, so the image's own scanlines are never overlaid (no moiré, no double lines).
        <div className="apefest-overlay" aria-hidden="true">
          <span className="apefest-glitch apefest-glitch--1" />
          <span className="apefest-glitch apefest-glitch--2" />
          <span className="apefest-glitch apefest-glitch--3" />
        </div>
      )}
      <a className="skip-link" href="#editor-controls">Skip to editor</a>
      <SiteBar />
      {!tokenId && (
        <Hero
          apiBase={apiBaseCandidates[0]}
          mintedIds={mintedTokenIds}
          onSubmitId={handleTokenSubmit}
          onOpenLook={handleOpenLook}
          apefest={APEFEST_DEFAULT_ON && apefest}
          explore={APEFEST_DEFAULT_ON}
          onExplore={handleExplore}
        />
      )}
      {tokenId && (
        <MiniPreviewBar
          visible={miniVisible}
          tokenId={tokenId}
          imageUrl={currentImageUrl}
          previewOnly={previewOnly}
          lastTrait={lastTrait}
          onJump={scrollToPreview}
        />
      )}
      <main className={`studio ${tokenId ? 'studio--editing' : 'studio--picking'}`}>
        <section className={`studio-preview ${tokenId ? 'has-token' : ''}`} aria-label="Preview">
          <div className="preview-card">
            <div id="asset-display" className={`${fade || ''} ${showLoader ? 'is-loading' : ''}`}>
              <img src={currentImageUrl} alt="Ape preview" width="1200" height="1200" />
              {apefestActive && previewOnly && !showLoader && (
                // 390: the baked 13px note is ~5px on screen, so a readable page overlay sits on top (>=11px, 60%).
                <span className="apefest-note-overlay" aria-hidden="true">NOT YET MINTED</span>
              )}
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
            <div className="hero-caption preview-caption" aria-live="polite">
              <span className="hero-caption-name">{previewOnly ? `Ape #${tokenId}` : `AFA #${tokenId}`}</span>
              <div className="preview-caption-traits" ref={captionTraitsRef}>
                {selectedTraits.length === 0 ? (
                  <span className="preview-caption-item"><span className="hero-caption-val">Original</span></span>
                ) : selectedTraits.map(([key, title, v], i) => (
                  <span className="preview-caption-item" key={`${key}-${v}`} hidden={captionHidden > 0 && i >= selectedTraits.length - captionHidden}>
                    <span className="hero-caption-cat">{title}</span>{' '}<span className="hero-caption-val">{assetLabel(key, v) || v}</span>
                  </span>
                ))}
                {captionHidden > 0 && <span className="preview-caption-item preview-caption-more">+{captionHidden}</span>}
              </div>
            </div>
          )}
          {tokenId && (previewOnly && !apefestActive ? (
            <div className="preview-locked" role="note">
              <p className="preview-locked-title">Ape #{tokenId} is still looking the other way.</p>
              <p className="preview-locked-note">Not minted yet? Try it on anyway. Your Ape stays blurred until it's yours.</p>
              <div className="preview-actions">
                <a className="preview-mint-link" href={MINT_URL} target="_blank" rel="noopener noreferrer" onClick={() => track('mint_cta_click', tokenId)}>
                  Mint to reveal →
                </a>
                <button type="button" className="preview-share" disabled title="Available after mint">Download</button>
              </div>
              <p className="preview-locked-fine">Download and sharing unlock once it's minted.</p>
            </div>
            ) : (
            <div className="preview-actions">
              <button
                type="button"
                className="preview-download"
                onClick={handleDownload}
                disabled={!String(currentImageUrl).startsWith('blob:')}
              >
                {apefestActive ? 'Download 1:1' : 'Download PNG'}
              </button>
              {apefestActive && (
                <button
                  type="button"
                  className="preview-download preview-download--wide"
                  onClick={handleDownloadWide}
                  disabled={apefestBusy || !String(currentImageUrl).startsWith('blob:')}
                  title="1600×900 for X"
                >
                  16:9 for X
                </button>
              )}
              {previewOnly && (
                <a className="preview-mint-link" href={MINT_URL} target="_blank" rel="noopener noreferrer" onClick={() => track('mint_cta_click', tokenId)}>
                  Mint to reveal →
                </a>
              )}
              <div className="share-wrap">
              {downloaded ? (
                <a
                  className="preview-share preview-share--x"
                  href={xShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleShareOnX}
                >
                  Share on X
                </a>
              ) : (
                <button type="button" className="preview-share" onClick={handleShare}>
                  Share
                </button>
              )}
              {shareNote && (
                <p className={`share-hint${shareNoteFading ? ' is-fading' : ''}`} role="status">
                  <svg className="share-hint-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="#f5c542" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {shareNote}
                </p>
              )}
              </div>
            </div>
            ))}



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
                Ape #{unmintedTokenId} is still looking the other way.
              </p>
              <p className="claim-prompt-copy">
                Download and sharing unlock once it's minted.
              </p>
              <a
                href={MINT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('mint_cta_click', tokenId)}
                className="claim-prompt-cta"
              >
                Mint to reveal
              </a>
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
                  Randomize
                </button>
                {APEFEST_ENABLED ? (
                  <button
                    type="button"
                    onClick={() => { track('apefest_toggle', apefestActive ? 'off' : 'on'); setApefest((v) => !v); }}
                    className={`action-button apefest-button ${apefestActive ? 'is-on' : ''}`}
                    aria-pressed={apefestActive}
                    title="Red CRT look for ApeFest. Your traits stay on."
                    data-tooltip="Red CRT look for ApeFest. Your traits stay on."
                  >
                    ApeFest{apefestActive && <span className="apefest-dot" aria-hidden="true" />}
                  </button>
                ) : (
                <button
                  type="button"
                  onClick={handleFrameIt}
                  className="action-button vegas-button"
                  title="Adds the vintage frame."
                  data-tooltip="Adds the vintage frame."
                >
                  Add frame
                </button>
                )}
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
                              <span>{suggestion}</span>
                              {(mintedTokens.has(suggestion) || mintedTokens.has(String(suggestion))) ? (
                                <span className="suggestion-tag">Minted</span>
                              ) : mintListReady ? (
                                <span className="suggestion-tag suggestion-tag--preview">Preview</span>
                              ) : null}
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
                            <AssetStrip
                              selectRef={outfitRef}
                              param="secondAssetType"
                              tokenId={stripTokenId}
                              endpoint={stripEndpoint}
                              value={secondAsset}
                              onPick={(v) => handleSecondAssetChange({ target: { value: secondAsset === v ? '' : v } })}
                              disabled={thirdAsset === 'selfie' || Boolean(clubAsset)}
                              fetchAssetBlob={(path) => fetchFromAnyBase(path, (r) => r.blob())}
                              crop="outfit"
                            />
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
                            <AssetStrip
                              selectRef={mouthRef}
                              param="mouthAssetType"
                              tokenId={stripTokenId}
                              endpoint={stripEndpoint}
                              value={mouthAsset}
                              onPick={(v) => handleMouthAssetChange({ target: { value: mouthAsset === v ? '' : v } })}
                              disabled={clubAsset === 'elite'}
                              fetchAssetBlob={(path) => fetchFromAnyBase(path, (r) => r.blob())}
                              crop="mouth"
                            />
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
                            <AssetStrip
                              selectRef={hatRef}
                              param="hatAssetType"
                              tokenId={stripTokenId}
                              endpoint={stripEndpoint}
                              value={hatAsset}
                              onPick={(v) => handleHatAssetChange({ target: { value: hatAsset === v ? '' : v } })}
                              disabled={Boolean(clubAsset) || secondAsset === 'singe_hoodie_glow' || secondAsset === 'singe_hoodie'}
                              fetchAssetBlob={(path) => fetchFromAnyBase(path, (r) => r.blob())}
                              crop="hat"
                            />
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
                            <AssetStrip
                              selectRef={eyesRef}
                              param="eyesAssetType"
                              tokenId={stripTokenId}
                              endpoint={stripEndpoint}
                              value={eyesAsset}
                              onPick={(v) => handleEyesAssetChange({ target: { value: eyesAsset === v ? '' : v } })}
                              disabled={clubAsset === 'elite'}
                              fetchAssetBlob={(path) => fetchFromAnyBase(path, (r) => r.blob())}
                              crop="eyes"
                            />
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
                                <option value="gordon">Gordon</option>
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
                            <AssetStrip
                              selectRef={handRef}
                              param="assetType"
                              tokenId={stripTokenId}
                              endpoint={stripEndpoint}
                              value={selectedAsset}
                              onPick={(v) => handleAssetChange({ target: { value: selectedAsset === v ? '' : v } })}
                              disabled={thirdAsset === 'selfie' || clubAsset === 'elite'}
                              fetchAssetBlob={(path) => fetchFromAnyBase(path, (r) => r.blob())}
                              crop="hand"
                            />
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
                      {apefestActive && <p className="apefest-note">Backgrounds and effects are off in ApeFest mode.</p>}
                      <div className="dropdown-with-arrows">
                        <select
                          id="extra-select"
                          ref={extraRef}
                          value={thirdAsset}
                          onChange={handleThirdAssetChange}
                          className="dropdown"
                          disabled={clubAsset === 'elite' || apefestActive}
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
                            <AssetStrip
                              selectRef={extraRef}
                              param="thirdAssetType"
                              tokenId={stripTokenId}
                              endpoint={stripEndpoint}
                              value={thirdAsset}
                              onPick={(v) => handleThirdAssetChange({ target: { value: thirdAsset === v ? '' : v } })}
                              disabled={clubAsset === 'elite' || apefestActive}
                              fetchAssetBlob={(path) => fetchFromAnyBase(path, (r) => r.blob())}
                              crop="extra"
                            />
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
            New Perspective
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