import { useEffect, useState } from 'react';

type TimeLeft = {
  hours: number;
  minutes: number;
  seconds: number;
};

const timeUntilMidnightUtc = (): TimeLeft => {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0
    )
  );
  const diff = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
};

const pad = (value: number): string => String(value).padStart(2, '0');

export const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(timeUntilMidnightUtc);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(timeUntilMidnightUtc());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase dark:text-gray-400">
        Next puzzle in
      </span>
      <span className="font-mono text-3xl font-bold tracking-tight text-ink tabular-nums dark:text-white">
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    </div>
  );
};
