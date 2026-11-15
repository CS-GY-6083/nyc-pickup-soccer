// cn(): join Tailwind class names, letting later classes win over
// earlier ones that conflict (e.g. cn('px-2', isWide && 'px-6') -> 'px-6').
// Used by shadcn, Kokonut UI and Bklit UI components.
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
