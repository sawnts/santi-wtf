// garden.js - digital garden core functionality

// state
let gardenIndex = null;
let currentNote = null;
let history = [];
let historyIndex = -1;
let leftPaneWidth = 200;
let drawerOpen = false;

// Drawer/pane toggle functions
let leftPaneHidden = false;

function toggleDrawer() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        drawerOpen ? closeDrawer() : openDrawer();
    } else {
        // Desktop: toggle left pane visibility
        leftPaneHidden = !leftPaneHidden;
        const leftPane = document.getElementById('left-pane');
        const divider = document.getElementById('pane-divider');
        if (leftPaneHidden) {
            leftPane.style.display = 'none';
            divider.style.display = 'none';
        } else {
            leftPane.style.display = '';
            divider.style.display = '';
        }
    }
}

function openDrawer() {
    drawerOpen = true;
    const leftPane = document.getElementById('left-pane');
    leftPane.classList.remove('hidden');
    leftPane.classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    drawerOpen = false;
    document.getElementById('left-pane').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

// initialize on load
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadIndex();
    renderTree();
    collapseAllFolders(); // Start with folders collapsed
    setupPaneResize();
    setupHoverPreviews();

    // Check for path from parent window (via sessionStorage)
    let notePath = null;
    try {
        notePath = window.parent !== window ? sessionStorage.getItem('gardenPath') : null;
        if (notePath) sessionStorage.removeItem('gardenPath');
    } catch (e) {}

    // Fallback to URL path
    if (!notePath) {
        const urlPath = window.location.pathname.replace('/garden', '').replace(/^\//, '');
        // Ignore the iframe's own file (garden.html) and index paths
        if (urlPath && urlPath !== '/' && urlPath !== 'index.html' && urlPath !== 'garden.html') {
            notePath = fromUrlSlug(urlPath.replace('.html', ''));
        }
    }

    // Load the note or welcome page
    if (notePath && gardenIndex.notes[notePath]) {
        loadNote(notePath);
    } else {
        loadWelcome();
    }

    updateStatusBar();
}

// load index.json
async function loadIndex() {
    try {
        const response = await fetch('/garden/data/index.json');
        gardenIndex = await response.json();
    } catch (e) {
        console.error('failed to load index:', e);
        gardenIndex = { notes: {}, folders: {}, stats: { total: 0, links: 0, seedling: 0, growing: 0, evergreen: 0 } };
    }
}

// render tree view
function renderTree() {
    const treeView = document.getElementById('tree-view');
    treeView.innerHTML = '';

    // render folder contents directly (no wrapper folder)
    const folder = gardenIndex.folders || { folders: {}, notes: [] };
    let html = '';

    // root-level notes first (like index)
    if (folder.notes) {
        const sortedNotes = folder.notes
            .map(noteId => ({ id: noteId, note: gardenIndex.notes[noteId] }))
            .filter(item => item.note)
            .sort((a, b) => a.note.title.localeCompare(b.note.title));

        for (const { id: noteId, note } of sortedNotes) {
            html += `<div class="tree-item" data-note="${noteId}">`;
            html += `<span class="tree-toggle"></span>`;
            html += `<span class="tree-icon"><img src="/icons/notepad_file-0.png" alt=""></span>`;
            html += `<span class="tree-label">${note.title}</span>`;
            html += `</div>`;
        }
    }

    // then subfolders
    if (folder.folders) {
        const sortedFolders = Object.entries(folder.folders).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [name, subFolder] of sortedFolders) {
            html += createFolderHtml(name, subFolder, '');
        }
    }

    treeView.innerHTML = html;

    // add click handlers
    treeView.querySelectorAll('.tree-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const children = toggle.parentElement.nextElementSibling;
            if (children && children.classList.contains('tree-children')) {
                children.classList.toggle('collapsed');
                toggle.textContent = children.classList.contains('collapsed') ? '+' : '-';
            }
        });
    });

    treeView.querySelectorAll('.tree-item[data-note]').forEach(item => {
        item.addEventListener('click', () => {
            loadNote(item.dataset.note);
            closeDrawer(); // Close drawer on mobile after selection
        });
    });
}

