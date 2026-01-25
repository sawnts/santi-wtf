#!/usr/bin/env node

/**
 * garden build script
 *
 * converts obsidian markdown files to html for the digital garden
 *
 * usage: node garden/build.js /path/to/obsidian/vault/public
 *
 * dependencies: npm install marked gray-matter glob
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const { glob } = require('glob');

// config
const OUTPUT_DIR = path.join(__dirname, 'content');
const DATA_DIR = path.join(__dirname, 'data');

// get source path from args
const sourcePath = process.argv[2];

if (!sourcePath) {
    console.error('usage: node garden/build.js /path/to/obsidian/vault');
    process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
    console.error(`error: source path does not exist: ${sourcePath}`);
    process.exit(1);
}

console.log(`building garden from: ${sourcePath}`);

// ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// clear existing content
const existingFiles = glob.sync(`${OUTPUT_DIR}/**/*.html`);
existingFiles.forEach(f => fs.unlinkSync(f));

// find all markdown files
const mdFiles = glob.sync(`${sourcePath}/**/*.md`);
console.log(`found ${mdFiles.length} markdown files`);

// store for building index
const notes = {};
const rawContent = {}; // store markdown for second pass
const folders = { folders: {}, notes: [] };

// build filename -> noteId lookup
const filenameLookup = {};

// special content types
let habitsConfig = null;

// first pass: collect all notes and build lookup table
mdFiles.forEach(filePath => {
    const relativePath = path.relative(sourcePath, filePath);
    const noteId = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');

    // skip files starting with underscore (private reference files)
    if (path.basename(filePath).startsWith('_')) {
        return;
    }
    const filename = path.basename(noteId).toLowerCase().replace(/\s+/g, '-');

    filenameLookup[filename] = noteId;

    const content = fs.readFileSync(filePath, 'utf8');
    const { data: frontmatter, content: markdown } = matter(content);

    rawContent[noteId] = markdown;

    // check for special content types
    if (frontmatter.type === 'habit-tracker' && frontmatter.habits) {
        const currentYear = new Date().getFullYear();

        // Parse completion data from ```habits code block in body
        const habitsBlockMatch = markdown.match(/```habits\n([\s\S]*?)```/);
        const completionData = {};

        if (habitsBlockMatch) {
            const lines = habitsBlockMatch[1].trim().split('\n');
            lines.forEach(line => {
                const [name, daysStr] = line.split(':').map(s => s.trim());
                if (name && daysStr) {
                    const days = [];
                    // Parse ranges (1-14) and individual numbers (24)
                    daysStr.split(',').forEach(part => {
                        part = part.trim();
                        if (part.includes('-')) {
                            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                            for (let i = start; i <= end; i++) {
                                days.push(i);
                            }
                        } else if (part) {
                            days.push(parseInt(part));
                        }
                    });
                    completionData[name.toLowerCase()] = days;
                }
            });
        }

        const processedHabits = frontmatter.habits.map(habit => ({
            name: habit.name,
            goal: habit.goal,
            completed: completionData[habit.name.toLowerCase()] || []
        }));

        habitsConfig = {
            noteId: noteId,
            title: frontmatter.title || 'habit tracker',
            year: currentYear,
            habits: processedHabits
        };
        console.log(`  → found habit tracker config with ${frontmatter.habits.length} habits`);
    }

    // extract wikilinks
    const wikilinks = [];
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(markdown)) !== null) {
        wikilinks.push(match[1].toLowerCase().replace(/\s+/g, '-'));
    }

    // create excerpt (first paragraph, stripped of html)
    const excerptMatch = markdown.match(/^[^#\n][^\n]+/m);
    const excerpt = excerptMatch
        ? excerptMatch[0].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2$1').substring(0, 150)
        : '';

    // build note metadata
    notes[noteId] = {
        title: frontmatter.title || path.basename(noteId),
        stage: frontmatter.stage || 'seedling',
        planted: frontmatter.planted || null,
        tended: frontmatter.tended || null,
        tags: frontmatter.tags || [],
        links: wikilinks,
        backlinks: [],
        excerpt: excerpt.trim()
    };

    addToFolderTree(noteId, folders);
});

// second pass: convert markdown to html with resolved links
Object.entries(rawContent).forEach(([noteId, markdown]) => {
    console.log(`processing: ${noteId}`);

    // convert markdown to html
    let html = marked(markdown);

    // convert wikilinks to html links with resolved paths
    html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, display) => {
        const linkId = link.toLowerCase().replace(/\s+/g, '-');
        const resolvedId = findNoteId(linkId);
        const displayText = display || link;
        return `<a href="#" class="wikilink" data-note="${resolvedId || linkId}">${displayText}</a>`;
    });

    // ensure output directory exists
    const outputPath = path.join(OUTPUT_DIR, noteId + '.html');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // write html file
    fs.writeFileSync(outputPath, html);
});

// third pass: compute backlinks
Object.entries(notes).forEach(([noteId, note]) => {
    note.links.forEach(linkId => {
        const targetId = findNoteId(linkId);
        if (targetId && notes[targetId]) {
            if (!notes[targetId].backlinks.includes(noteId)) {
                notes[targetId].backlinks.push(noteId);
            }
        }
    });
});

// resolve links in notes metadata too
Object.values(notes).forEach(note => {
    note.links = note.links.map(linkId => findNoteId(linkId) || linkId);
});

// compute stats
const stats = {
    total: Object.keys(notes).length,
    links: Object.values(notes).reduce((sum, n) => sum + n.links.length, 0),
    seedling: Object.values(notes).filter(n => n.stage === 'seedling').length,
    growing: Object.values(notes).filter(n => n.stage === 'growing').length,
    evergreen: Object.values(notes).filter(n => n.stage === 'evergreen').length
};

// write index.json
const index = { notes, folders, stats };
fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));

// write habits-config.json if found
if (habitsConfig) {
    fs.writeFileSync(path.join(DATA_DIR, 'habits-config.json'), JSON.stringify(habitsConfig, null, 2));
    console.log(`\nhabits config saved: ${habitsConfig.habits.length} habits`);
}

console.log(`\nbuild complete!`);
console.log(`  ${stats.total} notes`);
console.log(`  ${stats.links} links`);
console.log(`  🌱 ${stats.seedling} seedling | 🌿 ${stats.growing} growing | 🌲 ${stats.evergreen} evergreen`);

// helper: add note to folder tree
function addToFolderTree(noteId, tree) {
    const parts = noteId.split('/');
    let current = tree;

    // navigate/create folder structure
    for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        if (!current.folders[folderName]) {
            current.folders[folderName] = { folders: {}, notes: [] };
        }
        current = current.folders[folderName];
    }

    // add note to final folder
    current.notes.push(noteId);
}

// helper: find note id by partial match
function findNoteId(linkId) {
    // exact match
    if (notes[linkId]) return linkId;

    // lookup by filename
    if (filenameLookup[linkId]) return filenameLookup[linkId];

    // try finding by filename only
    const filename = linkId.split('/').pop();
    if (filenameLookup[filename]) return filenameLookup[filename];

    return null;
}
