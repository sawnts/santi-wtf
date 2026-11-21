import { rm } from 'node:fs/promises';

// A full build must not inherit routes or images from a previous build mode.
await rm(new URL('../_site/', import.meta.url), { recursive: true, force: true });
