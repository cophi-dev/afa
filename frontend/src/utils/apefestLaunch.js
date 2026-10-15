import { runJob } from './apefestJob';
import { LAUNCH_UNMINTED } from './apefestScene';

// Uncompressed 24-bit BMP of the exact pixels: instant to build and decode (canvas.toBlob PNG
// encoding of a 1000x1000 frame took 0.5-6.8 s at 4x CPU and was most of the cold preview time).
// The PNG for download/share is encoded afterwards, off the critical path.
export function makeBmp(px, W, H) {
    const row = Math.ceil((W * 3) / 4) * 4; const size = 54 + row * H;
    const buf = new ArrayBuffer(size); const dv = new DataView(buf); const u8 = new Uint8Array(buf);
    dv.setUint16(0, 0x4d42, true); dv.setUint32(2, size, true); dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true); dv.setInt32(18, W, true); dv.setInt32(22, H, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, row * H, true);
    for (let y = 0; y < H; y += 1) {
        let o = 54 + (H - 1 - y) * row; let i = y * W * 4;
        for (let x = 0; x < W; x += 1, i += 4, o += 3) { u8[o] = px[i + 2]; u8[o + 1] = px[i + 1]; u8[o + 2] = px[i]; }
    }
    return new Blob([buf], { type: 'image/bmp' });
}

// ---------- editor entry point ----------
// Minted:   launch post frame; square text = afa's PIL layers (1:1 pixel-identical).
// Unminted: afa reply pipeline (key_reply on the server blur + scene with soft glow), top text from
//           afa's layer, bottom 'APE #N' + 'NOT YET MINTED' drawn here (DejaVu Sans Mono Bold, as afa).
// Wide:     same scene maths at 1600x900, text drawn by the editor.
const MINTED = {
    square: { W: 1000, H: 1000, opts: {}, glowLayers: ['/apefest/text_minted_1000_glow.png'], layers: ['/apefest/text_claim_outline_1000.png', '/apefest/text_minted_1000.png'] },
    wide: { W: 1600, H: 900, opts: { apeScale: 0.95, apeX: 0.69 }, glowLayers: [], layers: [] },
};
const UNMINTED = {
    square: { W: 1000, H: 1000, opts: { ...LAUNCH_UNMINTED }, glowLayers: ['/apefest/text_top_1000_glow.png'], layers: ['/apefest/text_claim_outline_1000.png', '/apefest/text_top_1000.png'] },
    wide: { W: 1600, H: 900, opts: { ...LAUNCH_UNMINTED, apeScale: 0.87, apeX: 0.69 }, glowLayers: [], layers: [] },
};
export const LAUNCH_FORMATS = MINTED;
const RED = [225, 20, 30];
const MONO = '"AFA DejaVu Mono Bold", "DejaVu Sans Mono", Menlo, monospace';

