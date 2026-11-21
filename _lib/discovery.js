import { convertHtmlToAbsoluteUrls, dateToRfc822 } from '@11ty/eleventy-plugin-rss';

const utilityPaths = new Set(['/404.html', '/subscribed/', '/confirmed/']);
const xml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]);
const cdata = (value) => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

export function isDiscoverable(item) {
  const data = item.data || {};
  return Boolean(item.url)
    && !utilityPaths.has(item.url)
    && !data.draft && !data.noindex && !data.seoExclude
    && !data.seo?.noindex && !data.seo?.excludeFromSitemap
    && !/(?:^|[\s,])noindex(?:$|[\s,])/i.test(String(data.robots || ''));
}

export function feedPosts(collections, section) {
  const posts = section ? collections[section] || [] : [...(collections.notes || []), ...(collections.newsletter || [])];
  return posts.filter(isDiscoverable).sort((a, b) => b.date - a.date || a.url.localeCompare(b.url));
}

export async function renderFeed({ posts, feed, site }) {
  const origin = new URL(site.url);
  const title = `${site.name} — ${feed.title}`;
  const entries = await Promise.all(posts.map(async (post) => {
    const published = new Date(post.date);
    if (!Number.isFinite(published.getTime())) throw new Error(`Feed post ${post.url} needs a valid publication date.`);
    const canonical = new URL(post.data.seo?.canonical || post.url, origin).href;
    const content = await convertHtmlToAbsoluteUrls(post.content || '', canonical, { closingSingleTag: 'slash' });
    return `    <item>
      <title>${xml(post.data.title)}</title>
      <link>${xml(canonical)}</link>
      <guid isPermaLink="true">${xml(canonical)}</guid>
      <pubDate>${dateToRfc822(published, 'UTC')}</pubDate>
      <description>${xml(post.data.seo?.description || post.data.description || '')}</description>
      <content:encoded>${cdata(content)}</content:encoded>
    </item>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xml(title)}</title>
    <link>${xml(new URL(feed.home, origin).href)}</link>
    <atom:link href="${xml(new URL(feed.path, origin).href)}" rel="self" type="application/rss+xml" />
    <description>${xml(`${feed.title} by ${site.name}. ${site.description}`)}</description>
    <language>en</language>
${entries.join('\n')}
  </channel>
</rss>
`;
}

export function sitemapUrls(items, site) {
  const origin = new URL(site.url).origin;
  return [...new Set(items.filter(isDiscoverable).flatMap((item) => {
    const canonical = new URL(item.data.seo?.canonical || item.url, site.url);
    return canonical.origin === origin && /(?:\/|\.html)$/.test(canonical.pathname)
      && !utilityPaths.has(canonical.pathname) && !canonical.search && !canonical.hash ? [canonical.href] : [];
  }))].sort();
}

export function renderSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`).join('\n')}
</urlset>
`;
}
