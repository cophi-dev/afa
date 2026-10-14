// One shared lane for background image renders (picker thumbnails + minted list).
// The image server renders every request (2-4s each); background work used to flood it
// (~40 renders on ape load) and the main preview queued behind it ("Dialing in drip..." up to ~50s).
// While the main preview is rendering, background queues hold (max HOLD_MAX_MS), then resume.
const HOLD_MAX_MS = 15000;
let holdUntil = 0;
const listeners = new Set();

export const backgroundHeld = () => Date.now() < holdUntil;
export const onBackgroundRelease = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const release = () => { holdUntil = 0; listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } }); };
let timer = null;
export function holdBackground() {
    holdUntil = Date.now() + HOLD_MAX_MS;
    clearTimeout(timer);
    timer = setTimeout(release, HOLD_MAX_MS + 10);
}
export function releaseBackground() { clearTimeout(timer); release(); }

// fetch with a hard timeout (the server sometimes closes or stalls connections).
export async function fetchWithTimeout(url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
    try {
        return await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    } finally {
        if (t) clearTimeout(t);
    }
}
