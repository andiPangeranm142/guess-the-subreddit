import { MAX_SPEED_BONUS, speedBonus } from '../../shared/game';

export type SpeedMeterProps = {
  elapsedMs: number;
};

/**
 * Live speed-bonus meter: starts at +50 and drains 5 points per second.
 * The parent ticks `elapsedMs` every 100ms, so the bar drains smoothly.
 */
export const SpeedMeter = ({ elapsedMs }: SpeedMeterProps) => {
  const bonus = speedBonus(elapsedMs);
  const percent = (bonus / MAX_SPEED_BONUS) * 100;
  const barColor =
    bonus >= 35
      ? 'bg-emerald-500'
      : bonus >= 15
        ? 'bg-amber-500'
        : 'bg-rose-500';
  const labelColor =
    bonus >= 35
      ? 'text-emerald-600 dark:text-emerald-400'
      : bonus >= 15
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="flex items-center gap-2.5" aria-live="off">
      <span className="text-base leading-none">⚡</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`min-w-11 text-right text-sm font-extrabold tabular-nums ${labelColor}`}
      >
        +{bonus}
      </span>
    </div>
  );
};
