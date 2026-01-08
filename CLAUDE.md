# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal blog/website styled to look like Windows 98. The site runs entirely in the browser with no build process, dependencies, or server-side code.

## Architecture

**Single-page application in `index.html`:**
- All CSS is embedded in `<style>` tags (lines 7-541)
- All JavaScript is embedded in `<script>` tags (lines 747-1164)
- Simulates a desktop environment with draggable, resizable, and minimizable windows
- Contains an "Internet Explorer" window that acts as an in-page browser for blog posts
- Implements browser-like navigation (back/forward/refresh) with a JavaScript history system

**Blog posts in `posts/` directory:**
- Standalone HTML files with their own embedded styles
- Loaded dynamically via `fetch()` and injected into the IE window's content area
- Post links in `index.html` call `loadPost('posts/filename.html')`

**Applications in `applications/` directory:**
- Interactive apps that run in their own desktop windows (e.g., FlowGarden)
- Each app is a standalone HTML file with embedded CSS and JS
- Loaded via dedicated functions (e.g., `loadFlowGarden()`) that inject styles, HTML, and execute scripts

## Key Functions (in index.html)

**Window management:**
- `openWindow(id)` / `closeWindow(id)` - Show/hide window elements
- `minimizeWindow(id)` / `restoreWindow(id)` - Minimize to taskbar / restore from taskbar
- `setActiveWindow(id)` - Bring window to front and mark as active
- `dragStart()` / `resizeStart()` - Handle window drag and resize interactions
- `updateTaskbar()` - Refresh taskbar items (shows icon + truncated title)

**Navigation (IE window):**
- `loadHome()` / `loadArchive()` - Navigate to main pages (content defined as template strings ~line 927, 963)
- `loadPost(url)` - Fetch and display a post file
- `goBack()` / `goForward()` - Browser history navigation
- `refreshPage()` - Reload current page

**State tracking:**
- `minimizedWindows` (Set) - Tracks which windows are minimized
- `openWindows` (Set) - Tracks which windows are open
- `browserHistory` (Array) - Stores navigation history for back/forward

## Adding New Posts

1. Create new HTML file in `posts/`
2. Add link in `homeContent` template string (around line 927)
3. Add link in `archiveContent` template string (around line 963)
