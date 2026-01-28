/**
 * Site Updates Module
 * Handles the updates window with Firebase backing
 */

// State
let isAdminMode = false;
let siteUpdates = [];

const defaultSiteUpdates = [
    { date: "january 25, 2026", text: "garden is now mobile friendly + polished graph view" },
    { date: "january 24, 2026", text: "launched the digital garden — now the heart of the site" },
    { date: "january 19, 2026", text: "added habit tracker to the desktop" },
    { date: "january 18, 2026", text: "added updates window to the <s>desktop</s> digital garden" },
    { date: "january 14, 2026", text: "added pomodoro timer application" },
    { date: "january 10, 2026", text: "new blog post: 10 reasons why you should start writing online" },
    { date: "january 7, 2026", text: "launched chat" },
    { date: "january 5, 2026", text: "added flow garden and sticky notes applications" },
    { date: "january 1, 2026", text: "launched this website 🥂" },
];

siteUpdates = [...defaultSiteUpdates];

export function setAdminMode(value) {
    isAdminMode = value;
}

export function getAdminMode() {
    return isAdminMode;
}

export function initUpdates() {
    if (!window.db) {
        setTimeout(initUpdates, 100);
        return;
    }
    
    window.db.ref('updates').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            siteUpdates = Array.isArray(data) ? data : Object.values(data);

            // Merge any new defaults that don't exist in Firebase
            const existingKeys = new Set(siteUpdates.map(u => u.date + '|' + u.text));
            const newDefaults = defaultSiteUpdates.filter(d => !existingKeys.has(d.date + '|' + d.text));
            if (newDefaults.length > 0) {
                siteUpdates = [...newDefaults, ...siteUpdates];
                siteUpdates.sort((a, b) => new Date(b.date) - new Date(a.date));
                window.db.ref('updates').set(siteUpdates);
            }
        } else {
            window.db.ref('updates').set(defaultSiteUpdates);
        }
        
        if (document.getElementById('updates')?.style.display === 'block') {
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

export function addUpdate(text) {
    if (!isAdminMode || !text?.trim()) return;
    
    const today = new Date();
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const date = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    
    siteUpdates.unshift({ date, text: text.trim() });
    saveUpdates();
}

export function deleteUpdate(index) {
    if (!isAdminMode) return;
    if (!confirm('delete this update?')) return;
    
    siteUpdates.splice(index, 1);
    saveUpdates();
}

export function editUpdate(index) {
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

export function renderUpdates() {
    const content = document.getElementById('updates-content');
    if (!content) return;

    const adminForm = isAdminMode ? `
        <div class="update-admin-form">
            <input type="text" id="new-update-text" class="update-admin-input" placeholder="new update...">
            <button class="update-admin-btn" onclick="window.santi.addUpdate(document.getElementById('new-update-text').value); document.getElementById('new-update-text').value = '';">post</button>
        </div>
    ` : '';

    const updatesHTML = siteUpdates.map((update, index) => {
        const adminButtons = isAdminMode ? `
            <span class="update-admin-actions">
                <button class="update-edit-btn" onclick="window.santi.editUpdate(${index})">edit</button>
                <button class="update-delete-btn" onclick="window.santi.deleteUpdate(${index})">×</button>
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
