import { frameFromBox } from './utils/tileFrame';

const windowOf = (f) => ({ top: f.cy - 0.5 / f.zoom, bottom: f.cy + 0.5 / f.zoom, left: f.cx - 0.5 / f.zoom, right: f.cx + 0.5 / f.zoom });

test('outfit band fills about 60% and leaves the face outside the window', () => {
    // #2388 vegas: clothes are a wide short band at the bottom of the ape, not the head.
    const f = frameFromBox({ x0: 17, y0: 71, x1: 76, y1: 95 }, { category: 'outfit', launch: true });
    expect(f.zoom).toBeCloseTo(2.4, 1);
    const w = windowOf(f);
    expect(w.top).toBeGreaterThan(0.5);
    expect(w.bottom).toBeLessThanOrEqual(1);
    expect(w.top).toBeGreaterThanOrEqual(0);
    // short side of the band, mapped into the launch frame, fills ~60% of the tile
    const bh = ((1 - 0.96) + 0.96 * (96 / 96)) - ((1 - 0.96) + 0.96 * (71 / 96));
    expect(bh * f.zoom).toBeCloseTo(0.6, 1);
});

test('tall hand at the side frames the object instead of the face', () => {
    const f = frameFromBox({ x0: 61, y0: 0, x1: 95, y1: 95 }, { category: 'hand', launch: true });
    expect(f.zoom).toBeGreaterThan(1.5);
    const w = windowOf(f);
    expect(w.left).toBeGreaterThan(0.35);
    expect(w.left).toBeGreaterThanOrEqual(-0.001);
    expect(w.right).toBeLessThanOrEqual(1.001);
});

test('compact eyes crop keeps the long-side zoom', () => {
    const f = frameFromBox({ x0: 35, y0: 32, x1: 60, y1: 39 }, { category: 'eyes', launch: true });
    expect(f.zoom).toBeCloseTo(0.6 / 0.26, 1);
    expect(f.cx).toBeCloseTo(0.5, 1);
});

test('full-body outfit (singe) stays a full frame', () => {
    const f = frameFromBox({ x0: 18, y0: 8, x1: 77, y1: 95 }, { category: 'outfit', launch: true });
    expect(f.zoom).toBe(1);
});

test('unminted frames the preview square, not the launch placement', () => {
    const f = frameFromBox({ x0: 18, y0: 76, x1: 74, y1: 95 }, { category: 'outfit', launch: false });
    expect(f.zoom).toBeGreaterThan(2);
    const w = windowOf(f);
    expect(w.bottom).toBeLessThanOrEqual(1);
    expect(w.top).toBeGreaterThan(0.5);
});
