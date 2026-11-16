// Site footer for the v2 shell: credits and the honest small print.
import Skyline from './Skyline.jsx';

export default function SiteFooter() {
  return (
    <footer data-ui className="mt-12 border-t border-line-soft bg-surface font-sans dark:bg-background">
      <div className="mx-auto w-full max-w-[1240px] px-4 pt-8 pb-10 sm:px-6">
        <Skyline decorative className="aspect-[6/1] w-full max-w-[720px] opacity-80" />
        <div className="mt-5 grid gap-3 text-[13px] leading-5 text-muted-foreground md:grid-cols-2 md:gap-10">
          <p>
            <span className="font-semibold text-foreground">NYC Pickup Soccer</span> · CS-GY 6083 course project. Fields are
            approximations of NYC Parks facilities; people and games are made up.
          </p>
          <p>
            Field photos: Wikimedia Commons, credited on each photo (stock photos are marked). Map data © OpenStreetMap
            contributors, tiles by OpenFreeMap. Skyline art is original. Not affiliated with NYC Parks, the MTA or any team.
          </p>
        </div>
      </div>
    </footer>
  );
}
