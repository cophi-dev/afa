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

const loadPreview = (key, fetcher, priority = false) => {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve) => {
        queue[priority ? 'unshift' : 'push'](async () => {
            try {
                const blob = await fetcher();
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
                {url && <img src={url} alt="" width="72" height="72" style={{ transform: `scale(${(CROPS[crop] || CROPS.extra).zoom})`, transformOrigin: (CROPS[crop] || CROPS.extra).origin }} />}
            </span>
            <span className="asset-thumb-label">{option.label}</span>
        </button>
    );
}

/** Horizontal, swipeable thumbnail row mirroring an existing <select>. */
export default function AssetStrip({ selectRef, param, tokenId, value, onPick, disabled, fetchAssetBlob, crop = 'extra' }) {
    const [options, setOptions] = useState([]);
    const rootRef = useRef(null);

    useEffect(() => {
        const select = selectRef.current;
        if (!select) return;
        setOptions(Array.from(select.options)
            .filter((o) => o.value && !o.disabled)
            .map((o) => ({ value: o.value, label: o.textContent.trim() })));
    }, [selectRef, tokenId]);

    if (!tokenId || options.length === 0) return null;

    return (
        <div className="asset-strip" ref={rootRef} role="group" aria-label="Asset previews">
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
    );
}
