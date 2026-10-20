// Picker auto-frame. The diff bbox is measured on a 96px sample of (asset - bare ape).
// Minted tiles map that box into the launch frame (ape scaled 0.96, bottom-centred).
// Unminted tiles frame the blurred preview itself (the ape already fills the square).
// The item's longer side fills ~60% of the tile, then the view is centred on the box.
export const FRAME_FILL = 0.6;
export const APE_S = 0.96;
export const SAMPLE = 96;

// Outfit and hand diffs are often a wide or tall band whose long side already spans
// most of the ape, so a max()-zoom stays ~1 and the key-lit face fills the tile.
// Those bands scale by their short side so the garment or held object fills ~60%,
// and the window is pulled back inside the image so the item is not left half off the edge.
export function frameFromBox(box, { category = 'extra', launch = true } = {}) {
    if (!box || box.x1 < 0) return null;
    const { x0, y0, x1, y1 } = box;
    const m = (v) => v / SAMPLE;
    const fx = launch ? (v) => (1 - APE_S) / 2 + APE_S * m(v) : m;
    const fy = launch ? (v) => (1 - APE_S) + APE_S * m(v) : m;
    const bx0 = fx(x0); const bx1 = fx(x1 + 1); const by0 = fy(y0); const by1 = fy(y1 + 1);
    const bw = bx1 - bx0; const bh = by1 - by0;
    const long = Math.max(bw, bh); const short = Math.min(bw, bh);
    const aspect = long / Math.max(short, 1e-3);
    const band = (category === 'outfit' || category === 'hand') && aspect >= 1.7 && long >= 0.45;
    const side = band ? short : long;
    const zoom = Math.min(4, Math.max(1, FRAME_FILL / side));
    let cx = (bx0 + bx1) / 2; let cy = (by0 + by1) / 2;
    if (category === 'outfit' || category === 'hand') {
        const half = 0.5 / zoom;
        if (half < 0.5) {
            cx = Math.min(Math.max(cx, half), 1 - half);
            cy = Math.min(Math.max(cy, half), 1 - half);
        }
    }
    return { zoom, cx, cy };
}
