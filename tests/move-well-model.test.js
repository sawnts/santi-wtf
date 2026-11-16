import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, evaluateEvidence } from '../public/js/move-well-model.js';
import { scenario } from '../public/js/move-well-fixtures.js';

const NOW = new Date('2026-11-16T03:00:00Z'); // still november 15 in los angeles
const evaluate = (input, rules = DEFAULT_RULES, now = NOW) => evaluateEvidence(input, rules, now);
const emptyDay = (date) => ({ date, activity: null, recovery: null, improvement: null, intentionalRest: false });

test('synthetic scenarios visibly progress, retain care progress, and never imply real data', () => {
  for (const name of ['steady', 'starting', 'rest', 'injury', 'stale', 'missing']) {
    const result = evaluate(scenario(name, NOW));
    assert.equal(result.audience, 'synthetic');
    assert.equal(result.history.length, 28);
    assert.ok(result.levelProgress >= 0 && result.levelProgress <= 99);
  }
  assert.equal(evaluate(scenario('starting', NOW)).stage, 'seed');
  assert.equal(evaluate(scenario('steady', NOW)).stage, 'bloom');
  for (const mode of ['rest', 'injury']) {
    const result = evaluate(scenario(mode, NOW));
    assert.equal(result.xp, 245);
    assert.ok(result.totals.careDays > 0);
    assert.ok(result.pillars.find((pillar) => pillar.key === 'consistency').xp > 0);
  }
});

test('freshness uses verified time, includes 36 hour boundary, and distinguishes missing', () => {
  assert.equal(evaluate(scenario('steady', NOW)).fresh, 'fresh');
  assert.equal(evaluate(scenario('stale', NOW)).fresh, 'stale');
  assert.equal(evaluate(scenario('missing', NOW)).fresh, 'unknown');
  const input = scenario('missing', NOW);
  input.verifiedAt = new Date(NOW.getTime() - 36 * 3_600_000).toISOString();
  assert.equal(evaluate(input).fresh, 'fresh');
  assert.equal(evaluate(input, DEFAULT_RULES, new Date(NOW.getTime() + 1)).fresh, 'stale');
});

test('evaluation is pure and deterministic; duplicate dates cannot multiply rewards', () => {
  const input = scenario('steady', NOW);
  const before = JSON.stringify(input);
  const expected = evaluate(input);
  assert.equal(JSON.stringify(input), before);
  input.days = [...input.days, ...input.days].reverse();
  assert.deepEqual(evaluate(input), expected);
  assert.equal(JSON.stringify(scenario('steady', NOW)), before);
  assert.deepEqual(evaluate(input), evaluate(input));
});

test('volume and multiple activity domains give one daily award; weekly cap starts monday', () => {
  const input = scenario('steady', NOW);
  input.days = Array.from({ length: 8 }, (_, index) => ({
    ...emptyDay(`2026-11-${String(index + 8).padStart(2, '0')}`),
    activity: { verified: true, domains: ['running', 'running'] },
  }));
  const result = evaluate(input);
  assert.equal(result.totals.activityDays, 8);
  assert.equal(result.pillars[0].xp, 80);
  assert.equal(result.pillars[1].days, 4); // sunday then one monday-based week
  assert.equal(result.pillars[1].xp, 20);
});

test('unverified actions, physiology, and missing days award no points', () => {
  const input = scenario('missing', NOW);
  input.days = [{ ...emptyDay('2026-11-15'), activity: { verified: false, domains: ['running'] }, recovery: { verified: false }, improvement: { verified: false } }];
  const result = evaluate(input);
  assert.equal(result.xp, 0);
  assert.deepEqual(result.totals, { activityDays: 0, recoveryDays: 0, improvementDays: 0, careDays: 0 });
  assert.equal(result.history[0].kind, 'unknown');
  input.days[0].recovery = { verified: true, sleepHours: 8 };
  assert.throws(() => evaluate(input), /unsupported recovery fields/);
});

test('future local dates never score and future or missing verification is refused', () => {
  const input = scenario('steady', NOW);
  const expected = evaluate(input);
  input.days.push({ ...emptyDay('2026-11-16'), activity: { verified: true, domains: ['running'] } });
  assert.deepEqual(evaluate(input), expected);
  input.verifiedAt = '2026-11-16T04:00:00Z';
  assert.throws(() => evaluate(input), /future verification/);
  input.verifiedAt = null;
  assert.throws(() => evaluate(input), /inconsistent source verification/);
});

test('connected sources are required for verified actions', () => {
  const input = scenario('steady', NOW);
  input.sources.find((source) => source.domain === 'running').status = 'planned';
  assert.throws(() => evaluate(input), /unconnected source/);
  input.sources.find((source) => source.domain === 'running').verifiedAt = null;
  assert.throws(() => evaluate(input), /activity lacks verified source/);
});

test('a source cannot verify an action that happened after its verification day', () => {
  const input = scenario('steady', NOW);
  input.days = [{ ...emptyDay('2026-11-15'), activity: { verified: true, domains: ['running'] } }];
  input.sources.find((source) => source.domain === 'running').verifiedAt = '2026-11-14T20:00:00Z';
  assert.throws(() => evaluate(input), /activity postdates source verification/);
});

test('calendar validation rejects impossible dates, timestamps, and malformed collections', () => {
  for (const date of ['2026-02-30', '2026-13-01', '11/15/2026', '2026-1-01']) {
    const input = scenario('missing', NOW);
    input.days.push(emptyDay(date));
    assert.throws(() => evaluate(input), /invalid evidence date/);
  }
  const input = scenario('missing', NOW);
  input.generatedAt = '2026-02-30T03:00:00Z';
  assert.throws(() => evaluate(input), /invalid evidence date/);
  input.generatedAt = NOW.toISOString();
  input.sources.push({ ...input.sources[0] });
  assert.throws(() => evaluate(input), /duplicate source/);
  const invalidRetained = scenario('missing', NOW);
  invalidRetained.retainedXp = null;
  assert.throws(() => evaluate(invalidRetained), /invalid retained xp/);
});

test('retained xp protects progress across shorter history and stale rest or injury windows', () => {
  for (const name of ['rest', 'injury']) {
    const input = scenario(name, NOW);
    input.days = [];
    const result = evaluate(input, DEFAULT_RULES, new Date('2026-12-16T03:00:00Z'));
    assert.equal(result.evidenceXp, 0);
    assert.equal(result.retainedXp, 245);
    assert.equal(result.xp, 245);
    assert.equal(result.stage, 'bloom');
    assert.equal(result.fresh, 'stale');
  }
});

test('adjustable rules recalculate evidence transparently without mutating defaults', () => {
  const input = scenario('starting', NOW);
  const result = evaluate(input, { ...DEFAULT_RULES, activityXp: 20, consistencyXp: 10, xpPerLevel: 20 });
  assert.equal(result.evidenceXp, 30);
  assert.equal(result.level, 2);
  assert.equal(result.levelProgress, 50);
  assert.equal(result.nextLevelXp, 40);
  assert.equal(DEFAULT_RULES.activityXp, 10);
  for (const rules of [{ ...DEFAULT_RULES, weeklyTarget: 8 }, { ...DEFAULT_RULES, xpPerLevel: 0 }, { ...DEFAULT_RULES, recoveryXp: -1 }, { ...DEFAULT_RULES, activityXp: NaN }]) {
    assert.throws(() => evaluate(input, rules), /invalid progression rule/);
  }
});
