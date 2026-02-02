/* ═══════════════════════════════════════════════════════════════
   SANTI.WTF — terminal interface
   ═══════════════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // ─── State ────────────────────────────────────────────────────
    let notesIndex = {};
    let notesList = [];
    let commandHistory = [];
    let historyIndex = -1;
    let isReading = false;
    let moreMenuVisible = false;
    let slashMenuVisible = false;
    let slashMenuIndex = 0;
    let lettersMode = false;
    let placeholderInterval = null;
    let idleTimeout = null;

    const placeholderHints = [
        'type / to begin',
        "try 'random' for a surprise",
        'press tab to autocomplete',
        'there are secrets here...',
        "type 'explore' to see all notes",
        '↑↑↓↓←→←→BA',
        "try 'coffee' when you need a break",
        "type 'help' for commands",
        'click the traffic lights...',
        "type 'fortune' for wisdom"
    ];
    let currentHintIndex = 0;

    const slashCommands = [
        { name: 'about', desc: 'who is santi' },
        { name: 'info', desc: 'about this site' },
        { name: 'explore', desc: 'browse all notes' },
        { name: 'now', desc: 'what i\'m up to' },
        { name: 'letters', desc: 'subscribe to my newsletter' },
        { name: 'random', desc: 'surprise me' }
    ];

    // ─── Elements ─────────────────────────────────────────────────
    const input = document.getElementById('command-input');
    const output = document.getElementById('output');
    const loading = document.getElementById('loading');
    const banner = document.getElementById('banner');
    const welcome = document.getElementById('welcome');
    const commandPalette = document.getElementById('command-palette');
    const matrixCanvas = document.getElementById('matrix-canvas');

    // ─── Initialize ───────────────────────────────────────────────
    async function init() {
        await loadIndex();

        // Check for route from 404 redirect
        const pendingRoute = sessionStorage.getItem('pendingRoute');
        if (pendingRoute) {
            sessionStorage.removeItem('pendingRoute');
            await handleRoute(pendingRoute);
        } else {
            // Show welcome with typing effect
            await typeWelcome();
        }

        if (input) {
            input.addEventListener('keydown', handleInput);
            input.addEventListener('input', handleInputChange);
            input.focus();

            // Keep focus on input (desktop)
            document.body.addEventListener('click', (e) => {
                if (!e.target.closest('a') &&
                    !e.target.closest('button') &&
                    !e.target.closest('.command-palette') &&
                    !e.target.closest('.more-menu') &&
                    !e.target.closest('.slash-menu') &&
                    !window.getSelection().toString()) {
                    input.focus();
                }
            });

            // Ensure input stays focused for typing
            document.addEventListener('keydown', (e) => {
                if (document.activeElement !== input &&
                    !e.metaKey && !e.ctrlKey &&
                    e.key.length === 1) {
                    input.focus();
                }
            });
        }

        // Mobile command palette
        setupCommandPalette();

        // Swipe gestures for mobile
        setupSwipeGestures();

        // Konami code listener
        setupKonamiCode();

        // Traffic light button easter eggs
        setupTrafficLights();

        // Triple-tap easter egg (mobile alternative to Konami code)
        setupTripleTapEasterEgg();
    }

    // ─── Load Index ───────────────────────────────────────────────
    async function loadIndex() {
        try {
            const res = await fetch('/terminal/data/index.json');
            if (!res.ok) throw new Error('Index not found');
            const data = await res.json();
            notesIndex = data.notes || {};

            notesList = Object.entries(notesIndex).map(([slug, note]) => ({
                slug,
                ...note
            }));

            notesList.sort((a, b) => new Date(b.tended) - new Date(a.tended));
        } catch (e) {
            console.error('Failed to load index:', e);
            // Try falling back to garden data
            try {
                const res = await fetch('/garden/data/index.json');
                if (res.ok) {
                    const data = await res.json();
                    notesIndex = data.notes || {};
                    notesList = Object.entries(notesIndex).map(([path, note]) => ({
                        slug: pathToSlug(path),
                        path,
                        ...note
                    }));
                    notesList.sort((a, b) => new Date(b.tended) - new Date(a.tended));
                }
            } catch (e2) {
                console.error('Failed to load fallback index:', e2);
            }
        }
    }

    // ─── Typing Animation ─────────────────────────────────────────
    function getTimeGreeting() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'good morning';
        if (hour >= 12 && hour < 17) return 'good afternoon';
        if (hour >= 17 && hour < 21) return 'good evening';
        // Night owl mode (9pm - 5am)
        return 'hello, night owl';
    }

    async function typeWelcome() {
        const greeting = getTimeGreeting();
        const lines = [
            { text: `> ${greeting}`, class: 'greeting' },
            { text: "i'm santi — a writer, builder, and thinker.", class: '' }
        ];

        for (const line of lines) {
            const p = document.createElement('p');
            p.className = line.class;
            welcome.appendChild(p);

            // Create cursor
            const cursor = document.createElement('span');
            cursor.className = 'typing-cursor';
            p.appendChild(cursor);

            // Type each character
            const chars = line.text.split('');
            let html = '';
            for (let i = 0; i < chars.length; i++) {
                html += chars[i];
                p.innerHTML = html;
                p.appendChild(cursor);
                await sleep(8 + Math.random() * 12);
            }

            // Remove cursor from this line
            cursor.remove();
            p.innerHTML = line.text;

            await sleep(100);
        }

        // Show inline prompt with cursor and placeholder
        showInlinePrompt();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ─── URL Routing ──────────────────────────────────────────────
    async function handleRoute(path) {
        // Remove leading slash
        path = path.replace(/^\//, '');

        if (!path || path === 'terminal') {
            await typeWelcome();
            return;
        }

        // Special routes
        if (path === 'about' || path === 'whoami') {
            const note = findNote('about');
            if (note) {
                await loadNote(note.slug);
            }
            return;
        }

        if (path === 'now' || path === 'status') {
            const note = findNote('now');
            if (note) {
                await loadNote(note.slug);
            }
            return;
        }

        if (path === 'resources' || path === 'playbooks') {
            await showResources();
            return;
        }

        // Try to load as note
        const note = findNote(path);
        if (note) {
            await loadNote(note.slug);
        } else {
            welcome.innerHTML = `<p class="error">note not found: ${escapeHtml(path)}</p>`;
        }
    }

    // ─── Input Handler ────────────────────────────────────────────
    function handleInput(e) {
        // Handle snake game mode
        if (snakeGame) {
            return; // Snake has its own handler
        }

        // Handle vim trap mode
        if (vimMode) {
            e.preventDefault();
            handleVimInput(e.key);
            return;
        }

        // Handle letters (newsletter) mode
        if (lettersMode) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const email = input.value.trim();
                input.value = '';
                submitNewsletter(email);
                return;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                lettersMode = false;
                input.value = '';
                goHome();
                return;
            }
            return;
        }

        // Handle slash menu navigation
        if (slashMenuVisible) {
            const filtered = getFilteredSlashCommands();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (filtered.length > 0) {
                    slashMenuIndex = (slashMenuIndex + 1) % filtered.length;
                    updateSlashMenuSelection();
                }
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (filtered.length > 0) {
                    slashMenuIndex = (slashMenuIndex - 1 + filtered.length) % filtered.length;
                    updateSlashMenuSelection();
                }
                return;
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered.length > 0) {
                    const cmd = filtered[slashMenuIndex].name;
                    hideSlashMenu();
                    input.value = '';
                    updateInlinePrompt();
                    execute(cmd);
                }
                return;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideSlashMenu();
                input.value = '';
                updateInlinePrompt();
                return;
            } else if (e.key === 'Backspace' && input.value === '/') {
                hideSlashMenu();
                return;
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            hideSlashMenu();
            const cmd = input.value.trim();
            if (cmd && cmd !== '/') {
                commandHistory.push(cmd);
                historyIndex = commandHistory.length;
                execute(cmd);
            }
            input.value = '';
            updateInlinePrompt();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                input.value = commandHistory[historyIndex];
                updateInlinePrompt();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                input.value = commandHistory[historyIndex];
                updateInlinePrompt();
            } else {
                historyIndex = commandHistory.length;
                input.value = '';
                updateInlinePrompt();
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            autocomplete();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (slashMenuVisible) {
                hideSlashMenu();
                input.value = '';
                updateInlinePrompt();
            } else if (isReading) {
                goHome();
            } else {
                input.value = '';
                updateInlinePrompt();
            }
        }
    }

    // Handle input changes
    function handleInputChange() {
        // Reset idle hint rotation on any input
        resetIdleTimer();

        // Update letters input if in that mode
        if (lettersMode) {
            updateLettersInput();
            return;
        }

        if (input.value.startsWith('/') && !slashMenuVisible) {
            showSlashMenu();
        } else if (!input.value.startsWith('/') && slashMenuVisible) {
            hideSlashMenu();
        }
        updateInlinePrompt();
    }

    // Get filtered slash commands based on input
    function getFilteredSlashCommands() {
        const query = input.value.slice(1).toLowerCase(); // remove leading /
        if (!query) return slashCommands;
        return slashCommands.filter(cmd => cmd.name.startsWith(query));
    }

    // ─── Inline Prompt ─────────────────────────────────────────────
    function showInlinePrompt() {
        // Remove existing prompt if any
        const existing = welcome.querySelector('.inline-prompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.className = 'inline-prompt';
        prompt.innerHTML = `
            <span class="cursor"></span>
            <span class="placeholder">${placeholderHints[0]}</span>
        `;
        welcome.appendChild(prompt);

        // Start rotating hints after idle
        startIdleHintRotation();
    }

    function startIdleHintRotation() {
        // Clear any existing intervals
        stopIdleHintRotation();

        // Start rotating hints after 5 seconds of inactivity
        idleTimeout = setTimeout(() => {
            placeholderInterval = setInterval(() => {
                currentHintIndex = (currentHintIndex + 1) % placeholderHints.length;
                const placeholder = welcome.querySelector('.inline-prompt .placeholder');
                if (placeholder && !slashMenuVisible && !input.value) {
                    placeholder.classList.add('hint-fade');
                    setTimeout(() => {
                        placeholder.textContent = placeholderHints[currentHintIndex];
                        placeholder.classList.remove('hint-fade');
                    }, 150);
                }
            }, 4000);
        }, 5000);
    }

    function stopIdleHintRotation() {
        if (idleTimeout) {
            clearTimeout(idleTimeout);
            idleTimeout = null;
        }
        if (placeholderInterval) {
            clearInterval(placeholderInterval);
            placeholderInterval = null;
        }
    }

    function resetIdleTimer() {
        stopIdleHintRotation();
        if (!isReading && !vimMode && !lettersMode) {
            startIdleHintRotation();
        }
    }

    function updateInlinePrompt() {
        const prompt = welcome.querySelector('.inline-prompt');
        if (!prompt) return;

        const val = input.value;

        if (slashMenuVisible) {
            const filtered = getFilteredSlashCommands();
            // Clamp selection index to filtered length
            if (slashMenuIndex >= filtered.length) {
                slashMenuIndex = Math.max(0, filtered.length - 1);
            }
            // Show typed text with cursor, then filtered menu below
            prompt.innerHTML = `
                <div class="prompt-line"><span class="typed">${escapeHtml(val)}</span><span class="cursor"></span></div>
                <div class="slash-menu">
                    ${filtered.length > 0 ? filtered.map((cmd, i) => `
                        <div class="slash-menu-item${i === slashMenuIndex ? ' selected' : ''}" data-cmd="${cmd.name}">
                            <span class="menu-dot"></span><span class="menu-label">${cmd.name}</span>
                        </div>
                    `).join('') : '<div class="slash-menu-empty">no matches</div>'}
                </div>
            `;
            bindSlashMenu();
        } else if (val) {
            // Show typed text with cursor
            prompt.innerHTML = `
                <span class="typed">${escapeHtml(val)}</span><span class="cursor"></span>
            `;
        } else {
            // Show placeholder
            prompt.innerHTML = `
                <span class="cursor"></span>
                <span class="placeholder">type / to begin</span>
            `;
        }
    }

    // ─── Slash Menu ──────────────────────────────────────────────
    function showSlashMenu() {
        slashMenuVisible = true;
        slashMenuIndex = 0;
        updateInlinePrompt();
    }

    function hideSlashMenu() {
        slashMenuVisible = false;
        slashMenuIndex = 0;
        updateInlinePrompt();
    }

    function updateSlashMenuSelection() {
        updateInlinePrompt();
    }

    function bindSlashMenu() {
        const prompt = welcome.querySelector('.inline-prompt');
        if (!prompt) return;

        prompt.querySelectorAll('.slash-menu-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                const cmd = item.dataset.cmd;
                hideSlashMenu();
                input.value = '';
                await execute(cmd);
            });
        });
    }

    // ─── Execute Command ──────────────────────────────────────────
    async function execute(cmd) {
        // Trigger command flash
        triggerCmdFlash();

        // Strip leading "/" if present
        if (cmd.startsWith('/')) {
            cmd = cmd.slice(1);
        }
        const parts = cmd.toLowerCase().split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1).join(' ');

        switch (command) {
            case 'help':
            case '?':
                clearForCommand();
                showHelp();
                break;

            case 'ls':
            case 'explore':
                openGraph();
                break;

            case 'list':
            case 'notes':
                clearForCommand();
                listNotes(args);
                break;

            case 'cat':
            case 'read':
            case 'open':
            case 'go':
                if (args) {
                    await findAndLoad(args);
                } else {
                    echo(cmd);
                    print('usage: cat [note]', 'error');
                }
                break;

            case 'search':
            case 'find':
            case 'grep':
                if (args) {
                    clearForCommand();
                    search(args);
                } else {
                    echo(cmd);
                    print('usage: search [term]', 'error');
                }
                break;

            case 'random':
            case 'rand':
            case 'r':
                await loadRandom();
                break;

            case 'recent':
            case 'latest':
                clearForCommand();
                showRecent();
                break;

            case 'now':
            case 'status':
                await findAndLoad('now');
                break;

            case 'about':
            case 'whoami':
                await findAndLoad('about-me');
                break;

            case 'info':
                await findAndLoad('about-this-site');
                break;

            case 'letters':
            case 'newsletter':
            case 'subscribe':
                showLettersPrompt();
                break;

            case 'resources':
            case 'playbooks':
                clearForCommand();
                await showResources();
                break;

            case 'home':
            case 'clear':
            case 'cls':
            case 'back':
                goHome();
                break;

            case 'matrix':
                startMatrix();
                break;

            // ─── Easter Eggs ─────────────────────────────────────────
            case 'coffee':
                clearForCommand();
                showCoffee();
                break;

            case 'sudo':
                echo(cmd);
                print('nice try, but you have no power here.', 'system-msg');
                break;

            case '42':
                echo(cmd);
                print('the answer to life, the universe, and everything.', 'system-msg');
                print('but what was the question?', 'text-dim');
                break;

            case 'fortune':
                clearForCommand();
                showFortune();
                break;

            case 'cowsay':
                clearForCommand();
                showCowsay(args || 'moo');
                break;

            case 'hack':
                startHack();
                break;

            case 'vim':
            case 'vi':
            case 'nvim':
            case 'nano':
            case 'emacs':
                startVimTrap();
                break;

            case 'snake':
                startSnakeGame();
                break;

            default:
                // Try to find note by name
                const note = findNote(cmd);
                if (note) {
                    await loadNote(note.slug);
                } else {
                    echo(cmd);
                    print(`not found: ${command}`, 'error');
                    print("type 'help' for commands", 'system-msg');
                }
        }

        if (!isReading) {
            scrollToBottom();
        }
    }

    // ─── Commands ─────────────────────────────────────────────────
    function showHelp() {
        const html = `
            <div class="help-block">
                <div class="help-title">commands</div>
                <div class="help-grid">
                    <span class="help-cmd">explore</span>
                    <span class="help-desc">list all notes</span>
                    <span class="help-cmd">search [term]</span>
                    <span class="help-desc">find notes</span>
                    <span class="help-cmd">cat [note]</span>
                    <span class="help-desc">read a note</span>
                    <span class="help-cmd">random</span>
                    <span class="help-desc">surprise me</span>
                    <span class="help-cmd">recent</span>
                    <span class="help-desc">recently updated</span>
                    <span class="help-cmd">now</span>
                    <span class="help-desc">what i'm up to</span>
                    <span class="help-cmd">about</span>
                    <span class="help-desc">who is santi</span>
                    <span class="help-cmd">home</span>
                    <span class="help-desc">back to start</span>
                </div>
            </div>
            <p class="system-msg">or just type a note title and hit enter</p>
        `;
        output.insertAdjacentHTML('beforeend', html);
    }

    function listNotes(filter) {
        let notes = notesList;
        if (filter) {
            const f = filter.toLowerCase();
            notes = notes.filter(n =>
                n.title.toLowerCase().includes(f) ||
                (n.collection && n.collection.toLowerCase().includes(f)) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(f)))
            );
        }

        const html = `
            <ul class="note-list">
                ${notes.map(n => `
                    <li>
                        <span>
                            ${n.collection ? `<span class="collection-badge">${n.collection}</span>` : ''}
                            <a href="#" data-slug="${escapeAttr(n.slug)}">${escapeHtml(n.title)}</a>
                        </span>
                        <span class="meta"><span class="stage-${n.stage}">${stageEmoji(n.stage)}</span></span>
                    </li>
                `).join('')}
            </ul>
            <p class="list-count">${notes.length} notes</p>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
    }

    function showRecent() {
        const recent = notesList.slice(0, 10);
        const html = `
            <ul class="note-list">
                ${recent.map(n => `
                    <li>
                        <a href="#" data-slug="${escapeAttr(n.slug)}">${escapeHtml(n.title)}</a>
                        <span class="meta">${formatDate(n.tended)}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
    }

    function search(term) {
        const lower = term.toLowerCase();
        const results = notesList.filter(n =>
            n.title.toLowerCase().includes(lower) ||
            (n.tags && n.tags.some(t => t.toLowerCase().includes(lower))) ||
            (n.excerpt && n.excerpt.toLowerCase().includes(lower)) ||
            (n.collection && n.collection.toLowerCase().includes(lower))
        );

        if (results.length === 0) {
            print(`no results for "${term}"`, 'error');
            return;
        }

        const html = `
            <ul class="note-list">
                ${results.map(n => `
                    <li>
                        <span>
                            ${n.collection ? `<span class="collection-badge">${n.collection}</span>` : ''}
                            <a href="#" data-slug="${escapeAttr(n.slug)}">${escapeHtml(n.title)}</a>
                        </span>
                        <span class="meta"><span class="stage-${n.stage}">${stageEmoji(n.stage)}</span></span>
                    </li>
                `).join('')}
            </ul>
            <p class="list-count">${results.length} found</p>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
    }

    async function loadRandom() {
        if (notesList.length === 0) return;
        const note = notesList[Math.floor(Math.random() * notesList.length)];
        await loadNote(note.slug);
    }

    async function findAndLoad(name) {
        const note = findNote(name);
        if (note) {
            await loadNote(note.slug);
        } else {
            echo(`cat ${name}`);
            print(`note not found: "${name}"`, 'error');
        }
    }

    // ─── Load Note ────────────────────────────────────────────────
    async function loadNote(slug) {
        showLoading();

        const note = notesList.find(n => n.slug === slug);
        if (!note) {
            hideLoading();
            print('note not found', 'error');
            return;
        }

        try {
            // Try terminal content first, fall back to garden
            let res = await fetch(`/terminal/content/${slug}.html`);
            if (!res.ok) {
                // Try with path if available
                if (note.path) {
                    res = await fetch(`/garden/content/${note.path}.html`);
                }
            }
            if (!res.ok) throw new Error('not found');

            let content = await res.text();

            // Clear and enter reading mode
            output.innerHTML = '';
            welcome.classList.add('hidden');
            banner.classList.add('collapsed');
            isReading = true;
            stopIdleHintRotation();

            // Update URL
            history.pushState({ slug }, note.title, `/${slug}`);

            // Build note view
            const tags = note.tags && note.tags.length > 0
                ? `<span class="note-tags">${note.tags.map(t => `<span class="note-tag">#${t}</span>`).join(' ')}</span>`
                : '';

            const backlinks = note.backlinks && note.backlinks.length > 0
                ? `<div class="backlinks">
                    <div class="backlinks-title">linked from:</div>
                    <ul class="backlinks-list">
                        ${note.backlinks.map(b => {
                            const linked = notesList.find(n => n.slug === b || n.path === b);
                            const title = linked ? linked.title : b;
                            const linkSlug = linked ? linked.slug : b;
                            return `<li><a href="#" data-slug="${escapeAttr(linkSlug)}">${escapeHtml(title)}</a></li>`;
                        }).join('')}
                    </ul>
                </div>`
                : '';

            const html = `
                <article class="note-view">
                    <div class="note-box">
                        <div class="note-box-header">
                            <span class="note-box-title">${escapeHtml(note.title)}</span>
                            <span class="note-box-stage ${note.stage}">${stageEmoji(note.stage)} ${note.stage}</span>
                        </div>
                        <div class="note-box-meta">
                            <span>planted: ${note.planted || 'unknown'}</span>
                            <span>tended: ${note.tended || 'unknown'}</span>
                            ${tags}
                        </div>
                    </div>
                    <div class="note-body">
                        ${content}
                    </div>
                    <footer class="note-footer">
                        ${backlinks}
                        <span class="back-link" onclick="window.terminalHome()">← back</span>
                    </footer>
                </article>
            `;
            output.insertAdjacentHTML('beforeend', html);

            // Bind internal links
            bindBodyLinks();
            bindNoteLinks();

            // Scroll to top
            window.scrollTo(0, 0);

        } catch (e) {
            print('failed to load note', 'error');
        }

        hideLoading();
    }

    // ─── Special Pages ────────────────────────────────────────────
    function showAbout() {
        output.innerHTML = '';
        welcome.classList.add('hidden');
        banner.classList.add('collapsed');
        isReading = true;

        history.pushState({}, 'about', '/about');

        const html = `
            <div class="about-view">
                <h1>whoami</h1>
                <p>i'm <span class="highlight">santi</span> — a writer, builder, and thinker based in seattle.</p>
                <p>i write about creativity, personal development (no guru shit), and building things on the internet.</p>
                <p>this site is my corner of the web — a digital garden where ideas grow in public.</p>
                <p>i believe in learning by doing, sharing the process, and building in the open.</p>
                <div class="about-links">
                    <a href="https://threads.net/@santivillanueva">threads</a>
                    <a href="https://github.com/sawnts">github</a>
                    <a href="mailto:hi@santi.wtf">email</a>
                </div>
                <p style="margin-top: 2rem;">
                    <span class="back-link" onclick="window.terminalHome()">← back</span>
                </p>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
        window.scrollTo(0, 0);
    }

    // ─── Letters (Newsletter) ────────────────────────────────────────
    function showLettersPrompt() {
        output.innerHTML = '';
        welcome.classList.add('hidden');
        banner.classList.add('collapsed');
        isReading = true;
        lettersMode = true;

        history.pushState({}, 'letters', '/letters');

        const html = `
            <div class="letters-view">
                <h1>santi's letters</h1>
                <p>occasional emails about creativity, thinking in public, and this weird thing called life.</p>
                <p>no spam. no bs. just honest thoughts and curated links.</p>
                <div class="letters-form">
                    <div class="letters-input-line">
                        <span class="letters-prompt">email:</span>
                        <span class="letters-input" id="letters-email"></span>
                        <span class="cursor"></span>
                    </div>
                    <p class="letters-hint">press enter to subscribe · esc to cancel</p>
                </div>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
        input.value = '';
        updateLettersInput();
        window.scrollTo(0, 0);
    }

    function updateLettersInput() {
        const emailSpan = document.getElementById('letters-email');
        if (emailSpan) {
            emailSpan.textContent = input.value;
        }
    }

    async function submitNewsletter(email) {
        if (!email || !email.includes('@')) {
            showLettersResult(false, 'please enter a valid email');
            return;
        }

        try {
            const res = await fetch('https://buttondown.com/api/emails/embed-subscribe/sawnts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `email=${encodeURIComponent(email)}`
            });

            if (res.ok) {
                showLettersResult(true, "you're in! check your inbox to confirm.");
            } else {
                showLettersResult(false, 'something went wrong. try again?');
            }
        } catch (e) {
            showLettersResult(false, 'could not connect. try again later.');
        }
    }

    function showLettersResult(success, message) {
        lettersMode = false;
        const view = output.querySelector('.letters-view');
        if (view) {
            const form = view.querySelector('.letters-form');
            if (form) {
                form.innerHTML = `
                    <p class="${success ? 'letters-success' : 'letters-error'}">${message}</p>
                    <p style="margin-top: 1.5rem;">
                        <span class="back-link" onclick="window.terminalHome()">← back</span>
                    </p>
                `;
            }
        }
    }

    async function showNow() {
        output.innerHTML = '';
        welcome.classList.add('hidden');
        banner.classList.add('collapsed');
        isReading = true;

        history.pushState({}, 'now', '/now');

        // Try to load now data
        let nowData = null;
        try {
            const res = await fetch('/terminal/data/now-data.json');
            if (res.ok) {
                nowData = await res.json();
            }
        } catch (e) {
            // Try garden fallback
            try {
                const res = await fetch('/garden/data/now-data.json');
                if (res.ok) {
                    nowData = await res.json();
                }
            } catch (e2) {}
        }

        const location = nowData?.location || 'seattle, wa';
        const status = nowData?.status || 'building';
        const reading = nowData?.reading;
        const mood = nowData?.mood || 'focused';

        const html = `
            <div class="now-view">
                <div class="now-header">
                    <span class="status-dot"></span>
                    <h1>now</h1>
                </div>
                <div class="now-grid">
                    <div class="now-card">
                        <div class="now-card-label">location</div>
                        <div class="now-card-value">${escapeHtml(location)}</div>
                    </div>
                    <div class="now-card">
                        <div class="now-card-label">status</div>
                        <div class="now-card-value">${escapeHtml(status)}</div>
                    </div>
                    <div class="now-card">
                        <div class="now-card-label">mood</div>
                        <div class="now-card-value">${escapeHtml(mood)}</div>
                    </div>
                    ${reading ? `
                    <div class="now-card">
                        <div class="now-card-label">reading</div>
                        <div class="now-card-value">${escapeHtml(reading.title)} by ${escapeHtml(reading.author)}</div>
                    </div>
                    ` : ''}
                </div>
                <p style="color: var(--text-dim); margin-top: 1rem;">
                    this is my <a href="https://nownownow.com/about" style="color: var(--link);">now page</a> —
                    a snapshot of what i'm focused on right now.
                </p>
                <p style="margin-top: 2rem;">
                    <span class="back-link" onclick="window.terminalHome()">← back</span>
                </p>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
        window.scrollTo(0, 0);
    }

    async function showResources() {
        output.innerHTML = '';
        welcome.classList.add('hidden');
        banner.classList.add('collapsed');
        isReading = true;

        history.pushState({}, 'resources', '/resources');

        // Find notes tagged as resources/playbooks
        const resources = notesList.filter(n =>
            (n.tags && n.tags.some(t => ['resource', 'playbook', 'guide'].includes(t.toLowerCase()))) ||
            (n.collection && ['resources', 'playbooks'].includes(n.collection.toLowerCase()))
        );

        const html = `
            <div class="about-view">
                <h1>resources & playbooks</h1>
                <p>practical guides and resources i've put together.</p>
                ${resources.length > 0 ? `
                <ul class="note-list" style="margin-top: 1.5rem;">
                    ${resources.map(n => `
                        <li>
                            <a href="#" data-slug="${escapeAttr(n.slug)}">${escapeHtml(n.title)}</a>
                            <span class="meta">${formatDate(n.tended)}</span>
                        </li>
                    `).join('')}
                </ul>
                ` : `
                <p style="color: var(--text-dim); margin-top: 1rem;">coming soon...</p>
                `}
                <p style="margin-top: 2rem;">
                    <span class="back-link" onclick="window.terminalHome()">← back</span>
                </p>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
        bindNoteLinks();
        window.scrollTo(0, 0);
    }

    // ─── Navigation ───────────────────────────────────────────────
    function goHome() {
        output.innerHTML = '';
        welcome.classList.remove('hidden');
        banner.classList.remove('collapsed');
        isReading = false;
        lettersMode = false;
        input.value = '';
        showInlinePrompt();
        history.pushState({}, 'santi.wtf', '/');
        window.scrollTo(0, 0);
        // Restart idle hint rotation
        resetIdleTimer();
    }

    // Expose for inline onclick
    window.terminalHome = goHome;

    function clearForCommand() {
        if (isReading) {
            output.innerHTML = '';
            welcome.classList.add('hidden');
            banner.classList.remove('collapsed');
            isReading = false;
        }
    }

    // ─── Graph View ───────────────────────────────────────────────
    let graphNodes = [];
    let graphEdges = [];
    let graphState = {
        dragging: null,
        hovering: null,
        panning: false,
        panStart: { x: 0, y: 0 },
        transform: { x: 0, y: 0, scale: 1 },
        alpha: 1,
        animationId: null,
        isClosing: false,
        startTime: 0
    };

    function openGraph() {
        const overlay = document.getElementById('graph-overlay');
        overlay.style.display = 'block';
        overlay.style.opacity = '0';

        graphState.transform = { x: 0, y: 0, scale: 1 };
        graphState.alpha = 1;
        graphState.hovering = null;
        graphState.dragging = null;
        graphState.panning = false;
        graphState.isClosing = false;
        graphState.startTime = performance.now();

        requestAnimationFrame(() => {
            initGraph();
            overlay.style.opacity = '1';
        });
    }

    function closeGraph() {
        graphState.isClosing = true;
        const overlay = document.getElementById('graph-overlay');
        overlay.style.opacity = '0';

        setTimeout(() => {
            overlay.style.display = 'none';
            if (graphState.animationId) {
                cancelAnimationFrame(graphState.animationId);
                graphState.animationId = null;
            }
        }, 200);
    }

    window.closeGraph = closeGraph;

    function initGraph() {
        const canvas = document.getElementById('graph-canvas');
        const ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Create nodes from notes
        graphNodes = [];
        graphEdges = [];

        const nodeMap = {};
        const centerX = width / 2;
        const centerY = height / 2;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        notesList.forEach((note, i) => {
            const angle = (i / notesList.length) * Math.PI * 2;
            const targetRadius = Math.min(width, height) * 0.35;
            const targetX = centerX + Math.cos(angle) * targetRadius + (Math.random() - 0.5) * 50;
            const targetY = centerY + Math.sin(angle) * targetRadius + (Math.random() - 0.5) * 50;
            const node = {
                id: note.slug,
                title: note.title,
                // Start at center for burst animation (or at target if reduced motion)
                x: reducedMotion ? targetX : centerX,
                y: reducedMotion ? targetY : centerY,
                targetX,
                targetY,
                vx: 0,
                vy: 0,
                backlinkCount: (note.backlinks || []).length,
                stage: note.stage || 'seedling',
                hoverAmount: 0,
                scale: 1,
                // Stagger the burst animation
                burstDelay: i * 15,
                burstProgress: reducedMotion ? 1 : 0
            };
            graphNodes.push(node);
            nodeMap[note.slug] = node;
            if (note.path) nodeMap[note.path] = node;
        });

        // Create edges from links
        notesList.forEach(note => {
            const sourceNode = nodeMap[note.slug] || nodeMap[note.path];
            if (!sourceNode) return;

            (note.links || []).forEach(link => {
                const targetNode = nodeMap[link];
                if (targetNode && sourceNode !== targetNode) {
                    graphEdges.push({ source: sourceNode, target: targetNode });
                }
            });
        });

        // Coordinate conversion
        const toGraphCoords = (screenX, screenY) => {
            const t = graphState.transform;
            return {
                x: (screenX - t.x) / t.scale,
                y: (screenY - t.y) / t.scale
            };
        };

        const findNodeAt = (gx, gy) => {
            for (let i = graphNodes.length - 1; i >= 0; i--) {
                const node = graphNodes[i];
                const dx = gx - node.x;
                const dy = gy - node.y;
                const nodeRadius = Math.min(6 + node.backlinkCount * 2, 20);
                if (dx * dx + dy * dy < (nodeRadius + 5) * (nodeRadius + 5)) {
                    return node;
                }
            }
            return null;
        };

        let dragStartX = 0, dragStartY = 0, didDrag = false;

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
                graphState.alpha = 0.8;
            } else {
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
                if (Math.abs(screenX - dragStartX) > 5 || Math.abs(screenY - dragStartY) > 5) {
                    didDrag = true;
                }
                graphState.dragging.x = gx;
                graphState.dragging.y = gy;
                graphState.dragging.vx = 0;
                graphState.dragging.vy = 0;
            } else if (graphState.panning) {
                graphState.transform.x += screenX - graphState.panStart.x;
                graphState.transform.y += screenY - graphState.panStart.y;
                graphState.panStart = { x: screenX, y: screenY };
                didDrag = true;
            }

            graphState.hovering = findNodeAt(gx, gy);
            canvas.style.cursor = graphState.hovering ? 'pointer' : (graphState.panning ? 'grabbing' : 'grab');
        };

        canvas.onmouseup = () => {
            if (graphState.dragging && !didDrag) {
                const node = graphState.dragging;
                closeGraph();
                loadNote(node.id);
            }
            graphState.dragging = null;
            graphState.panning = false;
        };

        canvas.onmouseleave = () => {
            graphState.hovering = null;
            graphState.panning = false;
        };

        canvas.ondblclick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const { x: gx, y: gy } = toGraphCoords(e.clientX - rect.left, e.clientY - rect.top);
            if (!findNodeAt(gx, gy)) {
                graphState.transform = { x: 0, y: 0, scale: 1 };
            }
        };

        canvas.onwheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.5, Math.min(2, graphState.transform.scale * zoomFactor));

            const scaleDiff = newScale - graphState.transform.scale;
            graphState.transform.x -= mouseX * scaleDiff / graphState.transform.scale;
            graphState.transform.y -= mouseY * scaleDiff / graphState.transform.scale;
            graphState.transform.scale = newScale;
        };

        // Touch event handling for mobile
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        let initialPinchDistance = 0;
        let initialScale = 1;

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();

            if (e.touches.length === 1) {
                // Single finger - drag or pan
                const touch = e.touches[0];
                const screenX = touch.clientX - rect.left;
                const screenY = touch.clientY - rect.top;
                const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

                touchStartTime = Date.now();
                touchStartPos = { x: screenX, y: screenY };
                dragStartX = screenX;
                dragStartY = screenY;
                didDrag = false;

                const node = findNodeAt(gx, gy);
                if (node) {
                    graphState.dragging = node;
                    graphState.hovering = node; // Show label on touch
                    graphState.alpha = 0.8;
                } else {
                    graphState.panning = true;
                    graphState.panStart = { x: screenX, y: screenY };
                }
            } else if (e.touches.length === 2) {
                // Two fingers - pinch to zoom
                graphState.dragging = null;
                graphState.panning = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
                initialScale = graphState.transform.scale;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();

            if (e.touches.length === 1 && (graphState.dragging || graphState.panning)) {
                const touch = e.touches[0];
                const screenX = touch.clientX - rect.left;
                const screenY = touch.clientY - rect.top;
                const { x: gx, y: gy } = toGraphCoords(screenX, screenY);

                if (graphState.dragging) {
                    if (Math.abs(screenX - dragStartX) > 5 || Math.abs(screenY - dragStartY) > 5) {
                        didDrag = true;
                    }
                    graphState.dragging.x = gx;
                    graphState.dragging.y = gy;
                    graphState.dragging.vx = 0;
                    graphState.dragging.vy = 0;
                } else if (graphState.panning) {
                    graphState.transform.x += screenX - graphState.panStart.x;
                    graphState.transform.y += screenY - graphState.panStart.y;
                    graphState.panStart = { x: screenX, y: screenY };
                    didDrag = true;
                }
            } else if (e.touches.length === 2) {
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (initialPinchDistance > 0) {
                    const scale = distance / initialPinchDistance;
                    const newScale = Math.max(0.5, Math.min(2, initialScale * scale));

                    // Zoom toward center of pinch
                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                    const scaleDiff = newScale - graphState.transform.scale;
                    graphState.transform.x -= centerX * scaleDiff / graphState.transform.scale;
                    graphState.transform.y -= centerY * scaleDiff / graphState.transform.scale;
                    graphState.transform.scale = newScale;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                const touchDuration = Date.now() - touchStartTime;
                const isTap = touchDuration < 300 && !didDrag;

                if (graphState.dragging && isTap) {
                    // Tap on node - open it
                    const node = graphState.dragging;
                    closeGraph();
                    loadNote(node.id);
                }

                graphState.dragging = null;
                // Keep label visible briefly after touch, then fade
                if (graphState.hovering) {
                    setTimeout(() => {
                        graphState.hovering = null;
                    }, 1500);
                }
                graphState.panning = false;
                initialPinchDistance = 0;
            } else if (e.touches.length === 1) {
                // Transitioned from two fingers to one
                initialPinchDistance = 0;
                const rect = canvas.getBoundingClientRect();
                const touch = e.touches[0];
                graphState.panning = true;
                graphState.panStart = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top
                };
            }
        }, { passive: true });

        // Escape key to close
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeGraph();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        animateGraph(canvas, ctx, width, height);
    }

    function animateGraph(canvas, ctx, width, height) {
        if (graphState.isClosing) return;

        const elapsed = performance.now() - graphState.startTime;

        // Burst animation phase
        graphNodes.forEach(node => {
            if (node.burstProgress < 1) {
                const nodeElapsed = elapsed - node.burstDelay;
                if (nodeElapsed > 0) {
                    // Ease out cubic for smooth deceleration
                    const duration = 600;
                    const t = Math.min(nodeElapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3);
                    node.burstProgress = eased;

                    // Interpolate from center to target
                    const centerX = width / 2;
                    const centerY = height / 2;
                    node.x = centerX + (node.targetX - centerX) * eased;
                    node.y = centerY + (node.targetY - centerY) * eased;
                }
            }
        });

        // Physics simulation (only after burst animation settles)
        const allBurstComplete = graphNodes.every(n => n.burstProgress >= 1);
        if (allBurstComplete && graphState.alpha > 0.001) {
            graphNodes.forEach(node => {
                if (node === graphState.dragging) return;

                // Repulsion
                graphNodes.forEach(other => {
                    if (node === other) return;
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    if (dist < 80) {
                        const force = (80 - dist) / dist * 0.5 * graphState.alpha;
                        node.vx += dx * force;
                        node.vy += dy * force;
                    }
                });

                // Center gravity
                node.vx += (width / 2 - node.x) * 0.001 * graphState.alpha;
                node.vy += (height / 2 - node.y) * 0.001 * graphState.alpha;

                // Edge attraction
                graphEdges.forEach(edge => {
                    let other = null;
                    if (edge.source === node) other = edge.target;
                    else if (edge.target === node) other = edge.source;

                    if (other) {
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = (dist - 100) * 0.002 * graphState.alpha;
                        node.vx += dx / dist * force;
                        node.vy += dy / dist * force;
                    }
                });

                // Apply velocity
                node.vx *= 0.9;
                node.vy *= 0.9;
                node.x += node.vx;
                node.y += node.vy;
            });
            graphState.alpha *= 0.99;
        }

        // Update hover animations
        graphNodes.forEach(node => {
            const targetHover = node === graphState.hovering ? 1 : 0;
            node.hoverAmount += (targetHover - node.hoverAmount) * 0.2;
        });

        // Draw
        const t = graphState.transform;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);

        // Determine connected nodes for hover
        const connectedToHover = new Set();
        if (graphState.hovering) {
            connectedToHover.add(graphState.hovering);
            graphEdges.forEach(edge => {
                if (edge.source === graphState.hovering) connectedToHover.add(edge.target);
                if (edge.target === graphState.hovering) connectedToHover.add(edge.source);
            });
        }

        // Draw edges with animated appearance
        graphEdges.forEach((edge, i) => {
            const isConnected = graphState.hovering &&
                (edge.source === graphState.hovering || edge.target === graphState.hovering);
            const shouldFade = graphState.hovering && !isConnected;

            // Edge appears as both connected nodes have burst
            const minBurst = Math.min(edge.source.burstProgress, edge.target.burstProgress);
            const edgeOpacity = minBurst;

            let baseOpacity = isConnected ? 0.8 : (shouldFade ? 0.1 : 0.3);
            baseOpacity *= edgeOpacity;

            ctx.strokeStyle = `rgba(93, 217, 193, ${baseOpacity})`;
            ctx.lineWidth = isConnected ? 2 : 1;

            // Draw edge with growing length effect during burst
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const drawProgress = Math.min(minBurst * 1.5, 1); // Edges draw slightly after nodes arrive

            ctx.beginPath();
            ctx.moveTo(edge.source.x, edge.source.y);
            ctx.lineTo(
                edge.source.x + dx * drawProgress,
                edge.source.y + dy * drawProgress
            );
            ctx.stroke();
        });

        // Draw nodes
        graphNodes.forEach(node => {
            const isHovered = node === graphState.hovering;
            const isConnected = connectedToHover.has(node);
            const shouldFade = graphState.hovering && !isConnected;

            const baseRadius = Math.min(6 + node.backlinkCount * 2, 20);
            const radius = baseRadius * (1 + node.hoverAmount * 0.15);

            // Node color by stage
            let color;
            if (shouldFade) {
                color = 'rgba(107, 107, 107, 0.5)';
            } else if (node.stage === 'evergreen') {
                color = '#b794f4';
            } else if (node.stage === 'growing') {
                color = '#5dd9c1';
            } else {
                color = '#68d391';
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Label on hover
            if (isHovered) {
                ctx.font = '12px "JetBrains Mono", monospace';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText(node.title, node.x, node.y - radius - 8);
            }
        });

        ctx.restore();

        graphState.animationId = requestAnimationFrame(() => animateGraph(canvas, ctx, width, height));
    }

    // ─── Matrix Easter Egg ────────────────────────────────────────
    function startMatrix() {
        matrixCanvas.classList.remove('hidden');
        const ctx = matrixCanvas.getContext('2d');

        // Set canvas size
        matrixCanvas.width = window.innerWidth;
        matrixCanvas.height = window.innerHeight;

        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
        const fontSize = 14;
        const columns = matrixCanvas.width / fontSize;
        const drops = Array(Math.floor(columns)).fill(1);

        function draw() {
            ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
            ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);

            ctx.fillStyle = '#0f0';
            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }

        const interval = setInterval(draw, 33);

        // Stop after 8 seconds
        setTimeout(() => {
            clearInterval(interval);
            matrixCanvas.classList.add('hidden');
            ctx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
        }, 8000);
    }

    // ─── Coffee Easter Egg ───────────────────────────────────────
    function showCoffee() {
        const ascii = `
        ( (
         ) )
      .______.
      |      |]
      \\      /
       \`----'
`;
        const html = `
            <div class="easter-egg">
                <pre class="ascii-art coffee">${ascii}</pre>
                <p class="system-msg">here's a virtual coffee. you've earned it.</p>
                <p class="text-dim">fun fact: this site was built on approximately 47 cups of coffee.</p>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
    }

    // ─── Fortune Easter Egg ──────────────────────────────────────
    function showFortune() {
        const fortunes = [
            "the code you're looking for is inside you all along.",
            "a bug in production builds character.",
            "your next commit will be your best yet.",
            "the terminal rewards those who explore.",
            "embrace the void. also, dark mode.",
            "ship it. you can always fix it later.",
            "documentation is a love letter to your future self.",
            "the best time to refactor was yesterday. the second best time is never.",
            "your impostor syndrome is lying to you.",
            "remember: every expert was once a beginner who didn't quit.",
            "the real treasure was the merge conflicts we resolved along the way.",
            "you will find what you seek in the last place you look. obviously.",
            "a wise developer once said: 'it works on my machine.'",
            "your rubber duck believes in you.",
            "today's yak shave will be tomorrow's useful skill."
        ];
        const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
        const html = `
            <div class="easter-egg fortune">
                <p class="fortune-text">"${fortune}"</p>
                <p class="fortune-attr">— the terminal oracle</p>
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);
    }

    // ─── Cowsay Easter Egg ───────────────────────────────────────
    function showCowsay(text) {
        const maxLen = Math.min(text.length, 40);
        const padding = '-'.repeat(maxLen + 2);
        const cow = `
 ${padding}
< ${text.slice(0, 40).padEnd(maxLen)} >
 ${padding}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
`;
        const html = `<pre class="ascii-art cowsay">${escapeHtml(cow)}</pre>`;
        output.insertAdjacentHTML('beforeend', html);
    }

    // ─── Hack Easter Egg ─────────────────────────────────────────
    function startHack() {
        output.innerHTML = '';
        welcome.classList.add('hidden');
        banner.classList.add('collapsed');

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const exitHint = isTouchDevice ? '(tap anywhere to return)' : '(press any key to return)';

        const hackLines = [
            'initializing hack sequence...',
            'bypassing firewall [██████████] 100%',
            'accessing mainframe...',
            'decrypting password hash: ********',
            'injecting payload into system32...',
            'ERROR: just kidding.',
            '',
            "you're not actually hacking anything.",
            "this is just a website.",
            '',
            'but hey, cool hacker aesthetic right?',
            '',
            exitHint
        ];

        let lineIndex = 0;
        const hackOutput = document.createElement('div');
        hackOutput.className = 'hack-output';
        output.appendChild(hackOutput);

        const typeNextLine = () => {
            if (lineIndex >= hackLines.length) {
                const keyHandler = () => {
                    document.removeEventListener('keydown', keyHandler);
                    document.removeEventListener('touchstart', touchHandler);
                    goHome();
                };
                const touchHandler = () => {
                    document.removeEventListener('keydown', keyHandler);
                    document.removeEventListener('touchstart', touchHandler);
                    goHome();
                };
                document.addEventListener('keydown', keyHandler);
                document.addEventListener('touchstart', touchHandler, { once: true });
                return;
            }

            const line = document.createElement('p');
            line.className = 'hack-line';
            line.textContent = hackLines[lineIndex];
            hackOutput.appendChild(line);
            lineIndex++;

            setTimeout(typeNextLine, 150 + Math.random() * 200);
        };

        typeNextLine();
    }

    // ─── Vim Trap Easter Egg ─────────────────────────────────────
    let vimMode = false;

    function startVimTrap() {
        vimMode = true;
        output.innerHTML = '';
        welcome.classList.add('hidden');
        banner.classList.add('collapsed');

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const html = `
            <div class="vim-trap">
                <pre class="vim-screen">
~
~
~
~                      VIM - Vi IMproved
~
~                        version 9.0
~                   by Bram Moolenaar et al.
~
~              type  :q!<Enter>       to exit
~              type  :help<Enter>     for help (just kidding)
~
~
~
~
</pre>
                <div class="vim-status">-- NORMAL --</div>
                <div class="vim-command"><span class="vim-input"></span><span class="cursor"></span></div>
                ${isTouchDevice ? `
                <button type="button" class="vim-escape-btn" id="vim-escape-btn">:q!</button>
                ` : ''}
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);

        // Setup mobile escape button
        if (isTouchDevice) {
            const escBtn = document.getElementById('vim-escape-btn');
            if (escBtn) {
                escBtn.addEventListener('click', () => {
                    vimMode = false;
                    goHome();
                    print('you escaped vim. you are among the chosen few.', 'system-msg');
                });
            }
        }

        // Override input handling
        input.value = '';
    }

    function handleVimInput(key) {
        const vimInput = output.querySelector('.vim-input');
        const vimStatus = output.querySelector('.vim-status');
        if (!vimInput) return;

        if (key === 'Escape') {
            vimInput.textContent = '';
            vimStatus.textContent = '-- NORMAL --';
            return;
        }

        if (key === ':') {
            vimInput.textContent = ':';
            vimStatus.textContent = '';
            return;
        }

        if (vimInput.textContent.startsWith(':')) {
            if (key === 'Enter') {
                const cmd = vimInput.textContent;
                if (cmd === ':q!' || cmd === ':wq' || cmd === ':x' || cmd === ':qa!') {
                    vimMode = false;
                    goHome();
                    print('you escaped vim. you are among the chosen few.', 'system-msg');
                } else if (cmd === ':q') {
                    vimInput.textContent = '';
                    vimStatus.textContent = 'E37: No write since last change (add ! to override)';
                } else if (cmd === ':help') {
                    vimInput.textContent = '';
                    vimStatus.textContent = 'just type :q! to quit. i believe in you.';
                } else {
                    vimInput.textContent = '';
                    vimStatus.textContent = `E492: Not an editor command: ${cmd.slice(1)}`;
                }
            } else if (key === 'Backspace') {
                vimInput.textContent = vimInput.textContent.slice(0, -1);
            } else if (key.length === 1) {
                vimInput.textContent += key;
            }
        }
    }

    // ─── Traffic Light Easter Eggs ─────────────────────────────────
    function setupTrafficLights() {
        const btnRed = document.getElementById('btn-red');
        const btnYellow = document.getElementById('btn-yellow');
        const btnGreen = document.getElementById('btn-green');

        if (btnRed) {
            btnRed.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerGlitch();
            });
        }

        if (btnYellow) {
            btnYellow.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerMinimize();
            });
        }

        if (btnGreen) {
            btnGreen.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerFlash();
            });
        }
    }

    function triggerGlitch() {
        const terminal = document.querySelector('.terminal');
        if (!terminal || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        terminal.classList.add('glitch');
        setTimeout(() => terminal.classList.remove('glitch'), 500);
    }

    function triggerMinimize() {
        const terminal = document.querySelector('.terminal');
        if (!terminal) return;

        terminal.classList.add('minimize');
        setTimeout(() => terminal.classList.remove('minimize'), 600);
    }

    function triggerFlash() {
        const terminal = document.querySelector('.terminal');
        if (!terminal || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        terminal.classList.add('flash-green');
        setTimeout(() => terminal.classList.remove('flash-green'), 300);
    }

    // ─── Konami Code Easter Egg ──────────────────────────────────
    function setupKonamiCode() {
        const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        let konamiIndex = 0;

        document.addEventListener('keydown', (e) => {
            // Don't trigger during vim mode or letters mode
            if (vimMode || lettersMode) return;

            const key = e.key.toLowerCase() === e.key ? e.key : e.key;
            if (key === konamiCode[konamiIndex] || key.toLowerCase() === konamiCode[konamiIndex]) {
                konamiIndex++;
                if (konamiIndex === konamiCode.length) {
                    konamiIndex = 0;
                    triggerKonamiEasterEgg();
                }
            } else {
                konamiIndex = 0;
            }
        });
    }

    function triggerKonamiEasterEgg() {
        startSnakeGame();
    }

    // ─── Triple-Tap Easter Egg (mobile Konami alternative) ───────
    function setupTripleTapEasterEgg() {
        const terminal = document.querySelector('.terminal');
        if (!terminal) return;

        let tapCount = 0;
        let lastTapTime = 0;
        const TAP_TIMEOUT = 500; // ms between taps
        const TAP_ZONE_HEIGHT = 100; // Only trigger in top 100px of terminal

        terminal.addEventListener('touchstart', (e) => {
            // Only count taps in the header area
            const rect = terminal.getBoundingClientRect();
            const touchY = e.touches[0].clientY - rect.top;

            if (touchY > TAP_ZONE_HEIGHT) {
                tapCount = 0;
                return;
            }

            const now = Date.now();
            if (now - lastTapTime > TAP_TIMEOUT) {
                tapCount = 0;
            }

            tapCount++;
            lastTapTime = now;

            if (tapCount === 3) {
                tapCount = 0;
                // Don't trigger if already in a game or special mode
                if (!snakeGame && !vimMode && !lettersMode) {
                    triggerKonamiEasterEgg();
                }
            }
        }, { passive: true });
    }

    // ─── Snake Game ──────────────────────────────────────────────
    let snakeGame = null;
    const SNAKE_HIGH_SCORES_KEY = 'santi-wtf-snake-highscores';
    const MAX_HIGH_SCORES = 5;

    function getHighScores() {
        try {
            const scores = JSON.parse(localStorage.getItem(SNAKE_HIGH_SCORES_KEY)) || [];
            return scores.slice(0, MAX_HIGH_SCORES);
        } catch {
            return [];
        }
    }

    function saveHighScore(score) {
        if (score <= 0) return false;
        const scores = getHighScores();
        const isHighScore = scores.length < MAX_HIGH_SCORES || score > scores[scores.length - 1]?.score;

        if (isHighScore) {
            scores.push({ score, date: new Date().toLocaleDateString() });
            scores.sort((a, b) => b.score - a.score);
            localStorage.setItem(SNAKE_HIGH_SCORES_KEY, JSON.stringify(scores.slice(0, MAX_HIGH_SCORES)));
        }
        return isHighScore;
    }

    function renderHighScores() {
        const scores = getHighScores();
        if (scores.length === 0) return '';

        return `
            <div class="snake-highscores">
                <span class="highscores-title">high scores</span>
                <div class="highscores-list">
                    ${scores.map((s, i) => `<span class="highscore-entry"><span class="highscore-rank">${i + 1}.</span> ${s.score}</span>`).join('')}
                </div>
            </div>
        `;
    }

    function startSnakeGame() {
        // Hide SANTI banner, show SNAKE banner instead
        output.innerHTML = '';
        welcome.innerHTML = '';
        banner.classList.add('collapsed');
        stopIdleHintRotation();

        const gameWidth = 40;
        const gameHeight = 12;

        snakeGame = {
            width: gameWidth,
            height: gameHeight,
            snake: [{ x: Math.floor(gameWidth / 2), y: Math.floor(gameHeight / 2) }],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
            food: null,
            score: 0,
            gameOver: false,
            intervalId: null,
            speed: 150
        };

        spawnFood();

        const snakeAscii = `███████╗███╗   ██╗ █████╗ ██╗  ██╗███████╗
██╔════╝████╗  ██║██╔══██╗██║ ██╔╝██╔════╝
███████╗██╔██╗ ██║███████║█████╔╝ █████╗
╚════██║██║╚██╗██║██╔══██║██╔═██╗ ██╔══╝
███████║██║ ╚████║██║  ██║██║  ██╗███████╗
╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝`;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const controlsHint = isTouchDevice ? 'd-pad to move · esc to quit' : 'arrow keys to move · esc to quit';

        const html = `
            <div class="snake-game">
                <pre class="snake-ascii">${snakeAscii}</pre>
                <div class="snake-main">
                    <pre id="snake-board" class="snake-board"></pre>
                    <div id="snake-sidebar" class="snake-sidebar">${renderHighScores()}</div>
                </div>
                <div class="snake-footer">
                    <span class="snake-controls">${controlsHint}</span>
                    <span class="snake-score">score: <span id="snake-score">0</span></span>
                </div>
                ${isTouchDevice ? `
                <div class="snake-dpad" id="snake-dpad">
                    <button type="button" class="dpad-btn dpad-up" data-dir="up" aria-label="Move up">↑</button>
                    <button type="button" class="dpad-btn dpad-left" data-dir="left" aria-label="Move left">←</button>
                    <button type="button" class="dpad-btn dpad-center"></button>
                    <button type="button" class="dpad-btn dpad-right" data-dir="right" aria-label="Move right">→</button>
                    <button type="button" class="dpad-btn dpad-down" data-dir="down" aria-label="Move down">↓</button>
                </div>
                ` : ''}
            </div>
        `;
        output.insertAdjacentHTML('beforeend', html);

        // Setup D-pad touch controls
        if (isTouchDevice) {
            setupSnakeDpad();
        }

        renderSnakeBoard();

        // Start game loop
        snakeGame.intervalId = setInterval(updateSnake, snakeGame.speed);

        // Handle snake input
        document.addEventListener('keydown', handleSnakeInput);
    }

    function spawnFood() {
        if (!snakeGame) return;
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * snakeGame.width),
                y: Math.floor(Math.random() * snakeGame.height)
            };
        } while (snakeGame.snake.some(seg => seg.x === pos.x && seg.y === pos.y));
        snakeGame.food = pos;
    }

    function handleSnakeInput(e) {
        if (!snakeGame) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            endSnakeGame();
            return;
        }

        if (snakeGame.gameOver) {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Restart game
                document.removeEventListener('keydown', handleSnakeInput);
                startSnakeGame();
            }
            return;
        }

        const { direction } = snakeGame;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (direction.y !== 1) snakeGame.nextDirection = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (direction.y !== -1) snakeGame.nextDirection = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (direction.x !== 1) snakeGame.nextDirection = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (direction.x !== -1) snakeGame.nextDirection = { x: 1, y: 0 };
                break;
        }
    }

    function updateSnake() {
        if (!snakeGame || snakeGame.gameOver) return;

        snakeGame.direction = snakeGame.nextDirection;

        const head = snakeGame.snake[0];
        const newHead = {
            x: head.x + snakeGame.direction.x,
            y: head.y + snakeGame.direction.y
        };

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= snakeGame.width ||
            newHead.y < 0 || newHead.y >= snakeGame.height) {
            gameOver();
            return;
        }

        // Check self collision
        if (snakeGame.snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
            gameOver();
            return;
        }

        snakeGame.snake.unshift(newHead);

        // Check food collision
        if (snakeGame.food && newHead.x === snakeGame.food.x && newHead.y === snakeGame.food.y) {
            snakeGame.score += 10;
            document.getElementById('snake-score').textContent = snakeGame.score;
            spawnFood();
            // Speed up slightly
            if (snakeGame.speed > 80) {
                clearInterval(snakeGame.intervalId);
                snakeGame.speed -= 5;
                snakeGame.intervalId = setInterval(updateSnake, snakeGame.speed);
            }
        } else {
            snakeGame.snake.pop();
        }

        renderSnakeBoard();
    }

    function renderSnakeBoard() {
        if (!snakeGame) return;

        const board = document.getElementById('snake-board');
        if (!board) return;

        let display = '┌' + '─'.repeat(snakeGame.width) + '┐\n';

        for (let y = 0; y < snakeGame.height; y++) {
            display += '│';
            for (let x = 0; x < snakeGame.width; x++) {
                const isHead = snakeGame.snake[0].x === x && snakeGame.snake[0].y === y;
                const isBody = snakeGame.snake.slice(1).some(seg => seg.x === x && seg.y === y);
                const isFood = snakeGame.food && snakeGame.food.x === x && snakeGame.food.y === y;

                if (isHead) {
                    display += '◆';
                } else if (isBody) {
                    display += '●';
                } else if (isFood) {
                    display += '○';
                } else {
                    display += ' ';
                }
            }
            display += '│\n';
        }

        display += '└' + '─'.repeat(snakeGame.width) + '┘';

        board.textContent = display;
    }

    function gameOver() {
        if (!snakeGame) return;
        snakeGame.gameOver = true;
        clearInterval(snakeGame.intervalId);

        // Save and check for high score
        const isNewHighScore = saveHighScore(snakeGame.score);

        // Update controls text to show game over state
        const controls = document.querySelector('.snake-controls');
        if (controls) {
            const msg = isNewHighScore ? '<span class="snake-new-highscore">new high score!</span>' : '<span class="snake-game-over">game over!</span>';
            controls.innerHTML = `${msg} press enter to restart · esc to quit`;
        }

        // Update high scores display
        const sidebar = document.getElementById('snake-sidebar');
        if (sidebar) {
            sidebar.innerHTML = renderHighScores();
        }
    }

    function endSnakeGame() {
        if (snakeGame && snakeGame.intervalId) {
            clearInterval(snakeGame.intervalId);
        }
        document.removeEventListener('keydown', handleSnakeInput);
        snakeGame = null;
        // Restore welcome and go home
        output.innerHTML = '';
        welcome.innerHTML = '';
        banner.classList.remove('collapsed');
        isReading = false;
        typeWelcome();
        history.pushState({}, 'santi.wtf', '/');
    }

    function setupSnakeDpad() {
        const dpad = document.getElementById('snake-dpad');
        if (!dpad) return;

        const handleDpadInput = (dir) => {
            if (!snakeGame || snakeGame.gameOver) {
                if (snakeGame && snakeGame.gameOver) {
                    // Restart on any tap when game is over
                    document.removeEventListener('keydown', handleSnakeInput);
                    startSnakeGame();
                }
                return;
            }

            const { direction } = snakeGame;

            switch (dir) {
                case 'up':
                    if (direction.y !== 1) snakeGame.nextDirection = { x: 0, y: -1 };
                    break;
                case 'down':
                    if (direction.y !== -1) snakeGame.nextDirection = { x: 0, y: 1 };
                    break;
                case 'left':
                    if (direction.x !== 1) snakeGame.nextDirection = { x: -1, y: 0 };
                    break;
                case 'right':
                    if (direction.x !== -1) snakeGame.nextDirection = { x: 1, y: 0 };
                    break;
            }
        };

        dpad.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleDpadInput(btn.dataset.dir);
            }, { passive: false });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                handleDpadInput(btn.dataset.dir);
            });
        });
    }

    // ─── Mobile Command Palette ───────────────────────────────────
    function setupCommandPalette() {
        if (!commandPalette) return;

        const moreMenu = createMoreMenu();
        document.body.appendChild(moreMenu);

        commandPalette.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const cmd = btn.dataset.cmd;
            if (cmd === 'more') {
                toggleMoreMenu(moreMenu);
            } else if (cmd === 'search') {
                // Focus input and prompt for search
                input.focus();
                input.value = 'search ';
                hideMoreMenu(moreMenu);
            } else {
                await execute(cmd);
                hideMoreMenu(moreMenu);
            }
        });
    }

    function createMoreMenu() {
        const menu = document.createElement('div');
        menu.className = 'more-menu';
        menu.innerHTML = `
            <div class="more-menu-grid">
                <button type="button" data-cmd="recent">recent</button>
                <button type="button" data-cmd="now">now</button>
                <button type="button" data-cmd="about">about</button>
                <button type="button" data-cmd="help">help</button>
                <button type="button" data-cmd="home">home</button>
                <button type="button" data-cmd="matrix">matrix</button>
            </div>
        `;

        menu.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            await execute(btn.dataset.cmd);
            hideMoreMenu(menu);
        });

        return menu;
    }

    function toggleMoreMenu(menu) {
        moreMenuVisible = !moreMenuVisible;
        menu.classList.toggle('visible', moreMenuVisible);
    }

    function hideMoreMenu(menu) {
        moreMenuVisible = false;
        menu.classList.remove('visible');
    }

    // ─── Swipe Gestures ───────────────────────────────────────────
    function setupSwipeGestures() {
        let startX = 0;
        let startY = 0;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = endY - startY;

            // Only trigger if horizontal swipe is dominant
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0 && isReading) {
                    // Swipe right = go back
                    goHome();
                }
            }
        }, { passive: true });
    }

    // ─── Helpers ──────────────────────────────────────────────────
    function triggerCmdFlash() {
        const inner = document.querySelector('.terminal-inner');
        if (inner && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            inner.classList.remove('cmd-flash');
            // Force reflow to restart animation
            void inner.offsetWidth;
            inner.classList.add('cmd-flash');
            setTimeout(() => inner.classList.remove('cmd-flash'), 300);
        }
    }

    function echo(cmd) {
        output.insertAdjacentHTML('beforeend', `
            <div class="cmd-echo"><span class="prompt">~$</span> ${escapeHtml(cmd)}</div>
        `);
    }

    function print(text, className = 'system-msg') {
        output.insertAdjacentHTML('beforeend', `
            <p class="${className}">${escapeHtml(text)}</p>
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
                await loadNote(a.dataset.slug);
            });
        });
    }

    function bindBodyLinks() {
        output.querySelectorAll('.note-body a.wikilink').forEach(a => {
            a.addEventListener('click', async e => {
                e.preventDefault();
                const noteId = a.dataset.note;
                const note = notesList.find(n => n.slug === noteId || n.path === noteId);
                if (note) {
                    await loadNote(note.slug);
                }
            });
        });
    }

    function autocomplete() {
        const val = input.value.toLowerCase();
        if (!val) return;

        // Check if we're completing after a command
        const parts = val.split(/\s+/);
        const cmd = parts[0];
        const arg = parts.slice(1).join(' ');

        // If command + partial arg, autocomplete the note title
        if (['cat', 'read', 'open', 'go', 'search', 'find', 'grep'].includes(cmd) && parts.length > 1) {
            const noteMatch = notesList.find(n => n.title.toLowerCase().startsWith(arg));
            if (noteMatch) {
                input.value = `${cmd} ${noteMatch.title.toLowerCase()}`;
            }
            return;
        }

        // Try commands first
        const cmds = ['help', 'explore', 'recent', 'random', 'search', 'cat', 'now', 'about', 'home', 'matrix'];
        const cmdMatch = cmds.find(c => c.startsWith(val));
        if (cmdMatch) {
            input.value = cmdMatch;
            return;
        }

        // Try note titles directly
        const noteMatch = notesList.find(n => n.title.toLowerCase().startsWith(val));
        if (noteMatch) {
            input.value = noteMatch.title.toLowerCase();
        }
    }

    function findNote(name) {
        const lower = name.toLowerCase().replace(/\s+/g, '-');
        return notesList.find(n =>
            n.title.toLowerCase() === lower ||
            n.title.toLowerCase().replace(/\s+/g, '-') === lower ||
            n.slug === lower ||
            n.slug === name ||
            n.title.toLowerCase().startsWith(lower)
        );
    }

    function pathToSlug(path) {
        // Extract just the filename, strip folder prefix
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        return filename
            .replace(/\s+/g, '-')
            .toLowerCase();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (days === 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo ago`;
        return `${Math.floor(days / 365)}y ago`;
    }

    function stageEmoji(stage) {
        switch (stage) {
            case 'seedling': return '🌱';
            case 'growing': return '🌿';
            case 'evergreen': return '🌲';
            default: return '🌱';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        if (!text) return '';
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ─── Browser History ──────────────────────────────────────────
    window.addEventListener('popstate', async (e) => {
        if (e.state && e.state.slug) {
            await loadNote(e.state.slug);
        } else {
            goHome();
        }
    });

    // ─── Start ────────────────────────────────────────────────────
    init();
})();
