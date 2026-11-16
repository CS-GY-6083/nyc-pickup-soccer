// Unknown route: offside.
import { ArrowLeft } from 'lucide-react';
import { Button, Icon, SignBand } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { WRAP, usePageTitle } from '../ui.jsx';

export default function NotFound({ text = 'There is no page at this address.' }) {
  usePageTitle('Page not found');
  return (
    <div className={cn(WRAP, 'flex min-h-[60dvh] flex-col items-start justify-center gap-5 py-16')}>
      <SignBand as="h1" size="md">
        Offside: no page here
      </SignBand>
      <p className="max-w-[56ch] text-[17px] text-muted-foreground">{text}</p>
      <Button href="#/" variant="secondary">
        <Icon icon={ArrowLeft} tone="label" size="16px" />
        Back to upcoming games
      </Button>
    </div>
  );
}
