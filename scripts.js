        let activeWindow = null;
        let draggedWindow = null;
        let offsetX = 0;
        let offsetY = 0;

        // Resize variables
        let resizedWindow = null;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        // Track minimized and open windows
        const minimizedWindows = new Set();
        const openWindows = new Set();

        // ==========================================
        // SITE UPDATES (Firebase-backed)
        // ==========================================
        const defaultSiteUpdates = [
            { date: "january 19, 2026", text: "added habit tracker to the desktop" },
            { date: "january 18, 2026", text: "added updates window to the desktop" },
            { date: "january 14, 2026", text: "added pomodoro timer application" },
            { date: "january 10, 2026", text: "new blog post: 10 reasons why you should start writing online" },
            { date: "january 7, 2026", text: "launched chat" },
            { date: "january 5, 2026", text: "added flow garden and sticky notes applications" },
            { date: "january 1, 2026", text: "launched this website 🥂" },
        ];
        let siteUpdates = [...defaultSiteUpdates];

        function initUpdates() {
            if (!window.db) {
                setTimeout(initUpdates, 100);
                return;
            }
            window.db.ref('updates').on('value', (snapshot) => {
                const data = snapshot.val();
                console.log('Firebase updates data:', data);
                if (data) {
                    // Convert from Firebase object to array if needed
                    siteUpdates = Array.isArray(data) ? data : Object.values(data);
                    console.log('Loaded updates:', siteUpdates);
                } else {
                    console.log('No data, initializing with defaults');
                    // Initialize Firebase with defaults
                    window.db.ref('updates').set(defaultSiteUpdates);
                }
                if (document.getElementById('updates').style.display === 'block') {
                    renderUpdates();
                }
            });
        }

        function saveUpdates() {
            console.log('Saving updates:', JSON.stringify(siteUpdates));
            return window.db.ref('updates').set(siteUpdates).then(() => {
                console.log('Updates saved successfully');
            }).catch(err => {
                console.error('Save failed:', err);
                alert('failed to save: ' + err.message);
            });
        }

        function addUpdate(text) {
            if (!isAdminMode || !text.trim()) return;
            const today = new Date();
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                               'july', 'august', 'september', 'october', 'november', 'december'];
            const date = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
            siteUpdates.unshift({ date, text: text.trim() });
            saveUpdates();
        }

        function deleteUpdate(index) {
            if (!isAdminMode) return;
            if (!confirm('delete this update?')) return;
            siteUpdates.splice(index, 1);
            saveUpdates();
        }

        function editUpdate(index) {
            if (!isAdminMode) return;
            const newText = prompt('edit update:', siteUpdates[index].text);
            if (newText === null) return;
            if (!newText.trim()) {
                deleteUpdate(index);
                return;
            }
            siteUpdates[index].text = newText.trim();
            saveUpdates();
        }

        // ==========================================
        // HABIT TRACKER DATA (Firebase-backed)
        // ==========================================
        const defaultHabitData = [
            { name: "meditation", completed: [1,2,3,4,5,6,7,8,9,10,11,12,13,14] },
            { name: "sleep", completed: [1,2,3,4,5,6,7,8,9,10,11,12,13] },
            { name: "movement", completed: [1,2,3,4,5,6,7,8,9,10,11,12,13,14] },
            { name: "reading", completed: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19] },
            { name: "writing", completed: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19] },
        ];
        let habitData = [...defaultHabitData];

        function initHabits() {
            if (!window.db) {
                setTimeout(initHabits, 100);
                return;
            }
            window.db.ref('habits').on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    // Convert from Firebase object to array if needed
                    habitData = Array.isArray(data) ? data : Object.values(data);
                    // Also convert completed arrays within each habit
                    habitData = habitData.map(h => ({
                        ...h,
                        completed: Array.isArray(h.completed) ? h.completed : (h.completed ? Object.values(h.completed) : [])
                    }));
                } else {
                    // Initialize Firebase with defaults
                    window.db.ref('habits').set(defaultHabitData);
                }
                if (document.getElementById('habits').style.display === 'block') {
                    renderHabitTracker();
                }
            });
        }

        function saveHabits() {
            return window.db.ref('habits').set(habitData).catch(err => {
                alert('failed to save: ' + err.message);
            });
        }

        function toggleHabitDay(habitIndex, dayOfYear) {
            if (!isAdminMode) return;
            const habit = habitData[habitIndex];
            const idx = habit.completed.indexOf(dayOfYear);
            if (idx === -1) {
                habit.completed.push(dayOfYear);
            } else {
                habit.completed.splice(idx, 1);
            }
            saveHabits();
        }

        function addHabit(name) {
            if (!isAdminMode || !name.trim()) return;
            habitData.push({ name: name.trim().toLowerCase(), completed: [] });
            saveHabits();
        }

        function editHabit(index) {
            if (!isAdminMode) return;
            const newName = prompt('edit habit name:', habitData[index].name);
            if (newName === null) return;
            if (!newName.trim()) {
                deleteHabit(index);
                return;
            }
            habitData[index].name = newName.trim().toLowerCase();
            saveHabits();
        }

        function deleteHabit(index) {
            if (!isAdminMode) return;
            if (!confirm('delete this habit?')) return;
            habitData.splice(index, 1);
            saveHabits();
        }

        function openWindow(id) {
            const win = document.getElementById(id);
            win.style.display = 'block';
            openWindows.add(id);
            minimizedWindows.delete(id);
            setActiveWindow(id);
            updateTaskbar();
            closeStartMenu();

            // Load content for app windows
            if (id === 'flowgarden') {
                loadFlowGarden();
            } else if (id === 'stickynotes') {
                loadStickyNotes();
            } else if (id === 'pomodoro') {
                loadPomodoro();
            } else if (id === 'updates') {
                renderUpdates();
            } else if (id === 'habits') {
                renderHabitTracker();
            }
        }

        function minimizeWindow(id) {
            const win = document.getElementById(id);
            win.style.display = 'none';
            minimizedWindows.add(id);
            win.classList.remove('active');
            activeWindow = null;
            updateTaskbar();
        }

        function restoreWindow(id) {
            const win = document.getElementById(id);
            win.style.display = 'block';
            minimizedWindows.delete(id);
            setActiveWindow(id);
            updateTaskbar();
        }

        function closeWindow(id) {
            const win = document.getElementById(id);
            win.style.display = 'none';
            openWindows.delete(id);
            minimizedWindows.delete(id);
            updateTaskbar();

        }

        function setActiveWindow(id) {
            document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
            const win = document.getElementById(id);
            win.classList.add('active');
            activeWindow = id;
        }

        function updateTaskbar() {
            const container = document.getElementById('taskbar-items');
            container.innerHTML = '';

            document.querySelectorAll('.window').forEach(win => {
                const isVisible = win.style.display === 'block';
                const isMinimized = minimizedWindows.has(win.id);

                if (isVisible || isMinimized) {
                    const item = document.createElement('div');
                    item.className = 'taskbar-item';
                    if (win.classList.contains('active')) item.classList.add('active');

                    // Get icon and title
                    const iconImg = win.querySelector('.title-icon img');
                    const iconSrc = iconImg ? iconImg.src : '';
                    let title = win.querySelector('.title-text span').textContent;

                    // Truncate long titles
                    const maxLength = 15;
                    if (title.length > maxLength) {
                        title = title.substring(0, maxLength) + '...';
                    }

                    item.innerHTML = `<img src="${iconSrc}" alt="" class="taskbar-icon">${title}`;

                    item.onclick = () => {
                        if (minimizedWindows.has(win.id)) {
                            restoreWindow(win.id);
                        } else {
                            setActiveWindow(win.id);
                        }
                    };
                    container.appendChild(item);
                }
            });
        }

        function toggleStartMenu() {
            document.getElementById('start-menu').classList.toggle('open');
        }

        function closeStartMenu() {
            document.getElementById('start-menu').classList.remove('open');
        }

        // Shut Down Dialog (Newsletter Easter Egg)
        const subscribeMessages = {
            shutdown: "<strong>Wait! Before you go...</strong><br>Subscribe to get my latest thoughts delivered straight to your inbox.",
            clippy: "<strong>Great choice!</strong><br>Enter your email to get my latest posts.",
            newsletter: "<strong>Stay connected</strong><br>Get my latest posts delivered straight to your inbox."
        };

        function openShutdownDialog(source = 'shutdown') {
            closeStartMenu();
            document.getElementById('subscribe-message').innerHTML = subscribeMessages[source];
            document.getElementById('subscribe-dialog-title').textContent = source === 'shutdown' ? 'Shut Down' : 'Newsletter';
            document.getElementById('subscribe-dialog-icon').innerHTML = source === 'shutdown'
                ? '<img src="icons/shut_down_normal-1.png" alt="">'
                : '<img src="icons/envelope_closed-1.png" alt="">';
            document.getElementById('shutdown-overlay').classList.add('open');
        }

        function openSubscribeDialog() {
            openShutdownDialog('newsletter');
        }

        function closeShutdownDialog(event) {
            // If called from overlay click, only close if clicking the overlay itself
            if (event && event.currentTarget && event.target !== event.currentTarget) return;
            document.getElementById('shutdown-overlay').classList.remove('open');
        }

        // Clippy Assistant
        let clippyDismissed = sessionStorage.getItem('clippyDismissed');
        let clippyBubbleVisible = true;

        function initClippy() {
            if (clippyDismissed) return;

            // Show Clippy after 15 seconds
            setTimeout(() => {
                document.getElementById('clippy').classList.add('show');
            }, 15000);
        }

        function dismissClippy() {
            document.getElementById('clippy').classList.remove('show');
            sessionStorage.setItem('clippyDismissed', 'true');
            clippyDismissed = true;
        }

        function toggleClippyBubble() {
            const bubble = document.querySelector('.clippy-bubble');
            clippyBubbleVisible = !clippyBubbleVisible;
            bubble.style.display = clippyBubbleVisible ? 'block' : 'none';
        }

        function clippySubscribe() {
            dismissClippy();
            openShutdownDialog('clippy');
        }

        // Initialize Clippy on page load
        document.addEventListener('DOMContentLoaded', initClippy);

        function dragStart(e, id) {
            draggedWindow = document.getElementById(id);
            setActiveWindow(id);
            
            const rect = draggedWindow.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }

        function drag(e) {
            if (!draggedWindow) return;
            
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            
            draggedWindow.style.left = Math.max(0, x) + 'px';
            draggedWindow.style.top = Math.max(0, y) + 'px';
        }

        function dragEnd() {
            draggedWindow = null;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', dragEnd);
        }

        // Window resize functions
        function resizeStart(e, id) {
            e.stopPropagation();
            resizedWindow = document.getElementById(id);
            setActiveWindow(id);
            
            startX = e.clientX;
            startY = e.clientY;
            startWidth = resizedWindow.offsetWidth;
            startHeight = resizedWindow.offsetHeight;
            
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', resizeEnd);
        }

        function resize(e) {
            if (!resizedWindow) return;
            
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            
            // Enforce minimum sizes
            if (width >= 400) {
                resizedWindow.style.width = width + 'px';
            }
            if (height >= 200) {
                resizedWindow.style.height = height + 'px';
            }
        }

        function resizeEnd() {
            resizedWindow = null;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', resizeEnd);
        }

        // Click outside start menu to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.start-btn') && !e.target.closest('.start-menu')) {
                closeStartMenu();
            }
        });

        // Browser history for navigation
        let browserHistory = [];
        let historyPosition = -1;

        // Store the home content
        const homeContent = `
            <div class="post">
                <h1>santi.wtf</h1>
                <p style="text-align: center; margin-bottom: 20px;">
                    <a href="/now" onclick="loadPost('now.html'); return false;">now</a> | <a href="/notes" onclick="loadArchive(); return false;">notes</a> | <a href="https://mail.0ffbrand.com" target="_blank">newsletter</a>
                </p>
                <h2>welcome, friend. shoes off, please.</h2>
                <p>i built this site because i miss the internet. the one before the apps. i miss the weird little corners of the web where people shared their thoughts, art, and creativity freely. the internet before social media algorithms.</p>
                <p>i miss that internet.</p>
                <p>so i made a little corner of my own to share my thoughts, feelings, and projects. away from all the noise. away from algorithms, gurus, and ads. just me, my words, and now, you.</p>
                <p>a little bit about me: i'm santi — i study the greatest creative minds, run a <a href="https://mail.0ffbrand.com" target="_blank">weekly letter</a> about them, and spend my days slinging software. when i'm not working, you'll find me reading, <a href="/notes" onclick="loadArchive(); return false;">writing</a>, or <a href="https://www.chess.com/member/sawnts" target="_blank">pushing pawns</a>.</p>
                <p>enjoy your stay, and come back soon — and as often as you'd like. don't forget to say hi in the <a href="#" onclick="openWindow('chat'); return false;">chat</a> on your way out.</p>
                <p>p.s. even though the site works pretty well on mobile, you'll have a lot more fun viewing it on your computer.</p>
                <p style="font-family: monospace; margin-top: 1.5em;">&lt;3 <a href="mailto:yosawnts@gmail.com">santi</a></p>
            </div>
        `;

        // Archive content
        const archiveContent = `
            <div class="post">
                <h1>santi.wtf</h1>
                <p style="text-align: center; margin-bottom: 20px;">
                    <a href="/now" onclick="loadPost('now.html'); return false;">now</a> | <a href="/notes" onclick="loadArchive(); return false;">notes</a> | <a href="https://mail.0ffbrand.com" target="_blank">newsletter</a>
                </p>

                <h2>notes</h2>
                <p>on creativity, philosophy, business, life, and so on.</p>

                <h3 style="margin-top: 30px;">2026</h3>
                <ul>
                    <li><a href="/power-of-writing-online" onclick="loadPost('posts/power-of-writing-online.html'); return false;">10 reasons why you should start writing online</a></li>
                    <li><a href="/favorite-reads-2025" onclick="loadPost('posts/favorite-reads-2025.html'); return false;">my favorite reads of 2025</a></li>
                </ul>
            </div>
        `;

        // Load home content
        function loadHome(updateUrl = true) {
            const content = document.getElementById('blog-content');
            if (content) {
                content.innerHTML = homeContent;
                content.scrollTop = 0;

                // Update URL
                if (updateUrl) {
                    history.pushState(null, '', '/');
                    updateAddressBar('https://santi.wtf');
                }

                // Add to history
                addToHistory('home', homeContent);
            }
        }

        // Load archive page
        function loadArchive(updateUrl = true) {
            const content = document.getElementById('blog-content');
            if (content) {
                content.innerHTML = archiveContent;
                content.scrollTop = 0;

                // Update URL
                if (updateUrl) {
                    history.pushState(null, '', '/notes');
                    updateAddressBar('https://santi.wtf/notes');
                }

                // Add to history
                addToHistory('archive', archiveContent);
            }
        }

        // Update address bar display
        function updateAddressBar(url) {
            const addressBar = document.querySelector('.address-bar');
            if (addressBar) {
                addressBar.textContent = 'Address: ' + url;
            }
        }

        // Load Flow Garden content
        async function loadFlowGarden() {
            const content = document.getElementById('flowgarden-content');
            if (!content || content.dataset.loaded === 'true') return;

            try {
                const response = await fetch('applications/flowgarden.html');
                const html = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const body = doc.querySelector('body');
                const styles = doc.querySelectorAll('style');
                const scripts = doc.querySelectorAll('script');

                if (body) {
                    // Inject styles first, then body content
                    let styleHTML = '';
                    styles.forEach(style => { styleHTML += style.outerHTML; });
                    content.innerHTML = styleHTML + body.innerHTML;

                    // Execute scripts manually (innerHTML doesn't execute scripts)
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        newScript.textContent = oldScript.textContent;
                        content.appendChild(newScript);
                    });

                    content.dataset.loaded = 'true';
                }
            } catch (error) {
                content.innerHTML = '<p>Error loading Flow Garden.</p>';
                console.error('Error loading Flow Garden:', error);
            }
        }

        // Load Sticky Notes content
        async function loadStickyNotes() {
            const content = document.getElementById('stickynotes-content');
            if (!content || content.dataset.loaded === 'true') return;

            try {
                const response = await fetch('applications/stickynotes.html');
                const html = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const body = doc.querySelector('body');
                const styles = doc.querySelectorAll('style');
                const scripts = doc.querySelectorAll('script');

                if (body) {
                    let styleHTML = '';
                    styles.forEach(style => { styleHTML += style.outerHTML; });
                    content.innerHTML = styleHTML + body.innerHTML;

                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        newScript.textContent = oldScript.textContent;
                        content.appendChild(newScript);
                    });

                    content.dataset.loaded = 'true';
                }
            } catch (error) {
                content.innerHTML = '<p>Error loading Sticky Notes.</p>';
                console.error('Error loading Sticky Notes:', error);
            }
        }

        // Load Pomodoro Timer content
        async function loadPomodoro() {
            const content = document.getElementById('pomodoro-content');
            if (!content || content.dataset.loaded === 'true') return;

            try {
                const response = await fetch('applications/pomodoro.html');
                const html = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const body = doc.querySelector('body');
                const styles = doc.querySelectorAll('style');
                const scripts = doc.querySelectorAll('script');

                if (body) {
                    let styleHTML = '';
                    styles.forEach(style => { styleHTML += style.outerHTML; });
                    content.innerHTML = styleHTML + body.innerHTML;

                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        newScript.textContent = oldScript.textContent;
                        content.appendChild(newScript);
                    });

                    content.dataset.loaded = 'true';
                }
            } catch (error) {
                content.innerHTML = '<p>Error loading Pomodoro Timer.</p>';
                console.error('Error loading Pomodoro Timer:', error);
            }
        }

        // Render Updates window content
        function renderUpdates() {
            const content = document.getElementById('updates-content');
            if (!content) return;

            const adminForm = isAdminMode ? `
                <div class="update-admin-form">
                    <input type="text" id="new-update-text" class="update-admin-input" placeholder="new update...">
                    <button class="update-admin-btn" onclick="addUpdate(document.getElementById('new-update-text').value); document.getElementById('new-update-text').value = '';">post</button>
                </div>
            ` : '';

            const updatesHTML = siteUpdates.map((update, index) => {
                const adminButtons = isAdminMode ? `
                    <span class="update-admin-actions">
                        <button class="update-edit-btn" onclick="editUpdate(${index})">edit</button>
                        <button class="update-delete-btn" onclick="deleteUpdate(${index})">×</button>
                    </span>
                ` : '';
                return `
                    <div class="update-entry">
                        <div class="update-date">${update.date}${adminButtons}</div>
                        <div class="update-text">${update.text}</div>
                    </div>
                `;
            }).join('');

            content.innerHTML = adminForm + updatesHTML;
        }

        function renderHabitTracker() {
            const content = document.getElementById('habits-content');
            if (!content) return;

            const habits = habitData;
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            const startOfYear = new Date(currentYear, 0, 1);
            const todayDayOfYear = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
            const todayDate = today.getDate();

            // Calculate streak
            function getStreak(completed) {
                let streak = 0;
                let checkDay = todayDayOfYear;

                // If today isn't completed, start checking from yesterday
                if (!completed.includes(todayDayOfYear)) {
                    checkDay = todayDayOfYear - 1;
                }

                while (checkDay > 0 && completed.includes(checkDay)) {
                    streak++;
                    checkDay--;
                }
                return streak;
            }

            // Build HTML for each habit
            const habitsHTML = habits.map((habit, habitIndex) => {
                // Count completed days this year
                const completedThisYear = habit.completed.filter(d => d <= todayDayOfYear).length;
                const percentage = Math.round((completedThisYear / 365) * 100);
                const streak = getStreak(habit.completed);
                const isTodayDone = habit.completed.includes(todayDayOfYear);

                const adminButton = isAdminMode ? `
                    <a href="#" class="habit-today-link ${isTodayDone ? 'done' : ''}" onclick="toggleHabitDay(${habitIndex}, ${todayDayOfYear}); return false;">
                        ${isTodayDone ? '✓ done' : 'mark today'}
                    </a>
                ` : '';

                const adminActions = isAdminMode ? `
                    <span class="habit-admin-actions">
                        <button class="habit-edit-btn" onclick="editHabit(${habitIndex})">edit</button>
                        <button class="habit-delete-btn" onclick="deleteHabit(${habitIndex})">×</button>
                    </span>
                ` : '';

                const streakEmoji = streak > 0 ? ' 🔥' : '';

                return `
                    <div class="habit-section">
                        <div class="habit-header">
                            <span class="habit-name">${habit.name}${streakEmoji}${adminActions}</span>
                            <span class="habit-streak">${streak > 0 ? streak + ' day streak' : ''}</span>
                        </div>
                        <div class="habit-progress-row">
                            <div class="habit-progress-bar">
                                <div class="habit-progress-fill" style="width: ${percentage}%;"></div>
                            </div>
                            <span class="habit-percentage">${percentage}%</span>
                        </div>
                        <div class="habit-stats">
                            <span class="habit-month-stat">${completedThisYear}/365 in ${currentYear}</span>
                            ${adminButton}
                        </div>
                    </div>
                `;
            }).join('');

            const adminForm = isAdminMode ? `
                <div class="habit-admin-form">
                    <input type="text" id="new-habit-name" class="habit-admin-input" placeholder="new habit...">
                    <a href="#" class="habit-admin-link" onclick="addHabit(document.getElementById('new-habit-name').value); document.getElementById('new-habit-name').value = ''; return false;">add</a>
                </div>
            ` : '';

            // Build yearly heat map - 365 squares vertical
            const totalHabits = habits.length;
            let heatmapDots = '';
            for (let day = 1; day <= 365; day++) {
                if (day > todayDayOfYear) {
                    heatmapDots += `<div class="heatmap-dot future" title="day ${day}"></div>`;
                } else {
                    let completedCount = 0;
                    habits.forEach(h => {
                        if (h.completed.includes(day)) completedCount++;
                    });
                    const intensity = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 4) : 0;
                    heatmapDots += `<div class="heatmap-dot level-${intensity}" title="day ${day}: ${completedCount}/${totalHabits}"></div>`;
                }
            }

            const currentTab = window.habitTab || 'habits';

            const tabsHTML = `
                <div class="habit-tabs">
                    <a href="#" class="habit-tab ${currentTab === 'habits' ? 'active' : ''}" onclick="window.habitTab='habits'; renderHabitTracker(); return false;">habits</a>
                    <span class="habit-tab-sep">|</span>
                    <a href="#" class="habit-tab ${currentTab === 'year' ? 'active' : ''}" onclick="window.habitTab='year'; renderHabitTracker(); return false;">year</a>
                </div>
            `;

            const yearViewHTML = `
                <div class="habit-year-view">
                    <div class="heatmap-grid-vertical">${heatmapDots}</div>
                    <div class="heatmap-legend">
                        <span>less</span>
                        <div class="heatmap-dot level-0"></div>
                        <div class="heatmap-dot level-1"></div>
                        <div class="heatmap-dot level-2"></div>
                        <div class="heatmap-dot level-3"></div>
                        <div class="heatmap-dot level-4"></div>
                        <span>more</span>
                    </div>
                </div>
            `;

            const contentHTML = currentTab === 'year' ? yearViewHTML : (adminForm + habitsHTML);
            content.innerHTML = tabsHTML + contentHTML;
        }

        // Load a blog post
        async function loadPost(url, updateUrl = true) {
            const content = document.getElementById('blog-content');
            if (!content) return;

            try {
                const response = await fetch(url);
                const html = await response.text();

                // Extract styles and body content from the post
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const styles = doc.querySelectorAll('style');
                const body = doc.querySelector('body');

                if (body) {
                    // Replace "back to desktop" links with "back to home" that works in-window
                    let postContent = '';

                    // Add styles first
                    styles.forEach(style => { postContent += style.outerHTML; });

                    // Add body content
                    postContent += body.innerHTML;
                    postContent = postContent.replace(/← back to desktop/g, '← back to home');
                    postContent = postContent.replace(/href="\.\.\/index\.html"/g, 'href="/" onclick="loadHome(); return false;"');

                    content.innerHTML = postContent;
                    content.scrollTop = 0;

                    // Update URL
                    if (updateUrl) {
                        // Handle root-level pages vs posts
                        if (url === 'now.html') {
                            history.pushState(null, '', '/now');
                            updateAddressBar('https://santi.wtf/now');
                        } else {
                            const postName = url.replace('posts/', '').replace('.html', '');
                            history.pushState(null, '', '/' + postName);
                            updateAddressBar('https://santi.wtf/' + postName);
                        }
                    }

                    // Add to history
                    addToHistory(url, postContent);
                } else {
                    content.innerHTML = '<p>Error loading post.</p>';
                }
            } catch (error) {
                content.innerHTML = '<p>Error loading post. Make sure the file exists in the posts folder.</p>';
                console.error('Error loading post:', error);
            }
        }

        // Add page to browser history
        function addToHistory(url, content) {
            // If we're not at the end of history, remove everything after current position
            if (historyPosition < browserHistory.length - 1) {
                browserHistory = browserHistory.slice(0, historyPosition + 1);
            }
            
            browserHistory.push({ url, content });
            historyPosition = browserHistory.length - 1;
        }

        // Navigate back
        function goBack() {
            if (historyPosition > 0) {
                historyPosition--;
                const page = browserHistory[historyPosition];
                const content = document.getElementById('blog-content');
                if (content) {
                    content.innerHTML = page.content;
                    content.scrollTop = 0;
                    updateUrlForPage(page.url);
                }
            }
        }

        // Navigate forward
        function goForward() {
            if (historyPosition < browserHistory.length - 1) {
                historyPosition++;
                const page = browserHistory[historyPosition];
                const content = document.getElementById('blog-content');
                if (content) {
                    content.innerHTML = page.content;
                    content.scrollTop = 0;
                    updateUrlForPage(page.url);
                }
            }
        }

        // Update URL based on page type
        function updateUrlForPage(pageUrl) {
            if (pageUrl === 'home') {
                history.replaceState(null, '', '/');
                updateAddressBar('https://santi.wtf');
            } else if (pageUrl === 'archive') {
                history.replaceState(null, '', '/notes');
                updateAddressBar('https://santi.wtf/notes');
            } else if (pageUrl === 'now.html') {
                history.replaceState(null, '', '/now');
                updateAddressBar('https://santi.wtf/now');
            } else {
                const postName = pageUrl.replace('posts/', '').replace('.html', '');
                history.replaceState(null, '', '/' + postName);
                updateAddressBar('https://santi.wtf/' + postName);
            }
        }

        // Stop loading (placeholder for now)
        function stopLoading() {
            // In a real browser this would stop page loading
            // For now, just a visual feedback
            // Stop loading (no-op, page already loaded)
        }

        // Refresh current page
        function refreshPage() {
            if (historyPosition >= 0 && browserHistory[historyPosition]) {
                const page = browserHistory[historyPosition];
                if (page.url === 'home') {
                    loadHome();
                    historyPosition--; // loadHome adds to history, so adjust
                } else if (page.url === 'archive') {
                    loadArchive();
                    historyPosition--;
                } else {
                    loadPost(page.url);
                    historyPosition--;
                }
            } else {
                loadHome();
            }
        }

        // Handle pathname-based routing
        function handleRoute() {
            // Check for 404 redirect from sessionStorage
            let path = sessionStorage.getItem('redirect');
            if (path) {
                sessionStorage.removeItem('redirect');
            } else {
                path = window.location.pathname;
            }

            // Remove leading slash
            path = path.replace(/^\//, '');

            if (!path || path === '' || path === 'index.html') {
                loadHome(false);
            } else if (path === 'notes' || path === 'archive') {
                loadArchive(false);
            } else if (path === 'now') {
                loadPost('now.html', false);
            } else if (path === 'player') {
                // Direct link to player
                loadHome(false);
                openWindow('player');
            } else {
                // Assume it's a post slug
                loadPost('posts/' + path + '.html', false);
            }
        }

        // Listen for browser back/forward navigation
        window.addEventListener('popstate', handleRoute);

        // Open IE on load and route based on URL
        window.onload = () => {
            openWindow('internet');
            handleRoute(); // Load page based on URL
            updateClock(); // Set initial time
            setInterval(updateClock, 1000); // Update every second
        };

        // Update the clock
        function updateClock() {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 should be 12
            
            const timeString = `${hours}:${minutes} ${ampm}`;
            document.getElementById('clock').textContent = timeString;
        }

        // ==========================================
        // FIREBASE CHAT ROOM
        // ==========================================

        const firebaseConfig = {
            apiKey: "AIzaSyDUcoZ437gcv8w99atWiMixK4ebvpxHwCw",
            authDomain: "santi-guestbook.firebaseapp.com",
            databaseURL: "https://santi-guestbook-default-rtdb.firebaseio.com",
            projectId: "santi-guestbook",
            storageBucket: "santi-guestbook.firebasestorage.app",
            messagingSenderId: "456705609062",
            appId: "1:456705609062:web:2a0feac46c2692bff9cca7"
        };

        window.db = null;

        function initFirebase() {
            if (typeof firebase === 'undefined') {
                setTimeout(initFirebase, 100);
                return;
            }
            try {
                firebase.initializeApp(firebaseConfig);
                window.db = firebase.database();
                initChatRoom();
                initHabits();
                initUpdates();
            } catch (e) {
                console.error('Firebase init failed:', e);
                document.getElementById('chat-messages').innerHTML =
                    '<div style="text-align: center; color: #666; padding: 20px;">chat coming soon!</div>';
            }
        }

        initFirebase();

        function initChatRoom() {
            // Listen for status updates
            window.db.ref('status').on('value', (snapshot) => {
                const status = snapshot.val() || { type: 'online', message: 'welcome to my corner of the internet', lastSeen: Date.now() };
                const indicator = document.getElementById('status-indicator');
                const messageEl = document.getElementById('status-message');
                const lastSeenEl = document.getElementById('status-lastseen');

                indicator.className = 'chat-status-indicator ' + (status.type || 'online');
                messageEl.textContent = status.message || 'welcome to my corner of the internet';
                lastSeenEl.textContent = 'last seen: ' + getRelativeTime(status.lastSeen || Date.now());
            });

            // Listen for chat messages
            const messagesRef = window.db.ref('guestbook').orderByChild('timestamp').limitToLast(100);
            messagesRef.on('value', (snapshot) => {
                const messagesContainer = document.getElementById('chat-messages');
                const messages = [];
                snapshot.forEach((child) => { messages.push({ id: child.key, ...child.val() }); });

                if (messages.length === 0) {
                    messagesContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">be the first to say something!</div>';
                    return;
                }

                messagesContainer.innerHTML = messages.map(msg => {
                    const isOwner = msg.isOwner === true;
                    const bubbleClass = isOwner ? 'owner' : 'visitor';
                    const name = isOwner ? 'santi' : escapeHtml(msg.name || 'anon');
                    return `
                        <div class="chat-bubble ${bubbleClass}">
                            <button class="chat-delete" onclick="deleteMessage('${msg.id}')">×</button>
                            <div class="chat-bubble-header">
                                <span class="chat-bubble-name">${name}</span>
                                <span class="chat-bubble-time">${getRelativeTime(msg.timestamp)}</span>
                            </div>
                            <div class="chat-bubble-text">${escapeHtml(msg.message)}</div>
                        </div>
                    `;
                }).join('');

                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });

        }

        function submitChat() {
            const nameInput = document.getElementById('chat-name');
            const messageInput = document.getElementById('chat-message');
            const message = messageInput.value.trim();
            if (!message) return;

            window.db.ref('guestbook').push({
                name: nameInput.value.trim() || 'anon',
                message: message,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isOwner: false
            }).then(() => {
                messageInput.value = '';
            }).catch(error => {
                console.error('Error posting message:', error);
            });
        }

        function getRelativeTime(timestamp) {
            if (!timestamp) return 'just now';
            const now = Date.now();
            const diff = now - timestamp;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (seconds < 60) return 'just now';
            if (minutes < 60) return minutes + 'm ago';
            if (hours < 24) return hours + 'h ago';
            if (days < 7) return days + 'd ago';
            return new Date(timestamp).toLocaleDateString();
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // ==========================================
        // CHAT ADMIN MODE
        // ==========================================

        const ADMIN_PASSWORD = 'wtf123';
        let isAdminMode = false;
        let clickCount = 0;
        let clickTimer = null;

        document.querySelector('#updates .title-bar').addEventListener('click', (e) => {
            clickCount++;
            if (clickCount === 3) {
                clickCount = 0;
                clearTimeout(clickTimer);
                toggleAdminMode();
            } else {
                clearTimeout(clickTimer);
                clickTimer = setTimeout(() => { clickCount = 0; }, 500);
            }
        });

        function toggleAdminMode() {
            if (!isAdminMode) {
                const password = prompt('enter admin password:');
                if (password === ADMIN_PASSWORD) {
                    isAdminMode = true;
                    document.getElementById('updates').classList.add('admin-mode');
                    document.getElementById('chat').classList.add('admin-mode');
                    renderUpdates();
                    if (document.getElementById('habits').style.display === 'block') {
                        renderHabitTracker();
                    }
                }
            } else {
                isAdminMode = false;
                document.getElementById('updates').classList.remove('admin-mode');
                document.getElementById('chat').classList.remove('admin-mode');
                renderUpdates();
                if (document.getElementById('habits').style.display === 'block') {
                    renderHabitTracker();
                }
            }
        }

        function getDb() {
            if (!window.db) {
                alert('firebase not ready yet, try again');
                return null;
            }
            return window.db;
        }

        function updateStatus() {
            if (!isAdminMode) {
                alert('not in admin mode');
                return;
            }
            const database = getDb();
            if (!database) return;

            const type = document.getElementById('admin-status-type').value;
            const message = document.getElementById('admin-status-message').value.trim();

            database.ref('status').set({
                type: type,
                message: message || 'welcome to my corner of the internet',
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                document.getElementById('admin-status-message').value = '';
            }).catch(err => {
                alert('failed to update status: ' + err.message);
            });
        }

        function postAsOwner() {
            if (!isAdminMode) return;
            const database = getDb();
            if (!database) return;

            const messageInput = document.getElementById('admin-chat-message');
            const message = messageInput.value.trim();
            if (!message) return;

            database.ref('guestbook').push({
                name: 'santi',
                message: message,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isOwner: true
            }).then(() => {
                messageInput.value = '';
                database.ref('status/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
            }).catch(err => alert('failed to post: ' + err.message));
        }

        function deleteMessage(messageId) {
            if (!isAdminMode) return;
            const database = getDb();
            if (!database) return;

            if (confirm('delete this message?')) {
                database.ref('guestbook/' + messageId).remove()
                    .catch(err => alert('failed to delete: ' + err.message));
            }
        }
