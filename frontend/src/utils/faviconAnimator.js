const FAVICON_VERSION = 2;
const FRAME_COUNT = 8;
const INTERVAL_MS = 650;

/** Cycle BAYC background frames while the tab is open (GIF favicons don't animate in most browsers). */
export function startFaviconAnimation() {
  if (typeof document === 'undefined') return undefined;

  const publicUrl = process.env.PUBLIC_URL || '';
  const frameBase = `${publicUrl}/favicon-frames`;

  let link = document.querySelector('link[rel~="icon"][data-animated="true"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.sizes = '32x32';
    link.dataset.animated = 'true';
    document.head.appendChild(link);
  }

  let frame = 0;
  let timerId = null;

  const setFrame = () => {
    link.href = `${frameBase}/${frame}.png?v=${FAVICON_VERSION}`;
    frame = (frame + 1) % FRAME_COUNT;
  };

  const start = () => {
    if (timerId !== null) return;
    setFrame();
    timerId = window.setInterval(setFrame, INTERVAL_MS);
  };

  const stop = () => {
    if (timerId === null) return;
    window.clearInterval(timerId);
    timerId = null;
  };

  const onVisibility = () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  start();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
