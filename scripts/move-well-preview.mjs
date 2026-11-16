import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOP_KEYS = ['schemaVersion', 'audience', 'generatedAt', 'verifiedAt', 'timezone', 'mode', 'xp', 'evidenceXp', 'retainedXp', 'level', 'stage', 'levelProgress', 'nextLevelXp', 'fresh', 'pillars', 'totals', 'history', 'sources', 'rules'];
const DOMAINS = ['running', 'recovery', 'strength', 'mobility', 'nutrition'];
const PILLARS = ['activity', 'consistency', 'recovery', 'improvement'];
const RULES = ['activityXp', 'consistencyXp', 'recoveryXp', 'improvementXp', 'weeklyTarget', 'xpPerLevel'];
function shape(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
const integer = (n) => Number.isSafeInteger(n) && n >= 0;
function date(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
function instant(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now(); }

// Reject extra fields at every boundary, including inside arrays. This endpoint
// cannot accidentally expose a future private adapter's notes or raw records.
export function validateProjection(p) {
  if (!shape(p, TOP_KEYS) || p.schemaVersion !== 1 || p.audience !== 'private' || p.timezone !== 'America/Los_Angeles') return false;
  if (!instant(p.generatedAt) || !(p.verifiedAt === null || instant(p.verifiedAt)) || !['build', 'rest', 'injury'].includes(p.mode)) return false;
  if (!['xp', 'evidenceXp', 'retainedXp', 'level', 'levelProgress', 'nextLevelXp'].every((key) => integer(p[key])) || p.level < 1 || p.levelProgress > 99) return false;
  if (!['seed', 'sprout', 'bloom', 'canopy'].includes(p.stage) || !['fresh', 'stale', 'unknown'].includes(p.fresh)) return false;
  if (!shape(p.totals, ['activityDays', 'recoveryDays', 'improvementDays', 'careDays']) || !Object.values(p.totals).every(integer)) return false;
  if (!shape(p.rules, RULES) || !Object.values(p.rules).every(integer) || p.rules.weeklyTarget < 1 || p.rules.weeklyTarget > 7 || p.rules.xpPerLevel < 1) return false;
  const labels = ['verified activity', 'sustainable consistency', 'recovery actions', 'personal improvement'];
  if (!Array.isArray(p.pillars) || p.pillars.length !== 4 || !p.pillars.every((v, i) => shape(v, ['key', 'label', 'xp', 'days']) && v.key === PILLARS[i] && v.label === labels[i] && integer(v.xp) && integer(v.days))) return false;
  if (!Array.isArray(p.history) || p.history.length > 5000 || !p.history.every((v) => shape(v, ['date', 'kind', 'xp']) && date(v.date) && ['activity', 'recovery', 'rest', 'unknown'].includes(v.kind) && integer(v.xp))) return false;
  if (!Array.isArray(p.sources) || p.sources.length > 5 || new Set(p.sources.map((s) => s?.domain)).size !== p.sources.length || !p.sources.every((v) => shape(v, ['domain', 'status', 'verifiedAt']) && DOMAINS.includes(v.domain) && ['connected', 'planned', 'missing'].includes(v.status) && (v.verifiedAt === null || instant(v.verifiedAt)))) return false;
  return true;
}

export function createPreviewServer({ siteRoot = path.join(ROOT, '_site'), privateFile = null } = {}) {
  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const end = (code, text) => { response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(text); };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host ?? '')) return end(403, 'local preview only');
    if (!['GET', 'HEAD'].includes(request.method)) return end(405, 'method not allowed');
    let url;
    try { url = new URL(request.url, `http://${request.headers.host}`); } catch { return end(400, 'invalid request'); }
    if (url.pathname.startsWith('/__move-well/')) {
      if (url.pathname !== '/__move-well/avatar' || url.search) return end(404, 'not found');
      const origin = `http://${request.headers.host}`;
      if ((request.headers.origin && request.headers.origin !== origin) || (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) return end(403, 'same origin only');
      if (!privateFile) return end(503, 'owner preview unavailable');
      try {
        const resolved = await realpath(privateFile);
        // Private data must be outside the repository, including its build output.
        if (resolved === ROOT || resolved.startsWith(ROOT + path.sep)) return end(503, 'owner preview unavailable');
        const info = await stat(resolved);
        if (!info.isFile() || info.size > 1_000_000) return end(503, 'owner preview unavailable');
        const projection = JSON.parse(await readFile(resolved, 'utf8'));
        if (!validateProjection(projection)) return end(503, 'owner preview unavailable');
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return response.end(request.method === 'HEAD' ? undefined : JSON.stringify(projection));
      } catch { return end(503, 'owner preview unavailable'); }
    }
    try {
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split('/').some((part) => part.startsWith('.'))) return end(404, 'not found');
      const requested = path.resolve(siteRoot, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      const resolved = await realpath(requested);
      const root = await realpath(siteRoot);
      if (!resolved.startsWith(root + path.sep) || !(await stat(resolved)).isFile()) return end(404, 'not found');
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
      response.writeHead(200, { 'Content-Type': types[path.extname(resolved)] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : await readFile(resolved));
    } catch { end(404, 'not found'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const privateIndex = args.indexOf('--private-file');
  const privateFile = privateIndex < 0 ? null : args[privateIndex + 1];
  const portIndex = args.indexOf('--port');
  const port = portIndex < 0 ? 8091 : Number(args[portIndex + 1]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || (privateIndex >= 0 && !privateFile)) { process.stderr.write('invalid preview options\n'); process.exit(1); }
  const server = createPreviewServer({ privateFile });
  server.on('error', () => { process.stderr.write('preview could not start\n'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Local: http://127.0.0.1:${port}/move-well/\n`));
}
