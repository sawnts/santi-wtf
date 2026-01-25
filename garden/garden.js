// garden.js - digital garden functionality

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

// search
function openSearch() {
    document.getElementById('search-overlay').style.display = 'flex';
    document.getElementById('search-input').focus();
}

function closeSearch() {
    document.getElementById('search-overlay').style.display = 'none';
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
}

function handleSearchKey(event) {
    if (event.key === 'Enter') {
        performSearch();
    } else if (event.key === 'Escape') {
        closeSearch();
    }
}

function performSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');

    if (!query) {
        resultsContainer.innerHTML = '<div class="no-results">enter a search term</div>';
        return;
    }

    const results = [];

    for (const [id, note] of Object.entries(gardenIndex.notes || {})) {
        const titleMatch = note.title.toLowerCase().includes(query);
        const tagMatch = (note.tags || []).some(t => t.toLowerCase().includes(query));
        const excerptMatch = (note.excerpt || '').toLowerCase().includes(query);

        if (titleMatch || tagMatch || excerptMatch) {
            results.push({ id, note, titleMatch });
        }
    }

    // sort by title match first
    results.sort((a, b) => {
        if (a.titleMatch && !b.titleMatch) return -1;
        if (!a.titleMatch && b.titleMatch) return 1;
        return a.note.title.localeCompare(b.note.title);
    });

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">no notes found</div>';
        return;
    }

    let html = '';
    for (const { id, note } of results) {
        html += `<div class="search-result-item" onclick="loadNoteFromSearch('${escapeAttr(id)}')">`;
        html += `<div class="search-result-title">${getStageIcon(note.stage)} ${note.title}</div>`;
        html += `<div class="search-result-path">${id}</div>`;
        html += `</div>`;
    }

    resultsContainer.innerHTML = html;
}

function loadNoteFromSearch(noteId) {
    closeSearch();
    loadNote(noteId);
}

function searchByTag(tag) {
    document.getElementById('search-input').value = tag;
    openSearch();
    performSearch();
}

// graph view
let graphNodes = [];
let graphEdges = [];
let graphState = {
    dragging: null,
    hovering: null,
    panning: false,
    panStart: { x: 0, y: 0 },
    transform: { x: 0, y: 0, scale: 1 },
    alpha: 1,  // simulation "heat" - decays over time
    animationId: null,
    entryProgress: 0,  // 0-1 for entry animation
    exitProgress: 0,
    isClosing: false,
    startTime: 0,
    pulsePhase: 0,
    clickFeedback: null  // { node, startTime }
};

