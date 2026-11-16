// Every scenario is synthetic; these values never describe a person.
const DAY_MS = 86_400_000;
const NAMES = new Set(['steady', 'starting', 'rest', 'injury', 'stale', 'missing']);

function dateInLosAngeles(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function scenario(name, now = new Date()) {
  if (!NAMES.has(name) || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('invalid synthetic scenario');
  const missing = name === 'missing';
  const care = name === 'rest' || name === 'injury';
  const verifiedAt = missing ? null : new Date(now.getTime() - (name === 'stale' ? 72 : 1) * 3_600_000).toISOString();
  const verifiedDate = verifiedAt === null ? null : dateInLosAngeles(new Date(verifiedAt));
  const today = new Date(`${dateInLosAngeles(now)}T00:00:00Z`).getTime();
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today - (27 - index) * DAY_MS).toISOString().slice(0, 10);
    const known = !missing && date <= verifiedDate;
    const active = known && !care && (name === 'starting' ? index === 25 : index % 7 === 0 || index % 7 === 2 || index % 7 === 4);
    return {
      date,
      activity: active ? { verified: true, domains: ['running'] } : null,
      recovery: known && index % 7 === 5 && name !== 'starting' ? { verified: true } : null,
      intentionalRest: care && index % 7 < 3,
      improvement: active && index === 14 ? { verified: true } : null,
    };
  });
  return {
    schemaVersion: 1, audience: 'synthetic', generatedAt: now.toISOString(), verifiedAt,
    timezone: 'America/Los_Angeles', mode: care ? name : 'build', days,
    sources: ['running', 'recovery', 'strength', 'mobility', 'nutrition'].map((domain) => ({
      domain, status: ['running', 'recovery'].includes(domain) ? missing ? 'missing' : 'connected' : 'planned',
      verifiedAt: ['running', 'recovery'].includes(domain) ? verifiedAt : null,
    })),
    retainedXp: care ? 245 : 0,
  };
}
