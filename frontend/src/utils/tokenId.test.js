import { parseTokenIdInput, MAX_TOKEN_ID } from './tokenId';

describe('parseTokenIdInput', () => {
  it('accepts valid ids', () => {
    expect(parseTokenIdInput('2388')).toEqual({ ok: true, value: '2388' });
    expect(parseTokenIdInput('0')).toEqual({ ok: true, value: '0' });
    expect(parseTokenIdInput(String(MAX_TOKEN_ID))).toEqual({ ok: true, value: String(MAX_TOKEN_ID) });
  });

  it('rejects over-range ids without truncating', () => {
    expect(parseTokenIdInput('12345')).toEqual({ ok: false, reason: 'invalid_range' });
    expect(parseTokenIdInput('10000')).toEqual({ ok: false, reason: 'invalid_range' });
  });

  it('rejects empty input', () => {
    expect(parseTokenIdInput('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseTokenIdInput('abc')).toEqual({ ok: false, reason: 'empty' });
  });
});