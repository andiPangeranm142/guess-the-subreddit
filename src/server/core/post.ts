/**
 * Creates the daily game post: a dated custom post whose postData carries
 * the UTC date and game number, so the client always knows which day's game
 * a post belongs to.
 */
import { reddit } from '@devvit/web/server';
import { gameNumberForDate, utcDateString } from '../../shared/game';

export const createPost = async () => {
  const date = utcDateString();
  const gameNumber = gameNumberForDate(date);
  return await reddit.submitCustomPost({
    title: `🕵️ Guess the Subreddit #${gameNumber} — Can you name all 5?`,
    entry: 'default',
    postData: { date, gameNumber },
  });
};
