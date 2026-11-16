import { DEFAULT_RULES, evaluateEvidence } from './move-well-model.js';
import { scenario } from './move-well-fixtures.js';

const root = document.querySelector('#move-well');
const $ = (id) => document.getElementById(`mw-${id}`);
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
const sourceNames = { running: 'running / coros', recovery: 'recovery / sleep context', strength: 'strength', mobility: 'mobility', nutrition: 'nutrition' };
const pillarNames = { activity: 'movement', consistency: 'consistency', recovery: 'care', improvement: 'improvement' };
const pillarCopy = { activity: 'verified days · daily cap', consistency: 'days credited · weekly cap', recovery: 'confirmed care actions', improvement: 'confirmed personal milestones' };
const stageCopy = { seed: 'every practice starts somewhere.', sprout: 'a small rhythm is taking root.', bloom: 'steady care makes room to grow.', canopy: 'a practice with roots of its own.' };
const dateLabel = (value) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)).toLowerCase();
let rules = { ...DEFAULT_RULES };
let privateProjection = null;
let privateLoadedAt = null;

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}

function freshness(timestamp) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) > Date.now()) return 'unknown';
  return Date.now() - Date.parse(timestamp) > 36 * 3_600_000 ? 'stale' : 'fresh';
}

function showError(message) { $('error').textContent = message; $('error').hidden = !message; }

function render(projection) {
  const privateMode = projection.audience === 'private';
  $('audience').textContent = privateMode ? 'private owner preview' : 'synthetic preview';
  $('context').textContent = privateMode ? 'local derived summaries · visible on this mac · never bundled into the website.' : 'an interactive sketch with invented data. your health records stay private.';
  $('scenario').disabled = privateMode;
  $('private').textContent = privateMode ? 'back to synthetic preview' : 'open owner preview';
  for (const input of $('rules-form').elements) input.disabled = privateMode;
  $('rule-state').textContent = privateMode ? 'owner rules come from private settings' : 'preview only · nothing saved';
  for (const [key, value] of Object.entries(projection.rules)) $('rules-form').elements.namedItem(key).value = value;
  $('avatar').dataset.stage = projection.stage;
  $('avatar').dataset.mode = projection.mode;
  $('level').textContent = `level ${projection.level}`;
  $('chapter').textContent = `chapter ${String(projection.level).padStart(2, '0')}`;
  $('mode').textContent = ({ build: 'building', rest: 'resting', injury: 'room to heal' })[projection.mode];
  $('stage-name').textContent = projection.stage;
  $('stage-copy').textContent = stageCopy[projection.stage];
  $('avatar-title').textContent = `your ${projection.stage} companion, level ${projection.level}, ${$('mode').textContent}`;
  $('xp').textContent = `${projection.xp} xp earned`;
  $('next').textContent = `${projection.nextLevelXp - projection.xp} to next level`;
  $('progress').value = projection.levelProgress;
  $('progress').setAttribute('aria-valuetext', `${projection.levelProgress}% to level ${projection.level + 1}`);
  $('gentle').textContent = projection.mode === 'build' ? 'earned growth stays with you. rest is part of the practice.' : 'no catching up required. earned growth stays, and intentional rest counts toward consistency.';
  const fresh = freshness(projection.verifiedAt);
  const connected = projection.sources.filter((s) => s.status === 'connected');
  const partial = connected.some((s) => freshness(s.verifiedAt) !== 'fresh');
  $('fresh-dot').dataset.fresh = partial && fresh === 'fresh' ? 'stale' : fresh;
  $('freshness').textContent = fresh === 'unknown' ? 'no verified check yet · unknown days stay unknown' : `${fresh === 'stale' ? 'data check overdue' : partial ? 'some source checks overdue' : 'latest verified source check'} · ${dateLabel(projection.verifiedAt)} pt${privateMode ? '' : ' · synthetic'}`;
  if (privateMode && privateLoadedAt) $('freshness').textContent += ` · loaded ${dateLabel(privateLoadedAt)} pt`;
  $('pillars').replaceChildren(...projection.pillars.map((pillar) => {
    const item = node('div', undefined, 'mw-pillar');
    const top = node('div', undefined, 'mw-pillar-top');
    top.append(node('span', pillarNames[pillar.key]), node('span', `+${pillar.xp} xp`));
    item.append(top, node('strong', String(pillar.days)), node('p', pillarCopy[pillar.key]));
    return item;
  }));
  if (projection.xp > projection.evidenceXp) {
    $('gentle').textContent += ` ${projection.xp - projection.evidenceXp} xp retained beyond the current evidence totals.`;
  }
  const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (key) => todayParts.find((p) => p.type === key).value;
  const today = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const history = new Map(projection.history.map((entry) => [entry.date, entry]));
  $('history').replaceChildren(...Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today - (27 - index) * 86_400_000).toISOString().slice(0, 10);
    const entry = history.get(date) ?? { date, kind: 'unknown', xp: 0 };
    const item = node('li');
    item.dataset.kind = entry.kind;
    const label = `${date}: ${entry.kind === 'unknown' ? 'no verified evidence' : entry.kind}, ${entry.xp} xp`;
    item.title = label;
    item.append(node('span', label, 'visually-hidden'));
    return item;
  }));
  $('sources').replaceChildren(...projection.sources.map((source) => {
    const item = node('li');
    const status = source.status === 'planned' ? 'planned' : source.status === 'missing' ? 'no verified data' : `${privateMode ? 'connected' : 'simulated'} · ${freshness(source.verifiedAt) === 'fresh' ? 'checked' : freshness(source.verifiedAt) === 'stale' ? 'check overdue' : 'check unknown'}`;
    item.append(node('span', sourceNames[source.domain]), node('span', status));
    if (source.verifiedAt) item.title = `verified ${dateLabel(source.verifiedAt)} pt`;
    return item;
  }));
}

