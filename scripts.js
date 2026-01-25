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
            { date: "january 24, 2026", text: "launched the digital garden — now the heart of the site" },
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
                if (data) {
                    // Convert from Firebase object to array if needed
                    siteUpdates = Array.isArray(data) ? data : Object.values(data);
                } else {
                    // Initialize Firebase with defaults
                    window.db.ref('updates').set(defaultSiteUpdates);
                }
                if (document.getElementById('updates').style.display === 'block') {
                    renderUpdates();
                }
            });
        }

        function saveUpdates() {
            return window.db.ref('updates').set(siteUpdates).then(() => {
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
            updateTaskbar();
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
            e.preventDefault();
            draggedWindow = document.getElementById(id);
            setActiveWindow(id);

            const rect = draggedWindow.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            // Disable pointer events on iframes during drag to prevent capture
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }

        function drag(e) {
            if (!draggedWindow) return;
            e.preventDefault();

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            draggedWindow.style.left = Math.max(0, x) + 'px';
            draggedWindow.style.top = Math.max(0, y) + 'px';
        }

        function dragEnd() {
            draggedWindow = null;
            // Re-enable pointer events on iframes
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', dragEnd);
        }

        // Window resize functions
        function resizeStart(e, id) {
            e.preventDefault();
            e.stopPropagation();
            resizedWindow = document.getElementById(id);
            setActiveWindow(id);

            startX = e.clientX;
            startY = e.clientY;
            startWidth = resizedWindow.offsetWidth;
            startHeight = resizedWindow.offsetHeight;

            // Disable pointer events on iframes during resize
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', resizeEnd);
        }

        function resize(e) {
            if (!resizedWindow) return;
            e.preventDefault();

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
            // Re-enable pointer events on iframes
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', resizeEnd);
        }

        // Click outside start menu to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.start-btn') && !e.target.closest('.start-menu')) {
                closeStartMenu();
            }
        });

        // Generic application loader
        async function loadApplication(contentId, filePath, appName) {
            const content = document.getElementById(contentId);
            if (!content || content.dataset.loaded === 'true') return;

            try {
                const response = await fetch(filePath);
                if (!response.ok) throw new Error('Failed to load');
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
                content.innerHTML = `<p>Error loading ${appName}.</p>`;
            }
        }

        function loadFlowGarden() {
            loadApplication('flowgarden-content', 'applications/flowgarden.html', 'Flow Garden');
        }

        function loadStickyNotes() {
            loadApplication('stickynotes-content', 'applications/stickynotes.html', 'Sticky Notes');
        }

        function loadPomodoro() {
            loadApplication('pomodoro-content', 'applications/pomodoro.html', 'Pomodoro Timer');
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

        // Handle URLs and pass garden paths to iframe
        function handleRoutes() {
            // Check for 404 redirect from sessionStorage
            let path = sessionStorage.getItem('redirect');
            if (path) {
                sessionStorage.removeItem('redirect');
            } else {
                path = window.location.pathname;
            }

            // Remove leading slash
            path = path.replace(/^\//, '');

            // Map old blog URLs to garden paths
            const legacyRedirects = {
                'favorite-reads-2025': '/garden/being/my-favorite-reads-2025',
                'power-of-writing-online': '/garden/thinking/power-of-writing-online',
                'notes': '/garden',
                'archive': '/garden',
                'now': '/garden/being/now'
            };

            if (legacyRedirects[path]) {
                path = legacyRedirects[path].replace(/^\//, '');
            }

            // Handle garden paths
            if (path.startsWith('garden/') || path === 'garden') {
                const slugPath = path.replace(/^garden\/?/, '');
                if (slugPath) {
                    // Convert slug to noteId (map folder names back to numbered versions)
                    const parts = slugPath.split('/');
                    if (parts.length > 1) {
                        const folderMap = {
                            'thinking': '1. thinking',
                            'being': '2. being',
                            'doing': '3. doing',
                            'loving': '4. loving',
                            'writing': '5. writing'
                        };
                        parts[0] = folderMap[parts[0]] || parts[0];
                    }
                    sessionStorage.setItem('gardenPath', parts.join('/'));
                }
            } else if (path === 'player') {
                openWindow('player');
            }
        }

        // Listen for URL updates from garden iframe
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'gardenNavigate') {
                const newPath = e.data.path ? `/garden/${e.data.path}` : '/garden';
                history.replaceState(null, '', newPath);
            }
        });

        // Open garden on load and handle URL routes
        window.onload = () => {
            openWindow('garden');
            handleRoutes();
            updateClock();
            setInterval(updateClock, 1000);
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

        let firebaseRetries = 0;
        const MAX_FIREBASE_RETRIES = 50;

        function initFirebase() {
            if (typeof firebase === 'undefined') {
                firebaseRetries++;
                if (firebaseRetries < MAX_FIREBASE_RETRIES) {
                    setTimeout(initFirebase, 100);
                }
                return;
            }
            try {
                firebase.initializeApp(firebaseConfig);
                window.db = firebase.database();
                initChatRoom();
                initUpdates();
            } catch (e) {
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
            const message = messageInput.value.trim().slice(0, 500); // max 500 chars
            const name = (nameInput.value.trim() || 'anon').slice(0, 50); // max 50 chars
            if (!message) return;

            window.db.ref('guestbook').push({
                name: name,
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
        // ADMIN MODE (disabled for security - manage via Firebase console)
        // ==========================================

        let isAdminMode = false;

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
