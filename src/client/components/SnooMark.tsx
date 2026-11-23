export type SnooMarkProps = {
  className?: string;
};

/**
 * A simple Snoo-style alien mark built from original geometric shapes
 * (round head, antenna, eyes, smile) — decorative only, not a copy of
 * Reddit's official Snoo artwork.
 */
export const SnooMark = ({ className }: SnooMarkProps) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <line
      x1="32"
      y1="8"
      x2="32"
      y2="17"
      stroke="#1a1a1b"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="32" cy="6" r="4" fill="#FF4500" />
    <circle
      cx="32"
      cy="37"
      r="23"
      fill="#ffffff"
      stroke="#1a1a1b"
      strokeWidth="2.5"
    />
    <circle cx="23.5" cy="35" r="3.5" fill="#1a1a1b" />
    <circle cx="40.5" cy="35" r="3.5" fill="#1a1a1b" />
    <path
      d="M25 45 Q32 51 39 45"
      fill="none"
      stroke="#1a1a1b"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);