function expandAllFolders() {
    document.querySelectorAll('.tree-children').forEach(el => {
        el.classList.remove('collapsed');
    });
    document.querySelectorAll('.tree-toggle').forEach(toggle => {
        if (toggle.textContent) toggle.textContent = '-';
    });
}

function collapseAllFolders() {
    document.querySelectorAll('.tree-children').forEach(el => {
        el.classList.add('collapsed');
    });
    document.querySelectorAll('.tree-toggle').forEach(toggle => {
        if (toggle.textContent) toggle.textContent = '+';
    });
}

function createFolderHtml(name, folder, path) {
    let html = '';
    const fullPath = path ? `${path}/${name}` : name;

    // folder item
    const hasChildren = (folder.folders && Object.keys(folder.folders).length > 0) ||
                       (folder.notes && folder.notes.length > 0);

    html += `<div class="tree-folder">`;
    html += `<div class="tree-item">`;
    html += `<span class="tree-toggle">${hasChildren ? '-' : ''}</span>`;
    html += `<span class="tree-icon"><img src="/icons/directory_closed-0.png" alt=""></span>`;
    html += `<span class="tree-label">${name}</span>`;
    html += `</div>`;

    if (hasChildren) {
        html += `<div class="tree-children">`;

        // subfolders (sorted alphabetically)
        if (folder.folders) {
            const sortedFolders = Object.entries(folder.folders).sort((a, b) => a[0].localeCompare(b[0]));
            for (const [subName, subFolder] of sortedFolders) {
                html += createFolderHtml(subName, subFolder, fullPath);
            }
        }

        // notes (sorted alphabetically by title)
        if (folder.notes) {
            const sortedNotes = folder.notes
                .map(noteId => ({ id: noteId, note: gardenIndex.notes[noteId] }))
                .filter(item => item.note)
                .sort((a, b) => a.note.title.localeCompare(b.note.title));

            for (const { id: noteId, note } of sortedNotes) {
                html += `<div class="tree-item" data-note="${noteId}">`;
                html += `<span class="tree-toggle"></span>`;
                html += `<span class="tree-icon"><img src="/icons/notepad_file-0.png" alt=""></span>`;
                html += `<span class="tree-label">${note.title}</span>`;
                html += `</div>`;
            }
        }

        html += `</div>`;
    }

    html += `</div>`;
    return html;
}

// Convert noteId to URL-friendly slug
function toUrlSlug(noteId) {
    if (!noteId) return '';
    const parts = noteId.split('/');
    if (parts.length > 1) {
        // Remove "1. " prefix and replace spaces with dashes in folder name
        parts[0] = parts[0].replace(/^\d+\.\s*/, '').replace(/ /g, '-');
    }
    // Replace spaces with dashes in the note name (last part)
    parts[parts.length - 1] = parts[parts.length - 1].replace(/ /g, '-');
    return parts.join('/');
}

// Convert URL slug back to noteId
function fromUrlSlug(slug) {
    if (!slug) return '';
    const parts = slug.split('/');
    if (parts.length > 1) {
        // Try to find matching folder with number prefix
        const folderSlug = parts[0].replace(/-/g, ' ');
        const folders = ['1. thinking', '2. being', '3. doing', '4. loving', '5. writing'];
        const match = folders.find(f => f.replace(/^\d+\.\s*/, '') === folderSlug);
        if (match) parts[0] = match;
    }
    // Convert dashes back to spaces in note name (last part)
    parts[parts.length - 1] = parts[parts.length - 1].replace(/-/g, ' ');
    return parts.join('/');
}

// Update URL and notify parent window
function updateUrl(noteId) {
    const slug = toUrlSlug(noteId);
    const newUrl = slug ? `/garden/${slug}` : '/garden';
    window.history.pushState({ noteId }, '', newUrl);

    // Notify parent window to update its URL
    try {
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'gardenNavigate', path: slug }, '*');
        }
    } catch (e) {}
}

