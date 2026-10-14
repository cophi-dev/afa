import { buildSharePageUrl, LINK_UTM } from './look';

test('copy-link URL is the /a/ look page with link UTM', () => {
  const url = buildSharePageUrl(1, { secondAssetType: 'vegas' }, LINK_UTM);
  expect(url).toMatch(/^https:\/\/afa-editor\.app\/a\/1\?look=/);
  expect(url).toContain('utm_source=share&utm_medium=link&utm_campaign=editor-share');
});
