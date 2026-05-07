export default class SearchIndex {
  data() {
    return {
      permalink: "/search-index.json",
      eleventyExcludeFromCollections: true,
    };
  }
  render({ collections }) {
    const items = [
      ...collections.notesByTitle.map((p) => ({
        title: p.data.title,
        url: p.url,
        section: "notes",
      })),
      ...collections.newsletter.map((p) => ({
        title: p.data.title,
        url: p.url,
        section: "newsletter",
      })),
      ...collections.photos.map((p) => ({
        title: p.data.title,
        url: p.url,
        section: "photos",
      })),
    ];
    return JSON.stringify({ items });
  }
}