function openGraph() {
    const overlay = document.getElementById('graph-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';

    // Reset state
    graphState.transform = { x: 0, y: 0, scale: 1 };
    graphState.entryProgress = 0;
    graphState.exitProgress = 0;
    graphState.isClosing = false;
    graphState.alpha = 1;
    graphState.hovering = null;
    graphState.dragging = null;
    graphState.panning = false;
    graphState.clickFeedback = null;
    graphState.startTime = performance.now();

    // Wait a frame for layout, then init and fade in
    requestAnimationFrame(() => {
        initGraph();
        overlay.style.transition = 'opacity 200ms ease-out';
        overlay.style.opacity = '1';
    });
}

function closeGraph() {
    graphState.isClosing = true;
    const overlay = document.getElementById('graph-overlay');
    overlay.style.transition = 'opacity 150ms ease-out';
    overlay.style.opacity = '0';

    setTimeout(() => {
        overlay.style.display = 'none';
        if (graphState.animationId) {
            cancelAnimationFrame(graphState.animationId);
            graphState.animationId = null;
        }
    }, 150);
}

function initGraph() {
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');

    // set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Ensure we have valid dimensions
    const width = rect.width || 800;
    const height = rect.height || 600;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // create nodes from notes
    graphNodes = [];
    graphEdges = [];

    const notes = Object.entries(gardenIndex.notes || {});
    const nodeMap = {};
    const centerX = width / 2;
    const centerY = height / 2;

    // create nodes - start from center for entry animation
    notes.forEach(([id, note], i) => {
        const backlinkCount = (note.backlinks || []).length;
        const angle = (i / notes.length) * Math.PI * 2;
        const spread = Math.min(width, height) * 0.3;
        const node = {
            id,
            title: note.title,
            stage: note.stage,
            backlinkCount,
            // Start positions spread in a circle
            x: centerX + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
            y: centerY + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5),
            // Target for smooth transitions
            targetX: 0,
            targetY: 0,
            vx: 0,
            vy: 0,
            // Animation state
            hoverAmount: 0,  // 0-1 for smooth hover transitions
            entryDelay: i * 30,  // staggered entry
            scale: 0  // for entry animation
        };
        graphNodes.push(node);
        nodeMap[id] = node;
    });

    // create edges from links
    notes.forEach(([id, note]) => {
        if (note.links) {
            note.links.forEach(targetId => {
                if (nodeMap[targetId]) {
                    graphEdges.push({
                        source: nodeMap[id],
                        target: nodeMap[targetId]
                    });
                }
            });
        }
    });

    // Interaction handlers
    let dragStartX = 0, dragStartY = 0;
    let didDrag = false;
    let lastClickTime = 0;

    // Convert screen coords to graph coords
    const toGraphCoords = (screenX, screenY) => {
        const t = graphState.transform;
        return {
            x: (screenX - t.x) / t.scale,
            y: (screenY - t.y) / t.scale
        };
    };

    const findNodeAt = (gx, gy) => {
        // Check in reverse order (top nodes first)
        for (let i = graphNodes.length - 1; i >= 0; i--) {
            const node = graphNodes[i];
            const dx = gx - node.x;
            const dy = gy - node.y;
            const nodeRadius = Math.min(6 + node.backlinkCount * 2, 20);
            const hitRadius = nodeRadius + 5;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
                return node;
            }
        }
        return null;
    };

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

        dragStartX = screenX;
        dragStartY = screenY;
        didDrag = false;

        const node = findNodeAt(gx, gy);
        if (node) {
            graphState.dragging = node;
            graphState.alpha = 0.8;  // wake up simulation slightly
        } else {
            // Start panning
            graphState.panning = true;
            graphState.panStart = { x: screenX, y: screenY };
        }
    };

    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

        if (graphState.dragging) {
            const movedX = Math.abs(screenX - dragStartX);
            const movedY = Math.abs(screenY - dragStartY);
            if (movedX > 5 || movedY > 5) {
                didDrag = true;
            }
            graphState.dragging.x = gx;
            graphState.dragging.y = gy;
            graphState.dragging.vx = 0;
            graphState.dragging.vy = 0;
        } else if (graphState.panning) {
            const dx = screenX - graphState.panStart.x;
            const dy = screenY - graphState.panStart.y;
            graphState.transform.x += dx;
            graphState.transform.y += dy;
            graphState.panStart = { x: screenX, y: screenY };
            didDrag = true;
        }

        // Update hover state
        const hoveredNode = findNodeAt(gx, gy);
        graphState.hovering = hoveredNode;
        canvas.style.cursor = hoveredNode ? 'pointer' : (graphState.panning ? 'grabbing' : 'grab');
    };

    canvas.onmouseup = (e) => {
        const now = performance.now();

        if (graphState.dragging && !didDrag) {
            const node = graphState.dragging;

            // Click feedback animation
            graphState.clickFeedback = { node, startTime: now };

            // Navigate after brief feedback
            setTimeout(() => {
                closeGraph();
                loadNote(node.id);
            }, 100);
        }

        graphState.dragging = null;
        graphState.panning = false;
    };

    canvas.onmouseleave = () => {
        graphState.hovering = null;
        graphState.panning = false;
    };

    // Double-click to reset view
    canvas.ondblclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

        // Only reset if not clicking a node
        if (!findNodeAt(gx, gy)) {
            graphState.transform = { x: 0, y: 0, scale: 1 };
        }
    };

    // Mouse wheel zoom
    canvas.onwheel = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.5, Math.min(2, graphState.transform.scale * zoomFactor));

        // Zoom toward mouse position
        const scaleDiff = newScale - graphState.transform.scale;
        graphState.transform.x -= mouseX * scaleDiff / graphState.transform.scale;
        graphState.transform.y -= mouseY * scaleDiff / graphState.transform.scale;
        graphState.transform.scale = newScale;
    };

    // Escape key to close
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeGraph();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Handle resize
    let resizeTimeout;
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }, 100);
    };
    window.addEventListener('resize', handleResize);

    // Start animation
    animateGraph(canvas, ctx, width, height);
}

