const BOT_UA =
  /bot|crawl|spider|slack|discord|twitter|facebook|linkedin|telegram|whatsapp|embed|preview/i;

export const config = {
  matcher: ['/((?!api/|static/|favicon|logo|overview|manifest|robots|apple-touch|.*\\..*).*)'],
};

export default function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_UA.test(userAgent)) {
    return;
  }

  const url = new URL(request.url);
  const target = new URL('/api/og-preview', url.origin);
  url.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  return Response.redirect(target.toString(), 302);
}
