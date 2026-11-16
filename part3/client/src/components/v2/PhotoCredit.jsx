// Small credit for a field photo: (Stock photo ·) author · licence, linking
// to the source page on Wikimedia Commons.
import { cn } from '@/lib/utils.js';

export function creditText(photo) {
  return `${photo.stock ? 'Stock photo · ' : ''}${photo.author} · ${photo.license}`;
}

export default function PhotoCredit({ photo, className }) {
  if (!photo) return null;
  return (
    <a
      href={photo.sourceUrl}
      target="_blank"
      rel="noopener"
      title={`${photo.stock ? 'Stock photo, not this field. ' : ''}Photo: ${photo.author}, ${photo.license}. Source: Wikimedia Commons`}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] leading-4 font-medium text-muted-foreground',
        'shadow-[0_0_0_1px_var(--line)] transition-colors duration-150 hover:text-foreground dark:bg-surface-3',
        className,
      )}
    >
      {photo.stock && (
        <>
          <span className="flex-none font-semibold text-foreground">Stock photo</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span className="truncate">
        <span className="sr-only">Photo by </span>
        {photo.author}
      </span>
      <span aria-hidden="true">·</span>
      <span className="flex-none">{photo.license}</span>
      <span className="sr-only">(source on Wikimedia Commons, opens in a new tab)</span>
    </a>
  );
}
