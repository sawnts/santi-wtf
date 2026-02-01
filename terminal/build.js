#!/usr/bin/env node

/**
 * terminal build script
 *
 * converts obsidian markdown files to html for the terminal interface
 * FLAT structure: folders become collection tags, note slugs are just filenames
 *
 * usage: node terminal/build.js /path/to/obsidian/vault/public
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
const IMAGES_DIR = path.join(__dirname, 'images');

// get source path from args
const sourcePath = process.argv[2];

if (!sourcePath) {
    console.error('usage: node terminal/build.js /path/to/obsidian/vault');
    process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
    console.error(`error: source path does not exist: ${sourcePath}`);
    process.exit(1);
}

// vault root is the parent of the source path (for finding images/attachments)
const vaultRoot = path.dirname(sourcePath);

console.log(`building terminal from: ${sourcePath}`);

// ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
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

// build filename -> slug lookup (for wikilink resolution)
const filenameLookup = {};
const pathToSlugMap = {};

// special content types
let habitsConfig = null;
let nowData = null;

// first pass: collect all notes and build lookup table
mdFiles.forEach(filePath => {
    const relativePath = path.relative(sourcePath, filePath);
    const originalPath = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');

    // skip files or folders starting with underscore (private)
    if (relativePath.split('/').some(part => part.startsWith('_'))) {
        return;
    }

    // extract collection from folder (e.g., "1. thinking/note" -> "thinking")
    const parts = originalPath.split('/');
    let collection = null;
    if (parts.length > 1) {
        // Remove numbered prefix like "1. " from folder name
        collection = parts[0].replace(/^\d+\.\s*/, '').toLowerCase();
    }

    // slug is just the filename (flattened)
    const filename = parts[parts.length - 1];
    const slug = filename.toLowerCase().replace(/\s+/g, '-');

    // track mappings for link resolution
    filenameLookup[slug] = slug;
    filenameLookup[filename.toLowerCase().replace(/\s+/g, '-')] = slug;
    pathToSlugMap[originalPath] = slug;
    pathToSlugMap[originalPath.toLowerCase().replace(/\s+/g, '-')] = slug;

    const content = fs.readFileSync(filePath, 'utf8');
    const { data: frontmatter, content: markdown } = matter(content);

    rawContent[slug] = { markdown, originalPath };

    // check for special content types
    if (frontmatter.type === 'habit-tracker' && frontmatter.habits) {
        const currentYear = new Date().getFullYear();
        const habitsBlockMatch = markdown.match(/```habits\n([\s\S]*?)```/);
        const completionData = {};

        if (habitsBlockMatch) {
            const lines = habitsBlockMatch[1].trim().split('\n');
            lines.forEach(line => {
                const [name, daysStr] = line.split(':').map(s => s.trim());
                if (name && daysStr) {
                    const days = [];
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
            noteId: slug,
            title: frontmatter.title || 'habit tracker',
            year: currentYear,
            habits: processedHabits
        };
        console.log(`  → found habit tracker config with ${frontmatter.habits.length} habits`);
    }

    // check for now page with dashboard data
    if (frontmatter.title === 'now' || slug === 'now') {
        nowData = {
            location: frontmatter.location || 'seattle, wa',
            status: frontmatter.status || null,
            reading: frontmatter.reading || null,
            mood: frontmatter.mood || null,
            energy: frontmatter.energy || null,
            caffeine: frontmatter.caffeine || null,
            tended: frontmatter.tended || null
        };
        console.log(`  → found now page with dashboard data`);

        // also check for habits in now.md (centralized)
        if (frontmatter.habits) {
            const currentYear = new Date().getFullYear();
            const habitsBlockMatch = markdown.match(/```habits\n([\s\S]*?)```/);
            const completionData = {};

            if (habitsBlockMatch) {
                const lines = habitsBlockMatch[1].trim().split('\n');
                lines.forEach(line => {
                    const [name, daysStr] = line.split(':').map(s => s.trim());
                    if (name && daysStr) {
                        const days = [];
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
                noteId: slug,
                title: 'habits',
                year: currentYear,
                habits: processedHabits
            };
            console.log(`  → found habits config in now.md with ${frontmatter.habits.length} habits`);
        }
    }

    // extract wikilinks (skip image embeds prefixed with !)
    const wikilinks = [];
    const wikilinkRegex = /(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(markdown)) !== null) {
        wikilinks.push(match[1].toLowerCase().replace(/\s+/g, '-'));
    }

    // create excerpt (first paragraph, stripped of html)
    const excerptMatch = markdown.match(/^[^#\n][^\n]+/m);
    const excerpt = excerptMatch
        ? excerptMatch[0].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, link, display) => display || link).substring(0, 150)
        : '';

    // build note metadata
    notes[slug] = {
        title: frontmatter.title || filename,
        slug: slug,
        collection: collection,
        stage: frontmatter.stage || 'seedling',
        planted: frontmatter.planted || null,
        tended: frontmatter.tended || null,
        tags: frontmatter.tags || [],
        links: wikilinks,
        backlinks: [],
        excerpt: excerpt.trim()
    };
});

// second pass: convert markdown to html with resolved links
Object.entries(rawContent).forEach(([slug, { markdown, originalPath }]) => {
    console.log(`processing: ${slug}`);

    // convert image embeds to standard markdown images before marked processes them
    const imageExtensions = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
    markdown = markdown.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, altText) => {
        if (!imageExtensions.test(target)) return match;
        const imageSource = findImage(target);
        if (imageSource) {
            const safeFilename = target.replace(/\s+/g, '-').replace(/-{2,}/g, '-').toLowerCase();
            const destPath = path.join(IMAGES_DIR, safeFilename);
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(imageSource, destPath);
                console.log(`  → copied image: ${target} → images/${safeFilename}`);
            }
            const alt = altText || target.replace(/\.[^.]+$/, '');
            return `![${alt}](/terminal/images/${safeFilename})`;
        }
        console.log(`  ⚠ image not found: ${target}`);
        return match;
    });

    // convert markdown to html
    let html = marked(markdown);

    // convert wikilinks to html links with resolved slugs
    html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, display) => {
        const linkSlug = resolveSlug(link);
        const displayText = display || link;
        if (linkSlug && notes[linkSlug]) {
            return `<a href="#" class="wikilink" data-note="${linkSlug}">${displayText}</a>`;
        } else {
            return `<span class="wikilink-private" title="private note">${displayText} 🔒</span>`;
        }
    });

    // convert plain markdown links to internal notes
    html = html.replace(/<a href="([^"]+)"(?![^>]*class=)>([^<]+)<\/a>/g, (match, href, text) => {
        if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#') || href.startsWith('/')) {
            return match;
        }
        const linkSlug = resolveSlug(href);
        if (linkSlug && notes[linkSlug]) {
            return `<a href="#" class="wikilink" data-note="${linkSlug}">${text}</a>`;
        } else {
            return `<span class="wikilink-private" title="private note">${text} 🔒</span>`;
        }
    });

    // write html file (flat structure)
    const outputPath = path.join(OUTPUT_DIR, slug + '.html');
    fs.writeFileSync(outputPath, html);
});

