// habits.js - garden habit tracker (read-only)

let habitsConfig = null;

async function initHabitTracker() {
    // Load habits config (includes completion data from Obsidian)
    try {
        const response = await fetch('/garden/data/habits-config.json');
        habitsConfig = await response.json();
    } catch (e) {
        console.log('no habits config found');
    }
}

function isHabitTrackerNote(noteId) {
    return habitsConfig && noteId === habitsConfig.noteId;
}

async function renderHabitTracker() {
    const contentArea = document.getElementById('note-content');
    if (!contentArea || !habitsConfig) return;

    // Fetch the markdown content
    let introHtml = '';
    try {
        const response = await fetch(`/garden/content/${habitsConfig.noteId}.html`);
        if (response.ok) {
            const html = await response.text();
            // Extract just the intro sections (before completion log)
            const match = html.match(/^([\s\S]*?)<h2>completion log<\/h2>/i);
            if (match) {
                introHtml = match[1];
            }
        }
    } catch (e) {
        console.log('could not load intro content');
    }

    const today = new Date();
    const currentYear = habitsConfig.year || today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const todayDayOfYear = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

    // Habit icons
    const habitIcons = {
        'meditation': '🧘',
        'sleep': '😴',
        'movement': '🏃',
        'reading': '📖',
        'writing': '✍️',
        'chess': '♟️'
    };

    function getHabitIcon(name) {
        return habitIcons[name.toLowerCase()] || '·';
    }

    function getStreak(completed) {
        let streak = 0;
        let checkDay = todayDayOfYear;
        if (!completed.includes(todayDayOfYear)) {
            checkDay = todayDayOfYear - 1;
        }
        while (checkDay > 0 && completed.includes(checkDay)) {
            streak++;
            checkDay--;
        }
        return streak;
    }

    // Build habit cards (read-only)
    const habitCards = habitsConfig.habits.map((habit) => {
        const completed = habit.completed || [];
        const streak = getStreak(completed);
        const icon = getHabitIcon(habit.name);
        const completedThisYear = completed.filter(d => d <= todayDayOfYear).length;
        const percentage = todayDayOfYear > 0 ? Math.round((completedThisYear / todayDayOfYear) * 100) : 0;
        const isTodayDone = completed.includes(todayDayOfYear);

        // Build mini calendar (last 7 days) - display only
        let miniCal = '';
        for (let i = 6; i >= 0; i--) {
            const dayNum = todayDayOfYear - i;
            if (dayNum > 0) {
                const isDone = completed.includes(dayNum);
                const isToday = dayNum === todayDayOfYear;
                miniCal += `<div class="habit-day ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}"></div>`;
            }
        }

        return `
            <div class="habit-card">
                <div class="habit-plant">${icon}</div>
                <div class="habit-info">
                    <div class="habit-name">${habit.name}</div>
                    <div class="habit-goal">${habit.goal}</div>
                    <div class="habit-streak">${streak > 0 ? streak + ' days' : '—'}</div>
                </div>
                <div class="habit-progress">
                    <div class="habit-progress-bar">
                        <div class="habit-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="habit-progress-label">${percentage}%</div>
                </div>
                <div class="habit-calendar">${miniCal}</div>
                <div class="habit-status ${isTodayDone ? 'watered' : 'dry'}">
                    ${isTodayDone ? '✓ done' : '—'}
                </div>
            </div>
        `;
    }).join('');

    // Build yearly garden grid
    let gardenGrid = '';
    const totalHabits = habitsConfig.habits.length;
    for (let day = 1; day <= todayDayOfYear; day++) {
        let doneCount = 0;
        habitsConfig.habits.forEach(habit => {
            if ((habit.completed || []).includes(day)) doneCount++;
        });
        const level = Math.round((doneCount / totalHabits) * 4);
        const date = new Date(currentYear, 0, day);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        gardenGrid += `<div class="garden-cell level-${level}" title="${label}: ${doneCount}/${totalHabits}"></div>`;
    }

    // Build note metadata
    const note = gardenIndex.notes[habitsConfig.noteId];
    let metaHtml = '';
    if (note) {
        metaHtml = '<div class="note-meta">';
        metaHtml += `<span class="note-meta-item"><span class="note-meta-label">stage:</span> <a href="#" class="stage-link" onclick="openFilterByStage('${escapeAttr(note.stage)}'); return false;">${getStageIcon(note.stage)} ${escapeAttr(note.stage) || 'unknown'}</a></span>`;
        if (note.planted) {
            metaHtml += `<span class="note-meta-item"><span class="note-meta-label">planted:</span> ${formatDate(note.planted)}</span>`;
        }
        if (note.tended) {
            metaHtml += `<span class="note-meta-item"><span class="note-meta-label">tended:</span> ${formatDate(note.tended)}</span>`;
        }
        metaHtml += '</div>';

        if (note.tags && note.tags.length > 0) {
            metaHtml += '<div class="note-tags">';
            for (const tag of note.tags) {
                metaHtml += `<span class="tag" onclick="searchByTag('${escapeAttr(tag)}')">#${escapeAttr(tag)}</span>`;
            }
            metaHtml += '</div>';
        }
    }

    contentArea.innerHTML = `
        ${metaHtml}
        ${introHtml}

        <div class="habit-cards">
            ${habitCards}
        </div>

        <h2>year overview</h2>
        <div class="garden-grid">${gardenGrid}</div>
        <div class="garden-legend">
            <span>0</span>
            <div class="garden-cell level-0"></div>
            <div class="garden-cell level-1"></div>
            <div class="garden-cell level-2"></div>
            <div class="garden-cell level-3"></div>
            <div class="garden-cell level-4"></div>
            <span>all</span>
        </div>
    `;
}

// Initialize habit tracker on load
initHabitTracker();
