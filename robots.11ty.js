export default class Robots {
  data() {
    return {
      permalink: '/robots.txt',
      layout: false,
      seoExclude: true,
      eleventyExcludeFromCollections: true,
    };
  }

  render({ site }) {
    return `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site.url).href}\n`;
  }
}
