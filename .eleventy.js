import markdownIt from "markdown-it";

export default function (eleventyConfig) {
  // copy static assets
  eleventyConfig.addPassthroughCopy("public");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

  // markdown config
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });
  eleventyConfig.setLibrary("md", md);

  // notes collection
  eleventyConfig.addCollection("notes", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/notes/**/*.md")
      .filter((item) => !item.data.draft)
      .sort((a, b) => {
        const dateA = a.data.date || a.date;
        const dateB = b.data.date || b.date;
        return dateB - dateA;
      });
  });

  // notes sorted alphabetically (for sidebar)
  eleventyConfig.addCollection("notesByTitle", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/notes/**/*.md")
      .filter((item) => !item.data.draft)
      .sort((a, b) => {
        const titleA = (a.data.title || "").toLowerCase();
        const titleB = (b.data.title || "").toLowerCase();
        return titleA.localeCompare(titleB);
      });
  });

  // photos collection
  eleventyConfig.addCollection("photos", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/photos/**/*.md")
      .filter((item) => !item.data.draft)
      .sort((a, b) => {
        const dateA = a.data.date || a.date;
        const dateB = b.data.date || b.date;
        return dateB - dateA;
      });
  });

  // --- numberLines filter ---
  // flattens markdown-it HTML so every logical line is a direct
  // child of .lined, enabling continuous CSS counter numbering.
  // ul/ol → individual line-li divs with dash prefix
  // blockquote → individual line-quote divs with border span
  // blank spacer divs inserted between block groups
  eleventyConfig.addFilter("numberLines", function (html) {
    if (!html || typeof html !== "string") return html;

    const output = [];
    const rawLines = html.split("\n");
    let state = "normal";
    let buffer = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      switch (state) {
        case "normal":
          if (/^<[uo]l>$/i.test(line)) {
            state = "list";
          } else if (/^<blockquote>$/i.test(line)) {
            state = "quote";
          } else if (/^<pre/i.test(line)) {
            buffer = [rawLines[i]];
            if (/<\/pre>/.test(line)) {
              output.push(buffer.join("\n"));
              buffer = [];
            } else {
              state = "pre";
            }
          } else if (/^</.test(line)) {
            // recognized block element — keep as-is
            output.push(line);
          } else {
            // raw text not wrapped in a tag (e.g. text after <hr>)
            // wrap in a paragraph so it gets a line number
            output.push("<p>" + line + "</p>");
          }
          break;

        case "list":
          if (/^<\/[uo]l>$/i.test(line)) {
            state = "normal";
          } else if (/^<li>/i.test(line)) {
            if (/<\/li>$/i.test(line)) {
              const content = line
                .replace(/^<li>/i, "")
                .replace(/<\/li>$/i, "");
              output.push(
                '<div class="line line-li"><span class="li-dash">\u2014 </span>' +
                  content +
                  "</div>",
              );
            } else {
              buffer = [line.replace(/^<li>/i, "")];
            }
          } else if (/<\/li>$/i.test(line)) {
            buffer.push(line.replace(/<\/li>$/i, ""));
            const content = buffer.join(" ");
            output.push(
              '<div class="line line-li"><span class="li-dash">\u2014 </span>' +
                content +
                "</div>",
            );
            buffer = [];
          } else {
            buffer.push(line);
          }
          break;

        case "quote":
          if (/^<\/blockquote>$/i.test(line)) {
            state = "normal";
          } else if (/^<p>/i.test(line)) {
            if (/<\/p>$/i.test(line)) {
              const content = line
                .replace(/^<p>/i, "")
                .replace(/<\/p>$/i, "");
              output.push(
                '<div class="line line-quote"><span class="quote-border">' +
                  content +
                  "</span></div>",
              );
            } else {
              buffer = [line.replace(/^<p>/i, "")];
            }
          } else if (/<\/p>$/i.test(line)) {
            buffer.push(line.replace(/<\/p>$/i, ""));
            for (const bufLine of buffer) {
              const trimmed = bufLine.trim();
              if (trimmed) {
                output.push(
                  '<div class="line line-quote"><span class="quote-border">' +
                    trimmed +
                    "</span></div>",
                );
              }
            }
            buffer = [];
          } else {
            buffer.push(line);
          }
          break;

        case "pre":
          buffer.push(rawLines[i]);
          if (/<\/pre>/.test(line)) {
            output.push(buffer.join("\n"));
            buffer = [];
            state = "normal";
          }
          break;
      }
    }

    // insert blank spacer lines between different block groups
    const spaced = [];
    for (let j = 0; j < output.length; j++) {
      spaced.push(output[j]);
      if (j < output.length - 1) {
        const curr = output[j];
        const next = output[j + 1];
        const currLi = curr.includes("line-li");
        const nextLi = next.includes("line-li");
        const currQ = curr.includes("line-quote");
        const nextQ = next.includes("line-quote");
        if (!(currLi && nextLi) && !(currQ && nextQ)) {
          spaced.push('<div class="line line-blank"></div>');
        }
      }
    }

    return spaced.join("\n");
  });

  // date formatting filter
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    const months = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  });

  // iso date filter for datetime attributes and RSS
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    return new Date(dateObj).toISOString().split("T")[0];
  });

  // readable date+time filter for "last modified" footer
  eleventyConfig.addFilter("readableDateTime", (dateObj) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    const months = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    const h = d.getUTCHours().toString().padStart(2, "0");
    const m = d.getUTCMinutes().toString().padStart(2, "0");
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${h}:${m}`;
  });

  // get date from a collection item
  eleventyConfig.addFilter("getDate", (item) => {
    if (!item) return "";
    return item.data?.date || item.date || "";
  });

  // head filter - get first N items from array
  eleventyConfig.addFilter("head", (arr, n) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, n);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
}
