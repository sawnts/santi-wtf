const utilityRoutes = new Set(['/404.html', '/subscribed/', '/confirmed/']);

const plainText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function buildSeo(data, socialImage) {
  const { site, page = {} } = data;
  const siteUrl = new URL(site.url);
  const canonicalUrl = new URL(page.url || '/', siteUrl);
  if (canonicalUrl.origin !== siteUrl.origin) throw new Error(`Page URL must belong to ${siteUrl.origin}: ${page.url}`);
  canonicalUrl.search = '';
  canonicalUrl.hash = '';
  const route = canonicalUrl.pathname;
  const name = plainText(data.title || site.name);
  const title = route === '/' ? name : `${name} — ${siteUrl.hostname}`;
  const description = plainText(data.description || site.description);
  const robots = Array.isArray(data.robots) ? data.robots.join(',') : String(data.robots || '');
  const noindex = Boolean(data.noindex || data.draft || data.seoExclude || utilityRoutes.has(route) || /\bnoindex\b/i.test(robots));
  const excluded = Boolean(data.seoExclude || data.draft || noindex || !/\/$|\.html$/.test(route));
  const article = /^\/notes\/.+\/$/.test(route) && !excluded;
  let publishedTime;
  if (article && data.date) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid publication date for ${route}.`);
    publishedTime = date.toISOString();
  }
  const image = socialImage || {
    url: '/og.png', width: 1200, height: 630, type: 'image/png', alt: siteUrl.hostname,
  };
  return {
    title,
    description,
    canonical: canonicalUrl.href,
    type: article && publishedTime ? 'article' : 'website',
    publishedTime,
    image: { ...image, url: new URL(image.url, siteUrl).href },
    noindex,
    excludeFromSitemap: excluded,
  };
}
