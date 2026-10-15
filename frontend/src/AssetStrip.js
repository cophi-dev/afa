import React, { useEffect, useRef, useState } from 'react';
import { backgroundHeld, onBackgroundRelease } from './utils/apiLane';
import { renderApefestTile } from './utils/apefestLaunch';

// Picker crops zoom into the brightest (key-lit) part of the frame; a lower scene gain keeps the
// cropped tile at the same brightness/saturation as the full list tiles (Design 15.10).
// Per-category scene gain, measured so the visible crop matches the list tiles' mean luminance.
export const PICKER_GAIN = { outfit: 1.46, mouth: 0.75, hat: 0.74, eyes: 0.4, hand: 1.19, extra: 0.8 };

// Uniform framing in ApeFest mode: item bbox = (asset render - bare ape) on a 96px sample,
// mapped into the launch frame (ape scaled 0.96, bottom-centred), item fills ~60% of the tile.
const FRAME_FILL = 0.6;
const APE_S = 0.96;
const baseCache = new Map();
async function sample96(blob) {
    const bmp = await createImageBitmap(blob, { resizeWidth: 96, resizeHeight: 96, resizeQuality: 'medium' });
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
    return x.getImageData(0, 0, 96, 96).data;
}
async function itemFrame(itemBlob, baseBlob) {
    const [a, b] = await Promise.all([sample96(itemBlob), sample96(baseBlob)]);
    let x0 = 96; let y0 = 96; let x1 = -1; let y1 = -1;
    for (let y = 0; y < 96; y += 1) {
        for (let x = 0; x < 96; x += 1) {
            const i = (y * 96 + x) * 4;
            const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + 2 * Math.abs(a[i + 3] - b[i + 3]);
            if (d > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
    }
    if (x1 < 0) return null;
    const m = (v) => v / 96;
    const fx = (v) => (1 - APE_S) / 2 + APE_S * m(v); const fy = (v) => (1 - APE_S) + APE_S * m(v);
    const bx0 = fx(x0); const bx1 = fx(x1 + 1); const by0 = fy(y0); const by1 = fy(y1 + 1);
    const side = Math.max(bx1 - bx0, by1 - by0);
    const zoom = Math.min(4, Math.max(1, FRAME_FILL / side));
    return { zoom, cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2 };
}
const festBlobCache = new Map();
let frameChain = Promise.resolve();
const queueFrame = (fn) => {
    const run = frameChain.then(() => new Promise((r) => setTimeout(r, 0))).then(fn);
    frameChain = run.catch(() => null);
    return run;
};
const frameStyle = (f) => ({ transformOrigin: '50% 50%', transform: `scale(${f.zoom.toFixed(3)}) translate(${((0.5 - f.cx) * 100).toFixed(2)}%, ${((0.5 - f.cy) * 100).toFixed(2)}%)` });

// Shared, small-concurrency queue + cache for asset preview renders.
const cache = new Map();
const pending = new Map();
const queue = [];
let active = 0;
const MAX_ACTIVE = 3;

const finish = () => {
    active -= 1;
    pump(); // eslint-disable-line no-use-before-define
};

function pump() {
    if (backgroundHeld()) return; // main preview first
    while (active < MAX_ACTIVE && queue.length) {
        const job = queue.shift();
        active += 1;
        job().finally(finish);
    }
}

onBackgroundRelease(() => pump());
const EAGER_IN_ROW = 6;

// Consistent short names for tiles (full name stays in the tooltip/header).
const SHORT_NAMES = {
    'Ape Solar Hoodie Black': 'Solar Black',
    'Ape Solar Hoodie Blue': 'Solar Blue',
    'Apechain Hoodie Black': 'Apechain Black',
    'Apechain Hoodie Orange': 'Apechain Orange',
    'Apechain Hoodie Blue': 'Apechain Blue',
    'Mindfully Bored Hoodie': 'Mindfully Bored',
    'Mindfully Bored Cap': 'Mindfully Bored',
    'Applied Primate Lab Coat': 'Primate Lab Coat',
    'Top Trader Hoodie': 'Top Trader',
    'Singe Hoodie Glow': 'Singe Glow',
};
export const shortName = (label) => SHORT_NAMES[label]
    || label.replace(/^Dr\.? Bombay /, 'Bombay ');

// Per-category zoom + focal point so each tile shows the asset, not the ape.
// origin is the transform-origin for scale(zoom) on a 1:1 render.
const CROPS = {
    outfit: { zoom: 2.3, origin: '50% 100%' },
    hat: { zoom: 2.4, origin: '50% 0%' },
    eyes: { zoom: 3.2, origin: '50% 36%' },
    mouth: { zoom: 3, origin: '50% 68%' },
    hand: { zoom: 2, origin: '0% 100%' },
    extra: { zoom: 1, origin: '50% 50%' },
};

// Per-asset overrides where the generic category crop misses the object.
// Rule: the object fills >=60% of the tile and is not cut off; otherwise crop to its
// bounding box + ~10% margin. Boxes measured from each asset's render diff (1000px canvas)
// against the bare ape (hand: #1, hat/mouth/outfit: #21 plain face) or the category median
// (eyes/extra). Face items stay centred. Outfits: 2.3x bottom-anchored (collar + chest in, face out; shoulders may clip), Singe Hoodie Glow full frame.
// Very wide/thin items (Mindfully Bored Cap, Dookey Dash Hat, Apechain Grin, Big Smile,
// Banana Punch GM) crop to their dense core so thin strands/lip lines may touch the edge.
// Full-frame scenes (Dookie Dash, Clubhouse Sketch, ...) use zoom 1.
const ASSET_CROPS = {
  outfit: {
    'singe_hoodie_glow': { zoom: 1, origin: '50% 100%' },
  },
  hat: {
    'vegas': { zoom: 1.87, origin: '50% 0%' },
    'german_ape_club_hat': { zoom: 2.67, origin: '50% 3%' },
    'mindfully_bored_cap': { zoom: 1.56, origin: '50% 37%' },
    'apechain_cap': { zoom: 2.85, origin: '50% 10%' },
    'apechain_hat_blue': { zoom: 2.85, origin: '50% 10%' },
    'apechain_hat_orange': { zoom: 2.78, origin: '50% 9%' },
    'designer_toshiro_hat': { zoom: 3.06, origin: '50% 2%' },
    'cats_hat': { zoom: 2.78, origin: '50% 5%' },
    'plunger': { zoom: 1.97, origin: '78% 0%' },
    'pudgy_hat': { zoom: 1.61, origin: '50% 1%' },
    'glitter_cowboy_hat': { zoom: 1.89, origin: '50% 0%' },
  },
  eyes: {
    'btc_eyes': { zoom: 3.56, origin: '50% 30%' },
  },
  mouth: {
    'apechain_grin': { zoom: 1.65, origin: '50% 71%' },
    'lollipop': { zoom: 2.47, origin: '50% 64%' },
    'banana_punch_gm': { zoom: 2.41, origin: '50% 60%' },
    'banana_smile': { zoom: 2.03, origin: '50% 68%' },
    'doodles_rainbow': { zoom: 1.56, origin: '50% 100%' },
    'big_smile': { zoom: 1.63, origin: '50% 71%' },
  },
  hand: {
    'vegas': { zoom: 2.6, origin: '100% 100%' },
    'ape_solar_sun_hand': { zoom: 2.31, origin: '100% 100%' },
    'gordon': { zoom: 2.05, origin: '0% 100%' },
    'dookie_dash': { zoom: 1, origin: '50% 50%' },
    'smartphone_gm': { zoom: 1, origin: '50% 50%' },
    'sardines': { zoom: 2.3, origin: '0% 100%' },
    'ramen': { zoom: 1, origin: '50% 50%' },
    'pray': { zoom: 2.53, origin: '50% 100%' },
    'basketball': { zoom: 1, origin: '50% 50%' },
    'shiny-gm': { zoom: 1.31, origin: '52% 100%' },
    'pipe': { zoom: 1, origin: '50% 50%' },
    'magic_eden': { zoom: 1.16, origin: '0% 100%' },
    'gm_espresso': { zoom: 1.74, origin: '13% 100%' },
    'cheers': { zoom: 2.35, origin: '12% 100%' },
    'banana': { zoom: 1.7, origin: '91% 100%' },
    'otherside': { zoom: 1.17, origin: '0% 100%' },
    'apecoin_hands1': { zoom: 1.05, origin: '57% 100%' },
    'apecoin_hands2': { zoom: 1, origin: '50% 50%' },
    'candle': { zoom: 1.6, origin: '100% 100%' },
    'balloon_fireworks': { zoom: 1, origin: '50% 50%' },
    'fireworks': { zoom: 1.69, origin: '100% 100%' },
    'baguette': { zoom: 1, origin: '50% 50%' },
    'clubhouse': { zoom: 1.34, origin: '0% 100%' },
    'matchstick': { zoom: 1.56, origin: '0% 100%' },
    'balloon_moon': { zoom: 1, origin: '50% 50%' },
  },
  extra: {
    'unclogged': { zoom: 1.13, origin: '34% 100%' },
  },
};
const baseCrop = (crop, value) => (ASSET_CROPS[crop] && ASSET_CROPS[crop][value]) || CROPS[crop] || CROPS.extra;
// Design 15.10: Hand items ~50% less zoom (excess over 1x halved), focal point pulled halfway to the
// centre so the item sits centred with room around it.
const pullHalf = (o) => o.split(' ').map((v) => `${(parseFloat(v) + 50) / 2}%`).join(' ');
const cropFor = (crop, value) => {
    const c = baseCrop(crop, value);
    if (crop !== 'hand') return c;
    return { zoom: 1 + (c.zoom - 1) * 0.5, origin: pullHalf(c.origin) };
};

const loadPreview = (key, fetcher, priority = false) => {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve) => {
        queue[priority ? 'unshift' : 'push'](async () => {
            try {
                // The image server sometimes times out under load: retry twice with backoff.
                let blob;
                for (let attempt = 0; ; attempt += 1) {
                    try { blob = await fetcher(); break; } // eslint-disable-line no-await-in-loop
                    catch (err) {
                        if (attempt >= 2) throw err;
                        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); // eslint-disable-line no-await-in-loop
                    }
                }
                const url = URL.createObjectURL(blob);
                cache.set(key, url);
                resolve(url);
            } catch {
                resolve(null);
            } finally {
                pending.delete(key);
            }
        });
        pump();
    });
    pending.set(key, promise);
    return promise;
};

