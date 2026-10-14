// ApeFest look: client-side canvas port of x/apefest/scene/apefest_scene.py render_scene().
// Input is the fully composed ape on a transparent background (server thirdAssetType=transparent).
// Applied last: every hat/outfit/asset stays active. No logos, only "STILL HERE." + "10.17".

export const APEFEST_RED = '#e1141e';
const RED = [225 / 255, 20 / 255, 30 / 255];
const DARK = [8 / 255, 2 / 255, 3 / 255];
const HOT = [1, 140 / 255, 120 / 255];
const BG = [4 / 255, 2 / 255, 3 / 255];

// CRT strength, shared by the baked image and the page overlay (App.js sets --crt/--scan/--jump).
// 1.0 = approved look, ~2.5 = strong poster look (refs *_strong.png). Design: 1.8 overall,
// scanlines at the strong (2.5) level, line-jump offset kept small so jumps never cut the face.
export const APEFEST_CRT = 1.8;
export const APEFEST_SCAN = 2.5;
export const APEFEST_JUMP = 1.0;
// Page overlay scanline strength (Design: lighter than the image so the UI stays readable).
// Share text while ApeFest mode is on (text + image, no link). Final copy from afa.
// {id} = token id. Unminted apes get "Ape #N" instead of "AFA #N".
export const APEFEST_SHARE_TEXT = 'Four days. One club.\nAFA #{id}, still here. @ApeFacingApes';
// Unminted apes (blurred preview): final copy from afa.
export const APEFEST_SHARE_TEXT_UNMINTED = 'Four days. One club.\nApe #{id}, not here yet. @ApeFacingApes';
export const buildApefestShareText = (tokenId, minted = true) =>
  (minted ? APEFEST_SHARE_TEXT : APEFEST_SHARE_TEXT_UNMINTED).replace(/\{id\}/g, String(tokenId ?? ''));
// Unminted apes: the existing server-blurred image gets the same ApeFest render on top (blur unchanged).
// Bottom line becomes 'APE #N' (mono) with a small 'NOT YET MINTED' (50%) below; the claim stays.
export const apefestUnmintedText = (tokenId) => ({ sub: `APE #${tokenId}`, note: 'NOT YET MINTED', keyLight: true, glowScale: APEFEST_UNMINTED_GLOW });
export const APEFEST_PAGE_SCAN = 1.2;

// Text layout per format (Design). All values in output pixels.
// square: claim centred, cap height 40, top edge y=72; date centred, 22px mono, baseline 950, 70% opacity.
//         If the head comes closer than headGap to the claim, the ape moves down by headShift.
// wide:   claim + date left at shoulder height, ape in the right third.
export const APEFEST_TEXT = {
    square: { align: 'center', capHeight: 40, capTop: 72, headGap: 50, headShift: 30, subSize: 22, subBaseline: 950, subAlign: 'center', subAlpha: 0.7 },
    wide: { align: 'left', x: 96, capHeight: 36, capTop: 640, subSize: 22, subBaseline: 722, subAlign: 'left', subAlpha: 0.7 },
};

export const APEFEST_FORMATS = {
    square: { W: 1000, H: 1000, apeScale: 0.92, apeX: 0.5 },
    wide: { W: 1600, H: 900, apeScale: 0.95, apeX: 0.72 },
};

// Mono labels on the image ('10.17', 'APE #N', 'NOT YET MINTED'): JetBrains Mono 500, self-hosted Latin subset.
const APEFEST_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
// Unminted note under 'APE #N': 13px at 1000px, letter-spacing 0.08em, 10px below, 50% opacity.
export const APEFEST_NOTE = { size: 13, gap: 10, tracking: 0.08, alpha: 0.5 };
// Unminted: glow -10%; the light blur background is keyed to #0b0b0c before the duotone.
export const APEFEST_UNMINTED_GLOW = 0.9;

