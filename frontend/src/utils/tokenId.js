export const MAX_TOKEN_ID = 9999;

/** Parse numeric token id; reject empty, >9999, or more than four digits (no silent truncate). */
export function parseTokenIdInput(raw) {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) {
    return { ok: false, reason: 'empty' };
  }
  const numeric = Number(digits);
  if (!Number.isFinite(numeric) || digits.length > 4 || numeric > MAX_TOKEN_ID) {
    return { ok: false, reason: 'invalid_range' };
  }
  return { ok: true, value: String(numeric) };
}