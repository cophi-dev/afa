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
    const out = renderSceneRGB(ape, W, H, opts);
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

