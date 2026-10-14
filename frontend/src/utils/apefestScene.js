// Exact port of the @ApeFacingApes launch-post look (afa: scene/apefest_scene.py render_scene,
// unminted_scene.text; params in LAUNCH_LOOK_PARAMS.md). Same float64 maths as numpy and
// bit-exact ports of the Pillow 12 primitives it relies on (Lanczos resize via premultiplied RGBa,
// GaussianBlur = 3-pass extended box blur on 8-bit, alpha_composite), so the 1:1 export matches
// the launch renders pixel for pixel. PNGs are decoded here (not via <canvas>) to avoid the
// browser's premultiplied-alpha rounding.

// ---------- PNG decode (8-bit RGBA/RGB/GA/G, non-interlaced) ----------
async function inflate(bytes) {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function decodePng(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = 8; let w = 0; let h = 0; let depth = 0; let ctype = 0; let interlace = 0;
    const idat = [];
    while (p < u8.length) {
        const len = dv.getUint32(p); const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
        const data = u8.subarray(p + 8, p + 8 + len);
        if (type === 'IHDR') {
            w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = u8[p + 16]; ctype = u8[p + 17]; interlace = u8[p + 20];
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        p += 12 + len;
    }
    if (depth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(ctype)) throw new Error('unsupported png');
    const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
    let total = 0; idat.forEach((d) => { total += d.length; });
    const all = new Uint8Array(total); let o = 0; idat.forEach((d) => { all.set(d, o); o += d.length; });
    const raw = await inflate(all);
    const stride = w * ch; const px = new Uint8Array(h * stride);
    let prev = new Uint8Array(stride); let r = 0;
    for (let y = 0; y < h; y += 1) {
        const ft = raw[r]; r += 1;
        const line = px.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x += 1) {
            const a = x >= ch ? line[x - ch] : 0; const b = prev[x]; const c = x >= ch ? prev[x - ch] : 0;
            let v = raw[r + x];
            if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
            else if (ft === 4) { const pp = a + b - c; const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
            line[x] = v & 255;
        }
        r += stride; prev = line;
    }
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
        if (ch === 4) { rgba[i * 4] = px[i * 4]; rgba[i * 4 + 1] = px[i * 4 + 1]; rgba[i * 4 + 2] = px[i * 4 + 2]; rgba[i * 4 + 3] = px[i * 4 + 3]; }
        else if (ch === 3) { rgba[i * 4] = px[i * 3]; rgba[i * 4 + 1] = px[i * 3 + 1]; rgba[i * 4 + 2] = px[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
        else if (ch === 2) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = px[i * 2]; rgba[i * 4 + 3] = px[i * 2 + 1]; }
        else { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = px[i]; rgba[i * 4 + 3] = 255; }
    }
    return { w, h, data: rgba };
}

// ---------- Pillow primitives ----------
const PB = 22; // Resample PRECISION_BITS
const clip8 = (ss) => { const v = ss >> PB; return v < 0 ? 0 : (v > 255 ? 255 : v); };
const sinc = (x) => { if (x === 0.0) return 1.0; const t = x * Math.PI; return Math.sin(t) / t; };
const lanczos = (x) => ((-3.0 <= x && x < 3.0) ? sinc(x) * sinc(x / 3) : 0.0);
function coeffs(inSize, outSize) {
    const scale = inSize / outSize; const fs = scale < 1.0 ? 1.0 : scale;
    const support = 3.0 * fs; const ksize = Math.ceil(support) * 2 + 1;
    const kk = new Int32Array(outSize * ksize); const bounds = new Int32Array(outSize * 2);
    for (let xx = 0; xx < outSize; xx += 1) {
        const center = 0 + (xx + 0.5) * scale; const ss = 1.0 / fs;
        let xmin = Math.trunc(center - support + 0.5); if (xmin < 0) xmin = 0;
        let xmax = Math.trunc(center + support + 0.5); if (xmax > inSize) xmax = inSize;
        xmax -= xmin;
        const k = new Float64Array(xmax); let ww = 0.0;
        for (let x = 0; x < xmax; x += 1) { const wv = lanczos((x + xmin - center + 0.5) * ss); k[x] = wv; ww += wv; }
        for (let x = 0; x < xmax; x += 1) {
            const v = ww !== 0.0 ? k[x] / ww : k[x];
            kk[xx * ksize + x] = v < 0 ? Math.trunc(-0.5 + v * (1 << PB)) : Math.trunc(0.5 + v * (1 << PB));
        }
        bounds[xx * 2] = xmin; bounds[xx * 2 + 1] = xmax;
    }
    return { kk, bounds, ksize };
}
// Image.resize((s, s), LANCZOS) on RGBA: RGBA->RGBa, horizontal then vertical 8bpc pass, RGBa->RGBA.
export function resizeLanczosRGBA(src, w, h, ow, oh) {
    const pm = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        for (let c = 0; c < 3; c += 1) { const t = src[i + c] * a + 128; pm[i + c] = ((t >> 8) + t) >> 8; }
        pm[i + 3] = a;
    }
    const H = coeffs(w, ow); const V = coeffs(h, oh);
    const yfirst = V.bounds[0]; const ylast = V.bounds[oh * 2 - 2] + V.bounds[oh * 2 - 1];
    const th = ylast - yfirst; const tmp = new Uint8Array(ow * th * 4);
    for (let yy = 0; yy < th; yy += 1) {
        const row = (yy + yfirst) * w * 4;
        for (let xx = 0; xx < ow; xx += 1) {
            const xmin = H.bounds[xx * 2]; const xmax = H.bounds[xx * 2 + 1]; const kb = xx * H.ksize;
            let s0 = 1 << (PB - 1); let s1 = s0; let s2 = s0; let s3 = s0;
            for (let x = 0; x < xmax; x += 1) {
                const k = H.kk[kb + x]; const q = row + (x + xmin) * 4;
                s0 += pm[q] * k; s1 += pm[q + 1] * k; s2 += pm[q + 2] * k; s3 += pm[q + 3] * k;
            }
            const o = (yy * ow + xx) * 4; tmp[o] = clip8(s0); tmp[o + 1] = clip8(s1); tmp[o + 2] = clip8(s2); tmp[o + 3] = clip8(s3);
        }
    }
    const out = new Uint8Array(ow * oh * 4);
    for (let yy = 0; yy < oh; yy += 1) {
        const ymin = V.bounds[yy * 2] - yfirst; const ymax = V.bounds[yy * 2 + 1]; const kb = yy * V.ksize;
        for (let xx = 0; xx < ow; xx += 1) {
            let s0 = 1 << (PB - 1); let s1 = s0; let s2 = s0; let s3 = s0;
            for (let y = 0; y < ymax; y += 1) {
                const k = V.kk[kb + y]; const q = ((y + ymin) * ow + xx) * 4;
                s0 += tmp[q] * k; s1 += tmp[q + 1] * k; s2 += tmp[q + 2] * k; s3 += tmp[q + 3] * k;
            }
            const o = (yy * ow + xx) * 4; out[o] = clip8(s0); out[o + 1] = clip8(s1); out[o + 2] = clip8(s2); out[o + 3] = clip8(s3);
        }
    }
    for (let i = 0; i < out.length; i += 4) {
        const a = out[i + 3];
        if (a !== 255 && a !== 0) {
            for (let c = 0; c < 3; c += 1) { const v = Math.trunc((255 * out[i + c]) / a); out[i + c] = v <= 0 ? 0 : (v < 256 ? v : 255); }
        }
    }
    return out;
}
const f32 = Math.fround;
function gaussRadius(radius) {
    const r = f32(radius);
    const sigma2 = f32(f32(r * r) / 3);
    const L = f32(Math.sqrt(12.0 * sigma2 + 1.0));
    const l = f32(Math.floor((L - 1.0) / 2.0));
    const t1 = f32(f32(2 * l) + 1);
    const t2 = f32(f32(l * f32(l + 1)) - f32(3 * sigma2));
    let a = f32(t1 * t2);
    const den = f32(6 * f32(sigma2 - f32(f32(l + 1) * f32(l + 1))));
    a = f32(a / den);
    return f32(l + a);
}
// One horizontal box pass over `lines` lines of length `len`, `ch` interleaved channels, in place.
function boxLine(buf, len, lines, ch, fr, lineStride, step) {
    const radius = Math.trunc(fr);
    const ww = Math.trunc(f32((1 << 24) / f32(f32(fr * 2) + 1)));
    const fw = Math.trunc(((1 << 24) - (radius * 2 + 1) * ww) / 2) >>> 0;
    const lastx = len - 1;
    const edgeA = Math.min(radius + 1, len); const edgeB = Math.max(len - radius - 1, 0);
    const lineIn = new Float64Array(len); const lineOut = new Uint8Array(len);
    for (let l = 0; l < lines; l += 1) {
        for (let c = 0; c < ch; c += 1) {
            const base = l * lineStride + c;
            for (let x = 0; x < len; x += 1) lineIn[x] = buf[base + x * step];
            const L = (i) => lineIn[i];
            let acc = L(0) * (radius + 1);
            for (let x = 0; x < edgeA - 1; x += 1) acc += L(x);
            acc += L(lastx) * (radius - edgeA + 1);
            const save = (x, bulk) => { lineOut[x] = Math.floor((bulk + (1 << 23)) / (1 << 24)) & 255; };
            if (edgeA <= edgeB) {
                for (let x = 0; x < edgeA; x += 1) { acc += L(x + radius) - L(0); save(x, acc * ww + (L(0) + L(x + radius + 1)) * fw); }
                for (let x = edgeA; x < edgeB; x += 1) { acc += L(x + radius) - L(x - radius - 1); save(x, acc * ww + (L(x - radius - 1) + L(x + radius + 1)) * fw); }
                for (let x = edgeB; x <= lastx; x += 1) { acc += L(lastx) - L(x - radius - 1); save(x, acc * ww + (L(x - radius - 1) + L(lastx)) * fw); }
            } else {
                for (let x = 0; x < edgeB; x += 1) { acc += L(x + radius) - L(0); save(x, acc * ww + (L(0) + L(x + radius + 1)) * fw); }
                for (let x = edgeB; x < edgeA; x += 1) { acc += L(lastx) - L(0); save(x, acc * ww + (L(0) + L(lastx)) * fw); }
                for (let x = edgeA; x <= lastx; x += 1) { acc += L(lastx) - L(x - radius - 1); save(x, acc * ww + (L(x - radius - 1) + L(lastx)) * fw); }
            }
            for (let x = 0; x < len; x += 1) buf[base + x * step] = lineOut[x];
        }
    }
}
// ImageFilter.GaussianBlur(radius) on an 8-bit image with `ch` channels (RGB uses 4-byte pixels in
// Pillow, but channels are independent so 3 is equivalent). Returns a new Uint8Array.
export function pilGaussianBlur(src, w, h, ch, radius) {
    const fr = gaussRadius(radius);
    const buf = Uint8Array.from(src);
    if (fr === 0) return buf;
    for (let i = 0; i < 3; i += 1) boxLine(buf, w, h, ch, fr, w * ch, ch);
    for (let i = 0; i < 3; i += 1) boxLine(buf, h, w, ch, fr, ch, w * ch);
    return buf;
}
// Image.alpha_composite(dst, src), RGBA 8-bit, in place into dst.
export function pilAlphaComposite(dst, src) {
    const PBA = 7;
    const sh = (a) => (((a >>> 8) + a) >>> 8);
    for (let i = 0; i < dst.length; i += 4) {
        const sa = src[i + 3];
        if (sa === 0) continue;
        const blend = dst[i + 3] * (255 - sa);
        const outa255 = sa * 255 + blend;
        const coef1 = Math.floor((sa * 255 * 255 * (1 << PBA)) / outa255);
        const coef2 = 255 * (1 << PBA) - coef1;
        for (let c = 0; c < 3; c += 1) {
            const tmp = src[i + c] * coef1 + dst[i + c] * coef2;
            dst[i + c] = sh(tmp + (0x80 << PBA)) >>> PBA;
        }
        dst[i + 3] = sh(outa255 + 0x80);
    }
}

// ---------- render_scene (minted launch look) ----------
// numpy.random.default_rng(0) tears for crt 1.8, precomputed (y0, height, dx).
export const LAUNCH_TEARS = {
    '1000x1000': [[730, 7, -14], [296, 3, -7], [190, 9, 16], [452, 7, 19], [555, 7, 14], [271, 9, -16], [365, 9, -14]],
    '1600x900': [[657, 7, -14], [266, 3, -7], [171, 9, 16], [407, 7, 19], [500, 7, 14], [244, 9, -16], [328, 9, -14]],
};
export const LAUNCH = { crt: 1.8, apeScale: 0.92, apeX: 0.5, gain: 1.0, glow: 1.0, rimK: 1.0, rimR: 1.0, soft: true };

export function renderSceneRGB(ape, W = 1000, H = 1000, opts = {}) {
    const o = { ...LAUNCH, ...opts };
    const m = Math.min(W, H);
    const s = Math.trunc(m * o.apeScale);
    const res = resizeLanczosRGBA(ape.data, ape.w, ape.h, s, s);
    const n = s * s;
    const al = new Float64Array(n);
    for (let i = 0; i < n; i += 1) al[i] = res[i * 4 + 3] / 255;
    const dark = [8 / 255, 2 / 255, 3 / 255]; const red = [225 / 255, 20 / 255, 30 / 255]; const hot = [255 / 255, 140 / 255, 120 / 255];
    // rim: GaussianBlur of the alpha mask (uint8 of al*255, truncated)
    const am = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) am[i] = Math.trunc(al[i] * 255);
    const innerU = pilGaussianBlur(am, s, s, 1, (s / 120) * o.rimR);
    const col = new Float64Array(n * 3);
    for (let y = 0; y < s; y += 1) {
        for (let x = 0; x < s; x += 1) {
            const i = y * s + x;
            const r = res[i * 4] / 255; const g = res[i * 4 + 1] / 255; const b = res[i * 4 + 2] / 255;
            const lum = 0.3 * r + 0.59 * g + 0.11 * b;
            let t = Math.min(Math.max((lum - 0.18) / 0.78, 0), 1) ** 2.1;
            const yy = y / s; const xx = x / s;
            const key = Math.min(Math.max(1.25 - Math.hypot(xx - 0.66, yy - 0.28) * 1.5, 0.15), 1);
            t = t * key * o.gain;
            let rim = Math.min(Math.max(al[i] - innerU[i] / 255, 0), 1) * 2.2 * o.rimK;
            for (let c = 0; c < 3; c += 1) {
                let v = t < 0.6 ? dark[c] + (red[c] - dark[c]) * (t / 0.6) : red[c] + (hot[c] - red[c]) * ((t - 0.6) / 0.4) ** 2;
                v = v + rim * red[c] * 0.9 * o.glow;
                col[i * 3 + c] = Math.min(Math.max(v, 0), 1);
            }
            rim = 0;
        }
    }
    const N = W * H;
    const cv = new Float64Array(N * 3);
    const cx = W * o.apeX; const cy = H * 0.46;
    const base = [4 / 255, 2 / 255, 3 / 255]; const coreC = [1, 0.3, 0.25];
    for (let Y = 0; Y < H; Y += 1) {
        for (let X = 0; X < W; X += 1) {
            const d = Math.hypot((X - cx) / (m * 0.42), (Y - cy) / (m * 0.40));
            const d2 = d ** 2;
            const g1 = Math.exp(-d2 * 1.3); const g2 = Math.exp(-d2 * 5);
            const p = (Y * W + X) * 3;
            for (let c = 0; c < 3; c += 1) cv[p + c] = base[c] + (g1 * red[c] * 0.55 + g2 * coreC[c] * 0.18) * o.glow;
        }
    }
    const ox = Math.trunc(cx - s / 2); const oy = H - s;
    for (let y = 0; y < s; y += 1) {
        for (let x = 0; x < s; x += 1) {
            const i = y * s + x; const a = al[i]; const p = ((oy + y) * W + ox + x) * 3;
            for (let c = 0; c < 3; c += 1) cv[p + c] = cv[p + c] * (1 - a) + col[i * 3 + c] * a;
        }
    }
    // bloom
    const u8 = new Uint8Array(N * 3);
    for (let i = 0; i < N * 3; i += 1) u8[i] = Math.trunc(Math.min(Math.max(cv[i], 0), 1) * 255);
    const bl = pilGaussianBlur(u8, W, H, 3, m / 60);
    const bk = 0.35 + 0.12 * (o.crt - 1);
    for (let i = 0; i < N * 3; i += 1) { const c = Math.min(Math.max(cv[i], 0), 1); cv[i] = 1 - (1 - c) * (1 - (bl[i] / 255) * bk); }
    // RGB split (np.roll: R right, B left)
    const sh = Math.max(1, Math.round((W / 500) * o.crt));
    const c2 = new Float64Array(N * 3);
    for (let Y = 0; Y < H; Y += 1) {
        for (let X = 0; X < W; X += 1) {
            const p = (Y * W + X) * 3;
            c2[p] = cv[(Y * W + ((X - sh + W) % W)) * 3];
            c2[p + 1] = cv[p + 1];
            c2[p + 2] = cv[(Y * W + ((X + sh) % W)) * 3 + 2];
        }
    }
    // scanlines, eased back over the face
    const period = Math.max(3, Math.trunc(H / 300)); const half = Math.trunc(period / 2);
    for (let Y = 0; Y < H; Y += 1) {
        if (!((Y % period) < half)) continue;
        for (let X = 0; X < W; X += 1) {
            const face = Math.exp(-(((X - cx) / (m * 0.22)) ** 2 + ((Y - H * 0.40) / (m * 0.25)) ** 2));
            const f = 1 - Math.min(0.85, (0.29 - 0.07 * face) * (1 + 0.55 * (o.crt - 1)));
            const p = (Y * W + X) * 3; c2[p] *= f; c2[p + 1] *= f; c2[p + 2] *= f;
        }
    }
    // tears
    (LAUNCH_TEARS[`${W}x${H}`] || []).forEach(([y0, h, dx]) => {
        for (let Y = y0; Y < Math.min(H, y0 + h); Y += 1) {
            const row = c2.slice(Y * W * 3, (Y + 1) * W * 3);
            for (let X = 0; X < W; X += 1) {
                const from = ((((X - dx) % W) + W) % W) * 3; const p = (Y * W + X) * 3;
                c2[p] = row[from]; c2[p + 1] = row[from + 1]; c2[p + 2] = row[from + 2];
            }
        }
    });
    let c3 = c2;
    if (o.crt > 1 && o.soft) {
        const q = new Uint8Array(N * 3);
        for (let i = 0; i < N * 3; i += 1) q[i] = Math.trunc(Math.min(Math.max(c2[i], 0), 1) * 255);
        const sb = pilGaussianBlur(q, W, H, 3, 0.4 * (o.crt - 1));
        c3 = new Float64Array(N * 3);
        for (let i = 0; i < N * 3; i += 1) c3[i] = sb[i] / 255;
    }
    // vignette -> RGBA 8-bit
    const out = new Uint8Array(N * 4);
    for (let Y = 0; Y < H; Y += 1) {
        for (let X = 0; X < W; X += 1) {
            const v = Math.min(Math.max(1 - ((X - W / 2) / (W * 0.75)) ** 2 - ((Y - H / 2) / (H * 0.75)) ** 2, 0), 1) ** 0.6;
            const p = (Y * W + X) * 3; const q = (Y * W + X) * 4;
            for (let c = 0; c < 3; c += 1) out[q + c] = Math.trunc(Math.min(Math.max(c3[p + c] * v, 0), 1) * 255);
            out[q + 3] = 255;
        }
    }
    return out;
}

