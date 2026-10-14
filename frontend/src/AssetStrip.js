import React, { useEffect, useRef, useState } from 'react';

// Shared, small-concurrency queue + cache for asset preview renders.
const cache = new Map();
const pending = new Map();
const queue = [];
let active = 0;
const MAX_ACTIVE = 6;

const finish = () => {
    active -= 1;
    pump(); // eslint-disable-line no-use-before-define
};

function pump() {
    while (active < MAX_ACTIVE && queue.length) {
        const job = queue.shift();
        active += 1;
        job().finally(finish);
    }
}

const EAGER_COUNT = 6;

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
    outfit: { zoom: 2.2, origin: '50% 100%' },
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
// (eyes/extra). Face items stay centred. Outfits: width-fit, max 1.3x, bottom-anchored.
// Very wide/thin items (Mindfully Bored Cap, Dookey Dash Hat, Apechain Grin, Big Smile,
// Banana Punch GM) crop to their dense core so thin strands/lip lines may touch the edge.
// Full-frame scenes (Dookie Dash, Clubhouse Sketch, ...) use zoom 1.
const ASSET_CROPS = {
  outfit: {
    'apefest_merch_2025': { zoom: 1.3, origin: '50% 100%' },
    'vegas': { zoom: 1.3, origin: '50% 100%' },
    'german_ape_club_clothes': { zoom: 1.3, origin: '50% 100%' },
    'mindfully_bored_hoodie': { zoom: 1.3, origin: '50% 100%' },
    'ape_solar_hoodie_black': { zoom: 1.3, origin: '50% 100%' },
    'ape_solar_hoodie_blue': { zoom: 1.3, origin: '50% 100%' },
    'apefest_merch': { zoom: 1.3, origin: '50% 100%' },
    'tt_hoodie': { zoom: 1.3, origin: '50% 100%' },
    'bimmer_jacket': { zoom: 1.3, origin: '50% 100%' },
    'apechain_hoodie_black': { zoom: 1.3, origin: '50% 100%' },
    'apechain_hoodie_orange': { zoom: 1.3, origin: '50% 100%' },
    'apechain_hoodie_blue': { zoom: 1.3, origin: '50% 100%' },
    'apefest_jacket': { zoom: 1.3, origin: '50% 100%' },
    'cheetah_hoodie': { zoom: 1.3, origin: '50% 100%' },
    'naked': { zoom: 1.3, origin: '50% 100%' },
    'french_stripes': { zoom: 1.3, origin: '50% 100%' },
    'cats_shirt': { zoom: 1.3, origin: '50% 100%' },
    'singe_hoodie': { zoom: 1.3, origin: '50% 100%' },
    'singe_hoodie_glow': { zoom: 1, origin: '50% 100%' },
    'applied_primate_coat': { zoom: 1.3, origin: '50% 100%' },
    'btc_hoodie': { zoom: 1.3, origin: '50% 100%' },
    'jacket': { zoom: 1.3, origin: '50% 100%' },
    'blazer': { zoom: 1.3, origin: '50% 100%' },
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
const cropFor = (crop, value) => (ASSET_CROPS[crop] && ASSET_CROPS[crop][value]) || CROPS[crop] || CROPS.extra;

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

function AssetThumb({ option, index, active, disabled, onPick, fetchPreview, cacheKey, crop, rootRef }) {
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
        if (index < EAGER_COUNT) {
            // First thumbnails: fetch right away, ahead of the lazy queue.
            loadPreview(cacheKey, fetchPreview, true).then(apply);
            return () => { cancelled = true; };
        }
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            observer.disconnect();
            loadPreview(cacheKey, fetchPreview).then(apply);
        }, { root: rootRef.current, rootMargin: '0px 160px' });
        observer.observe(node);
        return () => { cancelled = true; observer.disconnect(); };
    }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <button
            ref={ref}
            type="button"
            className={`asset-thumb ${active ? 'is-active' : ''}`}
            onClick={() => onPick(option.value)}
            disabled={disabled}
            aria-pressed={active}
            title={option.label}
        >
            <span className={`asset-thumb-img ${url ? '' : 'is-loading'} ${failed ? 'is-failed' : ''}`}>
                {url && <img src={url} alt="" width="72" height="72" style={{ transform: `scale(${cropFor(crop, option.value).zoom})`, transformOrigin: cropFor(crop, option.value).origin }} />}
            </span>
            <span className="asset-thumb-label">{shortName(option.label)}</span>
        </button>
    );
}

/** Horizontal, swipeable thumbnail row mirroring an existing <select>. */
export default function AssetStrip({ selectRef, param, tokenId, value, onPick, disabled, fetchAssetBlob, crop = 'extra' }) {
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
                const cacheKey = `${tokenId}|${param}|${option.value}`;
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
                        fetchPreview={() => fetchAssetBlob(`/api/get-asset?${query.toString()}`)}
                    />
                );
            })}
        </div>
        </div>
        </div>
    );
}
