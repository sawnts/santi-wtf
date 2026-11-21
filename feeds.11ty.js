import { feedPosts, renderFeed } from './_lib/discovery.js';

export default class Feeds {
  data() {
    return {
      layout: false,
      seoExclude: true,
      eleventyExcludeFromCollections: true,
      eleventyImport: { collections: ['notes', 'newsletter'] },
      feeds: [
        { path: '/feed.xml', home: '/', title: 'notes & letters' },
        { path: '/notes/feed.xml', home: '/notes/', title: 'notes', section: 'notes' },
        { path: '/newsletter/feed.xml', home: '/newsletter/', title: 'letters', section: 'newsletter' },
      ],
      pagination: { data: 'feeds', size: 1, alias: 'feed' },
      permalink: ({ feed }) => feed.path,
    };
  }

  async render({ collections, feed, site }) {
    return renderFeed({ posts: feedPosts(collections, feed.section), feed, site });
  }
}
