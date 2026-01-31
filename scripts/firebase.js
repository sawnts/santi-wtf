/**
 * Firebase Module
 * Handles chat, updates, and authentication
 */

// Note: updates.js functions are accessed via dynamic import to avoid circular dependency

const firebaseConfig = {
    apiKey: "AIzaSyDUcoZ437gcv8w99atWiMixK4ebvpxHwCw",
    authDomain: "santi-guestbook.firebaseapp.com",
    databaseURL: "https://santi-guestbook-default-rtdb.firebaseio.com",
    projectId: "santi-guestbook",
    storageBucket: "santi-guestbook.firebasestorage.app",
    messagingSenderId: "456705609062",
    appId: "1:456705609062:web:2a0feac46c2692bff9cca7"
};

const ADMIN_UID = 'bGPBOS3bRLShDyiXDxU8CulVQqF3';
const MAX_FIREBASE_RETRIES = 50;

let firebaseRetries = 0;
let currentUser = null;
let replyingTo = null; // { id, name, text }
let messagesCache = {}; // Store messages for reply lookup

// Initialize Firebase with retry logic
export function initFirebase() {
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
        initUpdatesListener();
        initAuth();
    } catch (e) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">chat coming soon!</div>';
        }
    }
}

// Chat Room
function initChatRoom() {
    // Listen for status updates
    window.db.ref('status').on('value', (snapshot) => {
        const status = snapshot.val() || { 
            type: 'online', 
            message: 'welcome to my corner of the internet', 
            lastSeen: Date.now() 
        };
        
        const indicator = document.getElementById('status-indicator');
        const messageEl = document.getElementById('status-message');
        const lastSeenEl = document.getElementById('status-lastseen');

        if (indicator) indicator.className = 'chat-status-indicator ' + (status.type || 'online');
        if (messageEl) messageEl.textContent = status.message || 'welcome to my corner of the internet';
        if (lastSeenEl) lastSeenEl.textContent = 'last seen: ' + getRelativeTime(status.lastSeen || Date.now());
    });

    // Who's online - Firebase presence
    initPresence();

    // Listen for chat messages
    const messagesRef = window.db.ref('guestbook').orderByChild('timestamp').limitToLast(100);
    messagesRef.on('value', (snapshot) => {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messages = [];
        snapshot.forEach((child) => { 
            messages.push({ id: child.key, ...child.val() }); 
        });

        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">be the first to say something!</div>';
            return;
        }

        // Cache messages for reply lookup
        messages.forEach(msg => {
            const isOwner = msg.isOwner === true;
            messagesCache[msg.id] = {
                name: isOwner ? 'santi' : (msg.name || 'anon'),
                text: msg.message
            };
        });

        messagesContainer.innerHTML = messages.map(msg => {
            const isOwner = msg.isOwner === true;
            const bubbleClass = isOwner ? 'owner' : 'visitor';
            const name = isOwner ? 'santi' : escapeHtml(msg.name || 'anon');
            const replyHtml = msg.replyToName ? `
                <div class="chat-reply-context" onclick="window.santi.scrollToMessage('${msg.replyTo}')">
                    <span class="chat-reply-icon">↩</span>
                    <span class="chat-reply-name">${escapeHtml(msg.replyToName)}</span>
                    <span class="chat-reply-text">${escapeHtml((msg.replyToText || '').slice(0, 50))}${(msg.replyToText || '').length > 50 ? '...' : ''}</span>
                </div>
            ` : '';
            return `
                <div class="chat-bubble ${bubbleClass}" id="msg-${msg.id}">
                    <button class="chat-delete" onclick="window.santi.deleteMessage('${msg.id}')">×</button>
                    <button class="chat-reply-btn" onclick="window.santi.setReply('${msg.id}')" title="Reply">↩</button>
                    ${replyHtml}
                    <div class="chat-bubble-header">
                        <span class="chat-bubble-name">${name}</span>
                        <span class="chat-bubble-time">${getRelativeTime(msg.timestamp)}</span>
                    </div>
                    <div class="chat-bubble-text">${escapeHtml(msg.message)}</div>
                </div>
            `;
        }).join('');

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Activity-based presence tracking (counts users active in last 5 min)
function initPresence() {
    // Generate a unique ID per tab (not localStorage — each tab needs its own)
    const tabId = 'v_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    const visitorRef = window.db.ref('visitors/' + tabId);

    // Update our activity timestamp
    function updateActivity() {
        visitorRef.set({
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {
            // Silently fail if no permission — just hide the counter
            const onlineEl = document.getElementById('online-count');
            if (onlineEl) onlineEl.style.display = 'none';
        });
    }

    // Update on load and periodically
    updateActivity();
    setInterval(updateActivity, 30000); // Every 30 seconds

    // Clean up on page close
    window.addEventListener('beforeunload', () => {
        // Use sendBeacon for reliability on page close
        navigator.sendBeacon && visitorRef.remove();
    });
    
    // Also use Firebase onDisconnect for cleanup
    visitorRef.onDisconnect().remove();

    // Listen for active visitors (last 2 min for more responsive count)
    window.db.ref('visitors').on('value', (snapshot) => {
        const onlineEl = document.getElementById('online-count');
        if (!onlineEl) return;

        const now = Date.now();
        const twoMinAgo = now - (2 * 60 * 1000);
        let count = 0;

        snapshot.forEach((child) => {
            const data = child.val();
            if (data && data.lastSeen && data.lastSeen > twoMinAgo) {
                count++;
            }
        });

        onlineEl.textContent = count === 1 ? '1 person here' : `${count} people here`;
    }, () => {
        // Error callback — hide counter if no permission
        const onlineEl = document.getElementById('online-count');
        if (onlineEl) onlineEl.style.display = 'none';
    });
}

// Reply functions
export function setReply(msgId) {
    const cached = messagesCache[msgId];
    if (!cached) return;
    
    replyingTo = { id: msgId, name: cached.name, text: cached.text };
    const indicator = document.getElementById('reply-indicator');
    const nameEl = document.getElementById('reply-to-name');
    if (indicator && nameEl) {
        nameEl.textContent = cached.name;
        indicator.style.display = 'flex';
    }
    document.getElementById('chat-message')?.focus();
}

export function cancelReply() {
    replyingTo = null;
    const indicator = document.getElementById('reply-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

export function scrollToMessage(msgId) {
    const el = document.getElementById('msg-' + msgId);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('chat-bubble-highlight');
        setTimeout(() => el.classList.remove('chat-bubble-highlight'), 1500);
    }
}

export function submitChat() {
    const nameInput = document.getElementById('chat-name');
    const messageInput = document.getElementById('chat-message');
    if (!messageInput) return;
    
    const message = messageInput.value.trim().slice(0, 500);
    const name = (nameInput?.value.trim() || 'anon').slice(0, 50);
    if (!message) return;

    const msgData = {
        name: name,
        message: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        isOwner: false
    };

    // Add reply data if replying
    if (replyingTo) {
        msgData.replyTo = replyingTo.id;
        msgData.replyToName = replyingTo.name;
        msgData.replyToText = replyingTo.text;
    }

    window.db.ref('guestbook').push(msgData).then(() => {
        messageInput.value = '';
        cancelReply();
    }).catch(error => {
        console.error('Error posting message:', error);
    });
}

export async function postAsOwner() {
    const { getAdminMode } = await import('./updates.js');
    if (!getAdminMode()) return;
    if (!window.db) {
        alert('firebase not ready yet, try again');
        return;
    }

    const messageInput = document.getElementById('admin-chat-message');
    const message = messageInput?.value.trim();
    if (!message) return;

    const msgData = {
        name: 'santi',
        message: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        isOwner: true
    };

    // Add reply data if replying
    if (replyingTo) {
        msgData.replyTo = replyingTo.id;
        msgData.replyToName = replyingTo.name;
        msgData.replyToText = replyingTo.text;
    }

    window.db.ref('guestbook').push(msgData).then(() => {
        messageInput.value = '';
        cancelReply();
        window.db.ref('status/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
    }).catch(err => alert('failed to post: ' + err.message));
}

export async function deleteMessage(messageId) {
    const { getAdminMode } = await import('./updates.js');
    if (!getAdminMode()) return;
    if (!window.db) {
        alert('firebase not ready yet, try again');
        return;
    }

    if (confirm('delete this message?')) {
        window.db.ref('guestbook/' + messageId).remove()
            .catch(err => alert('failed to delete: ' + err.message));
    }
}

export async function updateStatus() {
    const { getAdminMode } = await import('./updates.js');
    if (!getAdminMode()) {
        alert('not in admin mode');
        return;
    }
    if (!window.db) {
        alert('firebase not ready yet, try again');
        return;
    }

    const type = document.getElementById('admin-status-type')?.value;
    const message = document.getElementById('admin-status-message')?.value.trim();

    window.db.ref('status').set({
        type: type,
        message: message || 'welcome to my corner of the internet',
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        const input = document.getElementById('admin-status-message');
        if (input) input.value = '';
    }).catch(err => {
        alert('failed to update status: ' + err.message);
    });
}

// Authentication
function initAuth() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        setTimeout(initAuth, 100);
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        currentUser = user;
        const { setAdminMode, renderUpdates } = await import('./updates.js');
        
        if (user && user.uid === ADMIN_UID) {
            setAdminMode(true);
            document.body.classList.add('admin-mode');
            console.log('Admin authenticated:', user.email);
        } else {
            setAdminMode(false);
            document.body.classList.remove('admin-mode');
        }
        renderUpdates();
    });
}

export function adminLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            console.log('Logged in as:', result.user.email);
        })
        .catch((error) => {
            console.error('Login failed:', error);
        });
}

export function adminLogout() {
    firebase.auth().signOut()
        .then(() => console.log('Logged out'))
        .catch((error) => console.error('Logout failed:', error));
}

export function toggleAdminAuth() {
    if (currentUser) {
        adminLogout();
    } else {
        adminLogin();
    }
}

// Utilities
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

// Updates listener (Firebase-backed)
async function initUpdatesListener() {
    const { initUpdates } = await import('./updates.js');
    initUpdates();
}