// Shared utility functions (used by graph.js, search.js, habits.js)
function getStageIcon(stage) {
    switch (stage) {
        case 'seedling': return '🌱';
        case 'growing': return '🌿';
        case 'evergreen': return '🌲';
        default: return '📄';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    // Extract just the date part (YYYY-MM-DD) from ISO string
    return dateStr.split('T')[0];
}

// Escape string for use in HTML attributes (prevents XSS)
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// load a note
async function loadNote(noteId) {
    // update history
    if (currentNote !== noteId) {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(noteId);
        historyIndex = history.length - 1;
    }

    currentNote = noteId;
    updateNavButtons();
    updateAddressBar(noteId);
    highlightTreeItem(noteId);

    const contentArea = document.getElementById('note-content');
    contentArea.innerHTML = '<div class="loading">loading...</div>';

    // Check if this is the habit tracker note
    if (isHabitTrackerNote(noteId)) {
        await renderHabitTracker();
        updateUrl(noteId);
        return;
    }

    try {
        const response = await fetch(`/garden/content/${noteId}.html`);
        if (!response.ok) throw new Error('not found');

        let html = await response.text();

        // add metadata and backlinks
        const note = gardenIndex.notes[noteId];
        if (note) {
            html = renderNoteWithMeta(html, note, noteId);
        }

        contentArea.innerHTML = html;
        setupWikilinkHandlers(contentArea);

        // update url and notify parent
        updateUrl(noteId);

    } catch (e) {
        contentArea.innerHTML = `<div class="no-results">note not found: ${noteId}</div>`;
    }
}

function renderNoteWithMeta(html, note, noteId) {
    // for index page, add stats instead of metadata
    if (noteId === 'index') {
        const stats = gardenIndex.stats || { total: 0, links: 0 };
        let statsHtml = `
            <div class="welcome-stats">
                <div class="stat-item">
                    <span class="stat-number">${stats.total}</span>
                    <span class="stat-label">notes</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.links}</span>
                    <span class="stat-label">connections</span>
                </div>
            </div>
        `;
        // insert stats after the first h1
        html = html.replace(/(<\/h1>)/, '$1' + statsHtml);
        return html;
    }

    // add metadata section for regular notes
    let metaHtml = '<div class="note-meta">';
    metaHtml += `<span class="note-meta-item"><span class="note-meta-label">stage:</span> <a href="#" class="stage-link" onclick="openFilterByStage('${escapeAttr(note.stage)}'); return false;">${getStageIcon(note.stage)} ${escapeAttr(note.stage) || 'unknown'}</a></span>`;
    if (note.planted) {
        metaHtml += `<span class="note-meta-item"><span class="note-meta-label">planted:</span> ${formatDate(note.planted)}</span>`;
    }
    if (note.tended) {
        metaHtml += `<span class="note-meta-item"><span class="note-meta-label">tended:</span> ${formatDate(note.tended)}</span>`;
    }
    metaHtml += '</div>';

    // add tags
    if (note.tags && note.tags.length > 0) {
        metaHtml += '<div class="note-tags">';
        for (const tag of note.tags) {
            metaHtml += `<span class="tag" onclick="searchByTag('${escapeAttr(tag)}')">#${escapeAttr(tag)}</span>`;
        }
        metaHtml += '</div>';
    }

    // add backlinks section as collapsible dropdown
    let backlinksHtml = '';
    if (note.backlinks && note.backlinks.length > 0) {
        backlinksHtml = '<details class="backlinks">';
        backlinksHtml += `<summary>what links here (${note.backlinks.length})</summary>`;
        backlinksHtml += '<ul class="backlinks-list">';
        for (const linkId of note.backlinks) {
            const linkNote = gardenIndex.notes[linkId];
            if (linkNote) {
                backlinksHtml += `<li><a href="#" class="wikilink" data-note="${linkId}">${linkNote.title}</a></li>`;
            }
        }
        backlinksHtml += '</ul></details>';
    }

    return metaHtml + html + backlinksHtml;
}

function setupWikilinkHandlers(container) {
    // Handle wikilinks (internal garden links)
    container.querySelectorAll('.wikilink').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            hidePreview();
            const noteId = link.dataset.note;
            if (noteId) {
                loadNote(noteId);
            }
        });
    });

    // Handle external links - open in new tab
    container.querySelectorAll('a[href^="http"]').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
}

