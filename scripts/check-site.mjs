import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '_site');
const args = process.argv.slice(2);
assert(args.every((arg) => /^--mode=(site|construction)$/.test(arg)), 'Use --mode=site or --mode=construction.');
assert(args.length <= 1, 'Specify one validation mode.');
const mode = args[0]?.split('=')[1] || 'site';
const site = JSON.parse(fs.readFileSync(path.join(root, '_data/site.json'), 'utf8'));
const origin = new URL(site.url).origin;
const errors = [];
const fail = (message) => errors.push(message);
const label = (file) => path.relative(output, file).split(path.sep).join('/');

assert(fs.existsSync(output) && fs.lstatSync(output).isDirectory(), 'Build _site/ before checking it.');

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(`${file}: symbolic links are not allowed in the published output.`);
      return [];
    }
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}

function inspectHtml(source) {
  const elements = [];
  const ids = new Set();
  const duplicates = new Set();
  function visit(node) {
    if (node.tagName) {
      const element = { tag: node.tagName, attrs: Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])), node };
      elements.push(element);
      if (element.attrs.id) {
        if (ids.has(element.attrs.id)) duplicates.add(element.attrs.id);
        ids.add(element.attrs.id);
      }
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(source));
  return { elements, ids, duplicates };
}

function articleProseOwner(node) {
  let prose = false;
  for (let ancestor = node.parentNode; ancestor; ancestor = ancestor.parentNode) {
    const classes = ancestor.attrs?.find(({ name }) => name === 'class')?.value.split(/\s+/) || [];
    if (classes.includes('prose')) prose = true;
    if (ancestor.tagName === 'article') return prose ? ancestor : undefined;
  }
  return undefined;
}

const files = filesIn(output);
const pages = new Map(files.filter((file) => file.endsWith('.html')).map((file) => [file, inspectHtml(fs.readFileSync(file, 'utf8'))]));
let referenceCount = 0;

function srcsetUrls(value) {
  const urls = [];
  let index = 0;
  while (index < value.length) {
    while (/[\s,]/.test(value[index] || '') && index < value.length) index++;
    const start = index;
    while (index < value.length && !/\s/.test(value[index])) index++;
    const url = value.slice(start, index);
    if (!url) break;
    urls.push(url.replace(/,+$/, ''));
    if (url.endsWith(',')) continue;
    // Commas inside data URLs belong to the URL; commas after descriptors separate candidates.
    let parentheses = 0;
    while (index < value.length) {
      const character = value[index++];
      if (character === '(') parentheses++;
      if (character === ')') parentheses--;
      if (character === ',' && parentheses === 0) break;
    }
  }
  return urls;
}

function checkReference(raw, fromFile, context, allowData = false) {
  if (!raw?.trim()) return;
  raw = raw.trim();
  let url;
  try {
    url = new URL(raw, `${origin}/${label(fromFile)}`);
  } catch {
    fail(`${label(fromFile)}: invalid ${context} URL ${JSON.stringify(raw)}.`);
    return;
  }
  if (['mailto:', 'tel:'].includes(url.protocol)) return;
  if (allowData && url.protocol === 'data:') return;
  if (!['http:', 'https:'].includes(url.protocol)) {
    fail(`${label(fromFile)}: unsupported ${context} URL scheme in ${JSON.stringify(raw)}.`);
    return;
  }
  if (url.origin !== origin) return;

  // Check before URL normalization removes traversal segments. Never follow a URL outside _site/.
  let rawPath;
  let pathname;
  try {
    rawPath = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    fail(`${label(fromFile)}: malformed URL encoding in ${JSON.stringify(raw)}.`);
    return;
  }
  if (/[\\\0]/.test(rawPath) || rawPath.split('/').includes('..') || /%(?:2e|2f|5c|00)/i.test(pathname)) {
    fail(`${label(fromFile)}: unsafe path in ${context} ${JSON.stringify(raw)}.`);
    return;
  }
  let target = path.resolve(output, `.${pathname}`);
  if (!target.startsWith(output + path.sep) && target !== output) {
    fail(`${label(fromFile)}: ${context} escapes _site/: ${JSON.stringify(raw)}.`);
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  referenceCount++;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    fail(`${label(fromFile)}: ${context} ${JSON.stringify(raw)} points to missing ${label(target)}.`);
    return;
  }
  if (url.hash && pages.has(target)) {
    let fragment;
    try { fragment = decodeURIComponent(url.hash.slice(1)); } catch {
      fail(`${label(fromFile)}: malformed fragment in ${JSON.stringify(raw)}.`);
      return;
    }
    if (fragment && !pages.get(target).ids.has(fragment)) fail(`${label(fromFile)}: ${context} ${JSON.stringify(raw)} points to a missing fragment.`);
  }
}

