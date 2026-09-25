import { Link } from "@tanstack/react-router";
import {
  Compass,
  MapPin,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

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
  const [menuOpen, setMenuOpen] =
    useState(false);

  const menuRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [menuOpen]);

  return (
    <header className="relative z-[1000] shrink-0 border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[1800px] px-2.5 sm:px-4 md:px-5 lg:px-8 xl:px-10">
        {/* =====================================================
            MAIN HEADER
           ===================================================== */}
        <div className="flex h-[60px] items-center gap-2 sm:h-[68px] sm:gap-3 lg:h-[76px] lg:gap-5">

          {/* ===================================================
              LOGO
             =================================================== */}
          <Link
            to="/"
            aria-label="Kerala Events — home"
            onClick={() =>
              setMenuOpen(false)
            }
            className="flex shrink-0 items-center gap-2 sm:gap-2.5 lg:gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf7f3] text-[#075c48] sm:h-10 sm:w-10 lg:h-11 lg:w-11">
              <MapPin
                size={21}
                strokeWidth={2.5}
                className="sm:h-[23px] sm:w-[23px] lg:h-6 lg:w-6"
              />
            </span>

            <span className="hidden font-display text-[25px] font-bold tracking-[-0.5px] text-[#075c48] sm:inline lg:text-[25px]">
              Kerala Events
            </span>
          </Link>

          {/* ===================================================
              MOBILE SEARCH
             =================================================== */}
          {search && (
            <div className="relative min-w-0 flex-1 md:hidden">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />

              <input
                type="search"
                value={search.value}
                onChange={(e) =>
                  search.onChange(
                    e.target.value,
                  )
                }
                aria-label="Search events, places or venues"
                placeholder="Search events, places..."
                className="
                  h-10
                  w-full
                  min-w-0
                  rounded-full
                  border
                  border-slate-200
                  bg-slate-50/70
                  pl-9
                  pr-9
                  text-[13px]
                  text-slate-800
                  placeholder:text-slate-500
                  shadow-sm
                  outline-none
                  transition
                  focus:border-[#075c48]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#075c48]/10
                  sm:h-11
                  sm:text-[14px]
                "
              />

              {search.value && (
                <button
                  type="button"
                  onClick={() =>
                    search.onChange("")
                  }
                  aria-label="Clear search"
                  className="
                    absolute
                    right-1
                    top-1/2
                    flex
                    h-8
                    w-8
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-full
                    text-slate-500
                    hover:bg-slate-100
                  "
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* ===================================================
              DESKTOP SEARCH
             =================================================== */}
          {search && (
            <div className="relative hidden min-w-0 flex-1 md:block md:max-w-[870px] lg:mx-5 xl:mx-8">
              <Search
                size={21}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />

              <input
                type="search"
                value={search.value}
                onChange={(e) =>
                  search.onChange(
                    e.target.value,
                  )
                }
                aria-label="Search events, places or venues"
                placeholder="Search events, places or venues..."
                className="
                  h-[58px]
                  w-full
                  rounded-full
                  border
                  border-slate-200
                  bg-slate-50/70
                  pl-14
                  pr-12
                  text-[16px]
                  text-slate-800
                  placeholder:text-slate-500
                  shadow-sm
                  outline-none
                  transition
                  focus:border-[#075c48]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#075c48]/10
                "
              />

              {search.value && (
                <button
                  type="button"
                  onClick={() =>
                    search.onChange("")
                  }
                  aria-label="Clear search"
                  className="
                    absolute
                    right-2
                    top-1/2
                    flex
                    h-10
                    w-10
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-full
                    text-slate-500
                    hover:bg-slate-100
                  "
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          {/* ===================================================
              MOBILE SPACER
             =================================================== */}
          {!search && (
            <div className="min-w-0 flex-1 md:hidden" />
          )}

          {/* ===================================================
              DESKTOP EXPLORE
             =================================================== */}
          <Link
            to="/"
            onClick={() =>
              setMenuOpen(false)
            }
            className="
              hidden
              shrink-0
              items-center
              gap-2
              rounded-full
              px-4
              py-3
              text-[16px]
              font-semibold
              text-[#064d3e]
              hover:bg-slate-50
              lg:flex
            "
          >
            <Compass size={22} />
            Explore
          </Link>

          {/* ===================================================
              POST EVENT
             =================================================== */}
          <Link
            to="/submit"
            onClick={() =>
              setMenuOpen(false)
            }
            className="
              flex
              h-9
              shrink-0
              items-center
              justify-center
              gap-1
              rounded-full
              bg-[#075c48]
              px-3
              text-[12px]
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#064d3e]
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#075c48]
              sm:h-10
              sm:gap-1.5
              sm:px-3.5
              sm:text-[13px]
              lg:h-[50px]
              lg:gap-2
              lg:px-5
              lg:text-[15px]
            "
          >
            <Plus
              size={17}
              className="sm:h-[19px] sm:w-[19px] lg:h-5 lg:w-5"
            />

            <span className="hidden sm:inline lg:hidden">
              Post
            </span>

            <span className="hidden lg:inline">
              Post an Event
            </span>
          </Link>

          {/* ===================================================
              MENU BUTTON
             =================================================== */}
          <div
            ref={menuRef}
            className="relative shrink-0"
          >
            <button
              type="button"
              aria-label={
                menuOpen
                  ? "Close menu"
                  : "Open menu"
              }
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() =>
                setMenuOpen(
                  (open) => !open,
                )
              }
              className="
                relative
                z-[1100]
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                text-slate-800
                transition
                hover:bg-slate-100
                active:bg-slate-200
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#075c48]
                sm:h-10
                sm:w-10
                lg:h-11
                lg:w-11
              "
            >
              {menuOpen ? (
                <X
                  size={22}
                  strokeWidth={2}
                />
              ) : (
                <Menu
                  size={24}
                  strokeWidth={2}
                />
              )}
            </button>

            {/* =================================================
                MOBILE DROPDOWN
               ================================================= */}
            {menuOpen && (
              <>
                {/* Mobile backdrop */}
                <div
                  className="
                    fixed
                    inset-0
                    z-[1050]
                    bg-black/5
                    md:hidden
                  "
                  aria-hidden="true"
                  onClick={() =>
                    setMenuOpen(false)
                  }
                />

                {/* Mobile menu */}
                <div
                  role="menu"
                  className="
                    fixed
                    right-2
                    top-[64px]
                    z-[1100]
                    w-[calc(100vw-16px)]
                    max-w-[280px]
                    overflow-hidden
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-1.5
                    shadow-xl
                    sm:right-3
                    sm:top-[72px]
                    sm:max-w-[300px]
                    md:hidden
                  "
                >
                  {/* Explore */}
                  <Link
                    to="/"
                    role="menuitem"
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-3.5
                      text-sm
                      font-medium
                      text-slate-700
                      transition
                      hover:bg-slate-100
                      active:bg-slate-200
                    "
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf7f3] text-[#075c48]">
                      <Compass
                        size={19}
                      />
                    </span>

                    <span>
                      Explore events
                    </span>
                  </Link>

                  {/* Buy me a coffee */}
                  <div
                    role="menuitem"
                    aria-disabled="true"
                    className="
                      flex
                      cursor-default
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-3.5
                      text-sm
                      font-medium
                      text-slate-400
                    "
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50">
                      <Plus
                        size={19}
                        className="text-slate-400"
                      />
                    </span>

                    <span>
                      Buy me a coffee
                    </span>
                  </div>
                </div>

                {/* Desktop dropdown */}
                <div
                  role="menu"
                  className="
                    absolute
                    right-0
                    top-[44px]
                    z-[1100]
                    hidden
                    w-56
                    overflow-hidden
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-1.5
                    shadow-xl
                    sm:top-[50px]
                    md:block
                    lg:top-[58px]
                  "
                >
                  {/* Explore */}
                  <Link
                    to="/"
                    role="menuitem"
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-3
                      text-sm
                      font-medium
                      text-slate-700
                      transition
                      hover:bg-slate-100
                    "
                  >
                    <Compass
                      size={19}
                      className="text-[#075c48]"
                    />

                    Explore events
                  </Link>

                  {/* Buy me a coffee */}
                  <div
                    role="menuitem"
                    aria-disabled="true"
                    className="
                      flex
                      cursor-default
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-3
                      text-sm
                      font-medium
                      text-slate-400
                    "
                  >
                    <Plus
                      size={19}
                      className="text-slate-400"
                    />

                    Buy me a coffee
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}