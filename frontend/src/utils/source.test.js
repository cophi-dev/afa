import { computeSource, sessionSource } from './source';

test('landing utm, else referrer domain, else direct', () => {
    expect(computeSource('https://afa-editor.app/?tokenId=1&utm_source=x&utm_campaign=editor-share', 'https://t.co/a', 'afa-editor.app')).toBe('x~editor-share');
    expect(computeSource('https://afa-editor.app/', 'https://x.com/i', 'afa-editor.app')).toBe('x.com');
    expect(computeSource('https://afa-editor.app/', 'https://www.afa-editor.app/', 'afa-editor.app')).toBe('direct');
    expect(computeSource('https://afa-editor.app/', '', 'afa-editor.app')).toBe('direct');
});

test('stored per tab in sessionStorage only', () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    const first = sessionSource();
    expect(window.sessionStorage.getItem('afa.src')).toBe(first);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe('');
});
