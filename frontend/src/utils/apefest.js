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

let fontsReady = null;
export function loadApefestFonts() {
    if (fontsReady) return fontsReady;
    const faces = [
        new FontFace('Press Start 2P', "url('/fonts/press-start-2p-400.woff2') format('woff2')"),
        new FontFace('AFA Mono Digits', "url('/fonts/dejavu-sans-mono-bold-digits.woff2') format('woff2')", { weight: '700' }),
    ];
    fontsReady = Promise.all(faces.map((f) => f.load().then((l) => { document.fonts.add(l); }).catch(() => null)));
    return fontsReady;
}

// Separable 3x box blur ~ gaussian(sigma) on a Float32Array with `ch` channels.
function boxBlur(src, w, h, ch, sigma) {
    if (sigma < 0.5) return src.slice();
    const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
    let a = src.slice();
    let b = new Float32Array(src.length);
    const pass = (from, to, horizontal) => {
        const len = horizontal ? w : h;
        const lines = horizontal ? h : w;
        const norm = 1 / (2 * r + 1);
        for (let l = 0; l < lines; l += 1) {
            for (let c = 0; c < ch; c += 1) {
                const idx = (i) => {
                    const k = Math.min(len - 1, Math.max(0, i));
                    return ((horizontal ? l * w + k : k * w + l) * ch) + c;
                };
                let sum = 0;
                for (let i = -r; i <= r; i += 1) sum += from[idx(i)];
                for (let i = 0; i < len; i += 1) {
                    to[idx(i)] = sum * norm;
                    sum += from[idx(i + r + 1)] - from[idx(i - r)];
                }
            }
        }
    };
    for (let k = 0; k < 3; k += 1) {
        pass(a, b, true);
        pass(b, a, false);
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

export async function renderApefest(image, format = 'square', { seed = 0, caption = 'STILL HERE.', sub = '10.17', gain, crt = APEFEST_CRT, scan = APEFEST_SCAN, jump = APEFEST_JUMP, text } = {}) {
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
    const inner = boxBlur(alpha, s, s, 1, s / 120);

    // Background with CRT glow
    const cx = W * apeX;
    const cy = H * 0.46;
    const c = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const dx = (x - cx) / (m * 0.42);
            const dy = (y - cy) / (m * 0.40);
            const d2 = dx * dx + dy * dy;
            const glow = Math.exp(-d2 * 1.3) * 0.55;
            const core = Math.exp(-d2 * 5) * 0.18;
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
    for (let i = 0; i < c.length; i += 1) c[i] = 1 - (1 - c[i]) * (1 - bl[i] * (0.35 + 0.12 * (crt - 1)));

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
    for (let y = 0; y < H; y += 1) {
        if (y % period >= half) continue;
        for (let x = 0; x < W; x += 1) {
            const fx = (x - cx) / (m * 0.22);
            const fy = (y - H * 0.40) / (m * 0.25);
            const face = Math.exp(-(fx * fx + fy * fy));
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
            ctx.font = `700 ${T.subSize}px "AFA Mono Digits", "DejaVu Sans Mono", Menlo, monospace`;
            ctx.textAlign = T.subAlign === 'center' ? 'center' : 'left';
            ctx.fillText(sub, T.subAlign === 'center' ? W / 2 : T.x, T.subBaseline);
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
    return out;
}

export const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
export const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
});