let fontsReady = null;
export function loadApefestFonts() {
    if (fontsReady) return fontsReady;
    const faces = [
        new FontFace('Press Start 2P', "url('/fonts/press-start-2p-400.woff2') format('woff2')"),
        new FontFace('JetBrains Mono', "url('/fonts/jetbrains-mono-500.woff2') format('woff2')", { weight: '500', display: 'swap' }),
    ];
    fontsReady = Promise.all(faces.map((f) => f.load().then((l) => { document.fonts.add(l); }).catch(() => null)))
        .then(() => Promise.all([
            document.fonts.load(`500 22px ${APEFEST_MONO}`, 'APE #0123456789. NOT YET MINTED'),
            document.fonts.load('40px "Press Start 2P"', 'STILL HERE.'),
        ]).catch(() => null));
    return fontsReady;
}

// Separable 3x box blur ~ gaussian(sigma) on a Float32Array with `ch` channels.
function boxBlur(src, w, h, ch, sigma) {
    if (sigma < 0.5) return src.slice();
    const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
    let a = src.slice();
    let b = new Float32Array(src.length);
    // Perf: direct strided indexing (no per-sample closure); identical result to the old version.
    const norm = 1 / (2 * r + 1);
    const pass = (from, to, horizontal) => {
        const len = horizontal ? w : h;
        const lines = horizontal ? h : w;
        const step = (horizontal ? 1 : w) * ch;
        const last = len - 1;
        for (let l = 0; l < lines; l += 1) {
            const base0 = (horizontal ? l * w : l) * ch;
            for (let c = 0; c < ch; c += 1) {
                const base = base0 + c;
                let sum = 0;
                for (let i = -r; i <= r; i += 1) sum += from[base + (i < 0 ? 0 : (i > last ? last : i)) * step];
                for (let i = 0; i < len; i += 1) {
                    to[base + i * step] = sum * norm;
                    const ia = i + r + 1;
                    const ib = i - r;
                    sum += from[base + (ia > last ? last : ia) * step] - from[base + (ib < 0 ? 0 : ib) * step];
                }
            }
        }
    };
    // Vertical pass row-major (all columns at once): cache-friendly, same summation order per column.
    const vpass = (from, to) => {
        const rowLen = w * ch;
        const last = h - 1;
        const sum = new Float64Array(rowLen);
        for (let i = -r; i <= r; i += 1) {
            const ro = (i < 0 ? 0 : (i > last ? last : i)) * rowLen;
            for (let q = 0; q < rowLen; q += 1) sum[q] += from[ro + q];
        }
        for (let i = 0; i < h; i += 1) {
            const ro = i * rowLen;
            const ia = i + r + 1;
            const ib = i - r;
            const ra = (ia > last ? last : ia) * rowLen;
            const rb = (ib < 0 ? 0 : ib) * rowLen;
            for (let q = 0; q < rowLen; q += 1) {
                to[ro + q] = sum[q] * norm;
                sum[q] += from[ra + q] - from[rb + q];
            }
        }
    };
    for (let k = 0; k < 3; k += 1) {
        pass(a, b, true);
        vpass(b, a);
    }
    return a;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

// Exposure: the reference used 1.0 (#2388) and 0.87 (#970/#4381); 0.93 stays within ~1.5/255 of all three.
export const APEFEST_GAIN = 0.93;

export async function renderApefest(image, format = 'square', { seed = 0, caption = 'STILL HERE.', sub = '10.17', note = null, keyLight = false, glowScale = 1, gain, crt = APEFEST_CRT, scan = APEFEST_SCAN, jump = APEFEST_JUMP, text } = {}) {
    await loadApefestFonts();
    const { W, H, apeScale, apeX } = APEFEST_FORMATS[format];
    const T = { ...APEFEST_TEXT[format], ...(text || {}) };
    const m = Math.min(W, H);
    const s = Math.round(m * apeScale);

    const apeCanvas = document.createElement('canvas');
    apeCanvas.width = s;
    apeCanvas.height = s;
    const actx = apeCanvas.getContext('2d', { willReadFrequently: true });
    actx.imageSmoothingQuality = 'high';
    actx.drawImage(image, 0, 0, s, s);
    const apeData = actx.getImageData(0, 0, s, s).data;
    const g = gain == null ? APEFEST_GAIN : gain;

    const alpha = new Float32Array(s * s);
    for (let i = 0; i < s * s; i += 1) alpha[i] = apeData[i * 4 + 3] / 255;
    if (keyLight) {
        // Unminted blur: soft luminance key, light background -> #0b0b0c / transparent (no sharpening,
        // blur untouched, smooth ramp so there is no hard square edge); highlights clamped.
        // The preview now carries the ape's original coloured background (e.g. blue #5000, teal #2), so
        // key by distance to the border colour too (median of the outer ring), not only by lightness.
        const ring = [];
        for (let t = 0; t < s; t += 4) {
            [[t, 2], [t, s - 3], [2, t], [s - 3, t]].forEach(([x, y]) => {
                const o = (y * s + x) * 4;
                ring.push([apeData[o], apeData[o + 1], apeData[o + 2]]);
            });
        }
        const med = [0, 1, 2].map((c) => ring.map((v) => v[c]).sort((p, q) => p - q)[ring.length >> 1]);
        for (let i = 0; i < s * s; i += 1) {
            const o = i * 4;
            const lum = (0.2126 * apeData[o] + 0.7152 * apeData[o + 1] + 0.0722 * apeData[o + 2]) / 255;
            const dist = Math.hypot(apeData[o] - med[0], apeData[o + 1] - med[1], apeData[o + 2] - med[2]) / 441;
            const kc = Math.min(1, Math.max(0, 1 - (dist - 0.08) / 0.16));
            const k = Math.max(kc, Math.min(1, Math.max(0, (lum - 0.72) / 0.2)));
            const kk = k * k * (3 - 2 * k);
            for (let c = 0; c < 3; c += 1) apeData[o + c] = Math.min(200, apeData[o + c] * (1 - kk) + 11 * kk);
            alpha[i] *= 1 - kk;
        }
    }
    const inner = boxBlur(alpha, s, s, 1, s / 120);

    // Background with CRT glow
    const cx = W * apeX;
    const cy = H * 0.46;
    const c = new Float32Array(W * H * 3);
    // Perf: exp(-(dx²+dy²)k) = exp(-dx²k)·exp(-dy²k), precomputed per column/row.
    const gx = new Float32Array(W); const kx = new Float32Array(W);
    for (let x = 0; x < W; x += 1) { const dx = (x - cx) / (m * 0.42); gx[x] = Math.exp(-dx * dx * 1.3); kx[x] = Math.exp(-dx * dx * 5); }
    for (let y = 0; y < H; y += 1) {
        const dy = (y - cy) / (m * 0.40);
        const gy = Math.exp(-dy * dy * 1.3) * 0.55 * glowScale;
        const ky = Math.exp(-dy * dy * 5) * 0.18;
        for (let x = 0; x < W; x += 1) {
            const glow = gx[x] * gy;
            const core = kx[x] * ky;
            const o = (y * W + x) * 3;
            c[o] = BG[0] + glow * RED[0] + core;
            c[o + 1] = BG[1] + glow * RED[1] + core * 0.3;
            c[o + 2] = BG[2] + glow * RED[2] + core * 0.25;
        }
    }

    // Duotone ape + rim light, composited bottom-aligned
    const ox = Math.floor(cx - s / 2);
    let oy = H - s;
    if (T.headGap != null) {
        let headRow = s;
        for (let y = 0; y < s && headRow === s; y += 1) {
            for (let x = 0; x < s; x += 4) if (alpha[y * s + x] > 0.5) { headRow = y; break; }
        }
        if (oy + headRow < T.capTop + T.capHeight + T.headGap) oy += T.headShift;
    }
    for (let y = 0; y < s; y += 1) {
        const Y = oy + y;
        if (Y < 0 || Y >= H) continue;
        for (let x = 0; x < s; x += 1) {
            const X = ox + x;
            if (X < 0 || X >= W) continue;
            const i = y * s + x;
            const al = alpha[i];
            if (al <= 0) continue;
            const lum = (0.3 * apeData[i * 4] + 0.59 * apeData[i * 4 + 1] + 0.11 * apeData[i * 4 + 2]) / 255;
            let t = Math.min(1, Math.max(0, (lum - 0.18) / 0.78)) ** 2.1;
            const key = Math.min(1, Math.max(0.15, 1.25 - Math.hypot(x / s - 0.66, y / s - 0.28) * 1.5));
            t = t * key * g;
            const rim = Math.min(1, Math.max(0, al - inner[i])) * 2.2;
            const o = (Y * W + X) * 3;
            for (let k = 0; k < 3; k += 1) {
                let col = t < 0.6
                    ? DARK[k] + (RED[k] - DARK[k]) * (t / 0.6)
                    : RED[k] + (HOT[k] - RED[k]) * ((t - 0.6) / 0.4) ** 2;
                col = Math.min(1, Math.max(0, col + rim * RED[k] * 0.9));
                c[o + k] = c[o + k] * (1 - al) + col * al;
            }
        }
    }

    // Bloom (screen blend with blurred copy)
    for (let i = 0; i < c.length; i += 1) c[i] = Math.min(1, Math.max(0, Math.round(c[i] * 255) / 255));
    const bl = boxBlur(c, W, H, 3, m / 60);
    for (let i = 0; i < c.length; i += 1) c[i] = 1 - (1 - c[i]) * (1 - bl[i] * (0.35 + 0.12 * (crt - 1)) * glowScale);

    // RGB split
    const sh = Math.max(1, Math.round((W / 500) * crt));
    const split = new Float32Array(c.length);
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const o = (y * W + x) * 3;
            const xr = (x - sh + W) % W;
            const xb = (x + sh) % W;
            split[o] = c[(y * W + xr) * 3];
            split[o + 1] = c[o + 1];
            split[o + 2] = c[(y * W + xb) * 3 + 2];
        }
    }

    // Scanlines, eased back over the face
    const period = Math.max(3, Math.floor(H / 300));
    const half = Math.floor(period / 2);
    const fxs = new Float32Array(W);
    for (let x = 0; x < W; x += 1) { const fx = (x - cx) / (m * 0.22); fxs[x] = Math.exp(-fx * fx); }
    for (let y = 0; y < H; y += 1) {
        if (y % period >= half) continue;
        const fy = (y - H * 0.40) / (m * 0.25);
        const fyy = Math.exp(-fy * fy);
        for (let x = 0; x < W; x += 1) {
            const face = fxs[x] * fyy;
            const f = 1 - Math.min(0.85, (0.29 - 0.07 * face) * (1 + 0.55 * (scan - 1)));
            const o = (y * W + x) * 3;
            split[o] *= f;
            split[o + 1] *= f;
            split[o + 2] *= f;
        }
    }

    // Line jumps: 3 at crt 1.0, more/larger when stronger (deterministic per seed)
    const rnd = mulberry32(seed + 1);
    const jumps = Math.round(3 * crt ** 1.5);
    for (let n = 0; n < jumps; n += 1) {
        const y0 = Math.floor(H * 0.05 + rnd() * (H * 0.8));
        const h = Math.floor((2 + Math.floor(rnd() * 4)) * jump);
        const dx = Math.floor((4 + Math.floor(rnd() * 8)) * jump) * (rnd() < 0.5 ? -1 : 1);
        for (let y = y0; y < Math.min(H, y0 + h); y += 1) {
            const row = split.slice(y * W * 3, (y + 1) * W * 3);
            for (let x = 0; x < W; x += 1) {
                const from = (((x - dx) % W + W) % W) * 3;
                const o = (y * W + x) * 3;
                split[o] = row[from];
                split[o + 1] = row[from + 1];
                split[o + 2] = row[from + 2];
            }
        }
    }

    // Phosphor softness when stronger than 1.0 (3-tap gaussian, sigma 0.4*(crt-1))
    if (crt > 1) {
        const sg = 0.4 * (crt - 1);
        const wSide = Math.exp(-1 / (2 * sg * sg));
        const norm = 1 / (1 + 2 * wSide);
        const tmp = new Float32Array(split.length);
        for (let y = 0; y < H; y += 1) {
            for (let x = 0; x < W; x += 1) {
                const xl = Math.max(0, x - 1);
                const xr = Math.min(W - 1, x + 1);
                for (let k = 0; k < 3; k += 1) {
                    tmp[(y * W + x) * 3 + k] = (split[(y * W + x) * 3 + k] + wSide * (split[(y * W + xl) * 3 + k] + split[(y * W + xr) * 3 + k])) * norm;
                }
            }
        }
        for (let y = 0; y < H; y += 1) {
            const yu = Math.max(0, y - 1);
            const yd = Math.min(H - 1, y + 1);
            for (let x = 0; x < W; x += 1) {
                for (let k = 0; k < 3; k += 1) {
                    split[(y * W + x) * 3 + k] = (tmp[(y * W + x) * 3 + k] + wSide * (tmp[(yu * W + x) * 3 + k] + tmp[(yd * W + x) * 3 + k])) * norm;
                }
            }
        }
    }

    // Vignette + write out
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y += 1) {
        const vy = (y - H / 2) / (H * 0.75);
        for (let x = 0; x < W; x += 1) {
            const vx = (x - W / 2) / (W * 0.75);
            const v = Math.max(0, Math.min(1, 1 - vx * vx - vy * vy)) ** 0.6;
            const o = (y * W + x) * 3;
            const p = (y * W + x) * 4;
            img.data[p] = Math.min(255, split[o] * v * 255);
            img.data[p + 1] = Math.min(255, split[o + 1] * v * 255);
            img.data[p + 2] = Math.min(255, split[o + 2] * v * 255);
            img.data[p + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);

    drawApefestText(ctx, format, { caption, sub, note, text });
    return out;
}

// Claim + date/sub/note over a rendered ApeFest frame (shared by the launch renderer for 16:9).
export function drawApefestText(ctx, format = 'square', { caption = 'STILL HERE.', sub = '10.17', note = null, text } = {}) {
    const T = { ...APEFEST_TEXT[format], ...(text || {}) };
    const { width: W } = ctx.canvas;
    // Claim (Press Start 2P, sized to the cap height) + date (mono), red with a slight glow
    ctx.font = '100px "Press Start 2P", monospace';
    const capAt100 = ctx.measureText('H').actualBoundingBoxAscent || 87.5;
    const fs = Math.round((T.capHeight * 100) / capAt100);
    const tr = -Math.floor(fs * 0.12);
    ctx.font = `${fs}px "Press Start 2P", monospace`;
    const widths = [...caption].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, w) => a + w + tr, 0) - tr;
    const capX = T.align === 'center' ? Math.round((W - total) / 2) : T.x;
    const baseline = T.capTop + T.capHeight;
    const drawText = () => {
        ctx.fillStyle = APEFEST_RED;
        ctx.font = `${fs}px "Press Start 2P", monospace`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        let x = capX;
        [...caption].forEach((ch, i) => { ctx.fillText(ch, x, baseline); x += widths[i] + tr; });
        if (sub) {
            ctx.save();
            ctx.globalAlpha *= T.subAlpha;
            ctx.font = `500 ${T.subSize}px ${APEFEST_MONO}`;
            ctx.textAlign = T.subAlign === 'center' ? 'center' : 'left';
            ctx.fillText(sub, T.subAlign === 'center' ? W / 2 : T.x, T.subBaseline);
            ctx.restore();
        }
        if (note) {
            ctx.save();
            ctx.globalAlpha *= APEFEST_NOTE.alpha;
            ctx.font = `500 ${APEFEST_NOTE.size}px ${APEFEST_MONO}`;
            ctx.textAlign = 'left';
            const tr = APEFEST_NOTE.size * APEFEST_NOTE.tracking;
            const chars = [...note];
            const ws = chars.map((ch) => ctx.measureText(ch).width);
            const tw = ws.reduce((a, w) => a + w + tr, 0) - tr;
            let nx = T.subAlign === 'center' ? (W - tw) / 2 : T.x;
            const ny = T.subBaseline + APEFEST_NOTE.gap + APEFEST_NOTE.size;
            chars.forEach((ch, k) => { ctx.fillText(ch, nx, ny); nx += ws[k] + tr; });
            ctx.restore();
        }
    };
    ctx.save();
    ctx.shadowColor = APEFEST_RED;
    ctx.shadowBlur = fs / 4;
    ctx.globalAlpha = 0.6;
    drawText();
    ctx.restore();
    drawText();
}

export const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
export const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
});
