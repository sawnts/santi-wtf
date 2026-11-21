import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { SaxesParser } from 'saxes';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
const site = JSON.parse(fs.readFileSync(path.join(root, '_data/site.json')));
const origin = new URL(site.url).origin;
const xmlNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const atomNamespace = 'http://www.w3.org/2005/Atom';
const contentNamespace = 'http://purl.org/rss/1.0/modules/content/';
const allFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? allFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
function elements(node) {
  return [...(node.tagName ? [{ tag: node.tagName, attrs: Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])), node }] : []), ...(node.childNodes || []).flatMap(elements)];
}
const text = (node) => node ? (node.value || '') + (node.childNodes || []).map(text).join('') : '';
function localFile(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, origin, `Expected a canonical site URL, got ${url}`);
  const file = path.resolve(output, `.${decodeURIComponent(parsed.pathname)}`);
  assert(file === output || file.startsWith(output + path.sep), `URL escapes the site: ${url}`);
  return fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
}
const pages = allFiles(output).filter((file) => file.endsWith('.html')).map((file) => {
  const dom = elements(parse(fs.readFileSync(file, 'utf8')));
  const metas = (key) => dom.filter(({ tag, attrs }) => tag === 'meta' && (attrs.name || attrs.property) === key);
  const meta = (key) => {
    const matches = metas(key);
    assert.equal(matches.length, 1, `${file}: expected one ${key} metadata field`);
    assert(matches[0].attrs.content?.trim(), `${file}: empty ${key}`);
    return matches[0].attrs.content;
  };
  const canonicals = dom.filter(({ tag, attrs }) => tag === 'link' && attrs.rel === 'canonical');
  assert.equal(canonicals.length, 1, `${file}: expected one canonical link`);
  const canonical = canonicals[0].attrs.href;
  assert.equal(localFile(canonical), file, `${file}: canonical points to another page`);
  const description = meta('description');
  assert(description.length >= 20 && description.length <= 320, `${file}: description should be a useful concise summary`);
  assert.equal(meta('og:description'), description, `${file}: inconsistent Open Graph summary`);
  assert.equal(meta('twitter:description'), description, `${file}: inconsistent Twitter summary`);
  assert.equal(meta('og:url'), canonical, `${file}: inconsistent Open Graph URL`);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert(meta('og:title') && meta('twitter:title'));
  const image = meta('og:image');
  assert.equal(meta('twitter:image'), image, `${file}: inconsistent social image`);
  assert(fs.existsSync(localFile(image)), `${file}: missing social image`);
  assert(meta('og:image:alt') && meta('twitter:image:alt'));
  for (const dimension of ['width', 'height']) assert(Number(meta(`og:image:${dimension}`)) > 0, `${file}: missing social image dimensions`);
  const noindex = metas('robots').some(({ attrs }) => /\bnoindex\b/i.test(attrs.content));
  const pathname = new URL(canonical).pathname;
  if (['/404.html', '/subscribed/', '/confirmed/'].includes(pathname)) assert(noindex, `${pathname}: utility pages must be noindex`);
  const section = pathname.match(/^\/(notes|newsletter)\/[^/]+\/$/)?.[1];
  if (section) {
    assert.equal(meta('og:type'), 'article', `${pathname}: writing should have article metadata`);
    const published = meta('article:published_time');
    assert(Number.isFinite(Date.parse(published)), `${pathname}: invalid article publication date`);
    const visibleDate = dom.find(({ tag, attrs }) => tag === 'time' && attrs.datetime)?.attrs.datetime;
    assert.equal(published.slice(0, 10), visibleDate?.slice(0, 10), `${pathname}: metadata publication date differs from the displayed date`);
  }
  if (/^\/photos\/[^/]+\/$/.test(pathname)) {
    assert.equal(meta('og:image:type'), 'image/jpeg', `${pathname}: photo previews should use compatible JPEG images`);
    assert(fs.statSync(localFile(image)).size <= 512_000, `${pathname}: social image exceeds 512 KB`);
  }
  const feeds = dom.filter(({ tag, attrs }) => tag === 'link' && attrs.rel === 'alternate' && attrs.type === 'application/rss+xml').map(({ attrs }) => new URL(attrs.href, canonical).href);
  assert(feeds.includes(`${origin}/feed.xml`), `${pathname}: missing main RSS discovery link`);
  if (section || ['/notes/', '/newsletter/'].includes(pathname)) {
    const folder = section || pathname.split('/')[1];
    assert(feeds.includes(`${origin}/${folder}/feed.xml`), `${pathname}: missing section RSS discovery link`);
  }
  return { file, canonical, description, section, noindex, dom };
});
assert.equal(new Set(pages.map(({ description }) => description)).size, pages.length, 'Each page needs its own description');

