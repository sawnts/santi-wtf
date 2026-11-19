# site versions

- production: `main` currently publishes the temporary construction page at `https://santi.wtf/`.
- v3: the exact previous source is preserved on `archive/v3` at `5870272ff8813a5597775fd9e3d00cfb45f900bf`. leave this branch unchanged.
- v4: the native redesign is developed separately on `v4-redesign`.

`npm run build` cleans `_site/` and publishes only the construction page, custom 404, font, stylesheet, favicon, and existing custom domain files. the deployment workflow and domain remain unchanged.

`npm run build:site` builds the complete eleventy site for local design review. this output must not be deployed while construction mode is intended. the github pages workflow uses `npm run build`.

when v4 is approved, merge its source into `main` and explicitly change the production build command back to the full eleventy build. retain the v3 archive branch. all source content and original image files remain in git.
