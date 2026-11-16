// #/goodbye  After Log out (the course flow: the session is gone, say so).
import { ArrowRight, LogIn } from 'lucide-react';
import { Button, Icon, SignBand, Skyline } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { WRAP, usePageTitle } from '../ui.jsx';

export default function Goodbye() {
  usePageTitle('Logged out');
  return (
    <div className={cn(WRAP, 'flex min-h-[min(640px,calc(100dvh-160px))] flex-col items-start justify-center gap-5 py-12')}>
      <Skyline decorative className="h-20 w-full max-w-[640px] sm:h-28" />
      <SignBand as="h1" size="md">
        Full time. You&rsquo;re logged out.
      </SignBand>
      <p className="max-w-[56ch] text-[17px] text-muted-foreground">
        Your session has ended on this device. Games and fields stay open to everyone; log in again to join a game.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button href="#/">
          Find a game
          <Icon icon={ArrowRight} tone="label" size="16px" />
        </Button>
        <Button href="#/login" variant="secondary">
          <Icon icon={LogIn} tone="label" size="16px" />
          Log in again
        </Button>
      </div>
    </div>
  );
}
