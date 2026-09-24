import { Link } from "@tanstack/react-router";
import { MapPin, Plus, Search, X } from "lucide-react";

export function SiteHeader({
  search,
}: {
  search?:
    | {
        value: string;
        onChange: (v: string) => void;
      }
    | undefined;
}) {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-3 px-3 sm:px-5 lg:px-8 xl:px-10">
        {/* Logo */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-1.5 rounded-md font-display text-lg font-bold text-primary"
          aria-label="Kerala Events — home"
        >
          <MapPin size={20} aria-hidden="true" />
          <span className="hidden sm:inline">
            Kerala Events
          </span>
        </Link>

        {/* Search */}
        {search ? (
          <div className="relative min-w-0 flex-1 md:max-w-2xl lg:mx-4 xl:mx-8">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <input
              type="search"
              value={search.value}
              onChange={(e) =>
                search.onChange(e.target.value)
              }
              aria-label="Search events, places or venues"
              placeholder="Search events, places or venues…"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-search-cancel-button]:hidden"
            />

            {search.value && (
              <button
                type="button"
                onClick={() =>
                  search.onChange("")
                }
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X
                  size={16}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        ) : (
          <nav
            className="flex flex-1 items-center gap-1 text-sm"
            aria-label="Main"
          >
            <Link
              to="/"
              className="rounded-md px-3 py-2 hover:bg-muted"
            >
              Explore the map
            </Link>
          </nav>
        )}

        {/* Desktop navigation */}
        {search && (
          <nav
            className="hidden shrink-0 items-center text-sm lg:flex"
            aria-label="Main"
          >
            <Link
              to="/"
              className="rounded-md px-3 py-2 font-medium hover:bg-muted"
            >
              Explore
            </Link>
          </nav>
        )}

        {/* Post button */}
        <Link
          to="/submit"
          className="flex h-10 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4"
        >
          <Plus
            size={16}
            aria-hidden="true"
          />

          <span className="hidden sm:inline">
            Post an Event
          </span>

          <span className="sm:hidden">
            Post
          </span>
        </Link>
      </div>
    </header>
  );
}