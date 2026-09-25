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
    <header className="relative z-50 shrink-0 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-[76px] w-full max-w-[1800px] items-center gap-5 px-5 lg:px-8 xl:px-10">

        {/* LOGO */}
        <Link
          to="/"
          aria-label="Kerala Events — home"
          onClick={() =>
            setMenuOpen(false)
          }
          className="flex shrink-0 items-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf7f3] text-[#075c48]">
            <MapPin
              size={26}
              strokeWidth={2.5}
            />
          </span>

          <span className="hidden font-display text-[25px] font-bold tracking-[-0.5px] text-[#075c48] sm:inline">
            Kerala Events
          </span>
        </Link>

        {/* SEARCH */}
        {search ? (
          <div className="relative min-w-0 flex-1 md:max-w-[870px] lg:mx-5 xl:mx-8">
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
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        {/* EXPLORE */}
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

        {/* POST AN EVENT */}
        <Link
          to="/submit"
          onClick={() =>
            setMenuOpen(false)
          }
          className="
            flex
            h-[50px]
            shrink-0
            items-center
            gap-2
            rounded-full
            bg-[#075c48]
            px-5
            text-[15px]
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-[#064d3e]
            focus-visible:outline-2
            focus-visible:outline-offset-2
            focus-visible:outline-[#075c48]
          "
        >
          <Plus size={20} />

          <span className="hidden sm:inline">
            Post an Event
          </span>

          <span className="sm:hidden">
            Post
          </span>
        </Link>

        {/* MENU */}
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
            onClick={() =>
              setMenuOpen(
                (open) => !open,
              )
            }
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              text-slate-800
              transition
              hover:bg-slate-100
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#075c48]
            "
          >
            {menuOpen ? (
              <X
                size={26}
                strokeWidth={2}
              />
            ) : (
              <Menu
                size={28}
                strokeWidth={2}
              />
            )}
          </button>

          {/* DROPDOWN MENU */}
          {menuOpen && (
            <div
              className="
                absolute
                right-0
                top-[58px]
                w-56
                overflow-hidden
                rounded-xl
                border
                border-slate-200
                bg-white
                p-1.5
                shadow-lg
              "
            >
              {/* Explore */}
              <Link
                to="/"
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
                  hover:bg-slate-100
                "
              >
                <Compass
                  size={19}
                  className="text-[#075c48]"
                />

                Explore events
              </Link>

              {/* Buy me a coffee — disabled for now */}
              <div
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
          )}
        </div>
      </div>
    </header>
  );
}