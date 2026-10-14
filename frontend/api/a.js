const { decodeLook, parseId } = require('../lib/look');

const SITE = 'https://afa-editor.app';
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderSharePage(id, lookRaw) {
  const look = decodeLook(lookRaw);
  const editorQuery = new URLSearchParams({ tokenId: String(id) });
  Object.entries(look).forEach(([k, v]) => { if (k !== 'frame') editorQuery.set(k, v); });
  editorQuery.set('utm_source', 'x');
  editorQuery.set('utm_medium', 'social');
  editorQuery.set('utm_campaign', 'editor-share');
  const editorUrl = `${SITE}/?${editorQuery.toString()}`;
  const lookParam = lookRaw && Object.keys(look).length ? `&look=${encodeURIComponent(lookRaw)}` : '';
  const og = `${SITE}/api/og-look?id=${id}${lookParam}`;
  const canonical = `${SITE}/a/${id}${lookParam ? `?look=${encodeURIComponent(lookRaw)}` : ''}`;
  const title = `AFA #${id}, restyled`;
  const description = 'Made with the AFA Editor. Dress up your Ape Facing Ape.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="AFA Editor" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(og)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(title)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@ApeFacingApes" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(og)}" />
<meta http-equiv="refresh" content="0; url=${esc(editorUrl)}" />
<style>html,body{margin:0;background:#0b0b0c;color:#fff;font-family:Inter,system-ui,sans-serif}a{color:#f5c542}</style>
</head>
<body>
<p style="padding:24px">Opening the AFA Editor… <a href="${esc(editorUrl)}">Continue</a></p>
<script>location.replace(${JSON.stringify(editorUrl)});</script>
</body>
</html>`;
}

module.exports = (req, res) => {
  const id = parseId(req.query.id);
  if (id == null) {
    res.statusCode = 302;
    res.setHeader('Location', SITE);
    return res.end();
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
  return res.status(200).send(renderSharePage(id, req.query.look));
};
module.exports.renderSharePage = renderSharePage;
