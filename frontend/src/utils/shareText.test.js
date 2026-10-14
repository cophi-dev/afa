import { buildShareText, buildXIntentUrl } from './shareText';

test('always tags @ApeFacingApes, no link, no hashtags', () => {
  for (let i = 0; i < 50; i += 1) {
    const text = buildShareText({ tokenId: 42, traits: { hat: 'Party_Hat.png', eyes: '' }, framed: i % 2 === 0 });
    expect(text).toContain('@ApeFacingApes');
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toContain('#A');
    expect(text).not.toMatch(/#[a-z]/i);
  }
  expect(buildXIntentUrl('a b')).toBe('https://x.com/intent/post?text=a%20b');
});

const lineFor = (traits) => buildShareText({ tokenId: 7, traits }, () => 0).split(' AFA #')[0];

test('uses asset display names, not internal keys', () => {
  expect(lineFor({ outfit: 'vegas' })).toBe('Dressed my ape in Vegas BAYC. It refuses to change back.');
  expect(lineFor({ hat: 'vegas' })).toBe('New hat: Vegas BAYC. Same ape. Different energy.');
  expect(lineFor({ eyes: 'vegas' })).toBe('Gave my ape Vegas BAYC. Now it sees things differently.');
});

test('a/an and gesture handling for hand items', () => {
  const hand = Object.entries(require('./assetLabels').ASSET_LABELS.hand);
  hand.forEach(([key, name]) => {
    const line = lineFor({ hand: key });
    expect(line).toContain(name);
    expect(line).not.toMatch(/\ba [aeiou]/i);
    expect(line).not.toMatch(/\ban [^aeiou]/i);
    expect(line).not.toMatch(/\ba (Pray|Peace|Thumbs Up|GM\.|Fireworks)/);
  });
});

test('every category resolves every key to its label', () => {
  const { ASSET_LABELS } = require('./assetLabels');
  Object.entries(ASSET_LABELS).forEach(([cat, map]) => Object.entries(map).forEach(([key, name]) => {
    if (cat === 'outfit' && key && name === 'No Clothes') return;
    expect(lineFor({ [cat]: key })).toContain(name);
  }));
});

test('unminted is labelled Ape #N', () => {
  expect(buildShareText({ tokenId: 9, minted: false }, () => 0)).toContain(' Ape #9 @ApeFacingApes');
  expect(buildShareText({ tokenId: 9 }, () => 0)).toContain(' AFA #9 @ApeFacingApes');
});