function update() {
  try { render(privateProjection ?? evaluateEvidence(scenario($('scenario').value), rules)); }
  catch { showError('this preview could not be evaluated. reset the rules to try again.'); }
}

$('scenario').addEventListener('change', () => { showError(''); update(); });
$('rules-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (privateProjection || !$('rules-form').reportValidity()) return;
  const next = Object.fromEntries(Object.keys(DEFAULT_RULES).map((key) => [key, Number($('rules-form').elements.namedItem(key).value)]));
  try { evaluateEvidence(scenario($('scenario').value), next); rules = next; showError(''); update(); $('rule-state').textContent = 'preview rules applied · nothing saved'; }
  catch { showError('use whole numbers within the shown ranges.'); }
});
$('reset').addEventListener('click', () => { rules = { ...DEFAULT_RULES }; showError(''); update(); });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function pause(paused) { root.classList.toggle('paused', paused); $('motion').setAttribute('aria-pressed', String(paused)); $('motion').textContent = paused ? 'resume animation' : 'pause animation'; }
pause(reducedMotion.matches);
$('motion').addEventListener('click', () => pause(!root.classList.contains('paused')));
reducedMotion.addEventListener('change', (event) => pause(event.matches));
$('private').hidden = !local;
$('private').addEventListener('click', async () => {
  if (privateProjection) { privateProjection = null; showError(''); update(); return; }
  $('private').disabled = true;
  try {
    const response = await fetch('/__move-well/avatar', { credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('unavailable');
    const projection = await response.json();
    if (projection.schemaVersion !== 1 || projection.audience !== 'private' || !['seed', 'sprout', 'bloom', 'canopy'].includes(projection.stage) || !Array.isArray(projection.history) || !Array.isArray(projection.sources) || !Array.isArray(projection.pillars)) throw new Error('invalid');
    render(projection);
    privateProjection = projection;
    privateLoadedAt = new Date().toISOString();
    showError(''); update();
  } catch { privateProjection = null; update(); showError('owner preview is unavailable. start the local private preview with a verified projection; the synthetic preview remains available.'); }
  finally { $('private').disabled = false; }
});
update();
setInterval(() => { if (!$('rules-form').contains(document.activeElement)) update(); }, 60_000);
