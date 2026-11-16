// Pure, versioned rules shared by the synthetic preview and private projection.
// No physiology value is an achievement; recovery means a verified action.
export const DEFAULT_RULES = Object.freeze({
  activityXp: 10,
  consistencyXp: 5,
  recoveryXp: 5,
  improvementXp: 10,
  weeklyTarget: 3,
  xpPerLevel: 100,
});

const DOMAINS = new Set(['running', 'recovery', 'strength', 'mobility', 'nutrition']);
const MODES = new Set(['build', 'rest', 'injury']);
const DAY_MS = 86_400_000;

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function object(value, keys, name) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `invalid ${name}`);
  assert(Object.keys(value).every((key) => keys.includes(key)), `unsupported ${name} fields`);
}

function calendarDate(value) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'invalid evidence date');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  assert(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, 'invalid evidence date');
  return value;
}

function timestamp(value, latest, name) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value), `invalid ${name}`);
  calendarDate(value.slice(0, 10));
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed) && parsed <= latest, `invalid or future ${name}`);
  return parsed;
}

function localDate(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function monday(date) {
  const instant = new Date(`${date}T00:00:00Z`);
  const offset = (instant.getUTCDay() + 6) % 7;
  return new Date(instant.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
}

function verifiedFlag(value, name) {
  if (value === null) return false;
  object(value, ['verified'], name);
  assert(typeof value.verified === 'boolean', `invalid ${name} verification`);
  return value.verified;
}

function validateRules(rules) {
  object(rules, Object.keys(DEFAULT_RULES), 'rules');
  for (const key of Object.keys(DEFAULT_RULES)) {
    assert(Number.isSafeInteger(rules[key]) && rules[key] >= 0, 'invalid progression rule');
  }
  assert(rules.weeklyTarget >= 1 && rules.weeklyTarget <= 7 && rules.xpPerLevel >= 1, 'invalid progression rule');
  return { ...rules };
}

export function evaluateEvidence(input, rules = DEFAULT_RULES, now = new Date()) {
  assert(now instanceof Date && Number.isFinite(now.getTime()), 'invalid evaluation time');
  object(input, ['schemaVersion', 'audience', 'generatedAt', 'verifiedAt', 'timezone', 'mode', 'days', 'sources', 'retainedXp'], 'input');
  assert(input.schemaVersion === 1, 'unsupported schema version');
  assert(input.audience === 'synthetic' || input.audience === 'private', 'invalid audience');
  assert(input.timezone === 'America/Los_Angeles', 'unsupported timezone');
  assert(MODES.has(input.mode), 'invalid mode');
  assert(Array.isArray(input.days) && Array.isArray(input.sources), 'invalid evidence collections');
  const appliedRules = validateRules(rules);
  const generatedMs = timestamp(input.generatedAt, now.getTime(), 'generation time');
  const verifiedMs = input.verifiedAt === null ? null : timestamp(input.verifiedAt, generatedMs, 'verification time');
  const retainedXp = input.retainedXp === undefined ? 0 : input.retainedXp;
  assert(Number.isSafeInteger(retainedXp) && retainedXp >= 0, 'invalid retained xp');
  const sourceDomains = new Set();
  const sources = input.sources.map((source) => {
    object(source, ['domain', 'status', 'verifiedAt'], 'source');
    assert(DOMAINS.has(source.domain) && !sourceDomains.has(source.domain), 'invalid or duplicate source domain');
    sourceDomains.add(source.domain);
    assert(['connected', 'planned', 'missing'].includes(source.status), 'invalid source status');
    if (source.verifiedAt !== null) {
      timestamp(source.verifiedAt, generatedMs, 'source verification time');
      assert(source.status === 'connected', 'unconnected source cannot verify evidence');
      assert(verifiedMs !== null && Date.parse(source.verifiedAt) <= verifiedMs, 'inconsistent source verification');
    }
    return { domain: source.domain, status: source.status, verifiedAt: source.verifiedAt };
  });
  const connected = new Set(sources.filter((source) => source.status === 'connected' && source.verifiedAt !== null).map((source) => source.domain));
  const verifiedDates = new Map(sources.filter((source) => connected.has(source.domain)).map((source) => [source.domain, localDate(new Date(source.verifiedAt), input.timezone)]));
  const today = localDate(now, input.timezone);
  const dates = new Map();
  for (const day of input.days) {
    object(day, ['date', 'activity', 'recovery', 'intentionalRest', 'improvement'], 'day');
    const date = calendarDate(day.date);
    assert(typeof day.intentionalRest === 'boolean', 'invalid rest evidence');
    let activity = false;
    if (day.activity !== null) {
      object(day.activity, ['verified', 'domains'], 'activity');
      assert(typeof day.activity.verified === 'boolean' && Array.isArray(day.activity.domains), 'invalid activity evidence');
      assert(day.activity.domains.length > 0 && day.activity.domains.every((domain) => DOMAINS.has(domain)), 'invalid activity domains');
      activity = day.activity.verified;
      if (activity) {
        assert(day.activity.domains.every((domain) => connected.has(domain)), 'activity lacks verified source');
        if (date <= today) assert(day.activity.domains.every((domain) => date <= verifiedDates.get(domain)), 'activity postdates source verification');
      }
    }
    const recovery = verifiedFlag(day.recovery, 'recovery');
    const improvement = verifiedFlag(day.improvement, 'improvement');
    if (recovery) {
      assert(connected.has('recovery'), 'recovery lacks verified source');
      if (date <= today) assert(date <= verifiedDates.get('recovery'), 'recovery postdates source verification');
    }
    if (activity || recovery || improvement) assert(verifiedMs !== null && connected.size > 0, 'evidence lacks verification');
    if (improvement && date <= today) assert(date <= localDate(new Date(verifiedMs), input.timezone), 'improvement postdates verification');
    if (date > today) continue;
    const previous = dates.get(date) ?? { activity: false, recovery: false, improvement: false, rest: false };
    dates.set(date, {
      activity: previous.activity || activity,
      recovery: previous.recovery || recovery,
      improvement: previous.improvement || improvement,
      rest: previous.rest || (day.intentionalRest && input.mode !== 'build'),
    });
  }
  const pillars = [
    { key: 'activity', label: 'verified activity', xp: 0, days: 0 },
    { key: 'consistency', label: 'sustainable consistency', xp: 0, days: 0 },
    { key: 'recovery', label: 'recovery actions', xp: 0, days: 0 },
    { key: 'improvement', label: 'personal improvement', xp: 0, days: 0 },
  ];
  const totals = { activityDays: 0, recoveryDays: 0, improvementDays: 0, careDays: 0 };
  const weekCounts = new Map();
  const history = [...dates.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => {
    let xp = 0;
    const award = (index, amount) => {
      pillars[index].days += 1;
      pillars[index].xp += amount;
      xp += amount;
    };
    if (day.activity) { totals.activityDays += 1; award(0, appliedRules.activityXp); }
    if (day.recovery) { totals.recoveryDays += 1; award(2, appliedRules.recoveryXp); }
    if (day.improvement) { totals.improvementDays += 1; award(3, appliedRules.improvementXp); }
    if (day.rest) totals.careDays += 1;
    if (day.activity || day.rest) {
      const week = monday(date);
      const count = weekCounts.get(week) ?? 0;
      if (count < appliedRules.weeklyTarget) award(1, appliedRules.consistencyXp);
      weekCounts.set(week, count + 1);
    }
    return { date, kind: day.activity ? 'activity' : day.recovery ? 'recovery' : day.rest ? 'rest' : 'unknown', xp };
  });
  const evidenceXp = pillars.reduce((sum, pillar) => sum + pillar.xp, 0);
  assert(Number.isSafeInteger(evidenceXp), 'progression total exceeds supported range');
  const xp = Math.max(retainedXp, evidenceXp);
  const level = Math.floor(xp / appliedRules.xpPerLevel) + 1;
  const nextLevelXp = level * appliedRules.xpPerLevel;
  assert(Number.isSafeInteger(nextLevelXp), 'progression level exceeds supported range');
  return {
    schemaVersion: 1, audience: input.audience, generatedAt: input.generatedAt, verifiedAt: input.verifiedAt,
    timezone: input.timezone, mode: input.mode, xp, evidenceXp, retainedXp, level,
    stage: level >= 5 ? 'canopy' : level >= 3 ? 'bloom' : level >= 2 ? 'sprout' : 'seed',
    levelProgress: Math.floor((xp % appliedRules.xpPerLevel) / appliedRules.xpPerLevel * 100),
    nextLevelXp, fresh: verifiedMs === null ? 'unknown' : now.getTime() - verifiedMs > 36 * 3_600_000 ? 'stale' : 'fresh',
    pillars, totals, history, sources, rules: appliedRules,
  };
}
