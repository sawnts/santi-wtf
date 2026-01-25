// garden.js - digital garden functionality

// state
let gardenIndex = null;
let currentNote = null;
let history = [];
let historyIndex = -1;
let leftPaneWidth = 200;

// initialize on load
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadIndex();
    renderTree();
    setupPaneResize();
    setupHoverPreviews();

    // check for path in url
    const path = window.location.pathname.replace('/garden', '').replace(/^\//, '');
    if (path && path !== '/' && path !== 'index.html') {
        const noteId = path.replace('.html', '').replace(/\//g, '/');
        if (gardenIndex.notes[noteId]) {
            loadNote(noteId);
        } else {
            loadWelcome();
        }
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
        const newUrl = `/garden/${noteId}`;
        window.history.pushState({ noteId }, '', newUrl);
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

        // update url without reload
        const newUrl = `/garden/${noteId}`;
        window.history.pushState({ noteId }, '', newUrl);

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

        const newUrl = `/garden/${noteId}`;
        window.history.replaceState({ noteId }, '', newUrl);

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
let graphDragging = null;
let graphHovering = null;

function openGraph() {
    document.getElementById('graph-overlay').style.display = 'flex';
    initGraph();
}

function closeGraph() {
    document.getElementById('graph-overlay').style.display = 'none';
}

function initGraph() {
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');

    // set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // create nodes from notes
    graphNodes = [];
    graphEdges = [];

    const notes = Object.entries(gardenIndex.notes || {});
    const nodeMap = {};

    // create nodes with random positions
    notes.forEach(([id, note], i) => {
        const node = {
            id,
            title: note.title,
            stage: note.stage,
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50,
            vx: 0,
            vy: 0
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

    // start animation
    animateGraph(canvas, ctx);

    // add interaction handlers
    let dragStartX = 0, dragStartY = 0;
    let didDrag = false;

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        dragStartX = x;
        dragStartY = y;
        didDrag = false;

        for (const node of graphNodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy < 400) {
                graphDragging = node;
                break;
            }
        }
    };

    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (graphDragging) {
            // check if mouse moved enough to count as drag
            const movedX = Math.abs(x - dragStartX);
            const movedY = Math.abs(y - dragStartY);
            if (movedX > 5 || movedY > 5) {
                didDrag = true;
            }
            graphDragging.x = x;
            graphDragging.y = y;
        }

        // check for hover
        graphHovering = null;
        for (const node of graphNodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy < 400) {
                graphHovering = node;
                canvas.style.cursor = 'pointer';
                break;
            }
        }
        if (!graphHovering) {
            canvas.style.cursor = 'default';
        }
    };

    canvas.onmouseup = (e) => {
        // if clicked on a node without dragging, navigate to it
        if (graphDragging && !didDrag) {
            const node = graphDragging;
            graphDragging = null;
            closeGraph();
            loadNote(node.id);
            return;
        }
        graphDragging = null;
    };
}

function animateGraph(canvas, ctx) {
    const width = canvas.width;
    const height = canvas.height;

    // apply forces (smoother physics)
    graphNodes.forEach(node => {
        if (node === graphDragging) return;

        // repulsion from other nodes (gentler)
        graphNodes.forEach(other => {
            if (node === other) return;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 300 / (dist * dist);
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
        });

        // attraction to center (gentler)
        node.vx += (width / 2 - node.x) * 0.0005;
        node.vy += (height / 2 - node.y) * 0.0005;

        // attraction along edges (gentler)
        graphEdges.forEach(edge => {
            let other = null;
            if (edge.source === node) other = edge.target;
            else if (edge.target === node) other = edge.source;

            if (other) {
                const dx = other.x - node.x;
                const dy = other.y - node.y;
                node.vx += dx * 0.003;
                node.vy += dy * 0.003;
            }
        });

        // apply velocity with stronger damping
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;

        // keep in bounds
        node.x = Math.max(30, Math.min(width - 30, node.x));
        node.y = Math.max(30, Math.min(height - 30, node.y));
    });

    // draw
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // draw edges (highlight connections to hovered node)
    graphEdges.forEach(edge => {
        const isHovered = graphHovering && (edge.source === graphHovering || edge.target === graphHovering);
        ctx.strokeStyle = isHovered ? '#8080ff' : '#4a4a6a';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.stroke();
    });

    // draw nodes
    graphNodes.forEach(node => {
        const isHovered = node === graphHovering;
        const radius = isHovered ? 12 : 8;

        // node circle
        ctx.fillStyle = getStageColor(node.stage);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // hover ring
        if (isHovered) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // label
        ctx.fillStyle = isHovered ? '#fff' : '#e0e0e0';
        ctx.font = isHovered ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.title, node.x, node.y + (isHovered ? 26 : 20));
    });

    // highlight current note
    if (currentNote && !graphHovering) {
        const currentNode = graphNodes.find(n => n.id === currentNote);
        if (currentNode) {
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(currentNode.x, currentNode.y, 12, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    requestAnimationFrame(() => animateGraph(canvas, ctx));
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
