/**
 * Applications Module
 * Handles loading standalone apps and UI features like Clippy and dialogs
 */

import { closeStartMenu } from './windows.js';

// Subscribe dialog messages
const subscribeMessages = {
    shutdown: "<strong>Wait! Before you go...</strong><br>Subscribe to get my latest thoughts delivered straight to your inbox.",
    clippy: "<strong>Great choice!</strong><br>Enter your email to get my latest posts.",
    newsletter: "<strong>Stay connected</strong><br>Get my latest posts delivered straight to your inbox."
};

// Generic application loader
export async function loadApplication(contentId, filePath, appName) {
    const content = document.getElementById(contentId);
    if (!content || content.dataset.loaded === 'true') return;

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error('Failed to load');
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body;

        const headStyles = doc.querySelectorAll('head style');
        const bodyStyles = doc.querySelectorAll('body style');

        if (body) {
            let styleHTML = '';
            headStyles.forEach(style => { styleHTML += style.outerHTML; });
            bodyStyles.forEach(style => { styleHTML += style.outerHTML; });
            content.innerHTML = styleHTML + body.innerHTML;

            // Execute scripts
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                newScript.textContent = oldScript.textContent;
                document.body.appendChild(newScript);
            });

            content.dataset.loaded = 'true';
        }
    } catch (error) {
        console.error('Error loading application:', error);
        content.innerHTML = `<p>Error loading ${appName}.</p>`;
    }
}

export function loadFlowGarden() {
    loadApplication('flowgarden-content', '/applications/flowgarden.html', 'Flow Garden');
}

export function loadStickyNotes() {
    loadApplication('stickynotes-content', '/applications/stickynotes.html', 'Sticky Notes');
}

export function loadPomodoro() {
    loadApplication('pomodoro-content', '/applications/pomodoro.html', 'Pomodoro Timer');
}

// Shutdown/Subscribe Dialog
export function openShutdownDialog(source = 'shutdown') {
    closeStartMenu();
    
    const messageEl = document.getElementById('subscribe-message');
    const titleEl = document.getElementById('subscribe-dialog-title');
    const iconEl = document.getElementById('subscribe-dialog-icon');
    const overlay = document.getElementById('shutdown-overlay');
    
    if (messageEl) messageEl.innerHTML = subscribeMessages[source];
    if (titleEl) titleEl.textContent = source === 'shutdown' ? 'Shut Down' : 'Newsletter';
    if (iconEl) {
        iconEl.innerHTML = source === 'shutdown'
            ? '<img src="/icons/shut_down_normal-1.png" alt="">'
            : '<img src="/icons/envelope_closed-1.png" alt="">';
    }
    if (overlay) overlay.classList.add('open');
}

export function openSubscribeDialog() {
    openShutdownDialog('newsletter');
}

export function closeShutdownDialog(event) {
    if (event && event.currentTarget && event.target !== event.currentTarget) return;
    document.getElementById('shutdown-overlay')?.classList.remove('open');
}

// Clippy Assistant
let clippyDismissed = sessionStorage.getItem('clippyDismissed');
let clippyBubbleVisible = true;

export function initClippy() {
    if (clippyDismissed) return;

    setTimeout(() => {
        document.getElementById('clippy')?.classList.add('show');
    }, 15000);
}

export function dismissClippy() {
    document.getElementById('clippy')?.classList.remove('show');
    sessionStorage.setItem('clippyDismissed', 'true');
    clippyDismissed = true;
}

export function toggleClippyBubble() {
    const bubble = document.querySelector('.clippy-bubble');
    if (!bubble) return;
    
    clippyBubbleVisible = !clippyBubbleVisible;
    bubble.style.display = clippyBubbleVisible ? 'block' : 'none';
}

export function clippySubscribe() {
    dismissClippy();
    openShutdownDialog('clippy');
}

// Clock
export function updateClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    clockEl.textContent = `${hours}:${minutes} ${ampm}`;
}
