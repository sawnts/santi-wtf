# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal blog/website styled to look like Windows 98. The site runs entirely in the browser with no build process or dependencies. Firebase is used for the real-time chat feature.

## File Structure

```
wtf/
├── index.html          # Main HTML - window markup, desktop layout
├── styles.css          # All CSS - Windows 98 styling
├── scripts.js          # All JavaScript - window management, navigation, chat
├── 404.html            # GitHub Pages SPA redirect handler
├── now.html            # Legacy "Now" page (redirects to garden)
├── posts/              # Legacy blog posts (redirects to garden)
├── applications/       # Standalone apps (FlowGarden, Sticky Notes, Pomodoro)
├── icons/              # Windows 98 style icons
└── garden/             # Digital garden (synced from Obsidian)
    ├── garden.html     # Garden UI (Windows Explorer style)
    ├── garden.css      # Garden-specific styles
    ├── garden.js       # Garden functionality
    ├── build.js        # Build script to sync from Obsidian
    ├── content/        # Generated HTML from markdown
    └── data/           # index.json with note metadata
```

## Architecture

**Single-page application structure:**
- `index.html` - Window markup and desktop layout only
- `styles.css` - All Windows 98 styling (external file)
- `scripts.js` - All JavaScript logic (external file)
- Simulates a desktop environment with draggable, resizable, and minimizable windows
- The digital garden is the main content area, running as an iframe

**URL Routing:**
- Uses pathname-based routing (`/garden`, `/garden/folder/note-name`, `/player`)
- `404.html` handles GitHub Pages SPA redirects by storing path in sessionStorage and redirecting to `/`
- `handleRoutes()` reads the path and navigates to appropriate garden note
- Garden URLs use dashes instead of spaces (e.g., `/garden/being/my-note-name`)

**Applications in `applications/` directory:**
- Interactive apps that run in their own desktop windows (e.g., FlowGarden)
- Each app is a standalone HTML file with embedded CSS and JS

**Digital Garden (`garden/` directory):**
- Windows Explorer-styled interface for browsing interconnected notes
- Runs as an iframe inside a draggable desktop window
- Content synced from Obsidian vault via build script
- Features: folder tree, wikilinks, backlinks, search, graph view, hover previews
- Resets to welcome page when window is closed and reopened

## Key Functions (in scripts.js)

**Window management:**
- `openWindow(id)` / `closeWindow(id)` - Show/hide window elements
- `minimizeWindow(id)` / `restoreWindow(id)` - Minimize to taskbar / restore from taskbar
- `setActiveWindow(id)` - Bring window to front and mark as active
- `dragStart()` / `resizeStart()` - Handle window drag and resize interactions

**State tracking:**
- `minimizedWindows` (Set) - Tracks which windows are minimized
- `openWindows` (Set) - Tracks which windows are open

**Chat (Firebase):**
- `initChatRoom()` - Sets up Firebase listeners for messages and status
- `submitChat()` - Posts visitor messages (max 500 chars, name max 50 chars)
- `postAsOwner()` - Posts as santi with blue bubble (admin mode only)
- `updateStatus()` - Updates online/away status (admin mode only)

**Admin Mode (Firebase Auth):**
- Press Ctrl+Shift+L (Windows) or Cmd+Shift+L (Mac) to login/logout with Google
- Or call `adminLogin()` / `adminLogout()` in browser console
- Only the configured ADMIN_UID can access admin features
- Enables: posting as owner in chat, updating status, editing/deleting updates

**Applications:**
- `loadApplication(contentId, filePath, appName)` - Generic loader for apps in applications/

## Content Style Guidelines

**All content must be lowercase** - titles, headings, body text, dates, everything. This is the site's aesthetic.

**Post signature:** Every post ends with a monospace signature linked to email:
```html
<p style="font-family: monospace; margin-top: 1.5em;">&lt;3 <a href="mailto:yosawnts@gmail.com">santi</a></p>
```

## Adding Site Updates

The Updates window displays entries from the `siteUpdates` array at the top of scripts.js. Add new entries at the top of the array, maintaining descending date order:

```javascript
const siteUpdates = [
    { date: "january 18, 2026", text: "added updates window to the desktop" },
    // add new entries above existing ones
];
```

## Digital Garden

The garden is a collection of interconnected notes synced from an Obsidian vault.

**Syncing from Obsidian:**
```bash
cd garden && npm run sync
```

This runs `build.js` which:
1. Reads markdown files from the Obsidian vault (`/Users/santi/Desktop/Areas/Jots/santi.wtf/public`)
2. Converts them to HTML with wikilink support
3. Generates `data/index.json` with note metadata, links, and backlinks
4. Outputs HTML files to `content/`

**Note frontmatter format:**
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

**Wikilinks:** Use `[[note-name]]` or `[[path/note-name|display text]]` format.

**Private files:** Files or folders starting with `_` are skipped by the build (e.g., `_template.md`, `_system/`).

**Habit Tracker:**
The habit tracker is a special note type that renders a visual tracker from Obsidian data.

Frontmatter format:
```yaml
---
title: habit tracker
type: habit-tracker
habits:
  - name: meditation
    goal: daily stillness
  - name: reading
    goal: feed the mind
---
```

Completion data in body (using day-of-year numbers, supports ranges):
```
\`\`\`habits
meditation: 1-14, 24
reading: 1-21, 24
\`\`\`
```

Day reference: day 1 = jan 1, day 32 = feb 1, day 60 = mar 1, etc.

## Local Development

Test locally before pushing:
```bash
python3 -m http.server 8080
```
Then open `localhost:8080`. The Beehiiv newsletter form won't load if you open index.html directly as a file.

## Deployment

Site is hosted on GitHub Pages. Push to main branch to deploy:
```bash
git add .
git commit -m "description"
git push
```

## Security Notes

- Firebase credentials are in client-side code (expected for web Firebase, security comes from Firebase Rules)
- Admin mode uses Firebase Authentication with Google Sign-in
- Only the ADMIN_UID in scripts.js can access admin features
- All fetch calls check `response.ok` before processing
- Garden uses `escapeAttr()` for dynamic values in onclick handlers
- Chat input is limited to 500 chars (message) and 50 chars (name)
