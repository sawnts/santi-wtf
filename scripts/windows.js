/**
 * Window Management Module
 * Handles opening, closing, minimizing, dragging, and resizing windows
 */

// State
let activeWindow = null;
let draggedWindow = null;
let offsetX = 0;
let offsetY = 0;
let resizedWindow = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

export const minimizedWindows = new Set();
export const openWindows = new Set();

// Window callbacks - set by main.js for cross-module communication
let onWindowOpen = null;
export function setOnWindowOpen(callback) {
    onWindowOpen = callback;
}

export function openWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    
    win.style.display = 'block';
    openWindows.add(id);
    minimizedWindows.delete(id);
    setActiveWindow(id);
    updateTaskbar();
    closeStartMenu();

    // Trigger callback for app-specific logic
    if (onWindowOpen) onWindowOpen(id, win);
}

export function minimizeWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    
    win.style.display = 'none';
    minimizedWindows.add(id);
    win.classList.remove('active');
    activeWindow = null;
    updateTaskbar();
}

export function restoreWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    
    win.style.display = 'block';
    minimizedWindows.delete(id);
    setActiveWindow(id);
    updateTaskbar();
}

export function closeWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    
    win.style.display = 'none';
    openWindows.delete(id);
    minimizedWindows.delete(id);
    updateTaskbar();
}

export function setActiveWindow(id) {
    document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
    const win = document.getElementById(id);
    if (!win) return;
    
    win.classList.add('active');
    activeWindow = id;
    updateTaskbar();
}

export function updateTaskbar() {
    const container = document.getElementById('taskbar-items');
    if (!container) return;
    
    container.innerHTML = '';

    document.querySelectorAll('.window').forEach(win => {
        const isVisible = win.style.display === 'block';
        const isMinimized = minimizedWindows.has(win.id);

        if (isVisible || isMinimized) {
            const item = document.createElement('div');
            item.className = 'taskbar-item';
            if (win.classList.contains('active')) item.classList.add('active');

            const iconImg = win.querySelector('.title-icon img');
            const iconSrc = iconImg ? iconImg.src : '';
            let title = win.querySelector('.title-text span')?.textContent || win.id;

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

export function toggleStartMenu() {
    document.getElementById('start-menu')?.classList.toggle('open');
}

export function closeStartMenu() {
    document.getElementById('start-menu')?.classList.remove('open');
}

// Drag handling
export function dragStart(e, id) {
    if (window.innerWidth <= 768) return; // Disable on mobile

    e.preventDefault();
    draggedWindow = document.getElementById(id);
    setActiveWindow(id);

    const rect = draggedWindow.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

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
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
}

// Resize handling
export function resizeStart(e, id) {
    if (window.innerWidth <= 768) return; // Disable on mobile

    e.preventDefault();
    e.stopPropagation();
    resizedWindow = document.getElementById(id);
    setActiveWindow(id);

    startX = e.clientX;
    startY = e.clientY;
    startWidth = resizedWindow.offsetWidth;
    startHeight = resizedWindow.offsetHeight;

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

    if (width >= 400) resizedWindow.style.width = width + 'px';
    if (height >= 200) resizedWindow.style.height = height + 'px';
}

function resizeEnd() {
    resizedWindow = null;
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', resizeEnd);
}

// Click outside to close start menu
document.addEventListener('click', (e) => {
    if (!e.target.closest('.start-btn') && !e.target.closest('.start-menu')) {
        closeStartMenu();
    }
});
