# working on santi.wtf

## architecture

native eleventy 3.x personal site. no client framework, iframe, exported visualization runtime, or client-side router. keep navigation as ordinary anchors.

- `README.md` renders `/` through `layouts/home.njk`.
- notes and newsletter posts remain local markdown with their existing URLs and prose.
- `photos/*.md` use `layouts/photo.njk`. the first markdown image supplies each gallery image, alt text, and caption.
- `_data/site.json` owns navigation and the short about text.
- `_includes/layouts/base.njk` owns document metadata and shared asset links.
- `_includes/partials/filmstrip.njk` renders the homepage photo strip; `photos.njk` renders the wider gallery wall.
- `_includes/partials/lightbox.njk` and `public/js/lightbox.js` enhance photo links on those two pages with one native dialog. keep canonical hrefs, modifier clicks, focus/scroll restoration, loading/error handling, and reduced motion.
- `_includes/partials/subscribe.njk` is the shared native buttondown signup. do not replace its POST with fetch, expose API keys, or show a fake subscription success state.
- `public/css/base.css` is the shared design system; `public/js/site.js` adds keyboard movement through filmstrips.
- `_lib/photographs.js` generates responsive webp images with intrinsic dimensions through eleventy image. metadata is derived from source images, including future portrait photographs.

## preview

```bash
npm ci
npm run serve
npm run build:site
```

the full site outputs to `_site/`. during the current deployment phase, `npm run build` produces the production construction site and `npm run build:site` produces the complete native preview. keep production's build choice on construction until the user explicitly approves launching v4. do not assume a successful preview or a push to main authorizes the launch.

## visual contract

the approved personal index is light, sparse, compact, and monospace. the native canvas is centered at a maximum width of 736px, with the approved 56px top/14px horizontal content padding and 13px typography. retain the real photographs, lowercase voice, and restrained amber hover/focus color.

the homepage strip uses a shared height and natural image widths: `width: auto`, `flex: 0 0 auto`, horizontal overflow, and intrinsic dimensions. the gallery wall uses two natural-ratio columns in a 1120px canvas, collapsing to one column on small screens. keep wall images `width: 100%; height: auto`; do not leak the strip's fixed heights into the wall. never crop photographs into square tiles. photo detail URLs remain available behind every lightbox trigger.

## content

preserve existing article and photo markdown bodies. keep source punctuation, wording, links, and formatting. dates are publication dates, not capture dates. the homepage's approved copy is `art, tech, culture.` and `overly caffeinated.`.

new posts require `title` and `date: YYYY-MM-DD`. filenames determine URLs. write photo alt text in the markdown image; do not add a separate hardcoded gallery list. the collections are `notes`, `newsletter`, and `photos`, newest first, with stable filename ordering for equal dates.

## checks

build the full site, verify original deep routes, and inspect desktop/mobile before calling a change complete. ensure external asset paths resolve, photo ratios remain natural, keyboard focus is visible, and subscription/404 pages remain available. docs, construction input, and helper scripts are excluded by `.eleventyignore`.

the frozen v3 source is retained on `archive/v3` in github. never recreate a public v3 archive without the user's request.
