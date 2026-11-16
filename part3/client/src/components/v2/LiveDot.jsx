// Pulsing dot for a game in play. The pulse stops under reduced motion;
// the words beside it ("In play") carry the meaning.
import { cn } from '@/lib/utils.js';

export default function LiveDot({ className }) {
  return <span aria-hidden="true" className={cn('live-dot', className)} />;
}
