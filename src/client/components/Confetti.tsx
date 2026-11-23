import { useEffect, useMemo, useState } from 'react';

type ConfettiParticle = {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  spinDuration: number;
  round: boolean;
};

/** Reddit palette: mostly orange/white/grey, a little gold. */
const COLORS = [
  '#FF4500',
  '#FF4500',
  '#FF7A33',
  '#FFFFFF',
  '#FFFFFF',
  '#9CA3AF',
  '#FFC107',
];

const COUNT = 48;
/** Longest possible fall (max delay + max duration), plus a small margin. */
const LIFETIME_MS = 4300;

const randomParticle = (): ConfettiParticle => ({
  left: Math.random() * 100,
  size: 6 + Math.random() * 7,
  color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#FF4500',
  delay: Math.random() * 0.5,
  duration: 2.4 + Math.random() * 1.2,
  spinDuration: 0.6 + Math.random() * 0.9,
  round: Math.random() > 0.5,
});

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Pure CSS/JS confetti burst — no dependencies. Renders once, falls once,
 * then removes itself from the DOM. Renders nothing when the user prefers
 * reduced motion.
 */
export const Confetti = () => {
  const particles = useMemo(
    () => Array.from({ length: COUNT }, randomParticle),
    []
  );
  const [visible, setVisible] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const timer = window.setTimeout(() => setVisible(false), LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {particles.map((particle, index) => (
        <div
          key={index}
          className="confetti-particle absolute top-0"
          style={{
            left: `${particle.left}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        >
          <div
            className="confetti-particle-inner"
            style={{
              width: particle.size,
              height: particle.size * (particle.round ? 1 : 0.6),
              backgroundColor: particle.color,
              borderRadius: particle.round ? '50%' : '1px',
              animationDuration: `${particle.spinDuration}s`,
            }}
          />
        </div>
      ))}
    </div>
  );
};
