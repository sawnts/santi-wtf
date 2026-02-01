# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal website with a terminal-themed interface. No build process except for content sync. Red background frames a floating dark terminal window.

**Key Principle: Obsidian is the source of truth.** All content lives in the Obsidian vault (`/Users/santi/Desktop/Areas/Jots/santi.wtf/public`). The site pulls from it via `npm run sync`. Never hardcode content that should come from Obsidian.

## Commands

```bash
# Sync content from Obsidian (run from terminal/ directory)
cd terminal && npm run sync

# Local development
python3 -m http.server 8000
# Then open localhost:8000

# Deploy (GitHub Pages)
git push origin main
```

## Architecture

**Single-page terminal app** (`terminal/app.js`):
- Hidden `<input>` captures all keystrokes globally
- Typing `/` shows slash menu with quick actions
- Commands execute and render output to `#output` div
- `explore` command opens force-directed graph visualization on canvas
- URL routing via `history.pushState` + 404.html redirect pattern

**Content pipeline** (`terminal/build.js`):
1. Reads markdown from Obsidian vault
2. Parses frontmatter with gray-matter
3. Converts to HTML with marked
4. Resolves `[[wikilinks]]` and `![[image.png]]` embeds
5. Computes backlinks
6. Outputs: `content/*.html`, `data/index.json`, `data/now-data.json`, `data/habits-config.json`

**SPA routing for GitHub Pages**:
- `404.html` stores path in `sessionStorage.redirect`, redirects to `/`
- `app.js` checks `sessionStorage.pendingRoute` on load (note: there's a key mismatch bug — 404 uses `redirect`, app expects `pendingRoute`)

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Root entry, loads terminal interface |
| `terminal/app.js` | Command system, graph, animations, routing |
| `terminal/build.js` | Obsidian → HTML converter |
| `terminal/styles.css` | Dark theme, JetBrains Mono, CSS variables |
| `terminal/data/index.json` | Note metadata, links, backlinks |

## Command System

Essential commands: `explore`, `cat [note]`, `search [term]`, `random`, `now`, `about`, `home`, `help`

Aliases exist (e.g., `ls` → `explore`, `read` → `cat`). Type a note title directly to load it.

## Digital Garden

**Frontmatter:**
```yaml
---
title: note title
stage: seedling | growing | evergreen
planted: 2026-01-24
tended: 2026-01-24
tags: [tag1, tag2]
---
```

**Growth stages:** 🌱 seedling → 🌿 growing → 🌲 evergreen

**Wikilinks:** `[[note-name]]` or `[[note|display text]]`

**Image embeds:** `![[image.png]]` — copied to `terminal/images/`

**Private files:** Files/folders starting with `_` are skipped

## Now Dashboard

`now.md` frontmatter drives the dashboard:
```yaml
location: seattle, wa
reading:
  title: book title
  author: author name
  progress: 76
mood: building
habits:
  - name: meditation
    goal: daily stillness
```

## Content Style

**All content must be lowercase** — titles, headings, body text, dates. This is the site's aesthetic.

## Mobile

Breakpoints: 768px (tablet), 480px (phone)
- ASCII banner hidden on phones
- Mobile command palette at bottom
- Swipe right to go back

## Security

- `escapeHtml()` and `escapeAttr()` sanitize dynamic content
- Firebase credentials in client code (security via Firebase Rules)
