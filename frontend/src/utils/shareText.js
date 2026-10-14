import { assetLabel } from './assetLabels';

// Short, dry share lines for X. One is picked at random per share.
const EDITOR_URL = 'https://afa-editor.app/?utm_source=x&utm_medium=social&utm_campaign=editor-share';

const pretty = (value) => String(value || '')
  .replace(/\.(png|webp)$/i, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

// Display name for a trait value; falls back to a cleaned-up key.
const label = (category, value) => assetLabel(category, value) || pretty(value);

// Hand gestures: own dry lines instead of "handed my ape a ...".
const GESTURE_LINES = {
  pray: 'Hands folded in Pray. The ape seems at peace.',
  peace: 'Peace sign up. The ape means it.',
  'thumbs up': 'Thumbs Up from my ape. High praise, by its standards.',
  gm: 'My ape says GM. That is all it says.',
  cheers: 'Cheers from my ape. The next round is on you.',
};
const GESTURE = /^(pray|peace|thumbs up|gm|cheers|apecoin hands( \d+)?|banana hand|ape solar sun hand)$/i;
// Plurals and brand names: no "a/an".
const NO_ARTICLE = /^(fireworks|balloon & fireworks|lisbon sardines|magic eden|moon coffee company)$/i;
const article = (t) => (/^[aeiou]/i.test(t) ? 'an' : 'a');

const POOLS = {
  hat: [
    (t) => `New hat: ${t}. Same ape. Different energy.`,
    (t) => `Tried the ${t}. The ape approved without saying a word.`,
  ],
  eyes: [
    (t) => `Gave my ape ${t}. Now it sees things differently.`,
    (t) => `${t} on. Eye contact has never been this direct.`,
  ],
  mouth: [
    (t) => `Swapped the mouth for ${t}. Still not talking.`,
  ],
  outfit: [
    (t) => (/^no clothes$/i.test(t) ? 'Took the outfit off my ape. It refuses to dress back up.' : `Dressed my ape in ${t}. It refuses to change back.`),
    (t) => (/^no clothes$/i.test(t) ? 'No clothes. Business up front, ape all over.' : `${t}: business up front, ape all over.`),
  ],
  hand: [
    (t) => {
      if (GESTURE.test(t)) return GESTURE_LINES[t.toLowerCase()] || `Went with ${t}. The ape seems at peace.`;
      if (NO_ARTICLE.test(t)) return `Handed my ape ${t}. Questionable decision, great result.`;
      return `Handed my ape ${article(t)} ${t}. Questionable decision, great result.`;
    },
  ],
  extra: [
    (t) => `Final touch: ${t}.`,
    (t) => `Added ${t}. Now it's complete.`,
    (t) => `One more detail: ${t}.`,
    (t) => `Small thing, big difference: ${t}.`,
    (t) => `${t} added. Same ape. Different energy.`,
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
    if (value && POOLS[key]) options.push(() => pick(POOLS[key], rand)(label(key, value)));
  });
  if (framed) options.push(() => pick(POOLS.frame, rand)());
  const raw = options.length ? pick(options, rand)() : pick(POOLS.plain, rand)();
  const line = raw.charAt(0).toUpperCase() + raw.slice(1);
  const id = tokenId !== '' && tokenId != null ? ` AFA #${tokenId}` : '';
  return `${line}${id} @ApeFacingApes\n\n${url}`;
};

export const buildXIntentUrl = (text) =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
