import { decodePng, renderSceneRGB, pilAlphaComposite, pilGaussianBlur, keyReply } from './apefestScene';

// One render job (worker or main-thread fallback).
export async function runJob({ src, raw, W, H, opts, layers, glowLayers, rawLayer, unminted }) {
    let ape;
    if (unminted) ape = keyReply(raw);
    else ape = await decodePng(src);
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

