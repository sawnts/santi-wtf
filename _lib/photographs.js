import fs from 'node:fs';
import path from 'node:path';
import Image from '@11ty/eleventy-img';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt();
const sources = new Map();
const images = new Map();
const publicRoot = path.resolve('public');

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function photoSource(inputPath) {
  const file = path.resolve(inputPath);
  const modified = fs.statSync(file).mtimeMs;
  const cached = sources.get(file);
  if (cached?.modified === modified) return cached.photo;
  const body = fs.readFileSync(file, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const findImage = (tokens) => {
    for (const token of tokens) {
      if (token.type === 'image') return token;
      if (token.children) {
        const nested = findImage(token.children);
        if (nested) return nested;
      }
    }
  };
  const image = findImage(markdown.parse(body, {}));
  if (!image) throw new Error(`Photo post ${inputPath} needs a Markdown image.`);
  const photo = { src: image.attrGet('src'), alt: image.content };
  if (!photo.src.startsWith('/images/')) throw new Error(`Photo post ${inputPath} must use a local /images/ image.`);
  sources.set(file, { modified, photo });
  return photo;
}

export async function optimizedImage(src) {
  const source = path.resolve(publicRoot, '.' + decodeURIComponent(new URL(src, 'https://santi.wtf').pathname));
  if (!source.startsWith(publicRoot + path.sep)) throw new Error(`Image escapes public/: ${src}`);
  const modified = fs.statSync(source).mtimeMs;
  const key = `${source}:${modified}`;
  if (!images.has(key)) images.set(key, Image(source, {
    fixOrientation: true,
    widths: [320, 640, 1600],
    formats: ['webp'],
    outputDir: './_site/images/generated/',
    urlPath: '/images/generated/',
    sharpWebpOptions: { quality: 82, effort: 6 },
  }));
  return (await images.get(key)).webp;
}

export async function renderImage(src, alt, mode = 'full') {
  const variants = await optimizedImage(src);
  const full = variants[variants.length - 1];
  const thumbnail = mode === 'thumbnail';
  const wall = mode === 'wall';
  const ratio = full.width / full.height;
  const image = wall
    ? variants.find((variant) => variant.width >= 522) || full
    : thumbnail ? variants.find((variant) => variant.width >= 76 * ratio) || full : full;
  const sizes = wall
    ? '(max-width: 732px) calc(100vw - 60px), (max-width: 1152px) calc((100vw - 108px) / 2), 522px'
    : thumbnail ? `(max-width: 532px) ${Math.ceil(68 * ratio)}px, ${Math.ceil(76 * ratio)}px`
      : '(max-width: 768px) calc(100vw - 60px), 708px';
  return `<img src="${image.url}" srcset="${variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ')}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${escapeHtml(alt)}" loading="${thumbnail || wall ? 'lazy' : 'eager'}" decoding="async">`;
}

export async function photograph(inputPath, mode) {
  const photo = photoSource(inputPath);
  return renderImage(photo.src, photo.alt, mode);
}

export async function photoLightbox(inputPath, title, date) {
  const photo = photoSource(inputPath);
  const variants = await optimizedImage(photo.src);
  const full = variants[variants.length - 1];
  return Object.entries({
    'data-lightbox': 'photographs',
    'data-photo-src': full.url,
    'data-photo-alt': photo.alt,
    'data-photo-title': title,
    'data-photo-date': `published ${date}`,
    'data-photo-width': full.width,
    'data-photo-height': full.height,
  }).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ');
}
