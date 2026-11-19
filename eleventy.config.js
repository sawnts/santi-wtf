import { DateTime } from 'luxon';
import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import pluginRss from '@11ty/eleventy-plugin-rss';
import pluginSyntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';
import pluginBundle from '@11ty/eleventy-plugin-bundle';
import { photograph, photoSource, renderImage } from './_lib/photographs.js';

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ public: '/' });
  eleventyConfig.addPassthroughCopy('CNAME');
  eleventyConfig.addPassthroughCopy('.nojekyll');
  eleventyConfig.addWatchTarget('public/images/');
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginBundle);

  const asDateTime = (value) => {
    if (value instanceof Date) return DateTime.fromJSDate(value, { zone: 'utc' });
    return value ? DateTime.fromISO(String(value), { zone: 'utc' }) : null;
  };
  const format = (value, pattern) => {
    const date = asDateTime(value);
    return date?.isValid ? date.toFormat(pattern) : '';
  };
  eleventyConfig.addFilter('htmlDateString', (value) => format(value, 'yyyy-MM-dd'));
  eleventyConfig.addFilter('personalDate', (value) => format(value, 'LLL dd, yyyy').toLowerCase());
  eleventyConfig.addFilter('readableDate', (value) => format(value, 'LLLL d, yyyy'));
  eleventyConfig.addFilter('shortDate', (value) => format(value, 'LLL d'));
  eleventyConfig.addFilter('dinkyDate', (value) => format(value, 'LLL dd, yyyy'));
  eleventyConfig.addFilter('fullDate', (value) => format(value, 'EEEE, LLLL d, yyyy'));
  eleventyConfig.addFilter('time', (value) => format(value, 'h:mm a'));
  eleventyConfig.addFilter('filterTagList', (tags = []) => tags.filter((tag) => !['all', 'nav', 'posts'].includes(tag)));
  eleventyConfig.addFilter('getPrevNext', (page, collection = []) => {
    const index = collection.findIndex((item) => item.url === page.url);
    return { prev: index > 0 ? collection[index - 1] : null, next: index >= 0 ? collection[index + 1] : null };
  });
  eleventyConfig.addFilter('photoAlt', (inputPath) => photoSource(inputPath).alt);
  eleventyConfig.addFilter('withoutLeadImage', (content) => content
    .replace(/<img\b[^>]*>/i, '')
    .replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, '')
    .replace(/<p>\s*<br\s*\/?>/i, '<p>'));
  eleventyConfig.addAsyncShortcode('photograph', photograph);
  eleventyConfig.addAsyncShortcode('image', (src, alt) => renderImage(src.replace(/^\.\/public/, ''), alt));

  const newestFirst = (a, b) => b.date - a.date || a.inputPath.localeCompare(b.inputPath);
  eleventyConfig.addCollection('notes', (api) => api.getFilteredByGlob('notes/**/*.md').sort(newestFirst));
  eleventyConfig.addCollection('notesByTitle', (api) => api.getFilteredByGlob('notes/**/*.md').sort((a, b) => a.data.title.localeCompare(b.data.title)));
  eleventyConfig.addCollection('newsletter', (api) => api.getFilteredByGlob('newsletter/**/*.md').sort(newestFirst));
  eleventyConfig.addCollection('photos', (api) => api.getFilteredByGlob('photos/**/*.md').sort(newestFirst));

  const markdown = markdownIt({ html: true, breaks: true, linkify: true }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({ placement: 'after', class: 'direct-link', symbol: '#' }),
    level: [1, 2, 3, 4],
    slugify: eleventyConfig.getFilter('slugify'),
  });
  const defaultLink = markdown.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
  markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const link = tokens[index];
    const href = link.attrGet('href');
    if (/^https:\/\/santi\.wtf(?:\/|$)/.test(href)) {
      const url = new URL(href);
      link.attrSet('href', url.pathname + url.search + url.hash);
    } else if (/^https?:/.test(href)) {
      link.attrSet('target', '_blank');
      link.attrSet('rel', 'noopener noreferrer');
    }
    return defaultLink(tokens, index, options, env, renderer);
  };
  eleventyConfig.setLibrary('md', markdown);

  eleventyConfig.addTransform('optimizeContentImages', async function (content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    const images = [...content.matchAll(/<img\b[^>]*\bsrc="(\/images\/[^\"]+)"[^>]*>/g)];
    for (const [tag, src] of images) {
      if (src.startsWith('/images/generated/')) continue;
      const alt = markdown.utils.unescapeAll(tag.match(/\balt="([^\"]*)"/)?.[1] || '');
      content = content.replace(tag, await renderImage(src, alt));
    }
    return content;
  });

  return {
    templateFormats: ['md', 'njk', 'html', '11ty.js'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    dir: { input: '.', includes: '_includes', data: '_data', output: '_site' },
  };
}
