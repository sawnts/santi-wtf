# how to publish

the site keeps its content in local markdown. notes, letters, and photographs each have a folder:

| content | folder | url |
|---------|--------|-----|
| notes | `notes/` | `/notes/your-title/` |
| letters | `newsletter/` | `/newsletter/your-title/` |
| photographs | `photos/` | `/photos/your-title/` |

## write a post

create a markdown file with a title and publication date:

```markdown
---
title: your title here
date: 2026-11-19
---

your words go here.
```

keep the site's lowercase voice. the filename becomes the URL, so retain it when editing an existing post to avoid breaking links. existing prose, punctuation, and links should stay intact unless you intend to edit them.

markdown supports paragraphs, headings, bold/italic text, links, lists, quotes, and images. line breaks are preserved. notes and letters appear automatically in their archives, newest first.

## add a photograph

1. put the original file in `public/images/`.
2. create a corresponding markdown post in `photos/`:

```markdown
---
title: seattle morning
date: 2026-11-19
---

![fog rolling over the puget sound](/images/seattle-morning.jpg)

caught this on my walk to the coffee shop.
```

the **first markdown image** is used for the homepage filmstrip, the photographs gallery wall, the enlarged popup, and the full photo page. its alt text supplies the image description. additional prose and images remain on the canonical photo page, available through the popup's `photo page` link. ordinary modifier-clicks and javascript-disabled navigation still open that page directly.

no gallery array or dimensions need updating. eleventy image creates 320px, 640px, and up-to-1600px webp versions at build time, retaining the original aspect ratio. landscape and portrait images work through the same workflow. generated files stay in `_site/images/generated/`; do not commit them. the original file remains available at its `/images/...` URL.

use meaningful alt text and a real publication date. the date is not presented as a capture date. images in notes and letters use the same `/images/...` markdown syntax and are optimized during the build.

## homepage and navigation

edit the homepage introduction in `README.md`. navigation and the short about text live in `_data/site.json`. the approved introduction ends:

```text
art, tech, culture.
overly caffeinated.
```

the compact subscribe form appears on the homepage and letters archive. `_includes/partials/subscribe.njk` submits a native POST to the existing personal buttondown newsletter (`sawnts`). buttondown handles confirmation, validation, and any captcha on its own page; no API key or custom backend is needed. do not test it by subscribing someone without their request.

## preview and build

```bash
npm ci
npm run serve
```

open `http://localhost:8080`. to produce the full static preview:

```bash
npm run build:site
```

the result is in `_site/`. preview a new photo in the filmstrip and on its full page, and check both desktop and phone sizes.

## release

the redesign is being prepared on a separate v4 branch while production shows the construction page. in this phase, `npm run build` produces that construction site; `npm run build:site` produces the full native preview. pushing to main does not publish new notes or launch v4 while construction mode remains selected. review the current branch and deployment mode before pushing. switching the production build to the full redesign requires explicit release approval.

v3 is preserved as source on github's `archive/v3` branch.
