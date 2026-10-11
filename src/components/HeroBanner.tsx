export function HeroBanner() {
  return (
    <section aria-labelledby="hero-title" className="border-b border-gold-line bg-card">
      <div className="mx-auto flex w-full max-w-[1800px] items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-7">
          <h1
            id="hero-title"
            className="ke-title text-[19px] leading-tight text-primary sm:text-[28px] lg:text-[36px]"
          >
            The living spirit of Kerala
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground sm:text-[15px]">
            Find Theyyam performances in kavus and temples across the state. Browse the map, pick a
            form, and see what is on tonight.
          </p>
          <nav
            aria-label="Jump to a section"
            className="mt-3 hidden flex-wrap gap-x-6 gap-y-1 text-sm font-semibold sm:flex"
          >
            <a href="#map" className="text-gold underline-offset-4 hover:underline">
              Explore performances
            </a>
            <a href="#forms" className="text-gold underline-offset-4 hover:underline">
              Discover forms
            </a>
            <a href="#calendar" className="text-gold underline-offset-4 hover:underline">
              See the calendar
            </a>
          </nav>
        </div>

        <div className="relative w-28 shrink-0 border-l border-gold-line sm:w-[38%] lg:w-[42%] lg:max-w-[780px]">
          <picture>
            <source srcSet="/hero-theyyam.webp" type="image/webp" />
            <img
              src="/hero-theyyam.jpg"
              alt="A Theyyam performer in a red crown and costume, with ritual flames behind"
              width={1600}
              height={1067}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover object-[62%_32%]"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
