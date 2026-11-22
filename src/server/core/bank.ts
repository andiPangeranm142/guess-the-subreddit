/**
 * Loads and validates the question bank at module load.
 *
 * The bank JSON lives in ../data/question-bank.json (owned by the content
 * agent); this module only reads it and fails fast with a clear error if the
 * data is malformed, so a bad bank breaks the deploy loudly instead of
 * serving broken games.
 */
import rawBank from '../data/question-bank.json';
import type { BankEntry, Difficulty } from '../../shared/api';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'medium' || value === 'hard';

const asNonEmptyString = (
  value: unknown,
  field: string,
  id: string
): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Question bank entry ${id}: field "${field}" must be a non-empty string`
    );
  }
  return value;
};

const asOptionalString = (
  value: unknown,
  field: string,
  id: string
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(
      `Question bank entry ${id}: field "${field}" must be a string when present`
    );
  }
  return value;
};

const validateEntry = (raw: unknown, index: number): BankEntry => {
  if (!isRecord(raw)) {
    throw new Error(
      `Question bank entry at index ${index} is not an object`
    );
  }
  const id = asNonEmptyString(raw.id, 'id', `#${index}`);
  const title = asNonEmptyString(raw.title, 'title', id);
  const body = asOptionalString(raw.body, 'body', id);
  const subreddit = asNonEmptyString(raw.subreddit, 'subreddit', id);
  const category = asNonEmptyString(raw.category, 'category', id);
  const note = asOptionalString(raw.note, 'note', id);
  if (!isDifficulty(raw.difficulty)) {
    throw new Error(
      `Question bank entry ${id}: field "difficulty" must be "easy", "medium", or "hard"`
    );
  }
  if (!Array.isArray(raw.options) || raw.options.length !== 4) {
    throw new Error(
      `Question bank entry ${id}: field "options" must be an array of 4 subreddits`
    );
  }
  const options: string[] = [];
  for (const option of raw.options) {
    if (typeof option !== 'string' || option.length === 0) {
      throw new Error(
        `Question bank entry ${id}: every option must be a non-empty string`
      );
    }
    options.push(option);
  }
  if (!options.includes(subreddit)) {
    throw new Error(
      `Question bank entry ${id}: options do not include the correct subreddit "${subreddit}"`
    );
  }
  return {
    id,
    title,
    body,
    subreddit,
    options,
    difficulty: raw.difficulty,
    category,
    note,
  };
};

const validateBank = (raw: unknown): BankEntry[] => {
  if (!Array.isArray(raw)) {
    throw new Error('Question bank must be a JSON array of entries');
  }
  const entries = raw.map((entry, index) => validateEntry(entry, index));
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`Question bank has a duplicate id: "${entry.id}"`);
    }
    seen.add(entry.id);
  }
  return entries;
};

/** The validated question bank. Throws at import time if malformed. */
export const questionBank: BankEntry[] = validateBank(rawBank);
