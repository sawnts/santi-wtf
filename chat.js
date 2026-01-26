// chat.js - firebase chat room and admin mode

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
// ADMIN MODE (Firebase Auth)
// ==========================================

let isAdminMode = false;
let currentUser = null;

// Your Firebase Auth UID - set this after first login
const ADMIN_UID = 'bGPBOS3bRLShDyiXDxU8CulVQqF3';

function initAuth() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        setTimeout(initAuth, 100);
        return;
    }

    firebase.auth().onAuthStateChanged((user) => {
        currentUser = user;
        if (user && user.uid === ADMIN_UID) {
            isAdminMode = true;
            document.body.classList.add('admin-mode');
            console.log('Admin authenticated:', user.email);
        } else {
            isAdminMode = false;
            document.body.classList.remove('admin-mode');
        }
        renderUpdates();
    });
}

function adminLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            console.log('Logged in as:', result.user.email);
        })
        .catch((error) => {
            console.error('Login failed:', error);
        });
}

function adminLogout() {
    firebase.auth().signOut()
        .then(() => console.log('Logged out'))
        .catch((error) => console.error('Logout failed:', error));
}

// Keyboard shortcut: Ctrl+Shift+L or Cmd+Shift+L to trigger login
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        if (currentUser) {
            adminLogout();
        } else {
            adminLogin();
        }
    }
});

initAuth();

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
