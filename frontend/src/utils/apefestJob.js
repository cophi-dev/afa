import { decodePng, renderSceneRGB, pilAlphaComposite, pilGaussianBlur, keyReply, fitTop } from './apefestScene';

// One render job (worker or main-thread fallback).
// Tile input decoded off the main thread when OffscreenCanvas exists (worker), else on the caller.
async function decodeBlobRGBA(blob) {
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, data: new Uint8Array(x.getImageData(0, 0, bmp.width, bmp.height).data.buffer) };
}
export async function runJob({ src, raw, rgba: rgbaIn, tileBlob, W, H, opts, layers, glowLayers, rawLayer, unminted }) {
    let ape;
    const rgba = tileBlob ? await decodeBlobRGBA(tileBlob) : rgbaIn;
    if (rgba) ape = rgba; // list tile: decoded transparent thumbnail
    else if (unminted) ape = keyReply(raw);
    else ape = await decodePng(src);
    if (W === 1000 && H === 1000) ape = fitTop(ape, (opts && opts.apeScale) || 0.92, H);
    let out = renderSceneRGB(ape, W, H, opts);
    if (opts && opts.tileFlat) out = flattenTile(out, W, H, opts);
    const decoded = [];
    for (const buf of layers || []) decoded.push((await decodePng(buf)).data);
    const glows = [];
    for (const buf of glowLayers || []) glows.push((await decodePng(buf)).data);
    // glow first (all), then sharp text (afa text(): alpha_composite(img, blur(gl)), then gl)
    glows.forEach((g) => pilAlphaComposite(out, g));
    if (rawLayer) pilAlphaComposite(out, pilGaussianBlur(rawLayer.data, rawLayer.w, rawLayer.h, 4, rawLayer.glowRadius));
    decoded.forEach((l) => pilAlphaComposite(out, l));
    if (rawLayer) pilAlphaComposite(out, rawLayer.data);
    return out;
}


// Tiles (Design 15.10): background exactly #0b0b0c with no bloom lift or scanline seams.
// out = target + (frame - emptyFrame): an empty scene with the same maths is subtracted, so only the
// ape and its halo remain; the head glow (opts.headGlow) is part of the frame, not the empty scene.
const emptyCache = new Map();
function flattenTile(px, W, H, opts) {
    const key = `${W}x${H}`;
    if (!emptyCache.has(key)) {
        const base = { ...opts };
        emptyCache.set(key, renderSceneRGB({ w: 4, h: 4, data: new Uint8Array(64) }, W, H, { ...base, bgGlow: 0 }));
    }
    const empty = emptyCache.get(key);
    const t = opts.tileFlat; // [r,g,b] 0..255
    for (let i = 0; i < px.length; i += 4) {
        px[i] = Math.max(0, Math.min(255, t[0] + px[i] - empty[i]));
        px[i + 1] = Math.max(0, Math.min(255, t[1] + px[i + 1] - empty[i + 1]));
        px[i + 2] = Math.max(0, Math.min(255, t[2] + px[i + 2] - empty[i + 2]));
    }
    return px;
}
