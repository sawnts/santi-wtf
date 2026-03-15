import { DateTime } from "luxon";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginBundle from "@11ty/eleventy-plugin-bundle";
import { execSync } from "child_process";

export default function (eleventyConfig) {
  // --- passthrough copies ---
  eleventyConfig.addPassthroughCopy("public");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy(".nojekyll");

  // --- plugins ---
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginBundle);

  // --- filters ---
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "LLLL d, yyyy"
    );
  });

  eleventyConfig.addFilter("shortDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLL d");
  });

  eleventyConfig.addFilter("dinkyDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "LLL dd, yyyy"
    );
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toISO();
  });

  eleventyConfig.addFilter("time", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("h:mm a");
  });

  eleventyConfig.addFilter("fullDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "EEEE, LLLL d, yyyy"
    );
  });

  eleventyConfig.addFilter("filterTagList", (tags) => {
    return (tags || []).filter(
      (tag) => ["all", "nav", "posts"].indexOf(tag) === -1
    );
  });

  eleventyConfig.addFilter("getPrevNext", (page, collection) => {
    if (!collection) return { prev: null, next: null };
    const index = collection.findIndex((item) => item.url === page.url);
    return {
      prev: index > 0 ? collection[index - 1] : null,
      next: index < collection.length - 1 ? collection[index + 1] : null,
    };
  });

  // --- git filters ---
  eleventyConfig.addFilter("gitCommitHash", (inputPath) => {
    try {
      return execSync(`git log -1 --format="%h" -- "${inputPath}"`)
        .toString()
        .trim();
    } catch {
      return "";
    }
  });

  eleventyConfig.addFilter("gitCommitDate", (inputPath) => {
    try {
      const date = execSync(
        `git log -1 --format="%ai" -- "${inputPath}"`
      )
        .toString()
        .trim();
      return date ? new Date(date) : null;
    } catch {
      return null;
    }
  });

  // --- collections ---
  eleventyConfig.addCollection("notes", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("notes/**/*.md")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("notesByTitle", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("notes/**/*.md")
      .sort((a, b) => {
        const titleA = (a.data.title || "").toLowerCase();
        const titleB = (b.data.title || "").toLowerCase();
        return titleA.localeCompare(titleB);
      });
  });

  eleventyConfig.addCollection("newsletter", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("newsletter/**/*.md")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("photos", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("photos/**/*.md")
      .sort((a, b) => b.date - a.date);
  });

  // --- markdown ---
  const mdLib = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: "after",
      class: "direct-link",
      symbol: "#",
    }),
    level: [1, 2, 3, 4],
    slugify: eleventyConfig.getFilter("slugify"),
  });

  eleventyConfig.setLibrary("md", mdLib);

  return {
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
  };
}
