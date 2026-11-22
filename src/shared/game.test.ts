/**
 * Unit tests for the pure game logic in ./game.
 *
 * Node's type-stripping runner cannot resolve the extensionless relative
 * imports the shared modules use (game.ts imports './api'), so this file
 * registers ./test-loader.ts first and then dynamically imports the module
 * under test (static imports are linked before any module code runs, so a
 * static import of ./game would bypass the hook).
 */
// The shared tsconfig does not include Node types, so this file pulls them
// in itself for node:test / node:assert / node:module.
/// <reference types="node" />
/* eslint-disable @typescript-eslint/no-floating-promises -- node:test's test()
   returns a promise the test runner manages; awaiting every call would be noise. */
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BankEntry, Difficulty } from './api';

register('./test-loader.ts', import.meta.url);

const {
  addDays,
  buildShareText,
  emojiGrid,
  fallbackNote,
  gameNumberForDate,
  getDailySet,
  MAX_DAILY_SCORE,
  rotationCycleDays,
  scoreAnswer,
  speedBonus,
  toClientQuestion,
  totalScore,
  utcDateString,
} = await import('./game');

/** Synthetic bank: 40 entries per difficulty, like the real bank. */
const makeBank = (): BankEntry[] => {
  const bank: BankEntry[] = [];
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
  for (const difficulty of difficulties) {
    for (let i = 0; i < 40; i++) {
      const subreddit = `sub_${difficulty}_${i}`;
      bank.push({
        id: `q-${difficulty}-${i}`,
        title: `Test post ${difficulty} ${i}`,
        body: `Body ${difficulty} ${i}`,
        subreddit,
        options: [subreddit, `other_a_${i}`, `other_b_${i}`, `other_c_${i}`],
        difficulty,
        category: 'test',
        note: undefined,
      });
    }
  }
  return bank;
};

const setIds = (set: BankEntry[]): string[] => set.map((entry) => entry.id);

test('daily set is deterministic: same date gives the same set in the same order', () => {
  const first = getDailySet(makeBank(), '2026-11-23');
  const second = getDailySet(makeBank(), '2026-11-23');
  assert.deepEqual(setIds(first), setIds(second));
  assert.equal(first.length, 5);
});

test('daily set composition is 2 easy + 2 medium + 1 hard', () => {
  for (const date of ['2026-11-23', '2026-11-24', '2026-12-01', '2027-01-15']) {
    const set = getDailySet(makeBank(), date);
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const entry of set) {
      counts[entry.difficulty] += 1;
    }
    assert.deepEqual(counts, { easy: 2, medium: 2, hard: 1 }, date);
  }
});

test('different dates give different sets', () => {
  const dates = [
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-28',
    '2026-11-29',
  ];
  const sets = dates.map((date) => setIds(getDailySet(makeBank(), date)));
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      assert.notDeepEqual(sets[i], sets[j], `${dates[i]} vs ${dates[j]}`);
    }
  }
});

test('daily sets do not repeat within one rotation cycle', () => {
  const bank = makeBank(); // 40 per difficulty -> 20-day cycle
  assert.equal(rotationCycleDays(bank), 20);
  const seen = new Set<string>();
  for (let day = 0; day < 20; day++) {
    const set = getDailySet(bank, addDays('2026-11-23', day));
    for (const entry of set) {
      assert.ok(
        !seen.has(entry.id),
        `duplicate ${entry.id} on day ${day + 1}`
      );
      seen.add(entry.id);
    }
  }
  assert.equal(seen.size, 100);
});

test('rotation repeats easy/medium after one cycle; hard rotates across cycles', () => {
  const bank = makeBank();
  const day1 = getDailySet(bank, '2026-11-23');
  const day21 = getDailySet(bank, '2026-12-13'); // game 21, cycle 2
  const idsFor = (set: BankEntry[], difficulty: Difficulty): string[] =>
    set
      .filter((entry) => entry.difficulty === difficulty)
      .map((entry) => entry.id)
      .sort();
  assert.deepEqual(idsFor(day21, 'easy'), idsFor(day1, 'easy'));
  assert.deepEqual(idsFor(day21, 'medium'), idsFor(day1, 'medium'));
  assert.notDeepEqual(idsFor(day21, 'hard'), idsFor(day1, 'hard'));
  // Cycle 3 (day 41) brings the hard pool back to the start: full set repeats.
  const day41 = getDailySet(bank, addDays('2026-11-23', 40));
  assert.deepEqual(setIds(day41).sort(), setIds(day1).sort());
});

