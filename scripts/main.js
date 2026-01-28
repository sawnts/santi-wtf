/**
 * Main Entry Point
 * Initializes all modules and sets up global bindings
 */

// Import modules
import {
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    setActiveWindow,
    toggleStartMenu,
    closeStartMenu,
    dragStart,
    resizeStart,
    setOnWindowOpen
} from './windows.js';

import {
    initFirebase,
    submitChat,
    postAsOwner,
    deleteMessage,
    updateStatus,
    toggleAdminAuth
} from './firebase.js';

import {
    addUpdate,
    editUpdate,
    deleteUpdate,
    renderUpdates
} from './updates.js';

import {
    loadFlowGarden,
    loadStickyNotes,
    loadPomodoro,
    openShutdownDialog,
    openSubscribeDialog,
    closeShutdownDialog,
    initClippy,
    dismissClippy,
    toggleClippyBubble,
    clippySubscribe,
    updateClock
} from './apps.js';

import {
    handleRoutes,
    initRouteListener
} from './routes.js';

// Handle window open events (cross-module communication)
setOnWindowOpen((id, win) => {
    if (id === 'flowgarden') {
        loadFlowGarden();
    } else if (id === 'stickynotes') {
        loadStickyNotes();
    } else if (id === 'pomodoro') {
        loadPomodoro();
    } else if (id === 'updates') {
        renderUpdates();
    } else if (id === 'garden') {
        // Reset garden to welcome page when reopening
        const iframe = win.querySelector('iframe');
        if (iframe) {
            iframe.src = '/garden/garden.html';
            history.replaceState(null, '', '/garden');
        }
    }
});

// Expose functions globally for onclick handlers in HTML
window.santi = {
    // Windows
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    setActiveWindow,
    toggleStartMenu,
    closeStartMenu,
    dragStart,
    resizeStart,
    
    // Chat
    submitChat,
    postAsOwner,
    deleteMessage,
    updateStatus,
    
    // Updates
    addUpdate,
    editUpdate,
    deleteUpdate,
    
    // Apps & UI
    openShutdownDialog,
    openSubscribeDialog,
    closeShutdownDialog,
    dismissClippy,
    toggleClippyBubble,
    clippySubscribe,
    
    // Auth (console access)
    adminLogin: toggleAdminAuth,
    adminLogout: toggleAdminAuth
};

// Also expose key functions directly for backwards compatibility with existing onclick handlers
window.openWindow = openWindow;
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.restoreWindow = restoreWindow;
window.toggleStartMenu = toggleStartMenu;
window.dragStart = dragStart;
window.resizeStart = resizeStart;
window.openShutdownDialog = openShutdownDialog;
window.openSubscribeDialog = openSubscribeDialog;
window.closeShutdownDialog = closeShutdownDialog;
window.submitChat = submitChat;
window.postAsOwner = postAsOwner;
window.deleteMessage = deleteMessage;
window.updateStatus = updateStatus;
window.dismissClippy = dismissClippy;
window.toggleClippyBubble = toggleClippyBubble;
window.clippySubscribe = clippySubscribe;
window.adminLogin = toggleAdminAuth;
window.adminLogout = toggleAdminAuth;

// Keyboard shortcut: Ctrl+Shift+L or Cmd+Shift+L to toggle admin auth
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        toggleAdminAuth();
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initClippy();
});

// Initialize on window load
window.onload = () => {
    openWindow('garden');
    handleRoutes();
    initRouteListener();
    updateClock();
    setInterval(updateClock, 1000);
};

// Start Firebase initialization
initFirebase();

console.log('santi.wtf loaded — modules initialized');
