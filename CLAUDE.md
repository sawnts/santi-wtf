# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal website with a terminal-themed interface. The site runs entirely in the browser with no build process (except for content sync). A red background frames a floating dark terminal window.

**Key Principle: Obsidian is the source of truth.** All content lives in the Obsidian vault (`/Users/santi/Desktop/Areas/Jots/santi.wtf/public`). The site pulls from it via `npm run sync`. Never hardcode content that should come from Obsidian.

## File Structure

```
santi-wtf/
├── index.html          # Root - loads terminal interface
├── terminal/           # Main terminal site
│   ├── index.html      # Terminal HTML structure
│   ├── styles.css      # Dark theme, JetBrains Mono font
│   ├── app.js          # Command system, graph, animations
│   ├── build.js        # Syncs from Obsidian (flat structure)
│   ├── data/           # index.json, now-data.json, habits-config.json
│   ├── content/        # Generated HTML notes
│   └── images/         # Images copied from Obsidian
├── garden/             # Legacy garden (fallback data source)
├── 404.html            # GitHub Pages SPA redirect handler
└── icons/              # Favicon and icons
```

## Architecture

**Terminal interface:**
- Single-page app with command-based navigation
- Slash menu (`/`) reveals quick actions (explore, random, about, now)
- Force-directed graph visualization for `explore` command
- Inline blinking cursor with placeholder "type / to begin"
- Hidden input element captures keystrokes globally
- Typing animation on welcome message

**Key elements:**
- ASCII banner at top (hidden on mobile <480px)
- macOS-style traffic light buttons (decorative)
- Mobile command palette at bottom (visible <768px)

**CSS Custom Properties (`terminal/styles.css`):**
```css
:root {
    --page-bg: #c0392b;      /* Red background */
    --bg: #1a1a1a;           /* Dark terminal */
    --text: #e0e0e0;
    --accent: #5dd9c1;       /* Teal accent */
    --accent-secondary: #b794f4;
    --accent-tertiary: #f687b3;
}
```

## Command System

| Command | Aliases | Description |
|---------|---------|-------------|
| `/` | - | Show slash menu with glowing dot selection |
| `explore` | `ls` | Open force-directed graph of all notes |
| `list` | `notes` | Text list of all notes |
| `cat [note]` | `read`, `open`, `go` | Display a note |
| `search [term]` | `find`, `grep` | Search notes by title/tags/content |
| `random` | `rand`, `r` | Load random note |
| `recent` | `latest` | Recently updated notes |
| `now` | `status` | Current status dashboard |
| `about` | `whoami` | About page |
| `home` | `clear`, `cls`, `back` | Return to welcome screen |
| `help` | `?` | Show all commands |
| `matrix` | - | Easter egg: matrix rain effect |

**Direct access:** Typing a note title and pressing Enter loads it directly.

**Slash menu:** Type `/` to show menu, use up/down arrows to navigate, Enter to select, Escape to dismiss.

## Digital Garden

**Syncing from Obsidian:**
```bash
cd terminal && npm run sync
# Or fallback:
cd garden && npm run sync
```

The build script:
1. Reads markdown from Obsidian vault (`/Users/santi/Desktop/Areas/Jots/santi.wtf/public`)
2. Converts to HTML with wikilink support
3. Converts `![[image.png]]` embeds to `<img>` tags
4. Generates `data/index.json` with note metadata, links, backlinks
5. Outputs to `content/` directory

**Note frontmatter:**
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
- 🌱 seedling — early ideas, rough thoughts
- 🌿 growing — developing ideas with some structure
- 🌲 evergreen — well-developed, stable concepts

**Wikilinks:** `[[note-name]]` or `[[path/note-name|display text]]`

**Image embeds:** `![[image.png]]` or `![[image.png|alt text]]`

**Private files:** Files/folders starting with `_` are skipped (e.g., `_template.md`)

## Now Dashboard

The `now.md` frontmatter drives the now page:
```yaml
---
title: now
location: seattle, wa
reading:
  title: book title
  author: author name
  progress: 76
mood: building
energy: 7
caffeine: 2
habits:
  - name: meditation
    goal: daily stillness
---
```

## URL Routing

```
santi.wtf/              → Terminal home
santi.wtf/[note-slug]   → Load note directly
santi.wtf/now           → Now page
santi.wtf/about         → About page
```

Uses `404.html` + sessionStorage pattern for GitHub Pages SPA routing.

## Local Development

**Always test locally before pushing:**
```bash
python3 -m http.server 8000
```
Then open `localhost:8000`

## Deployment

Site is hosted on GitHub Pages. Push to main branch to deploy:
```bash
git add .
git commit -m "description"
git push
```

## Content Style

**All content must be lowercase** — titles, headings, body text, dates. This is the site's aesthetic.

## Mobile

**Breakpoints:** 768px (tablet), 480px (phone)

- ASCII banner hidden on phones
- Mobile command palette appears at bottom
- Swipe right to go back
- Touch anywhere to focus input

## Security Notes

- Firebase credentials in client code (security via Firebase Rules)
- `escapeHtml()` and `escapeAttr()` used for dynamic content
- Input limited to prevent abuse