test('scoring boundaries', () => {
  assert.equal(scoreAnswer(true, 0), 150);
  assert.equal(scoreAnswer(true, 1000), 145);
  assert.equal(scoreAnswer(true, 9500), 105);
  assert.equal(scoreAnswer(true, 10000), 100);
  assert.equal(scoreAnswer(true, 30000), 100);
  assert.equal(scoreAnswer(true, 999999), 100);
  assert.equal(scoreAnswer(false, 0), 0);
  assert.equal(scoreAnswer(false, 1000), 0);
  assert.equal(scoreAnswer(false, 30000), 0);
});

test('speed bonus decays 5 points per second to a floor of 0', () => {
  assert.equal(speedBonus(0), 50);
  assert.equal(speedBonus(999), 50);
  assert.equal(speedBonus(1000), 45);
  assert.equal(speedBonus(9500), 5);
  assert.equal(speedBonus(10000), 0);
  assert.equal(speedBonus(30000), 0);
  assert.equal(speedBonus(-500), 50);
});

test('perfect bonus: 5x150 + 100 = 850 max daily score', () => {
  assert.equal(totalScore([150, 150, 150, 150, 150], 5), 850);
  assert.equal(MAX_DAILY_SCORE, 850);
  // No bonus without a perfect game.
  assert.equal(totalScore([150, 150, 150, 150, 0], 4), 600);
  assert.equal(totalScore([100, 100, 100, 100, 100], 5), 600);
  assert.equal(totalScore([0, 0, 0, 0, 0], 0), 0);
});

test('game number is 1 on 2026-11-23 and increments by 1 per day', () => {
  assert.equal(gameNumberForDate('2026-11-23'), 1);
  assert.equal(gameNumberForDate('2026-11-24'), 2);
  assert.equal(gameNumberForDate('2026-12-23'), 31);
  let previous = gameNumberForDate('2026-11-23');
  for (let day = 1; day <= 30; day++) {
    const next = gameNumberForDate(addDays('2026-11-23', day));
    assert.equal(next, previous + 1, `day offset ${day}`);
    previous = next;
  }
});

test('share text contains the game number, score, and grid', () => {
  const text = buildShareText({
    gameNumber: 7,
    score: 620,
    correctCount: 4,
    grid: [true, true, false, true, true],
    streak: 3,
  });
  assert.match(text, /#7/);
  assert.match(text, /620\/850/);
  assert.match(text, /🟩🟩🟥🟩🟩/);
  assert.match(text, /4\/5 correct/);
  assert.match(text, /3-day streak/);
});

test('share text omits the streak line for a 1-day streak', () => {
  const text = buildShareText({
    gameNumber: 1,
    score: 500,
    correctCount: 5,
    grid: [true, true, true, true, true],
    streak: 1,
  });
  assert.doesNotMatch(text, /streak/);
});

test('emoji grid maps correct to green and wrong to red', () => {
  assert.equal(emojiGrid([true, false, true]), '🟩🟥🟩');
  assert.equal(emojiGrid([]), '');
});

test('client questions strip the answer', () => {
  const bank = makeBank();
  const entry = bank[0];
  assert.ok(entry);
  const client = toClientQuestion(entry);
  assert.equal('subreddit' in client, false);
  assert.deepEqual(client.options, entry.options);
  assert.equal(client.id, entry.id);
  assert.equal(client.difficulty, entry.difficulty);
});

test('fallback note names the subreddit', () => {
  assert.match(fallbackNote('AmItheAsshole'), /r\/AmItheAsshole/);
});

test('date helpers handle month boundaries and UTC formatting', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-01', -1), '2026-11-30');
  assert.equal(addDays('2026-11-23', 0), '2026-11-23');
  assert.match(utcDateString(new Date('2026-11-23T23:30:00.000Z')), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(utcDateString(new Date('2026-11-23T00:00:00.000Z')), '2026-11-23');
});

test('daily set throws when the bank is too small', () => {
  const tinyBank: BankEntry[] = [
    {
      id: 'only',
      title: 'Only post',
      body: undefined,
      subreddit: 'test',
      options: ['test', 'a', 'b', 'c'],
      difficulty: 'easy',
      category: 'test',
      note: undefined,
    },
  ];
  assert.throws(() => getDailySet(tinyBank, '2026-11-23'), /too small/);
});
