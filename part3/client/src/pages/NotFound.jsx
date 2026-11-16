// Any address the app does not know: offside.
import { ArrowLeft } from 'lucide-react';
import { Button, Icon, SignBand, usePageTitle } from '../components/v2/index.js';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div data-ui className="flex min-h-[50dvh] flex-col items-start justify-center gap-5 py-12 font-sans text-foreground">
      <SignBand as="h1" size="md">
        Offside: no page here
      </SignBand>
      <p className="max-w-[56ch] text-[17px] text-muted-foreground">There is no page at this address. Check the link, or head back to the games.</p>
      <Button to="/" variant="secondary">
        <Icon icon={ArrowLeft} tone="label" size="16px" />
        Back to upcoming games
      </Button>
    </div>
  );
}
