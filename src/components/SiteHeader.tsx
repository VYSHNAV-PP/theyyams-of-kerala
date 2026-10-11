import { Link, useLocation } from "@tanstack/react-router";
import {
  CalendarDays,
  Coffee,
  Compass,
  Flame,
  Flower2,
  Landmark,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COFFEE_URL } from "./SiteIntro";

const NAV = [
  { to: "/", label: "Map" },
  { to: "/today", label: "Theyyam Today" },
  { to: "/forms", label: "Forms" },
  { to: "/temples", label: "Temples" },
  { to: "/calendar", label: "Calendar" },
] as const;

export function SiteHeader({
  search,
}: {
  search?: { value: string; onChange: (v: string) => void } | undefined;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isSubmitPage = location.pathname === "/submit";

  useEffect(() => {
    if (!menuOpen) return;

    const onOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  const searchField = (mobile: boolean) =>
    search && (
      <div
        className={
          mobile
            ? "relative min-w-0 flex-1 md:hidden"
            : "relative hidden min-w-0 flex-1 md:block md:max-w-[720px] lg:mx-4 xl:mx-8"
        }
      >
        <Search
          size={mobile ? 16 : 19}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gold ${
            mobile ? "left-3" : "left-4"
          }`}
          aria-hidden="true"
        />
        <input
          type="search"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          aria-label="Search Theyyams, temples or places"
          placeholder={mobile ? "Search Theyyams" : "Search Theyyam, temple or place…"}
          className={`w-full min-w-0 rounded-full border border-gold-line bg-raised text-foreground outline-none transition focus:border-gold ${
            mobile ? "h-10 pl-9 pr-9 text-[13px]" : "h-11 pl-11 pr-11 text-[15px]"
          }`}
        />
        {search.value && (
          <button
            type="button"
            onClick={() => search.onChange("")}
            aria-label="Clear search"
            className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground ${
              mobile ? "right-1 h-8 w-8" : "right-1.5 h-9 w-9"
            }`}
          >
            <X size={16} />
          </button>
        )}
      </div>
    );

  const menuItem =
    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-accent";

  return (
    <header className="ke-header relative z-[1000] shrink-0 border-b border-gold-line bg-card">
      <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4 md:px-5 lg:px-8 xl:px-10">
        <div
          className={`relative flex h-[var(--header-h)] items-center ${
            search ? "gap-2 sm:gap-3 lg:gap-5" : ""
          }`}
        >
          {/* Logo */}
          <Link
            to="/"
            aria-label="Theyyams of Kerala, home"
            onClick={close}
            className="flex shrink-0 items-center gap-2 sm:gap-2.5 lg:gap-3"
          >
            <img
              src="/logo-mark-96.png"
              alt=""
              width={48}
              height={48}
              className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10 lg:h-12 lg:w-12"
            />
            <span className="font-display font-bold uppercase leading-[1.05] tracking-[0.08em] text-foreground">
              <span className="block text-[13px] sm:text-[15px] lg:text-[19px]">Theyyams</span>
              <span className="block text-[10px] text-gold sm:text-[11px] lg:text-[13px]">
                of Kerala
              </span>
            </span>
          </Link>

          {/* Main navigation (wide screens) */}
          <nav aria-label="Main" className="hidden items-stretch gap-1 xl:flex">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center px-3 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] hover:text-gold ${
                    active ? "text-gold" : "text-foreground"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-px h-0.5 bg-gold"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile search (home only) */}
          {!isSubmitPage && searchField(true)}

          {/* On the Post page, mobile gets a way back instead of search */}
          {isSubmitPage && (
            <Link
              to="/"
              onClick={close}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-gold hover:bg-accent md:hidden"
            >
              <Compass size={18} aria-hidden="true" />
              Explore
            </Link>
          )}

          {/* Desktop search */}
          {searchField(false)}

          {/* Right side */}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
            <Link
              to="/submit"
              onClick={close}
              className="tap hidden h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 sm:flex lg:h-11 lg:gap-2 lg:px-5 lg:text-[15px]"
            >
              <Plus size={18} aria-hidden="true" />
              Post
            </Link>

            {/* Menu */}
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="relative z-[1100] flex h-9 w-9 items-center justify-center rounded-md text-foreground transition hover:bg-accent sm:h-10 sm:w-10 lg:h-11 lg:w-11"
              >
                {menuOpen ? <X size={22} /> : <Menu size={24} />}
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[1050] bg-black/40 md:hidden"
                    aria-hidden="true"
                    onClick={close}
                  />
                  <div
                    role="menu"
                    className="fixed right-2 top-[calc(var(--header-h)+4px)] z-[1100] w-[calc(100vw-16px)] max-w-[280px] overflow-hidden rounded-lg border border-gold-line bg-popover p-1.5 shadow-2xl sm:right-3 md:absolute md:right-0 md:top-[calc(100%+8px)] md:w-60"
                  >
                    {[
                      ["/", "Explore the map", Compass],
                      ["/today", "Theyyam today", Flame],
                      ["/forms", "Theyyam forms", Flower2],
                      ["/temples", "Temples", Landmark],
                      ["/calendar", "Calendar", CalendarDays],
                    ].map(([to, label, Icon]) => {
                      const I = Icon as typeof Compass;
                      return (
                        <Link
                          key={to as string}
                          to={to as "/"}
                          role="menuitem"
                          onClick={close}
                          className={menuItem}
                        >
                          <I size={19} className="text-gold" aria-hidden="true" />
                          {label as string}
                        </Link>
                      );
                    })}
                    {!isSubmitPage && (
                      <Link
                        to="/submit"
                        role="menuitem"
                        onClick={close}
                        className={`${menuItem} sm:hidden`}
                      >
                        <Plus size={19} className="text-gold" aria-hidden="true" />
                        Post a Theyyam
                      </Link>
                    )}
                    <a
                      href={COFFEE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      role="menuitem"
                      onClick={close}
                      className={`${menuItem} border-t border-border`}
                    >
                      <Coffee size={19} className="text-gold" aria-hidden="true" />
                      Support the project
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
