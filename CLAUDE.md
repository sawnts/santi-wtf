# CLAUDE.md

guidance for claude code when working in this repo.

## project overview

static personal site built with eleventy 3.x. file-browser UI with a fixed sidebar navigator, light/dark theme, and monospace content area. hosted on github pages at santi.wtf.

homepage copy lives in `README.md` (with `permalink: /` in frontmatter).

## commands

```bash
# dev server (port 8080, hot reload)
npm run serve

# build to _site/
npm run build

# deploy (github pages auto-builds on push)
git push origin main
```

## architecture

**eleventy static site** — no custom build pipeline, no external content source. all content is local markdown.

**three collections:**

| collection | folder | url pattern | directory config |
|-----------|--------|-------------|-----------------|
| notes | `notes/` | `/notes/{slug}/` | `notes/notes.json` |
| newsletter | `newsletter/` | `/newsletter/{slug}/` | `newsletter/newsletter.json` |
| photos | `photos/` | `/photos/{slug}/` | `photos/photos.json` |

each collection's `.json` file sets `layout`, `tags`, and `permalink` pattern.

**layouts** (`_includes/`):
- `layouts/base.njk` — root HTML shell: inline SVG sprite, meta tags, theme toggle, header with prev/next nav, sidebar management
- `layouts/note.njk` — wraps content in `.content-area` div
- `nav.njk` — sidebar navigator with folder tree and search/filter
- `footer.njk` — fixed footer with published date (calendar) and last-updated date (clock, from git)

**archive pages** (root-level `.njk` files):
- `notes.njk` → `/notes/` — table of all notes
- `newsletter.njk` → `/newsletter/` — table of all newsletters
- `photos.njk` → `/photos/` — table of all photos

## key files

| file | purpose |
|------|---------|
| `README.md` | homepage content (`permalink: /`) |
| `eleventy.config.js` | plugins, filters, collections, markdown config |
| `_includes/layouts/base.njk` | root HTML template with SVG sprite, theme toggle, header |
| `_includes/nav.njk` | sidebar navigator with folder tree and filter |
| `_includes/footer.njk` | content footer with dates |
| `public/css/base.css` | all styles, design tokens, responsive layout |
| `.eleventyignore` | excludes `CLAUDE.md` and `README.md` from build |

## content

**frontmatter:**
```yaml
---
title: lowercase title
date: 2026-03-15
---
```

`title` and `date` are required. filenames become URL slugs.

**images:** put files in `public/images/`, reference as `![alt](/public/images/filename.jpg)`.

**all content must be lowercase** — titles, headings, body text. this is a core aesthetic.

see `PUBLISHING.md` for the full publishing guide with examples.

## eleventy config highlights

**plugins:** rss, syntax highlight, bundle

**filters:**
- date formatting: `readableDate`, `shortDate`, `dinkyDate`, `fullDate`, `htmlDateString`, `time`
- `gitCommitDate` / `gitCommitHash` — git metadata for a file's last commit
- `filterTagList` — strips internal tags
- `getPrevNext` — prev/next note navigation

**collections:**
- `notes` — by date desc
- `notesByTitle` — alphabetical (sidebar)
- `newsletter` — by date desc
- `photos` — by date desc

**markdown:** markdown-it with anchor plugin (h1-h4), HTML enabled, linkify enabled

## css architecture (`public/css/base.css`)

**design tokens (css variables):**
- colors: neutral scale (100-1200) + primary, using `light-dark()` for dark mode
- fonts: `--font-mono` (SF Mono / ui-monospace), `--font-sans` (Inter)
- spacing: `--space-half` through `--space-5`
- sizing: `--size-navigator` (20rem), `--size-content-width` (40rem), `--size-chrome` (2.25rem)

**layout:**
- desktop (768px+): fixed sidebar left + content area
- mobile (<768px): sidebar hidden, toggleable overlay
- line numbers rendered via CSS counters on `.content-area`
- view transitions enabled

## deployment

github actions (`.github/workflows/deploy.yml`):
1. push to `main` triggers build
2. `npm ci` + `npm run build`
3. uploads `_site/` and deploys to github pages

passthrough copies: `public/`, `images/`, `CNAME`, `.nojekyll`

## common tasks

**add a note:** create `notes/my-note.md` with frontmatter, commit, push.

**add an image:** drop file in `public/images/`, reference in markdown.

**css changes:** edit `public/css/base.css`. design tokens at the top. mobile breakpoint at 768px.

**preview locally:** `npm run serve` → `http://localhost:8080`

**update homepage:** edit `README.md` in repo root.