for (const [file, page] of pages) {
  const { elements, ids, duplicates } = page;
  for (const id of duplicates) fail(`${label(file)}: duplicate id ${JSON.stringify(id)}.`);
  for (const tag of ['main', 'h1']) {
    const count = elements.filter((element) => element.tag === tag).length;
    if (count !== 1) fail(`${label(file)}: expected one <${tag}>, found ${count}.`);
  }
  if (!elements.find(({ tag, attrs }) => tag === 'html' && attrs.lang)) fail(`${label(file)}: missing document language.`);
  if (!elements.find(({ tag, node }) => tag === 'title' && node.childNodes.some((child) => child.value?.trim()))) fail(`${label(file)}: missing document title.`);
  // The page header owns h1; article prose starts at h2 and may deepen one level at a time.
  const articleHeadingLevels = new Map();
  for (const { tag, attrs, node } of elements.filter(({ tag }) => /^h[1-6]$/.test(tag))) {
    const article = articleProseOwner(node);
    if (!article) continue;
    const previousHeadingLevel = articleHeadingLevels.get(article) || 1;
    const level = Number(tag.slice(1));
    const heading = `${tag}${attrs.id ? `#${attrs.id}` : ''}`;
    if (level === 1) fail(`${label(file)}: ${heading} in article prose must be below the page h1.`);
    else if (level > previousHeadingLevel + 1) fail(`${label(file)}: ${heading} skips h${previousHeadingLevel + 1} after h${previousHeadingLevel} in the article outline.`);
    articleHeadingLevels.set(article, level);
  }
  for (const { tag, attrs } of elements) {
    for (const attribute of ['href', 'src', 'poster', 'action', 'data-photo-src']) {
      if (attribute in attrs) checkReference(attrs[attribute], file, `${tag}[${attribute}]`, ['src', 'poster'].includes(attribute));
    }
    if (attrs.srcset) {
      for (const candidate of srcsetUrls(attrs.srcset)) checkReference(candidate, file, `${tag}[srcset]`, true);
    }
    if (tag === 'meta' && ['og:image', 'twitter:image'].includes(attrs.property || attrs.name)) checkReference(attrs.content, file, 'social image');
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      for (const id of (attrs[attribute] || '').split(/\s+/).filter(Boolean)) {
        if (!ids.has(id)) fail(`${label(file)}: ${tag}[${attribute}] refers to missing id ${JSON.stringify(id)}.`);
      }
    }
    if (tag === 'img') {
      if (!('alt' in attrs)) fail(`${label(file)}: image ${JSON.stringify(attrs.src || '(dynamic)')} has no alt attribute.`);
      // The hidden lightbox image acquires its source and dimensions when opened.
      if (attrs.src && (!/^\d+$/.test(attrs.width || '') || Number(attrs.width) <= 0 || !/^\d+$/.test(attrs.height || '') || Number(attrs.height) <= 0)) {
        fail(`${label(file)}: image ${JSON.stringify(attrs.src)} needs positive width and height.`);
      }
    }
  }
}