function AssetThumb({ option, index, active, disabled, onPick, fetchPreview, cacheKey, crop, rootRef, fetchFest = null, fetchBase = null }) {
    const ref = useRef(null);
    const [url, setUrl] = useState(() => cache.get(cacheKey) || null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setUrl(cache.get(cacheKey) || null);
        setFailed(false);
        const node = ref.current;
        if (!node || cache.has(cacheKey)) return undefined;
        let cancelled = false;
        const apply = (result) => {
            if (cancelled) return;
            if (result) setUrl(result); else setFailed(true);
        };
        // Visible tiles only (viewport, incl. the strip's horizontal clipping), visible ones jump the queue.
        // Offscreen rows no longer load up front, so the server works on what the user sees.
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            observer.disconnect();
            loadPreview(cacheKey, fetchPreview, true).then(apply);
        }, { root: null, rootMargin: '200px 120px' });
        // The first tiles of a row (incl. the half-visible one at the strip edge, which the viewport
        // observer can't see through the strip's clipping) load as soon as the row itself is near view.
        observer.observe(index < EAGER_IN_ROW && rootRef.current ? rootRef.current : node);
        return () => { cancelled = true; observer.disconnect(); };
    }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ApeFest (minted only): same small launch frame as the list tiles, rendered in the worker from the
    // transparent thumbnail once the normal tile is loaded (so it stays lazy), queued + cached.
    const [festUrl, setFestUrl] = useState(null);
    const [frame, setFrame] = useState(null);
    useEffect(() => {
        if (!fetchFest || !url) { setFestUrl(null); return undefined; }
        let alive = true;
        // One fetch per asset for both the render and the framing; framing runs queued, one per task.
        if (!festBlobCache.has(cacheKey)) festBlobCache.set(cacheKey, fetchFest().catch((e) => { festBlobCache.delete(cacheKey); throw e; }));
        const getBlob = () => festBlobCache.get(cacheKey);
        const tile = renderApefestTile(`fest|${cacheKey}`, getBlob, 384, { gain: PICKER_GAIN[crop] ?? 0.8 });
        const fr = fetchBase ? Promise.all([getBlob(), fetchBase()]).then(([i, b]) => queueFrame(() => itemFrame(i, b))).catch(() => null) : Promise.resolve(null);
        Promise.all([tile, fr]).then(([u, f]) => { if (alive) { setFrame(f); setFestUrl(u); } }).catch(() => {});
        return () => { alive = false; };
    }, [fetchFest ? cacheKey : null, url]); // eslint-disable-line react-hooks/exhaustive-deps
    const c = cropFor(crop, option.value);

    return (
        <button
            ref={ref}
            type="button"
            className={`asset-thumb ${active ? 'is-active' : ''} ${festUrl ? 'is-fest' : ''}`}
            onClick={() => onPick(option.value)}
            disabled={disabled}
            aria-pressed={active}
            title={option.label}
        >
            <span data-cat={crop} className={`asset-thumb-img ${url ? '' : 'is-loading'} ${failed ? 'is-failed' : ''}`}>
                {url && <img src={url} alt="" width="72" height="72" className={festUrl ? 'has-fest' : undefined} style={{ transform: `scale(${c.zoom})`, transformOrigin: c.origin }} />}
                {festUrl && <img src={festUrl} alt="" width="72" height="72" className="asset-thumb-fest" data-cat={crop} style={frame ? frameStyle(frame) : { transform: `scale(${c.zoom})`, transformOrigin: c.origin }} />}
            </span>
            <span className="asset-thumb-label">{shortName(option.label)}</span>
        </button>
    );
}

