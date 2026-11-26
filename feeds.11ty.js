import { feedPosts, renderFeed } from './_lib/discovery.js';

export default class Feeds {
  data() {
    return {
      layout: false,
      seoExclude: true,
      eleventyExcludeFromCollections: true,
      eleventyImport: { collections: ['notes'] },
      feeds: [
        { path: '/feed.xml', home: '/', title: 'notes' },
        { path: '/notes/feed.xml', home: '/notes/', title: 'notes', section: 'notes' },
      ],
      pagination: { data: 'feeds', size: 1, alias: 'feed' },
      permalink: ({ feed }) => feed.path,
    };
  }

  async render({ collections, feed, site }) {
    return renderFeed({ posts: feedPosts(collections, feed.section), feed, site });
  }
}