function animateGraph(canvas, ctx, width, height) {
    if (graphState.isClosing) return;

    const now = performance.now();
    const elapsed = now - graphState.startTime;

    // Update entry animation progress
    graphState.entryProgress = Math.min(1, elapsed / 600);
    graphState.pulsePhase = (now / 1000) % (Math.PI * 2);

    // Apply physics with decaying alpha
    if (graphState.alpha > 0.001) {
        graphNodes.forEach(node => {
            if (node === graphState.dragging) return;

            // Repulsion from other nodes
            graphNodes.forEach(other => {
                if (node === other) return;
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const minDist = 80;
                if (dist < minDist) {
                    const force = (minDist - dist) / dist * 0.5 * graphState.alpha;
                    node.vx += dx * force;
                    node.vy += dy * force;
                }
            });

            // Attraction to center (gentle)
            node.vx += (width / 2 - node.x) * 0.001 * graphState.alpha;
            node.vy += (height / 2 - node.y) * 0.001 * graphState.alpha;

            // Attraction along edges
            graphEdges.forEach(edge => {
                let other = null;
                if (edge.source === node) other = edge.target;
                else if (edge.target === node) other = edge.source;

                if (other) {
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const targetDist = 100;
                    const force = (dist - targetDist) * 0.002 * graphState.alpha;
                    node.vx += dx / dist * force;
                    node.vy += dy / dist * force;
                }
            });

            // Apply velocity with damping
            node.vx *= 0.9;
            node.vy *= 0.9;
            node.x += node.vx;
            node.y += node.vy;

            // Keep in bounds (with padding)
            const padding = 50;
            node.x = Math.max(padding, Math.min(width - padding, node.x));
            node.y = Math.max(padding, Math.min(height - padding, node.y));
        });

        // Decay alpha (simulation cooling)
        graphState.alpha *= 0.99;
    }

    // Update hover animations
    graphNodes.forEach(node => {
        const isHovered = node === graphState.hovering;
        const targetHover = isHovered ? 1 : 0;
        node.hoverAmount += (targetHover - node.hoverAmount) * 0.2;

        // Entry animation
        const entryTime = Math.max(0, (elapsed - node.entryDelay) / 300);
        node.scale = Math.min(1, easeOutBack(entryTime));
    });

    // Draw
    const t = graphState.transform;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    // Determine which nodes are connected to hovered node
    const connectedToHover = new Set();
    if (graphState.hovering) {
        connectedToHover.add(graphState.hovering);
        graphEdges.forEach(edge => {
            if (edge.source === graphState.hovering) connectedToHover.add(edge.target);
            if (edge.target === graphState.hovering) connectedToHover.add(edge.source);
        });
    }

    // Draw edges (curved, with hover effects)
    graphEdges.forEach(edge => {
        const isConnectedToHover = graphState.hovering &&
            (edge.source === graphState.hovering || edge.target === graphState.hovering);
        const shouldFade = graphState.hovering && !isConnectedToHover;

        const opacity = shouldFade ? 0.15 : (isConnectedToHover ? 0.9 : 0.4);
        const lineWidth = isConnectedToHover ? 2 : 1;

        ctx.strokeStyle = isConnectedToHover ?
            `rgba(140, 160, 255, ${opacity})` :
            `rgba(100, 120, 180, ${opacity})`;
        ctx.lineWidth = lineWidth;

        // Draw curved edge
        const midX = (edge.source.x + edge.target.x) / 2;
        const midY = (edge.source.y + edge.target.y) / 2;
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        // Perpendicular offset for curve
        const curvature = 0.1;
        const ctrlX = midX - dy * curvature;
        const ctrlY = midY + dx * curvature;

        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, edge.target.x, edge.target.y);
        ctx.stroke();
    });

    // Draw nodes
    graphNodes.forEach(node => {
        if (node.scale < 0.01) return;  // Skip nodes not yet visible

        const isHovered = node === graphState.hovering;
        const isCurrent = node.id === currentNote;
        const isConnected = connectedToHover.has(node);
        const shouldFade = graphState.hovering && !isConnected;

        // Calculate radius with hover effect
        const baseRadius = Math.min(6 + node.backlinkCount * 2, 20);
        const hoverScale = 1 + node.hoverAmount * 0.15;

        // Click feedback
        let clickScale = 1;
        if (graphState.clickFeedback && graphState.clickFeedback.node === node) {
            const clickElapsed = now - graphState.clickFeedback.startTime;
            if (clickElapsed < 100) {
                clickScale = 1 - Math.sin(clickElapsed / 100 * Math.PI) * 0.15;
            }
        }

        const radius = baseRadius * node.scale * hoverScale * clickScale;
        const opacity = shouldFade ? 0.3 : 1;

        // Node glow
        if (!shouldFade && radius > 0) {
            const gradient = ctx.createRadialGradient(
                node.x, node.y, radius * 0.5,
                node.x, node.y, radius * 2
            );
            gradient.addColorStop(0, adjustColorOpacity(getStageColor(node.stage), 0.3));
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Node circle
        ctx.fillStyle = adjustColorOpacity(getStageColor(node.stage), opacity);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Hover ring
        if (node.hoverAmount > 0.01) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${node.hoverAmount * 0.8})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 3 + node.hoverAmount * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Current note pulsing ring
        if (isCurrent && !isHovered) {
            const pulseOpacity = 0.5 + Math.sin(graphState.pulsePhase * 2) * 0.3;
            ctx.strokeStyle = `rgba(255, 204, 0, ${pulseOpacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Label (only show for hovered, current, or larger nodes when not faded)
        const showLabel = isHovered || isCurrent || (baseRadius >= 10 && !shouldFade);
        if (showLabel && node.scale > 0.5) {
            const labelOpacity = isHovered ? 1 : (shouldFade ? 0.3 : 0.8);
            ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
            ctx.font = isHovered ? 'bold 11px system-ui, sans-serif' : '10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Text shadow for legibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;

            ctx.fillText(node.title, node.x, node.y + radius + 6);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    });

    ctx.restore();

    graphState.animationId = requestAnimationFrame(() => animateGraph(canvas, ctx, width, height));
}

// Easing function for entry animation
function easeOutBack(t) {
    if (t >= 1) return 1;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Adjust color opacity
function adjustColorOpacity(color, opacity) {
    // Convert hex or rgb to rgba
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
}

function getStageColor(stage) {
    switch (stage) {
        case 'seedling': return '#90EE90';
        case 'growing': return '#32CD32';
        case 'evergreen': return '#228B22';
        default: return '#808080';
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

// filter functionality
let currentFilterStage = null;

function openFilterByStage(stage) {
    currentFilterStage = stage;
    document.getElementById('filter-overlay').style.display = 'flex';
    document.getElementById('filter-header').innerHTML = `<span class="filter-stage">${getStageIcon(stage)} ${stage}</span> notes`;

    // populate tag filter with tags from notes of this stage
    populateTagFilter(stage);
    applyFilter();
}

function closeFilter() {
    document.getElementById('filter-overlay').style.display = 'none';
    currentFilterStage = null;
}

function populateTagFilter(stage) {
    const tagSelect = document.getElementById('filter-tag');
    tagSelect.innerHTML = '<option value="">all tags</option>';

    // collect all tags from notes of this stage
    const tags = new Set();
    for (const [id, note] of Object.entries(gardenIndex.notes || {})) {
        if (note.stage === stage && note.tags) {
            note.tags.forEach(tag => tags.add(tag));
        }
    }

    // add sorted tags to dropdown
    Array.from(tags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `#${tag}`;
        tagSelect.appendChild(option);
    });
}

