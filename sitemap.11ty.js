import { renderSitemap, sitemapUrls } from './_lib/discovery.js';

export default class Sitemap {
  data() {
    return {
      permalink: '/sitemap.xml',
      layout: false,
      seoExclude: true,
      eleventyExcludeFromCollections: true,
    };
  }

  render({ collections, site }) {
    return renderSitemap(sitemapUrls(collections.all, site));
  }
}
