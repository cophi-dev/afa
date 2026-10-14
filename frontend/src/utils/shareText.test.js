import { buildShareText, buildXIntentUrl } from './shareText';

test('always tags @ApeFacingApes, links with UTM, no hashtags', () => {
  for (let i = 0; i < 50; i += 1) {
    const text = buildShareText({ tokenId: 42, traits: { hat: 'Party_Hat.png', eyes: '' }, framed: i % 2 === 0 });
    expect(text).toContain('@ApeFacingApes');
    expect(text).toContain('utm_source=x&utm_medium=social&utm_campaign=editor-share');
    expect(text).not.toContain('#A');
    expect(text).not.toMatch(/#[a-z]/i);
  }
  expect(buildXIntentUrl('a b')).toBe('https://x.com/intent/post?text=a%20b');
});
