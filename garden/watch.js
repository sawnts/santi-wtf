#!/usr/bin/env node

/**
 * garden watcher
 * 
 * watches obsidian /public folder for changes and auto-syncs
 * ignores files/folders starting with "_"
 * 
 * usage: node garden/watch.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const WATCH_PATH = '/Users/santi/Desktop/Areas/Jots/santi.wtf/public';
const DEBOUNCE_MS = 1000;

let debounceTimer = null;
let isBuilding = false;

console.log('🌱 garden watcher started');
console.log(`   watching: ${WATCH_PATH}`);
console.log('   ignoring: files/folders starting with "_"');
console.log('   press ctrl+c to stop\n');

function shouldIgnore(filePath) {
    const parts = filePath.split(path.sep);
    return parts.some(part => part.startsWith('_'));
}

function runSync() {
    if (isBuilding) {
        console.log('   (build already in progress, skipping)');
        return;
    }
    
    isBuilding = true;
    console.log('🔄 changes detected, syncing...');
    
    const buildProcess = spawn('npm', ['run', 'sync'], {
        cwd: path.join(__dirname),
        stdio: 'inherit',
        shell: true
    });
    
    buildProcess.on('close', (code) => {
        isBuilding = false;
        if (code === 0) {
            console.log('✅ sync complete\n');
        } else {
            console.log(`❌ sync failed (code ${code})\n`);
        }
    });
}

function handleChange(eventType, filename) {
    if (!filename) return;
    
    // Check if should ignore
    if (shouldIgnore(filename)) {
        return;
    }
    
    // Only watch .md files
    if (!filename.endsWith('.md')) {
        return;
    }
    
    console.log(`   ${eventType}: ${filename}`);
    
    // Debounce rapid changes
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(runSync, DEBOUNCE_MS);
}

// Watch recursively
function watchRecursive(dir) {
    fs.watch(dir, { recursive: true }, handleChange);
}

// Start watching
try {
    watchRecursive(WATCH_PATH);
    console.log('👀 watching for changes...\n');
} catch (err) {
    console.error('Error starting watcher:', err.message);
    process.exit(1);
}

// Handle exit
process.on('SIGINT', () => {
    console.log('\n\n🛑 watcher stopped');
    process.exit(0);
});