/** Horizontal, swipeable thumbnail row mirroring an existing <select>. */
export default function AssetStrip({ selectRef, param, tokenId, value, onPick, disabled, fetchAssetBlob, crop = 'extra', endpoint = 'get-asset', apefest = false }) {
    const [options, setOptions] = useState([]);
    const rootRef = useRef(null);
    const [title, setTitle] = useState('');
    const [atEnd, setAtEnd] = useState(false);

    useEffect(() => {
        const select = selectRef.current;
        if (!select) return;
        setOptions(Array.from(select.options)
            .filter((o) => o.value && !o.disabled)
            .map((o) => ({ value: o.value, label: o.textContent.trim() })));
        const label = select.id && document.querySelector(`label[for="${select.id}"]`);
        setTitle(label ? label.textContent.trim() : '');
    }, [selectRef, tokenId]);

    const onScroll = () => {
        const el = rootRef.current;
        if (el) setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    const selected = options.find((o) => o.value === value);

    if (!tokenId || options.length === 0) return null;

    return (
        <div className="asset-picker">
        <div className="asset-picker-head">
            <span className="asset-picker-title">{title}</span>
            {selected && (
                <>
                    <span className="asset-picker-current" title={selected.label}>{selected.label}</span>
                    <button type="button" className="asset-picker-clear" onClick={() => onPick(value)} disabled={disabled} aria-label={`Remove ${title || 'asset'}`}>×</button>
                </>
            )}
        </div>
        <div className={`asset-strip-wrap ${atEnd ? 'is-end' : ''}`}>
        <div className="asset-strip" ref={rootRef} onScroll={onScroll} role="group" aria-label={`${title || 'Asset'} options`}>
            {options.map((option, index) => {
                const query = new URLSearchParams({ tokenId, assetType: 'AFA' });
                query.set(param, option.value);
                // Server-side small WebP (384px covers the 3.5x tile crops on 2x screens); ~20 KB instead of ~450 KB PNG.
                query.set('size', '384');
                const cacheKey = `${endpoint}|${tokenId}|${param}|${option.value}`;
                return (
                    <AssetThumb
                        key={option.value}
                        option={option}
                        index={index}
                        active={value === option.value}
                        disabled={disabled}
                        onPick={onPick}
                        cacheKey={cacheKey}
                        crop={crop}
                        rootRef={rootRef}
                        fetchPreview={() => fetchAssetBlob(`/api/${endpoint}?${query.toString()}`)}
                        fetchFest={apefest && endpoint === 'get-asset' ? () => {
                            const q = new URLSearchParams(query); q.set('thirdAssetType', 'transparent');
                            return fetchAssetBlob(`/api/get-asset?${q.toString()}`);
                        } : null}
                        fetchBase={apefest && endpoint === 'get-asset' ? () => {
                            const k = String(tokenId);
                            if (!baseCache.has(k)) {
                                const q = new URLSearchParams({ tokenId, assetType: 'AFA', thirdAssetType: 'transparent', size: '384' });
                                baseCache.set(k, fetchAssetBlob(`/api/get-asset?${q.toString()}`).catch((e) => { baseCache.delete(k); throw e; }));
                            }
                            return baseCache.get(k);
                        } : null}
                    />
                );
            })}
        </div>
        </div>
        </div>
    );
}
