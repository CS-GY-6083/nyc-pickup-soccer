// Shown after logging out (spec: "the session is destroyed and a
// goodbye page or the login page is displayed").
// Owner: Abhinav
import { ArrowRight, LogIn } from 'lucide-react';
import { Button, Icon, SignBand, Skyline, usePageTitle } from '../../components/v2/index.js';

export default function Goodbye() {
  usePageTitle('Logged out');
  return (
    <div data-ui className="flex min-h-[min(560px,calc(100dvh-260px))] flex-col items-start justify-center gap-5 py-10 font-sans text-foreground">
      <Skyline decorative className="h-20 w-full max-w-[640px] sm:h-28" />
      <SignBand as="h1" size="md">
        Full time. You&rsquo;re logged out.
      </SignBand>
      <p className="max-w-[56ch] text-[17px] text-muted-foreground">
        Your session has ended on this device. Games and fields stay open to everyone; log in again to join a game.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button to="/">
          Find a game
          <Icon icon={ArrowRight} tone="label" size="16px" />
        </Button>
        <Button to="/login" variant="secondary">
          <Icon icon={LogIn} tone="label" size="16px" />
          Log in again
        </Button>
      </div>
    </div>
  );
}