for (const file of files.filter((file) => file.endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/g)) checkReference(match[2] || match[3], file, 'CSS url()', true);
  for (const match of css.matchAll(/@import\s+(["'])(.*?)\1/g)) checkReference(match[2], file, 'CSS @import');
}

function frontmatter(text) {
  return text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
}

function permalinkFrom(text) {
  const value = text?.match(/^\s*permalink:\s*(.*?)\s*$/m)?.[1];
  return value?.replace(/^(['"])([\s\S]*)\1$/, '$2');
}

let expectedRoutes = 0;
if (mode === 'site') {
  const ignored = fs.readFileSync(path.join(root, '.eleventyignore'), 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  for (const entry of ignored) {
    const stem = entry.replace(/\.(?:md|njk|html)$/, '');
    for (const file of files) {
      const published = label(file);
      if (entry.endsWith('/') ? published.startsWith(entry) : [entry, `${stem}.html`, `${stem}/index.html`].includes(published)) {
        fail(`${published}: excluded source ${entry} was published.`);
      }
    }
  }
  for (const file of files) {
    if (/^(?:_includes|_data|_lib|node_modules|scripts|construction|\.git|\.github|\.impeccable)(?:\/|$)/.test(label(file))) fail(`${label(file)}: private source/helper path was published.`);
  }

  const sources = fs.readdirSync(root).filter((name) => /\.(?:md|njk|html|11ty\.js)$/.test(name) && !ignored.includes(name)).map((name) => ({ file: path.join(root, name) }));
  for (const directory of ['notes', 'newsletter', 'photos']) {
    const collectionData = JSON.parse(fs.readFileSync(path.join(root, directory, `${directory}.json`), 'utf8'));
    for (const file of filesIn(path.join(root, directory)).filter((file) => file.endsWith('.md'))) sources.push({ file, inherited: collectionData.permalink });
  }
  for (const { file, inherited } of sources) {
    const text = fs.readFileSync(file, 'utf8');
    const data = frontmatter(text);
    let route = permalinkFrom(data) || inherited;
    if (file.endsWith('.11ty.js')) route = text.match(/\bpermalink:\s*(["'])(.*?)\1/)?.[2];
    if (route === 'false') continue;
    if (!route && data !== undefined) route = file.endsWith('.html')
      ? `/${path.relative(root, file)}`
      : `/${path.relative(root, file).replace(/\.(?:md|njk)$/, '')}/`;
    if (!route) continue;
    const basename = path.basename(file, path.extname(file));
    const slug = basename === 'index' ? path.basename(path.dirname(file)) : basename;
    route = route.replace(/{{\s*page\.fileSlug\s*}}/g, slug);
    if (route.includes('{{')) { fail(`${path.relative(root, file)}: validator cannot resolve permalink ${JSON.stringify(route)}.`); continue; }
    expectedRoutes++;
    checkReference(route, path.join(output, 'index.html'), `source route from ${path.relative(root, file)}`);
  }
} else {
  const expected = new Map([
    ['index.html', 'construction/index.html'], ['404.html', 'construction/404.html'],
    ['css/construction.css', 'construction/styles.css'],
    ['fonts/MonaspaceNeonVar.woff2', 'public/fonts/MonaspaceNeonVar.woff2'],
    ['favicon.svg', 'public/favicon.svg'], ['CNAME', 'CNAME'], ['.nojekyll', '.nojekyll'],
  ]);
  for (const file of files) if (!expected.has(label(file))) fail(`${label(file)}: construction output must not include full-site content or extra files.`);
  for (const [published, source] of expected) {
    const file = path.join(output, published);
    if (!fs.existsSync(file)) fail(`${published}: missing construction output.`);
    else if (!fs.readFileSync(file).equals(fs.readFileSync(path.join(root, source)))) fail(`${published}: does not match its construction source ${source}.`);
  }
  const expectedPolicy = {
    'default-src': "'none'", 'style-src': "'self'", 'font-src': "'self'", 'img-src': "'self'",
    'base-uri': "'none'", 'object-src': "'none'", 'form-action': "'none'",
  };
  for (const [file, { elements }] of pages) {
    const policy = elements.find(({ tag, attrs }) => tag === 'meta' && attrs['http-equiv']?.toLowerCase() === 'content-security-policy')?.attrs.content;
    const directives = Object.fromEntries((policy || '').split(';').map((part) => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values.join(' ')]));
    if (JSON.stringify(Object.entries(directives).sort()) !== JSON.stringify(Object.entries(expectedPolicy).sort())) fail(`${label(file)}: expected the restrictive construction Content-Security-Policy.`);
    if (elements.some(({ tag }) => ['script', 'form', 'iframe'].includes(tag))) fail(`${label(file)}: construction page must not contain scripts, forms, or iframes.`);
  }
}

assert.equal(errors.length, 0, `Site validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
console.log(`Validated ${mode}: ${pages.size} HTML pages, ${referenceCount} local references${mode === 'site' ? `, ${expectedRoutes} source routes` : ''}.`);
