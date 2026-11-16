// Light / System / Dark switch for the navbar. The highlighted pill slides
// between options (Motion layout animation; instant under reduced motion).
// Toggle buttons with aria-pressed: keyboard users tab to each option.
import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { useTheme } from '../lib/theme.js';

const OPTIONS = [
  ['light', 'Light theme', Sun],
  ['system', 'Match my device', Monitor],
  ['dark', 'Dark theme', Moon],
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const pill = useId(); // one sliding pill per toggle (the nav and the Me sheet can both show one)
  return (
    <MotionConfig reducedMotion="user">
      <div
        data-ui
        role="group"
        aria-label="Colour theme"
        className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5"
      >
        {OPTIONS.map(([value, label, Icon]) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              aria-label={label}
              title={label}
              onClick={() => setTheme(value)}
              className="relative grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {active && (
                <motion.span
                  layoutId={`theme-pill-${pill}`}
                  className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_2px_var(--shadow),0_0_0_1px_var(--line)] dark:bg-surface-4 dark:shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--line)]"
                  transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                />
              )}
              <Icon aria-hidden="true" className="relative size-4" strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </MotionConfig>
  );
}
