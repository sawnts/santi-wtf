import test from 'node:test';
import assert from 'node:assert/strict';
import { SaxesParser } from 'saxes';
import { feedPosts, renderFeed, renderSitemap, sitemapUrls } from '../_lib/discovery.js';

const site = { name: 'santi & friends', url: 'https://santi.wtf', description: 'art < technology' };
const post = (url, date, data = {}) => ({ url, date: new Date(date), data, content: '<p>hello</p>' });

function parseXml(source) {
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  const nodes = new Map();
  parser.on('error', (error) => { throw error; });
  parser.on('opentag', (tag) => stack.push({ ...tag, text: '' }));
  const text = (value) => { stack.at(-1).text += value; };
  parser.on('text', (value) => { if (stack.length) text(value); });
  parser.on('cdata', text);
  parser.on('closetag', () => {
    const node = stack.pop();
    const path = [...stack.map(({ name }) => name), node.name].join('/');
    nodes.set(path, [...(nodes.get(path) || []), node]);
  });
  parser.write(source).close();
  return nodes;
}

test('feeds list eligible dated notes newest first and skip drafts and hidden posts', () => {
  const older = post('/notes/older/', '2026-01-01', { title: 'older' });
  const newer = post('/notes/newer/', '2026-02-01', { title: 'newer' });
  const draft = post('/notes/draft/', '2026-03-01', { draft: true });
  const hidden = post('/notes/hidden/', '2026-04-01', { seo: { noindex: true } });
  const collections = { notes: [older, draft, hidden, newer] };
  assert.deepEqual(feedPosts(collections).map((item) => item.url), [newer.url, older.url]);
  assert.deepEqual(feedPosts(collections, 'notes').map((item) => item.url), [newer.url, older.url]);
});

test('RSS preserves XML-sensitive metadata and full HTML with absolute image and link URLs', async () => {
  const item = post('/notes/a-post/', '2026-01-02', {
    title: 'a < b & c',
    seo: { description: 'quotes "and" ampersands & more', canonical: 'https://santi.wtf/notes/a-post/' },
  });
  item.content = '<p>literal ]]&gt; <a href="../other/?a=1&amp;b=2">next</a><img src="/images/test.webp" alt="a &amp; b"></p>';
  const output = await renderFeed({ posts: [item], feed: { path: '/feed.xml', home: '/', title: 'notes & letters' }, site });
  const nodes = parseXml(output);
  assert.equal(nodes.get('rss/channel/title')[0].text, 'santi & friends — notes & letters');
  assert.equal(nodes.get('rss/channel/atom:link')[0].attributes.href.value, 'https://santi.wtf/feed.xml');
  assert.equal(nodes.get('rss/channel/item/title')[0].text, 'a < b & c');
  assert.equal(nodes.get('rss/channel/item/description')[0].text, item.data.seo.description);
  assert.equal(nodes.get('rss/channel/item/guid')[0].text, item.data.seo.canonical);
  assert.equal(Date.parse(nodes.get('rss/channel/item/pubDate')[0].text), item.date.getTime());
  assert.match(nodes.get('rss/channel/item/content:encoded')[0].text, /href="https:\/\/santi\.wtf\/notes\/other\/\?a=1&amp;b=2"/);
  assert.match(nodes.get('rss/channel/item/content:encoded')[0].text, /src="https:\/\/santi\.wtf\/images\/test.webp"/);
});

test('RSS safely splits literal CDATA terminators and rejects invalid publication dates', async () => {
  const item = post('/notes/a-post/', '2026-01-02', { title: 'test' });
  item.content = '<pre>]]></pre>';
  const options = { posts: [item], feed: { path: '/feed.xml', home: '/', title: 'notes' }, site };
  const output = await renderFeed(options);
  assert.match(parseXml(output).get('rss/channel/item/content:encoded')[0].text, /\]\]>/);
  item.date = new Date('invalid');
  await assert.rejects(renderFeed(options), /valid publication date/);
});

test('sitemap includes unique public HTML canonicals without manufactured modification dates', () => {
  const items = [
    post('/', '2026-01-01'),
    post('/notes/', '2026-01-01'),
    post('/notes/alias/', '2026-01-01', { seo: { canonical: 'https://santi.wtf/notes/' } }),
    post('/404.html', '2026-01-01'),
    post('/subscribed/', '2026-01-01'),
    post('/confirmed/', '2026-01-01'),
    post('/draft/', '2026-01-01', { draft: true }),
    post('/private/', '2026-01-01', { robots: 'noindex, nofollow' }),
    post('/excluded/', '2026-01-01', { seo: { excludeFromSitemap: true } }),
    post('/external/', '2026-01-01', { seo: { canonical: 'https://other.example/' } }),
    post('/feed.xml', '2026-01-01'),
    post('/search-index.json', '2026-01-01'),
    post('/helper.js', '2026-01-01'),
  ];
  const urls = sitemapUrls(items, site);
  assert.deepEqual(urls, ['https://santi.wtf/', 'https://santi.wtf/notes/']);
  const output = renderSitemap(urls);
  assert.deepEqual(parseXml(output).get('urlset/url/loc').map(({ text }) => text), urls);
  assert.doesNotMatch(output, /lastmod/);
});
