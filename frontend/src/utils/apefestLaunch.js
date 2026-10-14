import { decodePng, renderSceneRGB, pilAlphaComposite } from './apefestScene';

// ---------- editor entry point ----------
// square = the launch post frame (text baked from afa's PIL layers, so it matches 1:1);
// wide   = same scene maths at 1600x900 (scene script: ape_scale .95, ape_x .69), text drawn by the editor.
export const LAUNCH_FORMATS = {
    square: { W: 1000, H: 1000, opts: {}, layers: ['/apefest/text_minted_1000_glow.png', '/apefest/text_minted_1000.png'] },
    wide: { W: 1600, H: 900, opts: { apeScale: 0.95, apeX: 0.69 }, layers: [] },
};
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
async function renderPixels(src, W, H, opts, layers) {
    const w = typeof Worker !== 'undefined' ? getWorker() : false;
    if (w) {
        try {
            return await new Promise((resolve, reject) => {
                seq += 1; const id = seq; pending.set(id, { resolve, reject });
                const s = src.slice(0); const ls = layers.map((b) => b.slice(0));
                w.postMessage({ id, src: s, W, H, opts, layers: ls }, [s, ...ls]);
            });
        } catch (e) { /* fall through to the main thread */ }
    }
    const ape = await decodePng(src);
    const out = renderSceneRGB(ape, W, H, opts);
    for (const buf of layers) pilAlphaComposite(out, (await decodePng(buf)).data);
    return out;
}
// blob: server PNG (get-asset, thirdAssetType=transparent). Returns a canvas.
export async function renderApefestLaunch(blob, format = 'square') {
    const F = LAUNCH_FORMATS[format];
    const [src, ...layers] = await Promise.all([blob.arrayBuffer(), ...F.layers.map(fetchLayer)]);
    const px = await renderPixels(src, F.W, F.H, F.opts, layers);
    const canvas = document.createElement('canvas');
    canvas.width = F.W; canvas.height = F.H;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), F.W, F.H), 0, 0);
    return canvas;
}