function applyFilter() {
    const stage = currentFilterStage;
    const selectedTag = document.getElementById('filter-tag').value;
    const resultsContainer = document.getElementById('filter-results');

    // filter notes by stage and optionally by tag
    const results = [];
    for (const [id, note] of Object.entries(gardenIndex.notes || {})) {
        if (note.stage !== stage) continue;
        if (selectedTag && (!note.tags || !note.tags.includes(selectedTag))) continue;
        results.push({ id, note });
    }

    // sort alphabetically
    results.sort((a, b) => a.note.title.localeCompare(b.note.title));

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">no notes found</div>';
        return;
    }

    let html = '';
    for (const { id, note } of results) {
        html += `<div class="filter-result-item" onclick="loadNoteFromFilter('${escapeAttr(id)}')">`;
        html += `<div class="filter-result-title">${note.title}</div>`;
        if (note.tags && note.tags.length > 0) {
            html += `<div class="filter-result-tags">${note.tags.map(t => '#' + t).join(' ')}</div>`;
        }
        html += `</div>`;
    }

    resultsContainer.innerHTML = html;
}

function loadNoteFromFilter(noteId) {
    closeFilter();
    loadNote(noteId);
}

// ==========================================
// HABIT TRACKER - Garden Edition (Read-only)
// ==========================================

