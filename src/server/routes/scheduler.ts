/**
 * Scheduled tasks (see the "scheduler" section in devvit.json).
 *
 * `daily-post` runs on a cron (00:00 UTC) and creates the day's game post.
 * It is idempotent: a posted:{date} marker in Redis makes a second run for
 * the same day a no-op, so retries and overlapping runs cannot double-post.
 *
 * The handler always answers 200 with an empty TaskResponse — a failed post
 * creation is logged, not retried by the scheduler.
 */
import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { utcDateString } from '../../shared/game';
import { createPost } from '../core/post';
import { isPosted, markPosted } from '../core/store';

export const scheduler = new Hono();

scheduler.post('/daily-post', async (c) => {
  let name: string | undefined;
  try {
    const input = await c.req.json<TaskRequest>();
    name = input.name;
  } catch {
    // The scheduler always POSTs JSON, but proceed anyway: this endpoint is
    // only wired to the daily-post task in devvit.json.
    name = undefined;
  }
  if (name !== undefined && name !== 'daily-post') {
    console.error(
      `Scheduler: unexpected task "${name}" hit /daily-post; ignoring`
    );
    return c.json<TaskResponse>({});
  }
  const date = utcDateString();
  try {
    if (await isPosted(date)) {
      console.log(`Scheduler: daily post for ${date} already exists; skipping`);
      return c.json<TaskResponse>({});
    }
    const post = await createPost();
    await markPosted(date);
    console.log(`Scheduler: created daily post ${post.id} for ${date}`);
  } catch (error) {
    console.error(
      `Scheduler: failed to create daily post for ${date}:`,
      error
    );
  }
  return c.json<TaskResponse>({});
});
