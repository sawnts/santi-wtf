/* ═══════════════════════════════════════════════════════════════
   SANTI'S GARDEN — terminal-first
   ═══════════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // ─── State ────────────────────────────────────────────────────
    let notesIndex = {};
    let notesList = [];
    let commandHistory = [];
    let historyIndex = -1;

    // ─── Elements ─────────────────────────────────────────────────
    const input = document.getElementById('command-input');
    const output = document.getElementById('output');
    const loading = document.getElementById('loading');
    const recentLanding = document.getElementById('recent-landing');
    const recentList = document.getElementById('recent-list');
    const hintPath = document.getElementById('hint-path');

    // ─── Initialize ───────────────────────────────────────────────
    async function init() {
        await loadIndex();
        if (input) {
            input.addEventListener('keydown', handleInput);
            input.focus();
            document.body.addEventListener('click', (e) => {
                if (!e.target.closest('a') && !e.target.closest('button')) {
                    input.focus();
                }
            });
        }
        
        // Mobile button handling
        document.querySelectorAll('.mobile-nav button').forEach(btn => {
            btn.addEventListener('click', () => {
                execute(btn.dataset.cmd);
            });
        });
        
        // Show recent on landing
        renderRecentLanding();
    }

    // ─── Load Index ───────────────────────────────────────────────
    async function loadIndex() {
        showLoading();
        try {
            const res = await fetch('/garden/data/index.json');
            const data = await res.json();
            notesIndex = data.notes;
            
            notesList = Object.entries(notesIndex).map(([path, note]) => ({
                path,
                ...note,
                slug: pathToSlug(path)
            }));
            
            notesList.sort((a, b) => new Date(b.tended) - new Date(a.tended));
        } catch (e) {
            console.error('Failed to load index:', e);
        }
        hideLoading();
    }

    // ─── Input Handler ────────────────────────────────────────────
    function handleInput(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = input.value.trim();
            if (cmd) {
                commandHistory.push(cmd);
                historyIndex = commandHistory.length;
                execute(cmd);
            }
            input.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                input.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                input.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                input.value = '';
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            autocomplete();
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            clear();
            showRecentLanding();
            updatePath('~/garden');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            clear();
            showRecentLanding();
            updatePath('~/garden');
            input.value = '';
        }
    }

    // ─── Execute Command ──────────────────────────────────────────
    async function execute(cmd) {
        echo(cmd);
        hideRecentLanding();
        
        const parts = cmd.toLowerCase().split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1).join(' ');

        switch (command) {
            case 'help':
            case '?':
                showHelp();
                updatePath('~/garden/help');
                break;
            case 'start':
            case 'begin':
                await loadNote('index');
                updatePath('~/garden/start');
                break;
            case 'ls':
            case 'list':
            case 'explore':
                listNotes(args);
                updatePath('~/garden/all');
                break;
            case 'random':
            case 'rand':
            case 'r':
                await loadRandom();
                break;
            case 'read':
            case 'open':
            case 'go':
            case 'cat':
                if (args) await findAndLoad(args);
                else print('usage: read [note name]', 'error');
                break;
            case 'search':
            case 'find':
            case 'grep':
                if (args) {
                    search(args);
                    updatePath(`~/garden/search/${args}`);
                }
                else print('usage: search [term]', 'error');
                break;
            case 'recent':
                showRecent();
                updatePath('~/garden/recent');
                break;
            case 'clear':
            case 'cls':
            case 'home':
                clear();
                showRecentLanding();
                updatePath('~/garden');
                break;
            default:
                // Try to find note by name
                const note = findNote(cmd);
                if (note) {
                    await loadNote(note.slug);
                } else {
                    print(`command not found: ${command}. type 'help' for commands.`, 'error');
                }
        }
        
        scrollToBottom();
    }

    // ─── Recent Landing ─────────────────────────────────────────────
    function renderRecentLanding() {
        if (!recentList) return;
        const recent = notesList.slice(0, 5);
        recentList.innerHTML = recent.map(n => 
            `<li><a href="#" data-slug="${n.slug}">${n.title}</a></li>`
        ).join('');
        
        recentList.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', async e => {
                e.preventDefault();
                hideRecentLanding();
                echo(`read ${a.textContent}`);
                await loadNote(a.dataset.slug);
                scrollToBottom();
            });
        });
    }
    
    function hideRecentLanding() {
        if (recentLanding) recentLanding.classList.add('hidden');
    }
    
    function showRecentLanding() {
        if (recentLanding) recentLanding.classList.remove('hidden');
    }
    
    function updatePath(path) {
        if (hintPath) hintPath.textContent = path;
    }

    // ─── Commands ─────────────────────────────────────────────────
    function showHelp() {
        const html = `
            <div class="help-section">
                <div class="help-title">commands</div>
                <div class="help-item"><strong>start</strong> — begin here</div>
                <div class="help-item"><strong>explore</strong> — list all notes</div>
                <div class="help-item"><strong>random</strong> — open random note</div>
                <div class="help-item"><strong>recent</strong> — recently tended</div>
                <div class="help-item"><strong>search [term]</strong> — find notes</div>
                <div class="help-item"><strong>read [note]</strong> — open a note</div>
                <div class="help-item"><strong>clear</strong> — clear screen</div>
            </div>
            <div class="help-section">
                <div class="help-title">shortcuts</div>
                <div class="help-item"><strong>↑/↓</strong> — command history</div>
                <div class="help-item"><strong>tab</strong> — autocomplete</div>
                <div class="help-item"><strong>ctrl+l</strong> — clear</div>
            </div>
            <div class="help-section">
                <div class="help-item" style="color: var(--text-dim);">or just type a note title and hit enter</div>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
    }

    function listNotes(filter) {
        let notes = notesList;
        if (filter) {
            notes = notes.filter(n => 
                n.title.toLowerCase().includes(filter) ||
                (n.tags && n.tags.some(t => t.includes(filter)))
            );
        }
        
        const html = `
            <ul class="note-list">
                ${notes.map(n => `
                    <li>
                        <a href="#" data-slug="${n.slug}">${n.title}</a>
                        <span class="stage">[${n.stage}]</span>
                    </li>
                `).join('')}
            </ul>
            <div style="color: var(--text-dim); margin-top: 0.5rem;">${notes.length} notes</div>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
    }

    function showRecent() {
        const recent = notesList.slice(0, 7);
        const html = `
            <div class="help-title">recently tended</div>
            <ul class="note-list">
                ${recent.map(n => `
                    <li>
                        <a href="#" data-slug="${n.slug}">${n.title}</a>
                        <span class="stage">${formatDate(n.tended)}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
    }

    function search(term) {
        const results = notesList.filter(n =>
            n.title.toLowerCase().includes(term) ||
            (n.tags && n.tags.some(t => t.toLowerCase().includes(term))) ||
            (n.excerpt && n.excerpt.toLowerCase().includes(term))
        );
        
        if (results.length === 0) {
            print(`no results for '${term}'`, 'error');
            return;
        }
        
        const html = `
            <div style="color: var(--text-dim); margin-bottom: 0.5rem;">found ${results.length} note${results.length === 1 ? '' : 's'}</div>
            <ul class="note-list">
                ${results.map(n => `
                    <li>
                        <a href="#" data-slug="${n.slug}">${n.title}</a>
                        <span class="stage">[${n.stage}]</span>
                    </li>
                `).join('')}
            </ul>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
    }

    async function loadRandom() {
        const note = notesList[Math.floor(Math.random() * notesList.length)];
        await loadNote(note.slug);
    }

    async function findAndLoad(name) {
        const note = findNote(name);
        if (note) {
            await loadNote(note.slug);
        } else {
            print(`note not found: '${name}'`, 'error');
        }
    }

    async function loadNote(slug) {
        showLoading();
        
        const note = notesList.find(n => n.slug === slug || n.path === slug || n.path === 'index' && slug === 'index');
        if (!note) {
            hideLoading();
            print('note not found', 'error');
            return;
        }
        
        try {
            const res = await fetch(`/garden/content/${note.path}.html`);
            if (!res.ok) throw new Error('not found');
            const html = await res.text();
            
            const noteHtml = `
                <div class="note-content">
                    ${html}
                </div>
                <div class="note-meta">
                    <span class="stage-${note.stage}">${note.stage}</span> · 
                    planted ${formatDate(note.planted)} · 
                    tended ${formatDate(note.tended)}
                    <span class="back-hint">· type 'home' to return</span>
                </div>
            `;
            output.insertAdjacentHTML('beforeend', noteHtml);
            bindNoteLinks();
            updatePath(`~/garden/${note.slug}`);
        } catch (e) {
            print('failed to load note', 'error');
        }
        
        hideLoading();
    }

    function clear() {
        output.innerHTML = '';
    }

    // ─── Helpers ──────────────────────────────────────────────────
    function echo(cmd) {
        output.insertAdjacentHTML('beforeend', `
            <div class="cmd-echo"><span class="prompt">$</span> ${escapeHtml(cmd)}</div>
        `);
    }

    function print(text, className = '') {
        output.insertAdjacentHTML('beforeend', `
            <div class="${className}">${escapeHtml(text)}</div>
        `);
    }

    function showLoading() {
        loading.classList.remove('hidden');
    }

    function hideLoading() {
        loading.classList.add('hidden');
    }

    function scrollToBottom() {
        window.scrollTo(0, document.body.scrollHeight);
    }

    function bindNoteLinks() {
        output.querySelectorAll('a[data-slug]').forEach(a => {
            a.addEventListener('click', async e => {
                e.preventDefault();
                const slug = a.dataset.slug;
                echo(`read ${a.textContent}`);
                await loadNote(slug);
                scrollToBottom();
            });
        });
        
        // Handle internal wiki-style links
        output.querySelectorAll('.note-content a').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                a.addEventListener('click', async e => {
                    e.preventDefault();
                    const slug = pathToSlug(href.replace(/^\/garden\//, ''));
                    echo(`read ${a.textContent}`);
                    await loadNote(slug);
                    scrollToBottom();
                });
            }
        });
    }

    function autocomplete() {
        const val = input.value.toLowerCase();
        if (!val) return;
        
        // Try commands
        const cmds = ['help', 'start', 'explore', 'random', 'recent', 'search', 'read', 'clear'];
        const cmdMatch = cmds.find(c => c.startsWith(val));
        if (cmdMatch) {
            input.value = cmdMatch;
            return;
        }
        
        // Try note titles
        const noteMatch = notesList.find(n => n.title.toLowerCase().startsWith(val));
        if (noteMatch) {
            input.value = noteMatch.title.toLowerCase();
        }
    }

    function findNote(name) {
        const lower = name.toLowerCase();
        return notesList.find(n => 
            n.title.toLowerCase() === lower ||
            n.slug === lower ||
            n.title.toLowerCase().startsWith(lower)
        );
    }

    function pathToSlug(path) {
        return path
            .replace(/^\d+\.\s*[^/]+\//, '')
            .replace(/\s+/g, '-')
            .toLowerCase();
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        return `${Math.floor(days / 30)}mo ago`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── Start ────────────────────────────────────────────────────
    init();
})();