// load welcome page (loads index note if it exists)
async function loadWelcome() {
    // if index note exists, load it
    if (gardenIndex.notes && gardenIndex.notes['index']) {
        loadNote('index');
        return;
    }

    // fallback to generated welcome page
    const contentArea = document.getElementById('note-content');
    const stats = gardenIndex.stats || { total: 0, links: 0, seedling: 0, growing: 0, evergreen: 0 };

    // get recent notes (sorted by tended date)
    const recentNotes = Object.entries(gardenIndex.notes || {})
        .sort((a, b) => {
            const dateA = a[1].tended || a[1].planted || '';
            const dateB = b[1].tended || b[1].planted || '';
            return dateB.localeCompare(dateA);
        })
        .slice(0, 5);

    let recentHtml = '';
    for (const [id, note] of recentNotes) {
        recentHtml += `<li>${getStageIcon(note.stage)} <a href="#" class="wikilink" data-note="${id}">${note.title}</a></li>`;
    }

    contentArea.innerHTML = `
        <div class="welcome-content">
            <h1>🌱 welcome to my garden</h1>
            <p class="subtitle">a collection of growing ideas and evergreen notes</p>

            <div class="welcome-stats">
                <div class="stat-item">
                    <span class="stat-number">${stats.total}</span>
                    <span class="stat-label">notes</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.links}</span>
                    <span class="stat-label">connections</span>
                </div>
            </div>

            <div class="recent-notes">
                <h2>recently tended</h2>
                <ul>${recentHtml || '<li>no notes yet</li>'}</ul>
            </div>

            <p style="margin-top: 32px; color: #808080; font-size: 11px;">
                use the folder tree on the left to browse, or click "find" to search.
            </p>
        </div>
    `;

    setupWikilinkHandlers(contentArea);
    updateAddressBar('');
    updateUrl(null);
    currentNote = null;
}

// navigation
function goBack() {
    if (historyIndex > 0) {
        historyIndex--;
        const noteId = history[historyIndex];
        currentNote = noteId;
        loadNoteWithoutHistory(noteId);
    }
}

function goForward() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        const noteId = history[historyIndex];
        currentNote = noteId;
        loadNoteWithoutHistory(noteId);
    }
}

async function loadNoteWithoutHistory(noteId) {
    updateNavButtons();
    updateAddressBar(noteId);
    highlightTreeItem(noteId);

    currentNote = noteId;

    // Check if this is the habit tracker note
    if (isHabitTrackerNote(noteId)) {
        await renderHabitTracker();
        return;
    }

    const contentArea = document.getElementById('note-content');

    try {
        const response = await fetch(`/garden/content/${noteId}.html`);
        if (!response.ok) throw new Error('not found');

        let html = await response.text();
        const note = gardenIndex.notes[noteId];
        if (note) {
            html = renderNoteWithMeta(html, note, noteId);
        }

        contentArea.innerHTML = html;
        setupWikilinkHandlers(contentArea);

        // Update URL and notify parent
        const slug = toUrlSlug(noteId);
        const newUrl = `/garden/${slug}`;
        window.history.replaceState({ noteId }, '', newUrl);
        try {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'gardenNavigate', path: slug }, '*');
            }
        } catch (e) {}

    } catch (e) {
        contentArea.innerHTML = `<div class="no-results">note not found: ${noteId}</div>`;
    }
}

