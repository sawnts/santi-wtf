# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal website with a terminal-themed interface. No build process except for content sync. Red background frames a floating dark terminal window.

**Key Principle: Obsidian is the source of truth.** All content lives in the Obsidian vault (`/Users/santi/Desktop/Areas/Jots/santi.wtf/public`). The site pulls from it via `npm run sync`. Never hardcode content that should come from Obsidian.

## Commands

```bash
# Sync content from Obsidian (full sync with git push)
cd terminal && npm run sync

# Quick sync without git (for testing builds)
cd terminal && npm run sync:mini

# Local development server
python3 -m http.server 8000
# Then open http://localhost:8000

# Validate JavaScript syntax
node --check terminal/app.js

# Lint CSS
npx stylelint terminal/styles.css --fix

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
- ~2500 lines, manages state, command dispatch, and all UI interactions

**Content pipeline** (`terminal/build.js`):
1. Reads all `.md` files from Obsidian vault (skips files/folders starting with `_`)
2. Parses frontmatter with gray-matter
3. Builds filename → slug lookup table (folders become collection tags, filenames become slugs)
4. **First pass**: Collects note metadata, extracts frontmatter, detects special content types (`habit-tracker`, `now` page)
5. **Second pass**: Converts markdown to HTML with marked, resolves `[[wikilinks]]` to `data-note` links, handles `![[image.png]]` embeds (copies images to `/terminal/images/`)
6. **Third pass**: Computes backlinks (which notes link TO each note)
7. Outputs:
   - `content/*.html` — One file per note
   - `data/index.json` — Complete note index with metadata, links, backlinks, excerpts
   - `data/now-data.json` — Dashboard data (location, reading, mood, energy, etc.)
   - `data/habits-config.json` — Habits with completion tracking

**Flat slug structure**:
- Folders in Obsidian become "collection" tags (e.g., `1. thinking/my-note.md` → collection: "thinking", slug: "my-note")
- All notes are stored flat in `terminal/content/` as `{slug}.html`
- Wikilinks resolve via slug lookup (case-insensitive, spaces → hyphens)
- Private content: Files in folders/files starting with `_` are skipped entirely

**SPA routing for GitHub Pages**:
- `404.html` stores path in `sessionStorage.pendingRoute`, redirects to `/`
- `app.js` checks `sessionStorage.pendingRoute` on load and handles routing
- Allows direct linking to notes via URL (e.g., `/my-note` → resolves via 404.html)

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Root entry point, loads terminal interface |
| `terminal/app.js` | Command system, graph visualization, animations, routing (~2500 lines) |
| `terminal/build.js` | Obsidian vault parser and HTML converter |
| `terminal/index.html` | Terminal interface template |
| `terminal/styles.css` | Dark theme, JetBrains Mono, CSS variables |
| `terminal/data/index.json` | Complete note index: titles, collections, stages, links, backlinks, excerpts |
| `404.html` | GitHub Pages SPA redirect handler |

## Command System

**Essential commands:**
- `explore` / `ls` — Force-directed graph of all notes with full-text search
- `cat [note]` / `read [note]` — Display a note's HTML content with backlinks
- `search [term]` — Full-text search across all notes
- `random` — Load a random note
- `now` — Show dashboard with location, reading, mood, habits
- `about` — About santi
- `info` — About this site
- `letters` — Subscribe to newsletter (Buttondown integration)
- `help` — List all commands
- **Direct title**: Type any note title to load it (e.g., `digital garden`)

**Dispatch logic**: `app.js` evaluates input as:
1. Slash commands (`/explore`, `/now`)
2. Registered commands (`cat`, `search`)
3. Direct note lookup via slug fuzzy match
4. If unrecognized, triggers "not found" message

## Digital Garden

**Frontmatter (all lowercase for consistency):**
```yaml
---
title: note title
stage: seedling | growing | evergreen
planted: 2026-01-24
tended: 2026-01-24
tags: [tag1, tag2]
---
```

**Growth stages:**
- 🌱 **seedling** — New, unpolished idea
- 🌿 **growing** — Developing, needs more work
- 🌲 **evergreen** — Mature, reference-worthy (used in header)

**Wikilinks** (resolved to notes via slug lookup):
- `[[note-name]]` → Link to `note-name` note
- `[[note-name|display text]]` → Link with custom display text
- Private/missing links show: `display text 🔒`

**Image embeds:**
- `![[image.png]]` — Automatically copied from vault to `/terminal/images/`
- Converted to standard markdown image links with proper paths
- Supported formats: png, jpg, jpeg, gif, webp, svg

**Private content:**
- Files or folders starting with `_` are skipped during build
- Use `_drafts/`, `_private/`, etc. to exclude content
- Private wikilinks (to `_*` notes) show as locked (🔒)

## Now Dashboard

The `now.md` note (frontmatter only) drives the dashboard displayed via `now` command.

**Expected frontmatter:**
```yaml
location: seattle, wa
status: null
reading:
  title: book title
  author: author name
  progress: 76
mood: building
energy: null
caffeine: null
habits:
  - name: meditation
    goal: daily stillness
  - name: exercise
    goal: daily movement
```

**Habits tracking:**
- Can be defined in `now.md` OR in a separate note with `type: habit-tracker`
- Completion data stored in code block: ` ```habits\nmeditation: 1-10, 15\nexercise: 1-28\n``` `
- `app.js` renders visual completion calendar for current year
- Days specified as ranges (`1-10`) or individual (`1, 5, 15`)

## Content Style

**All content must be lowercase** — titles, headings, body text, dates. This is a core aesthetic principle and should be consistent across all notes.

## Mobile & Responsive Design

**Breakpoints:**
- `768px` — Tablet layout changes
- `480px` — Phone layout changes

**Mobile-specific behavior:**
- ASCII banners and complex layouts hidden on phones
- Command palette moved to bottom of screen for thumb reach
- Swipe right gesture to navigate back
- Touch-optimized terminal interface
- Graph visualization scales appropriately

## Security

- `escapeHtml()` and `escapeAttr()` in `app.js` sanitize dynamic content before rendering
- No hardcoded secrets — all external integrations (e.g., Buttondown newsletter) use client-safe credentials
- GitHub Pages static hosting — no server-side processing
- HTML output is pre-built and stateless

## Common Development Tasks

**After syncing content from Obsidian:**
1. Check that all links resolved: `npm run sync` will log warnings for broken wikilinks
2. Verify images copied: Check `terminal/images/` for new images
3. Test note loading: Use `explore` command to verify all notes appear
4. Check data files: `terminal/data/index.json` should contain all notes with correct metadata

**Debugging wikilinks:**
- Wikilink resolution is case-insensitive and converts spaces to hyphens
- If a link shows 🔒, check: (1) Note exists in vault, (2) File doesn't start with `_`, (3) Slug matches filename (not folder path)
- The slug lookup is built in first pass of `build.js` — re-run sync if adding new notes

**Testing a single note build:**
- Edit `terminal/build.js` to temporarily filter to one note for faster iteration
- Or run full sync and check `terminal/content/{slug}.html` directly

**CSS changes:**
- All colors and fonts defined as CSS variables at top of `terminal/styles.css`
- Run `npx stylelint terminal/styles.css --fix` before committing
- Mobile breakpoints: see `@media (max-width: 480px)` sections
