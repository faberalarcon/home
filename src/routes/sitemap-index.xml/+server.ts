import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const urls = ['/', '/gallery', '/drinks/', '/stats/'];
  const updated = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>https://21bristoe.com${url}</loc><lastmod>${updated}</lastmod></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
