# 🕵️ Guess the Subreddit

**A daily guessing game for Reddit — built for [Reddit's Game of the Day Hackathon 2026](https://redditgameofday2026.devpost.com/).**

Every day, five Reddit-style posts appear. Your job: guess which subreddit each one came from. Get all five right for a perfect score, come back tomorrow to keep your streak alive, and climb the daily leaderboard.

## How to play

1. Open the daily post — a fresh game is published automatically every day at midnight UTC.
2. Read each post (title + excerpt) and pick the subreddit it belongs to from four options.
3. Answer fast: every correct answer is worth **100 points + a speed bonus of up to +50** (the bonus drains 5 points per second).
4. Get all five right and earn a **+100 perfect bonus** — a max of **850 points per day**.
5. Share your result: copy your Wordle-style 🟩🟥 grid, or post it as a comment on the daily thread.

## Features

- **A new puzzle every day** — the daily set (2 easy + 2 medium + 1 hard) is picked by a date seed, so every player gets the same five questions each day, Wordle-style.
- **Streaks & flair** — play consecutive days to build a streak. Hit 3, 7, or 30 days and the app awards you a subreddit flair: 🔥 3-Day Sleuth, 🕵️ Week Sleuth, 🏆 Subreddit Sage.
- **Leaderboards** — daily leaderboard (score, ties broken by finish time) and an all-time longest-streak board, with Snoovatar avatars.
- **Player stats** — games played, accuracy, average score, best streak, and perfect days.
- **Yesterday's answers** — missed a day? See yesterday's questions, the correct subreddits, and a short note on why each post fits its community.
- **Resume mid-game** — close the post halfway through and pick up where you left off.
- **No login required to play** — anyone can play the full game; logging in saves your streak, stats, and leaderboard rank.
- **150 hand-written questions** across ~50 subreddits, from household names to delightfully niche corners of Reddit. Every post is fictional, written in each community's authentic voice — no real posts, no real usernames, no external data.

## Tech

- **Devvit Web** — React 19 + Tailwind CSS 4 + Vite on the client, Hono on the server, Redis for scores/streaks/stats.
- **No external APIs, no LLM at runtime.** The question bank ships with the app; scoring and daily-set selection are deterministic pure functions (unit-tested).
- **Daily scheduler** — a Devvit cron task publishes the new game post every day at 00:00 UTC.

## Project layout

```
src/
  client/            React app (splash = feed view, game = expanded view)
  server/            Hono API routes, scheduler, flair, post creation
    data/            question-bank.json (bundled at runtime)
  shared/            API types + pure game logic (seed, scoring) + tests
```

## Commands

- `npm run dev` — playtest on Reddit (requires `devvit login` first)
- `npm run build` — build client + server
- `npm run test:unit` — unit tests for the game logic
- `npm run test:types` — TypeScript check
- `npm run lint` — ESLint
- `npm run deploy` — type-check, lint, and upload a new version

## License

Apache-2.0 — see [LICENSE](./LICENSE).