let habitsConfig = null;

async function initHabitTracker() {
    // Load habits config (includes completion data from Obsidian)
    try {
        const response = await fetch('/garden/data/habits-config.json');
        habitsConfig = await response.json();
    } catch (e) {
        console.log('no habits config found');
    }
}

function isHabitTrackerNote(noteId) {
    return habitsConfig && noteId === habitsConfig.noteId;
}

async function renderHabitTracker() {
    const contentArea = document.getElementById('note-content');
    if (!contentArea || !habitsConfig) return;

    // Fetch the markdown content
    let introHtml = '';
    try {
        const response = await fetch(`/garden/content/${habitsConfig.noteId}.html`);
        if (response.ok) {
            const html = await response.text();
            // Extract just the intro sections (before completion log)
            const match = html.match(/^([\s\S]*?)<h2>completion log<\/h2>/i);
            if (match) {
                introHtml = match[1];
            }
        }
    } catch (e) {
        console.log('could not load intro content');
    }

    const today = new Date();
    const currentYear = habitsConfig.year || today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const todayDayOfYear = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

    // Habit icons
    const habitIcons = {
        'meditation': '🧘',
        'sleep': '😴',
        'movement': '🏃',
        'reading': '📖',
        'writing': '✍️',
        'chess': '♟️'
    };

    function getHabitIcon(name) {
        return habitIcons[name.toLowerCase()] || '·';
    }

    function getStreak(completed) {
        let streak = 0;
        let checkDay = todayDayOfYear;
        if (!completed.includes(todayDayOfYear)) {
            checkDay = todayDayOfYear - 1;
        }
        while (checkDay > 0 && completed.includes(checkDay)) {
            streak++;
            checkDay--;
        }
        return streak;
    }

    // Build habit cards (read-only)
    const habitCards = habitsConfig.habits.map((habit) => {
        const completed = habit.completed || [];
        const streak = getStreak(completed);
        const icon = getHabitIcon(habit.name);
        const completedThisYear = completed.filter(d => d <= todayDayOfYear).length;
        const percentage = todayDayOfYear > 0 ? Math.round((completedThisYear / todayDayOfYear) * 100) : 0;
        const isTodayDone = completed.includes(todayDayOfYear);

        // Build mini calendar (last 7 days) - display only
        let miniCal = '';
        for (let i = 6; i >= 0; i--) {
            const dayNum = todayDayOfYear - i;
            if (dayNum > 0) {
                const isDone = completed.includes(dayNum);
                const isToday = dayNum === todayDayOfYear;
                miniCal += `<div class="habit-day ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}"></div>`;
            }
        }

        return `
            <div class="habit-card">
                <div class="habit-plant">${icon}</div>
                <div class="habit-info">
                    <div class="habit-name">${habit.name}</div>
                    <div class="habit-goal">${habit.goal}</div>
                    <div class="habit-streak">${streak > 0 ? streak + ' days' : '—'}</div>
                </div>
                <div class="habit-progress">
                    <div class="habit-progress-bar">
                        <div class="habit-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="habit-progress-label">${percentage}%</div>
                </div>
                <div class="habit-calendar">${miniCal}</div>
                <div class="habit-status ${isTodayDone ? 'watered' : 'dry'}">
                    ${isTodayDone ? '✓ done' : '—'}
                </div>
            </div>
        `;
    }).join('');

    // Build yearly garden grid
    let gardenGrid = '';
    const totalHabits = habitsConfig.habits.length;
    for (let day = 1; day <= todayDayOfYear; day++) {
        let doneCount = 0;
        habitsConfig.habits.forEach(habit => {
            if ((habit.completed || []).includes(day)) doneCount++;
        });
        const level = Math.round((doneCount / totalHabits) * 4);
        const date = new Date(currentYear, 0, day);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        gardenGrid += `<div class="garden-cell level-${level}" title="${label}: ${doneCount}/${totalHabits}"></div>`;
    }

    // Build note metadata
    const note = gardenIndex.notes[habitsConfig.noteId];
    let metaHtml = '';
    if (note) {
        metaHtml = '<div class="note-meta">';
        metaHtml += `<span class="note-meta-item"><span class="note-meta-label">stage:</span> <a href="#" class="stage-link" onclick="openFilterByStage('${escapeAttr(note.stage)}'); return false;">${getStageIcon(note.stage)} ${escapeAttr(note.stage) || 'unknown'}</a></span>`;
        if (note.planted) {
            metaHtml += `<span class="note-meta-item"><span class="note-meta-label">planted:</span> ${formatDate(note.planted)}</span>`;
        }
        if (note.tended) {
            metaHtml += `<span class="note-meta-item"><span class="note-meta-label">tended:</span> ${formatDate(note.tended)}</span>`;
        }
        metaHtml += '</div>';

        if (note.tags && note.tags.length > 0) {
            metaHtml += '<div class="note-tags">';
            for (const tag of note.tags) {
                metaHtml += `<span class="tag" onclick="searchByTag('${escapeAttr(tag)}')">#${escapeAttr(tag)}</span>`;
            }
            metaHtml += '</div>';
        }
    }

    contentArea.innerHTML = `
        ${metaHtml}
        ${introHtml}

        <div class="habit-cards">
            ${habitCards}
        </div>

        <h2>year overview</h2>
        <div class="garden-grid">${gardenGrid}</div>
        <div class="garden-legend">
            <span>0</span>
            <div class="garden-cell level-0"></div>
            <div class="garden-cell level-1"></div>
            <div class="garden-cell level-2"></div>
            <div class="garden-cell level-3"></div>
            <div class="garden-cell level-4"></div>
            <span>all</span>
        </div>
    `;
}

// Initialize habit tracker on load
initHabitTracker();