// third pass: compute backlinks
Object.entries(notes).forEach(([slug, note]) => {
    note.links.forEach(linkTarget => {
        const targetSlug = resolveSlug(linkTarget);
        if (targetSlug && notes[targetSlug]) {
            if (!notes[targetSlug].backlinks.includes(slug)) {
                notes[targetSlug].backlinks.push(slug);
            }
        }
    });
});

// resolve links in notes metadata too
Object.values(notes).forEach(note => {
    note.links = note.links.map(link => resolveSlug(link) || link);
});

// compute stats
const stats = {
    total: Object.keys(notes).length,
    links: Object.values(notes).reduce((sum, n) => sum + n.links.length, 0),
    seedling: Object.values(notes).filter(n => n.stage === 'seedling').length,
    growing: Object.values(notes).filter(n => n.stage === 'growing').length,
    evergreen: Object.values(notes).filter(n => n.stage === 'evergreen').length,
    collections: [...new Set(Object.values(notes).map(n => n.collection).filter(Boolean))]
};

// write index.json
const index = { notes, stats };
fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));

// write habits-config.json if found
if (habitsConfig) {
    fs.writeFileSync(path.join(DATA_DIR, 'habits-config.json'), JSON.stringify(habitsConfig, null, 2));
    console.log(`\nhabits config saved: ${habitsConfig.habits.length} habits`);
}

// write now-data.json if found
if (nowData) {
    fs.writeFileSync(path.join(DATA_DIR, 'now-data.json'), JSON.stringify(nowData, null, 2));
    console.log(`now data saved: ${nowData.location}${nowData.status ? ' | ' + nowData.status : ''}`);
}

console.log(`\nbuild complete!`);
console.log(`  ${stats.total} notes`);
console.log(`  ${stats.links} links`);
console.log(`  collections: ${stats.collections.join(', ') || 'none'}`);
console.log(`  🌱 ${stats.seedling} seedling | 🌿 ${stats.growing} growing | 🌲 ${stats.evergreen} evergreen`);

// helper: find image file in vault
function findImage(imageName) {
    const searchPaths = [
        path.join(vaultRoot, imageName),
        path.join(vaultRoot, 'images', imageName),
        path.join(sourcePath, imageName),
    ];

    for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
            return searchPath;
        }
    }
    return null;
}

// helper: resolve a link target to a slug
function resolveSlug(linkTarget) {
    const normalized = linkTarget.toLowerCase().replace(/\s+/g, '-');

    // direct match
    if (notes[normalized]) return normalized;

    // lookup by filename
    if (filenameLookup[normalized]) return filenameLookup[normalized];

    // try path mapping
    if (pathToSlugMap[linkTarget]) return pathToSlugMap[linkTarget];
    if (pathToSlugMap[normalized]) return pathToSlugMap[normalized];

    // try just the filename part
    const parts = normalized.split('/');
    const filename = parts[parts.length - 1];
    if (filenameLookup[filename]) return filenameLookup[filename];
    if (notes[filename]) return filename;

    return null;
}
