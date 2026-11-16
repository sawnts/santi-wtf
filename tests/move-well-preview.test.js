import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createPreviewServer, validateProjection } from '../scripts/move-well-preview.mjs';
import { evaluateEvidence } from '../public/js/move-well-model.js';
import { scenario } from '../public/js/move-well-fixtures.js';

function sample() { const input = scenario('steady'); input.audience = 'private'; return evaluateEvidence(input); }
test('endpoint allowlist rejects raw, identifier, and nested surprise fields', () => {
  assert.equal(validateProjection(sample()), true);
  for (const mutate of [p => { p.raw = {}; }, p => { p.sources[0].recordId = 'synthetic-id'; }, p => { p.sources[0] = null; }, p => { p.history[0].date = '2026-13-99'; }, p => { p.history[0].notes = 'synthetic note'; }, p => { p.pillars[0].label = 'unexpected text'; }, p => { p.audience = 'synthetic'; }]) {
    const p = sample(); mutate(p); assert.equal(validateProjection(p), false);
  }
});

test('local server isolates private projection, rejects cross-origin and serves site', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mw-preview-test-'));
  const site = path.join(dir, 'site'); await mkdir(site);
  await writeFile(path.join(site, 'index.html'), 'synthetic site');
  const privateFile = path.join(dir, 'avatar.private.json'); await writeFile(privateFile, JSON.stringify(sample()));
  const server = createPreviewServer({ siteRoot: site, privateFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const port = server.address().port;
  const get = (url, headers = {}) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url, headers }, (res) => {
      let body = ''; res.on('data', (data) => { body += data; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
  assert.equal((await get('/')).body, 'synthetic site');
  const own = await get('/__move-well/avatar');
  assert.equal(own.status, 200); assert.equal(JSON.parse(own.body).audience, 'private'); assert.equal(own.headers['cache-control'], 'no-store'); assert.equal(own.headers['access-control-allow-origin'], undefined);
  assert.equal((await get('/__move-well/avatar', { Origin: 'https://example.com' })).status, 403);
  assert.equal((await get('/__move-well/avatar', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await get('/__move-well/avatar', { Host: 'untrusted.example' })).status, 403);
  assert.equal((await get('/avatar.private.json')).status, 404);
  assert.equal((await get('/.git/config')).status, 404);
  assert.equal((await get('/__move-well/coach')).status, 404);
  await writeFile(privateFile, JSON.stringify({ ...sample(), recordId: 'synthetic-id' }));
  const rejected = await get('/__move-well/avatar'); assert.equal(rejected.status, 503); assert.equal(rejected.body.includes('synthetic-id'), false);
});