function xml(file) {
  const stack = [];
  let document;
  const parser = new SaxesParser({ xmlns: true, fileName: file });
  parser.on('doctype', () => { throw new Error(`${file}: DTDs are not permitted`); });
  parser.on('opentag', (tag) => {
    const node = { name: tag.local, uri: tag.uri, attrs: Object.fromEntries(Object.entries(tag.attributes).map(([name, value]) => [name, value.value])), children: [], text: '' };
    if (stack.length) stack.at(-1).children.push(node);
    else document = node;
    stack.push(node);
  });
  parser.on('text', (value) => { if (stack.length) stack.at(-1).text += value; });
  parser.on('cdata', (value) => { if (stack.length) stack.at(-1).text += value; });
  parser.on('closetag', () => stack.pop());
  parser.write(fs.readFileSync(path.join(output, file), 'utf8')).close();
  return document;
}
const children = (node, name, uri = '') => node.children.filter((child) => child.name === name && child.uri === uri);
const one = (node, name, uri = '') => {
  const matches = children(node, name, uri);
  assert.equal(matches.length, 1, `Expected one ${name} element in ${node.name}`);
  return matches[0];
};
for (const [file, section] of [['feed.xml', null], ['notes/feed.xml', 'notes'], ['newsletter/feed.xml', 'newsletter']]) {
  const feed = xml(file);
  assert.equal(feed.name, 'rss');
  assert.equal(feed.attrs.version, '2.0');
  const channel = one(feed, 'channel');
  assert(one(channel, 'title').text && one(channel, 'description').text);
  const self = children(channel, 'link', atomNamespace).find(({ attrs }) => attrs.rel === 'self');
  assert.equal(self?.attrs.href, `${origin}/${file}`, `${file}: invalid self link`);
  const items = children(channel, 'item');
  const expected = pages.filter((page) => page.section && !page.noindex && (!section || page.section === section));
  const urls = items.map((item) => one(item, 'link').text);
  assert.deepEqual([...urls].sort(), expected.map(({ canonical }) => canonical).sort(), `${file}: feed membership differs from published writing`);
  const dates = [];
  for (const item of items) {
    const link = one(item, 'link').text;
    const page = expected.find(({ canonical }) => canonical === link);
    assert.equal(one(item, 'guid').text, link, `${file}: GUID must remain the canonical post URL`);
    assert.equal(one(item, 'description').text, page.description, `${file}: summary differs from the post metadata`);
    const date = Date.parse(one(item, 'pubDate').text);
    assert(Number.isFinite(date), `${file}: invalid RSS publication date`);
    const articleDate = page.dom.find(({ tag, attrs }) => tag === 'meta' && attrs.property === 'article:published_time')?.attrs.content;
    assert.equal(date, Date.parse(articleDate), `${file}: RSS publication date differs from the article metadata`);
    dates.push(date);
    const html = one(item, 'encoded', contentNamespace).text;
    assert(html.trim(), `${file}: missing full post content`);
    const feedElements = elements(parse(html));
    for (const { attrs } of feedElements) {
      for (const attribute of ['href', 'src']) if (attrs[attribute]) assert(/^(?:https?:|mailto:|tel:)/.test(attrs[attribute]), `${file}: ${attribute} is not absolute: ${attrs[attribute]}`);
    }
    const body = page.dom.find(({ attrs }) => attrs.class?.split(/\s+/).includes('prose'))?.node;
    assert.equal(text(parse(html)).replace(/\s+/g, ' ').trim(), text(body).replace(/\s+/g, ' ').trim(), `${file}: full feed content differs from the published article`);
  }
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a), `${file}: posts must be newest first`);
}
const sitemap = xml('sitemap.xml');
assert.equal(sitemap.name, 'urlset');
assert.equal(sitemap.uri, xmlNamespace);
const locations = children(sitemap, 'url', xmlNamespace).map((url) => one(url, 'loc', xmlNamespace).text);
assert.deepEqual([...locations].sort(), pages.filter(({ noindex }) => !noindex).map(({ canonical }) => canonical).sort(), 'Sitemap must contain exactly the indexable canonical HTML pages');
assert.equal(new Set(locations).size, locations.length, 'Sitemap contains duplicate URLs');
assert(fs.readFileSync(path.join(output, 'robots.txt'), 'utf8').includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt must advertise the sitemap');

const fonts = JSON.parse(fs.readFileSync(path.join(root, '_data/fonts.json')));
const originalFont = fs.readFileSync(path.join(root, fonts.source.path));
assert.equal(originalFont.length, fonts.source.sizeBytes, 'Original font size differs from the recorded source');
assert.equal(createHash('sha256').update(originalFont).digest('hex'), fonts.source.sha256, 'Original font differs from the recorded source');
for (const asset of fonts.assets) {
  const bytes = fs.readFileSync(localFile(new URL(asset.url, origin).href));
  assert.equal(bytes.length, asset.sizeBytes, `Font size differs from its manifest: ${asset.url}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Font checksum differs from its manifest: ${asset.url}`);
}
console.log(`Validated discovery: ${pages.length} page metadata records, 3 RSS feeds, ${locations.length} sitemap URLs, and optimized font assets.`);