function goUp() {
    if (currentNote && currentNote.includes('/')) {
        const parentPath = currentNote.split('/').slice(0, -1).join('/');
        const parentNotes = Object.keys(gardenIndex.notes).filter(id => id.startsWith(parentPath + '/'));
        if (parentNotes.length > 0) {
            loadNote(parentNotes[0]);
        } else {
            loadWelcome();
        }
    } else {
        loadWelcome();
    }
}

function updateNavButtons() {
    document.getElementById('btn-back').disabled = historyIndex <= 0;
    document.getElementById('btn-forward').disabled = historyIndex >= history.length - 1;
}

function updateAddressBar(noteId) {
    const address = document.getElementById('address');
    if (noteId) {
        address.value = `C:\\garden\\${noteId.replace(/\//g, '\\')}`;
    } else {
        address.value = 'C:\\garden\\';
    }
}

function highlightTreeItem(noteId) {
    // remove previous selection
    document.querySelectorAll('.tree-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // add selection to current
    const item = document.querySelector(`.tree-item[data-note="${noteId}"]`);
    if (item) {
        item.classList.add('selected');
        // expand parent folders
        let parent = item.parentElement;
        while (parent) {
            if (parent.classList.contains('tree-children')) {
                parent.classList.remove('collapsed');
                const toggle = parent.previousElementSibling?.querySelector('.tree-toggle');
                if (toggle) toggle.textContent = '-';
            }
            parent = parent.parentElement;
        }
    }
}

// random note
function loadRandom() {
    const noteIds = Object.keys(gardenIndex.notes || {});
    if (noteIds.length > 0) {
        const randomId = noteIds[Math.floor(Math.random() * noteIds.length)];
        loadNote(randomId);
    }
}

// hover previews
function setupHoverPreviews() {
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('.wikilink');
        if (link && link.dataset.note) {
            showPreview(link);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const link = e.target.closest('.wikilink');
        if (link) {
            hidePreview();
        }
    });

    document.addEventListener('mousemove', (e) => {
        const preview = document.getElementById('hover-preview');
        if (preview.style.display !== 'none') {
            preview.style.left = (e.clientX + 15) + 'px';
            preview.style.top = (e.clientY + 15) + 'px';
        }
    });
}

function showPreview(link) {
    const noteId = link.dataset.note;
    const note = gardenIndex.notes[noteId];

    if (!note) return;

    const preview = document.getElementById('hover-preview');
    const titleEl = document.getElementById('preview-title');
    const excerptEl = document.getElementById('preview-excerpt');

    titleEl.textContent = `${getStageIcon(note.stage)} ${note.title}`;
    excerptEl.textContent = note.excerpt || 'no preview available';

    preview.style.display = 'block';
}

function hidePreview() {
    document.getElementById('hover-preview').style.display = 'none';
}

// pane resize
function setupPaneResize() {
    const divider = document.getElementById('pane-divider');
    const leftPane = document.querySelector('.left-pane');
    let isResizing = false;

    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = document.querySelector('.main-content').getBoundingClientRect();
        let newWidth = e.clientX - containerRect.left;
        newWidth = Math.max(100, Math.min(400, newWidth));

        leftPane.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
    });
}

// update status bar
function updateStatusBar() {
    const stats = gardenIndex.stats || { total: 0, links: 0, seedling: 0, growing: 0, evergreen: 0 };

    document.getElementById('status-notes').textContent = `${stats.total} notes`;
    document.getElementById('status-links').textContent = `${stats.links} links`;
    document.getElementById('status-growth').textContent = `🌱 ${stats.seedling} | 🌿 ${stats.growing} | 🌲 ${stats.evergreen}`;
}

// handle browser back/forward
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.noteId) {
        loadNoteWithoutHistory(e.state.noteId);
    } else {
        loadWelcome();
    }
});

// go to address (for address bar)
function goToAddress() {
    const address = document.getElementById('address').value;
    const match = address.match(/C:\\garden\\(.+)/i);
    if (match) {
        const noteId = match[1].replace(/\\/g, '/').replace(/\.html$/, '');
        if (gardenIndex.notes[noteId]) {
            loadNote(noteId);
        }
    }
}
