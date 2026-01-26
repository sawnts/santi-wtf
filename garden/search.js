// search.js - garden search and filter

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