const layerCache = new Map();
const fetchLayer = (url) => {
    if (!layerCache.has(url)) layerCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`layer ${r.status}`); return r.arrayBuffer(); }).catch((e) => { layerCache.delete(url); throw e; }));
    return layerCache.get(url);
};
let worker = null; let seq = 0; const pending = new Map();
function getWorker() {
    if (worker !== null) return worker;
    try {
        worker = new Worker(new URL('./apefestLaunch.worker.js', import.meta.url));
        worker.onmessage = ({ data }) => { const p = pending.get(data.id); if (!p) return; pending.delete(data.id); if (data.error) p.reject(new Error(data.error)); else p.resolve(data.out); };
        worker.onerror = () => { pending.forEach((p) => p.reject(new Error('worker failed'))); pending.clear(); worker = false; };
    } catch (e) { worker = false; }
    return worker;
}
async function runAnywhere(job, transfer) {
    const w = typeof Worker !== 'undefined' ? getWorker() : false;
    if (w) {
        try {
            return await new Promise((resolve, reject) => {
                seq += 1; const id = seq; pending.set(id, { resolve, reject });
                w.postMessage({ ...job, id }, transfer);
            });
        } catch (e) { /* main-thread fallback below */ }
    }
    return runJob(job);
}
let fontPromise = null;
function loadMonoFont() {
    if (!fontPromise) {
        fontPromise = (async () => {
            if (typeof FontFace === 'undefined') return;
            const f = new FontFace('AFA DejaVu Mono Bold', 'url(/fonts/dejavu-sans-mono-bold-sub.woff2)');
            document.fonts.add(await f.load());
        })().catch(() => {});
    }
    return fontPromise;
}
// afa text(): bottom 22px mono centred, baseline 950, alpha 0.8; small 13px, tracking 0.08em,
// 50% alpha, cap top 10px below the bottom baseline.
async function bottomTextLayer(W, H, bottom, small) {
    await loadMonoFont();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgba(${RED.join(',')},${Math.trunc(255 * 0.8) / 255})`;
    ctx.font = `22px ${MONO}`; ctx.textAlign = 'center';
    ctx.fillText(bottom, W / 2, 950);
    if (small) {
        ctx.font = `13px ${MONO}`; ctx.textAlign = 'left';
        ctx.fillStyle = `rgba(${RED.join(',')},${128 / 255})`;
        const tr = 13 * 0.08; const chars = [...small]; const ws = chars.map((ch) => ctx.measureText(ch).width);
        let x = (W - (ws.reduce((a, b) => a + b, 0) + tr * (chars.length - 1))) / 2;
        const cap = 9; // PIL: -bbox('N', anchor='ls')[1] at 13px
        chars.forEach((ch, k) => { ctx.fillText(ch, x, 950 + 10 + cap); x += ws[k] + tr; });
    }
    const d = ctx.getImageData(0, 0, W, H).data;
    return { w: W, h: H, data: new Uint8Array(d.buffer.slice(0)), glowRadius: 8 };
}
async function decodeAny(blob) {
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, data: new Uint8Array(ctx.getImageData(0, 0, bmp.width, bmp.height).data.buffer) };
}
// blob: server image (minted: get-asset transparent PNG; unminted: get-asset-preview blur). Returns a canvas.
export async function renderApefestLaunch(blob, format = 'square', { unminted = false, tokenId = '' } = {}) {
    const F = (unminted ? UNMINTED : MINTED)[format];
    const [layers, glowLayers] = await Promise.all([Promise.all(F.layers.map(fetchLayer)), Promise.all(F.glowLayers.map(fetchLayer))]);
    const job = { W: F.W, H: F.H, opts: F.opts, unminted, layers: layers.map((b) => b.slice(0)), glowLayers: glowLayers.map((b) => b.slice(0)) };
    const transfer = [...job.layers, ...job.glowLayers];
    if (unminted) {
        job.raw = await decodeAny(blob); transfer.push(job.raw.data.buffer);
        if (format === 'square') { job.rawLayer = await bottomTextLayer(F.W, F.H, `APE #${tokenId}`, 'NOT YET MINTED'); transfer.push(job.rawLayer.data.buffer); }
    } else {
        job.src = await blob.arrayBuffer(); transfer.push(job.src);
    }
    const px = await runAnywhere(job, transfer);
    const canvas = document.createElement('canvas');
    canvas.width = F.W; canvas.height = F.H;
    canvas.apefestBmp = makeBmp(px, F.W, F.H);
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), F.W, F.H), 0, 0);
    return canvas;
}

// ---------- list tiles (Phillipp 15.10): small launch frame, no text, uniform #0b0b0c ----------
// Same scene maths as the big preview on the transparent 256px thumbnail, in the worker,
// one tile at a time, cached per URL (BMP blob URL, never revoked while the page lives).
export const TILE_SIZE = 256;
// bgGlow 0.25 = head glow at ~25% of the big preview (Design 15.10); flattened to exactly #0b0b0c.
const TILE_OPTS = { bgGlow: 0.25, bgBase: [11 / 255, 11 / 255, 12 / 255], vignette: false, apeScale: 0.96, tileFlat: [11, 11, 12] };
const tileCache = new Map();
const tileQueue = [];
let tileBusy = false;
function pumpTiles() {
    if (tileBusy || !tileQueue.length) return;
    tileBusy = true;
    const { run, resolve, reject } = tileQueue.shift();
    run().then(resolve, reject).finally(() => { tileBusy = false; setTimeout(pumpTiles, 0); });
}
export function renderApefestTile(url) {
    if (tileCache.has(url)) return tileCache.get(url);
    const p = new Promise((resolve, reject) => {
        tileQueue.push({
            resolve, reject,
            run: async () => {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`tile ${res.status}`);
                const blob = await res.blob();
                const offscreen = typeof OffscreenCanvas !== 'undefined';
                const job = { W: TILE_SIZE, H: TILE_SIZE, opts: TILE_OPTS, layers: [], glowLayers: [] };
                if (offscreen) job.tileBlob = blob; else job.rgba = await decodeAny(blob);
                const px = await runAnywhere(job, offscreen ? [] : [job.rgba.data.buffer]);
                return URL.createObjectURL(makeBmp(px, TILE_SIZE, TILE_SIZE));
            },
        });
        pumpTiles();
    });
    p.catch(() => tileCache.delete(url));
    tileCache.set(url, p);
    return p;
}
// Cancel queued (not started) tiles, e.g. on mode switch off.
export function clearApefestTileQueue() { tileQueue.splice(0).forEach((j) => j.reject(new Error('cancelled'))); }
