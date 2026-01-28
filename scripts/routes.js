/**
 * Routes Module
 * Handles URL routing and navigation
 */

import { openWindow } from './windows.js';

// Legacy URL redirects
const legacyRedirects = {
    'favorite-reads-2025': '/garden/being/my-favorite-reads-2025',
    'power-of-writing-online': '/garden/thinking/power-of-writing-online',
    'notes': '/garden',
    'archive': '/garden',
    'now': '/garden/being/now'
};

// Folder slug mapping
const folderMap = {
    'thinking': '1. thinking',
    'being': '2. being',
    'doing': '3. doing',
    'loving': '4. loving',
    'writing': '5. writing'
};

export function handleRoutes() {
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
    if (legacyRedirects[path]) {
        path = legacyRedirects[path].replace(/^\//, '');
    }

    // Handle garden paths
    if (path.startsWith('garden/') || path === 'garden') {
        const slugPath = path.replace(/^garden\/?/, '');
        if (slugPath) {
            const parts = slugPath.split('/');
            if (parts.length > 1) {
                parts[0] = folderMap[parts[0]] || parts[0];
            }
            sessionStorage.setItem('gardenPath', parts.join('/'));
        }
    } else if (path === 'player') {
        openWindow('player');
    }
}

// Listen for URL updates from garden iframe
export function initRouteListener() {
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'gardenNavigate') {
            const newPath = e.data.path ? `/garden/${e.data.path}` : '/garden';
            history.replaceState(null, '', newPath);
        }
    });
}
