/**
 * Streak-milestone flair.
 *
 * When a finished game pushes the player's streak to exactly 3, 7, or 30
 * days, they earn the matching flair text (FLAIR_MILESTONES in shared/game).
 * Awarding it calls the Reddit API, which needs moderator permissions in the
 * subreddit and may fail — so flair is best-effort: the earned text is
 * always reported, `flairAwarded` is true only when the API call succeeded,
 * and a failure never breaks the game result.
 */
import { reddit } from '@devvit/web/server';
import { FLAIR_MILESTONES } from '../../shared/game';

export type FlairAttempt = {
  flairEarned: string | undefined;
  flairAwarded: boolean;
};

/** Flair text for a streak, if it hits a milestone exactly. */
export const flairForStreak = (streak: number): string | undefined =>
  FLAIR_MILESTONES.find((milestone) => milestone.days === streak)?.text;

export const awardStreakFlair = async (args: {
  subredditName: string;
  username: string | undefined;
  streak: number;
}): Promise<FlairAttempt> => {
  const flairEarned = flairForStreak(args.streak);
  if (!flairEarned || !args.username) {
    return { flairEarned, flairAwarded: false };
  }
  try {
    await reddit.setUserFlair({
      subredditName: args.subredditName,
      username: args.username,
      text: flairEarned,
    });
    return { flairEarned, flairAwarded: true };
  } catch (error) {
    console.error(
      `Failed to award flair "${flairEarned}" to u/${args.username}:`,
      error
    );
    return { flairEarned, flairAwarded: false };
  }
};
