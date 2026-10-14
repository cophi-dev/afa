// Short, dry share lines for X. One is picked at random per share.
const EDITOR_URL = 'https://afa-editor.app/?utm_source=x&utm_medium=social&utm_campaign=editor-share';

const pretty = (value) => String(value || '')
  .replace(/\.(png|webp)$/i, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const POOLS = {
  hat: [
    (t) => `New hat (${t}). Same ape. Different energy.`,
    (t) => `Tried the ${t}. The ape approved without saying a word.`,
  ],
  eyes: [
    (t) => `Gave my ape ${t.replace(/ eyes$/, '')} eyes. Now it sees things differently.`,
    (t) => `${t.replace(/ eyes$/, '')} eyes. Eye contact has never been this direct.`,
  ],
  mouth: [
    (t) => `Swapped the mouth for ${t}. Still not talking.`,
  ],
  outfit: [
    (t) => `Dressed my ape in ${t}. It refuses to change back.`,
    (t) => `${t}: business up front, ape all over.`,
  ],
  hand: [
    (t) => `Handed my ape ${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${t}. Questionable decision, great result.`,
  ],
  extra: [
    (t) => `Added ${t}. Subtle, if you ignore all of it.`,
  ],
  frame: [
    () => 'Framed my ape. Museums, you know where to find me.',
    () => 'Put it in a frame so it feels important. It worked.',
  ],
  plain: [
    () => 'My ape finally faces me. We need to talk.',
    () => 'Looked my ape in the eye. It looked back.',
    () => 'Same ape, new angle.',
  ],
};

const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];

/** Builds the tweet text for the selected ape and its traits. */
export const buildShareText = ({ tokenId, traits = {}, framed = false, url = EDITOR_URL }, rand = Math.random) => {
  const options = [];
  Object.entries(traits).forEach(([key, value]) => {
    if (value && POOLS[key]) options.push(() => pick(POOLS[key], rand)(pretty(value)));
  });
  if (framed) options.push(() => pick(POOLS.frame, rand)());
  const raw = options.length ? pick(options, rand)() : pick(POOLS.plain, rand)();
  const line = raw.charAt(0).toUpperCase() + raw.slice(1);
  const id = tokenId !== '' && tokenId != null ? ` AFA #${tokenId}` : '';
  return `${line}${id} @ApeFacingApes\n\n${url}`;
};

export const buildXIntentUrl = (text) =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
