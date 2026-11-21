import fs from 'node:fs';
import path from 'node:path';
import Image from '@11ty/eleventy-img';
import { photoSource } from './photographs.js';

const images = new Map();
const publicRoot = path.resolve('public');

export async function photoSocialImage(inputPath) {
  const photo = photoSource(inputPath);
  const source = path.resolve(publicRoot, '.' + decodeURIComponent(new URL(photo.src, 'https://santi.wtf').pathname));
  if (!source.startsWith(publicRoot + path.sep)) throw new Error(`Social image escapes public/: ${photo.src}`);
  const key = `${source}:${fs.statSync(source).mtimeMs}`;
  if (!images.has(key)) images.set(key, Image(source, {
    fixOrientation: true,
    widths: [1200],
    formats: ['jpeg'],
    outputDir: './_site/images/social/',
    urlPath: '/images/social/',
    sharpJpegOptions: { quality: 78, mozjpeg: true },
  }));
  const metadata = (await images.get(key)).jpeg[0];
  return {
    url: metadata.url,
    width: metadata.width,
    height: metadata.height,
    type: 'image/jpeg',
    alt: photo.alt,
  };
}
