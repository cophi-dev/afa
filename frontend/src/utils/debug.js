const shouldDebug =
  process.env.NODE_ENV !== 'production' &&
  (process.env.REACT_APP_DEBUG === '1' ||
    process.env.REACT_APP_DEBUG === 'true' ||
    process.env.REACT_APP_DEBUG === 'yes');

export function debug(...args) {
  if (!shouldDebug) return;
  // eslint-disable-next-line no-console
  console.debug(...args);
}

export function warn(...args) {
  if (!shouldDebug) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
}

export function error(...args) {
  // Always log errors; keep them out of the happy path.
  // eslint-disable-next-line no-console
  console.error(...args);
}

