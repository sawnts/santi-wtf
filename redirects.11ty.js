// Old letter URLs forward to their new home. GitHub Pages has no server redirects,
// so each one is a noindex page with an instant meta refresh and a visible link.
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export default class Redirects {
  data() {
    return {
      layout: 'layouts/base.njk',
      seoExclude: true,
      eleventyExcludeFromCollections: true,
      pagination: { data: 'redirects', size: 1, alias: 'redirect' },
      permalink: ({ redirect }) => redirect.from,
      eleventyComputed: {
        title: ({ redirect }) => redirect.title,
        description: ({ redirect }) => `“${redirect.title}” has moved. this page forwards to ${redirect.to} on santi.wtf.`,
        redirectTo: ({ redirect }) => redirect.to,
      },
    };
  }

  render({ redirect }) {
    return `<main class="page" id="main-content">
  <header class="page-header"><h1 id="page-title" tabindex="-1">${escape(redirect.title)}</h1></header>
  <p class="prose">this has moved to <a href="${escape(redirect.to)}">${escape(redirect.to)}</a>.</p>
</main>`;
  }
}
