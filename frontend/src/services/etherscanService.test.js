import { getMintedTokenIdsNewestFirst, processNFTStatuses } from './etherscanService';

describe('getMintedTokenIdsNewestFirst', () => {
  it('returns unique token ids newest mint first', () => {
    const ids = getMintedTokenIdsNewestFirst([
      { tokenID: '2', timeStamp: '20' },
      { tokenID: '1', timeStamp: '10' },
      { tokenID: '2', timeStamp: '30' },
      { tokenID: 'nope' },
    ]);
    expect(ids).toEqual([2, 1]);
  });

  it('returns an empty list for missing input', () => {
    expect(getMintedTokenIdsNewestFirst(null)).toEqual([]);
    expect(getMintedTokenIdsNewestFirst([])).toEqual([]);
  });
});

describe('processNFTStatuses', () => {
  it('maps token ids to owner and timestamp', () => {
    const statuses = processNFTStatuses([
      { tokenID: '4', to: '0xabc', timeStamp: '99' },
    ]);
    expect(statuses.get(4)).toEqual({ owner: '0xabc', timestamp: '99' });
  });
});
