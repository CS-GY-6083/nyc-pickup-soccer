// #/map  Field finder (prototype). The live street map (MapLibre +
// OpenFreeMap tiles) is built in the app; this offline prototype shows the
// list half: filter by borough and surface, sort, open a field.
import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronRight, MapPinned } from 'lucide-react';
import { BoroughBullet, BOROUGH_NAMES, FieldPhoto, Icon, SignBand, Skyline } from '@/components/v2';
import { cn } from '@/lib/utils.js';
import { fields } from '../data/index.js';
import { replaceQuery } from '../router.js';
import { CONTROL, LABEL, WRAP, usePageTitle } from '../ui.jsx';

const SORTS = {
  games: ['Most games coming up', (a, b) => b.upcoming.length - a.upcoming.length || a.name.localeCompare(b.name)],
  name: ['Name A–Z', (a, b) => a.name.localeCompare(b.name)],
  borough: ['Borough', (a, b) => a.borough.localeCompare(b.borough) || a.name.localeCompare(b.name)],
};

export default function FieldFinder({ query }) {
  usePageTitle('Fields');
  const [borough, setBorough] = useState(query.get('borough') ?? 'all');
  const [surface, setSurface] = useState(query.get('surface') ?? 'all');
  const [sort, setSort] = useState(SORTS[query.get('sort')] ? query.get('sort') : 'games');
  const ids = { b: useId(), s: useId(), o: useId() };

  useEffect(() => {
    replaceQuery('/map', { borough: borough === 'all' ? '' : borough, surface: surface === 'all' ? '' : surface, sort: sort === 'games' ? '' : sort });
  }, [borough, surface, sort]);

  const list = fields
    .filter((f) => (borough === 'all' || f.borough === borough) && (surface === 'all' || f.surface_type === surface))
    .sort(SORTS[sort][1]);

  const select = (id, label, value, onChange, options) => (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <span className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(CONTROL, 'cursor-pointer appearance-none pr-10')}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Icon icon={ChevronDown} tone="label" size="18px" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );

  return (
    <div className={cn(WRAP, 'pt-6 pb-16 sm:pt-10')}>
      <SignBand as="h1" size="md">
        Fields
      </SignBand>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--lift)] dark:bg-surface-2">
            {select(ids.b, 'Borough', borough, setBorough, [['all', 'All boroughs'], ...BOROUGH_NAMES.map((b) => [b, b])])}
            {select(ids.s, 'Surface', surface, setSurface, [['all', 'Any surface'], ['Synthetic Turf', 'Synthetic turf'], ['Natural Grass', 'Natural grass']])}
            {select(ids.o, 'Sort by', sort, setSort, Object.entries(SORTS).map(([k, [l]]) => [k, l]))}
          </div>
          <p role="status" className="mb-3 text-[15px] font-medium text-muted-foreground tnum">
            {list.length} {list.length === 1 ? 'field' : 'fields'}
          </p>
          {list.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong p-6">
              <p className="font-display text-[20px] font-bold">No field matches both filters.</p>
              <button type="button" onClick={() => { setBorough('all'); setSurface('all'); }} className="cursor-pointer font-semibold text-accent-ink underline underline-offset-4">
                Show all fields
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((f) => (
                <li key={f.field_id} className="group relative flex items-center gap-3 rounded-xl border border-line bg-surface p-2 pr-3 shadow-[var(--lift)] transition-colors duration-150 hover:bg-surface-2 dark:bg-surface-2 dark:hover:bg-surface-3">
                  <FieldPhoto photo={f.photo} credit="none" className="h-16 w-24 flex-none rounded-[12px]" />
                  <div className="min-w-0 flex-1">
                    <a href={`#/fields/${f.field_id}`} className="line-clamp-2 font-display text-[17px] leading-snug font-bold after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline">
                      {f.name}
                    </a>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <BoroughBullet borough={f.borough} size="xs" decorative />
                      {f.borough} · {f.surface_type}
                    </p>
                  </div>
                  <span className="text-right text-[13px] font-semibold tnum">
                    {f.upcoming.length ? `${f.upcoming.length} coming up` : <span className="font-normal text-muted-foreground">No games yet</span>}
                  </span>
                  <Icon icon={ChevronRight} tone="label" size="18px" className="text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24 lg:self-start" aria-labelledby="map-note">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--lift)] dark:bg-surface-2">
            <Skyline variant="accents" className="aspect-[64/15] w-full" />
            <div className="border-t border-line-soft p-5">
              <h2 id="map-note" className="flex items-center gap-2 font-display text-[19px] font-bold">
                <Icon icon={MapPinned} tone="label" size="20px" />
                The map lives in the app
              </h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                In the app this panel is a live street map with every field as a marker, &ldquo;Near me&rdquo; and the same
                filters. This offline prototype keeps the list, so you can still pick a field.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
