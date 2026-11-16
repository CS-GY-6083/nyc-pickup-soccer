// Blurred icon swap: the old icon fades out with blur(4px) + scale(.9) while
// the new one fades in (Motion AnimatePresence, 180 ms). Instant under
// prefers-reduced-motion.
//   <IconSwap swapKey={joined ? 'on' : 'off'}>{joined ? <Icon icon={Check}/> : <Icon icon={Plus}/>}</IconSwap>
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils.js';

const HIDDEN = { opacity: 0, scale: 0.9, filter: 'blur(4px)' };
const SHOWN = { opacity: 1, scale: 1, filter: 'blur(0px)' };

export default function IconSwap({ swapKey, children, className }) {
  const calm = useReducedMotion();
  const transition = calm ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] };
  return (
    <span className={cn('relative inline-grid place-items-center [&>*]:[grid-area:1/1]', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={swapKey}
          className="inline-grid place-items-center"
          initial={calm ? false : HIDDEN}
          animate={SHOWN}
          exit={calm ? { opacity: 0, transition: { duration: 0 } } : HIDDEN}
          transition={transition}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
