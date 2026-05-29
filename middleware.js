const BOT_UA =
  /bot|crawl|spider|slack|discord|twitter|facebook|linkedin|telegram|whatsapp|embed|preview/i;

const SITE_URL = 'https://www.afa-editor.app';
const API_URL = 'https://afa-editor.ew.r.appspot.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-preview.png`;
const DEFAULT_IMAGE_WIDTH = '580';
const DEFAULT_IMAGE_HEIGHT = '498';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOgHtml({ title, description, canonicalUrl, ogImage, imageWidth, imageHeight }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="AFA Editor" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
</head>
<body></body>
</html>`;
}

export const config = {
  matcher: ['/((?!api/|static/|favicon|logo|overview|manifest|robots|apple-touch|og-preview|.*\\..*).*)'],
};

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_UA.test(userAgent)) {
    return;
  }

  const url = new URL(request.url);
  const rawTokenId = url.searchParams.get('tokenId');
  const tokenId = rawTokenId ? String(rawTokenId).replace(/[^0-9]/g, '').slice(0, 4) : '';
  const queryString = url.searchParams.toString();
  const canonicalUrl = `${SITE_URL}/${queryString ? `?${queryString}` : ''}`;

  let title = 'AFA Editor';
  let description = 'Change your perspective with Ape Facing Apes';
  let ogImage = DEFAULT_IMAGE;
  let imageWidth = DEFAULT_IMAGE_WIDTH;
  let imageHeight = DEFAULT_IMAGE_HEIGHT;

  if (tokenId) {
    try {
      const mintResponse = await fetch(
        `${API_URL}/api/is-minted?tokenId=${encodeURIComponent(tokenId)}`
      );
      if (mintResponse.ok) {
        const mintData = await mintResponse.json();
        if (mintData.minted) {
          title = `AFA #${tokenId}`;
          description = `Customize Ape Facing Apes #${tokenId} with new perspectives`;
          const assetQuery = queryString || `tokenId=${tokenId}&assetType=AFA`;
          ogImage = `${API_URL}/api/get-asset?${assetQuery}`;
          imageWidth = '1000';
          imageHeight = '1000';
        } else {
          title = `AFA Editor – #${tokenId}`;
        }
      }
    } catch {
      // Fall back to the default preview image.
    }
  }

  return new Response(
    buildOgHtml({ title, description, canonicalUrl, ogImage, imageWidth, imageHeight }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}
