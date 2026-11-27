# site versions

- production: `main` publishes the native v4 site at `https://santi.wtf/`.
- v2: the earlier "garden" site history (january 2026) is preserved on `archive/v2` at `4e998b0`. leave this branch unchanged.
- v3: the exact previous source is preserved on `archive/v3` at `5870272ff8813a5597775fd9e3d00cfb45f900bf`. leave this branch unchanged.
- construction: the temporary holding page is kept in `construction/` as a fallback.

`npm run build` cleans `_site/` and builds the complete eleventy site. the github pages workflow uses `npm run build`.

`npm run build:construction` outputs only the holding page, custom 404, font, stylesheet, favicon, and custom domain files. to put the site back under construction, point the deploy workflow's build step at `npm run build:construction` (or swap the two scripts in `package.json`) and push to `main`. retain the v3 archive branch. all source content and original image files remain in git.
