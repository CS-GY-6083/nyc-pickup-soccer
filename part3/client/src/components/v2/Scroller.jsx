// Horizontal scroller with masked ends. Each end fades only while there is
// more to scroll that way (no hard cut-offs, no fade at rest on the start).
import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils.js';

export default function Scroller({ as: Tag = 'div', className, children, fade = 24, ...rest }) {
  const ref = useRef(null);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.style.setProperty('--fade-l', el.scrollLeft > 2 ? `${fade}px` : '0px');
    el.style.setProperty('--fade-r', el.scrollLeft < max - 2 ? `${fade}px` : '0px');
  }, [fade]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [update]);

  return (
    <Tag ref={ref} className={cn('mask-x no-scrollbar overflow-x-auto overscroll-x-contain', className)} {...rest}>
      {children}
    </Tag>
  );
}
