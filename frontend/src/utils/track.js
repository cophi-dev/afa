/**
 * Cookieless, fire-and-forget click events for afa-editor.app.
 * Sent with navigator.sendBeacon (text/plain → no CORS preflight) to the shared
 * counter on the progress page (Vercel Blob). No ids, cookies, storage or awaits.
 */
import { sessionSource } from './source';

const ENDPOINT = 'https://afa-mint-progress.vercel.app/api/event';

export const track = (event, label) => {
    try {
        if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
        if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') return;
        const body = JSON.stringify({ site: 'editor', event, label: label == null || label === '' ? 'none' : String(label), source: sessionSource() });
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
    } catch (e) {
        // tracking must never affect the page
    }
};
