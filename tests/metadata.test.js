import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeo } from '../_lib/metadata.js';

const site = { url: 'https://santi.wtf', name: 'santi villanueva', description: 'art, tech, culture.' };
const pageData = (url, extra = {}) => ({ site, page: { url }, ...extra });

test('articles expose an authored summary, canonical URL, and UTC publication date', () => {
  const seo = buildSeo(pageData('/notes/keep-going/', {
    title: 'keep going', description: 'running, consistency, and starting again.', date: new Date('2026-08-31T00:00:00Z'),
  }));
  assert.equal(seo.title, 'keep going — santi.wtf');
  assert.equal(seo.description, 'running, consistency, and starting again.');
  assert.equal(seo.canonical, 'https://santi.wtf/notes/keep-going/');
  assert.equal(seo.type, 'article');
  assert.equal(seo.publishedTime, '2026-08-31T00:00:00.000Z');
  assert.equal(seo.excludeFromSitemap, false);
});

test('photo sharing uses the specific JPEG and preserves description text', () => {
  const image = { url: '/images/social/paris.jpeg', width: 1200, height: 800, type: 'image/jpeg', alt: 'a view of paris' };
  const seo = buildSeo(pageData('/photos/paris-2025/', {
    title: 'paris-2025.jpg', description: 'paris & its rooftops — a photograph.', date: '2026-04-05',
  }), image);
  assert.deepEqual(seo.image, { ...image, url: 'https://santi.wtf/images/social/paris.jpeg' });
  assert.equal(seo.description, 'paris & its rooftops — a photograph.');
  assert.equal(seo.type, 'website');
  assert.equal(seo.publishedTime, undefined);
});

test('the not-found route stays out of search and the sitemap', () => {
  for (const url of ['/404.html']) {
    const seo = buildSeo(pageData(url, { date: '2026-05-07' }));
    assert.equal(seo.noindex, true, url);
    assert.equal(seo.excludeFromSitemap, true, url);
    assert.equal(seo.type, 'website', url);
    assert.equal(seo.publishedTime, undefined, url);
  }
});

test('feeds, explicit exclusions, and drafts never become sitemap pages', () => {
  for (const data of [
    pageData('/feed.xml', { seoExclude: true }),
    pageData('/notes/feed.xml', { seoExclude: true }),
    pageData('/sitemap.xml', { seoExclude: true }),
    pageData('/search-index.json'),
    pageData('/notes/draft/', { draft: true, date: '2026-01-01' }),
    pageData('/notes/hidden/', { robots: 'noindex, follow', date: '2026-01-01' }),
  ]) {
    const seo = buildSeo(data);
    assert.equal(seo.excludeFromSitemap, true, data.page.url);
    if (data.draft || data.seoExclude) assert.equal(seo.noindex, true, data.page.url);
  }
});

test('archive and homepage metadata never borrow a publication date', () => {
  for (const url of ['/', '/notes/', '/photos/']) {
    const seo = buildSeo(pageData(url, { date: '2026-01-01' }));
    assert.equal(seo.type, 'website', url);
    assert.equal(seo.publishedTime, undefined, url);
    assert.equal(seo.excludeFromSitemap, false, url);
  }
  assert.equal(buildSeo(pageData('/')).title, 'santi villanueva');
});

test('canonical URLs omit tracking state and reject another site', () => {
  assert.equal(buildSeo(pageData('/notes/example/?utm_source=email#heading')).canonical, 'https://santi.wtf/notes/example/');
  assert.throws(() => buildSeo(pageData('//other.example/')), /Page URL must belong/);
});

test('a malformed article date fails instead of publishing invalid metadata', () => {
  assert.throws(() => buildSeo(pageData('/notes/example/', { date: 'not a date' })), /Invalid publication date/);
});
