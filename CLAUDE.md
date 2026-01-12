# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal blog/website styled to look like Windows 98. The site runs entirely in the browser with no build process, dependencies, or server-side code (except Firebase for the guestbook).

## Architecture

**Single-page application in `index.html`:**
- All CSS is embedded in `<style>` tags (starts ~line 14)
- All JavaScript is embedded in `<script>` tags (starts ~line 1406)
- Simulates a desktop environment with draggable, resizable, and minimizable windows
- Contains an "Internet Explorer" window that acts as an in-page browser for blog posts
- Implements browser-like navigation (back/forward/refresh) with a JavaScript history system

**Blog posts in `posts/` directory:**
- Standalone HTML files with embedded styles
- Loaded dynamically via `fetch()` and injected into the IE window's content area
- Post links in `index.html` call `loadPost('posts/filename.html')`

**Other pages:**
- `now.html` - "Now" page at root level, loaded via `loadPost('now.html')`

**Applications in `applications/` directory:**
- Interactive apps that run in their own desktop windows (e.g., FlowGarden)
- Each app is a standalone HTML file with embedded CSS and JS

## Key Functions (in index.html)

**Window management:**
- `openWindow(id)` / `closeWindow(id)` - Show/hide window elements
- `minimizeWindow(id)` / `restoreWindow(id)` - Minimize to taskbar / restore from taskbar
- `setActiveWindow(id)` - Bring window to front and mark as active
- `dragStart()` / `resizeStart()` - Handle window drag and resize interactions

**Navigation (IE window):**
- `loadHome()` / `loadArchive()` - Navigate to main pages (content in `homeContent` ~line 1658, `archiveContent` ~line 1691)
- `loadPost(url)` - Fetch and display a post file
- `goBack()` / `goForward()` - Browser history navigation

**State tracking:**
- `minimizedWindows` (Set) - Tracks which windows are minimized
- `openWindows` (Set) - Tracks which windows are open
- `browserHistory` (Array) - Stores navigation history for back/forward

## Content Style Guidelines

**All content must be lowercase** - titles, headings, body text, dates, everything. This is the site's aesthetic.

**Post signature:** Every post ends with a monospace signature linked to email:
```html
<p style="font-family: monospace; margin-top: 1.5em;">&lt;3 <a href="mailto:yosawnts@gmail.com">santi</a></p>
```

## Adding New Posts

1. Create new HTML file in `posts/` (all lowercase content)
2. Include the signature before the date
3. Add link in `homeContent` template string (~line 1658)
4. Add link in `archiveContent` template string (~line 1691) - note: this section is called "notes" in the UI

**Post template:**
```html
<div class="post">
    <h1>post title here</h1>

    <p>content here...</p>

    <p style="font-family: monospace; margin-top: 1.5em;">&lt;3 <a href="mailto:yosawnts@gmail.com">santi</a></p>

    <div class="date">january 1, 2026</div>

    <div class="post-footer">
        enjoyed this? <a href="#" onclick="window.parent.openShutdownDialog('newsletter'); return false;">subscribe</a> for more.
    </div>
</div>
```

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

## Guestbook Admin

Triple-click the Guestbook window title bar, enter password `wtf123` to access admin mode for deleting spam.
