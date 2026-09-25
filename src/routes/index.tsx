import {
  createFileRoute,
  ClientOnly,
  Link,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  List,
  Map as MapIcon,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import {
  Chip,
  EventPreview,
  EventRow,
} from "@/components/EventViews";
import { FilterSheet } from "@/components/FilterSheet";
import type { Viewport } from "@/components/EventMap";
import {
  CATEGORIES,
  CATEGORY_META,
  DEFAULT_FILTERS,
  applyFilters,
  contextPlace,
  fetchEvents,
  type DateKey,
  type Filters,
  type KEvent,
} from "@/lib/events";
import { KERALA_BOUNDS } from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";

const EventMap = lazy(
  () => import("@/components/EventMap"),
);

export const Route =
  createFileRoute("/")({
    head: () => ({
      meta: [
        {
          title:
            "Kerala Events — see what's happening across Kerala",
        },
        {
          name: "description",
          content:
            "Explore events across Kerala's 14 districts on a live map. Search, filter and post events.",
        },
        {
          property: "og:title",
          content:
            "Kerala Events — see what's happening across Kerala",
        },
        {
          property: "og:description",
          content:
            "A community map of sports, cultural, religious and public events in Kerala.",
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content:
            "summary_large_image",
        },
      ],
    }),
    component: Home,
  });

const QUICK: [
  DateKey,
  string,
  string,
][] = [
  ["now", "Happening now", "#ef4444"],
  ["today", "Today", "#3b82f6"],
  ["weekend", "This weekend", "#8b5cf6"],
  ["upcoming", "Upcoming", "#22c55e"],
];

function useDebounced<T>(
  v: T,
  ms: number,
) {
  const [d, setD] =
    useState(v);

  useEffect(() => {
    const t = setTimeout(
      () => setD(v),
      ms,
    );

    return () =>
      clearTimeout(t);
  }, [v, ms]);

  return d;
}

function useIsDesktop() {
  const [
    isDesktop,
    setIsDesktop,
  ] = useState(false);

  useEffect(() => {
    const media =
      window.matchMedia(
        "(min-width: 1024px)",
      );

    const update = () =>
      setIsDesktop(
        media.matches,
      );

    update();

    media.addEventListener(
      "change",
      update,
    );

    return () =>
      media.removeEventListener(
        "change",
        update,
      );
  }, []);

  return isDesktop;
}

function Home() {
  const [f, setF] =
    useState<Filters>(
      DEFAULT_FILTERS,
    );

  const [view, setView] =
    useState<
      "map" | "list"
    >("map");

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | null
  >(null);

  const [focus, setFocus] =
    useState<{
      id: string;
      lat: number;
      lng: number;
    } | null>(null);

  const [vp, setVp] =
    useState<Viewport | null>(
      null,
    );

  const [user, setUser] =
    useState<
      [number, number] | null
    >(null);

  const [
    filterOpen,
    setFilterOpen,
  ] = useState(false);

  /* Mobile category expansion */
  const [
    categoriesExpanded,
    setCategoriesExpanded,
  ] = useState(false);

  const [now, setNow] =
    useState(() =>
      Date.now(),
    );

  /*
   * IMPORTANT:
   *
   * EventMap must not be mounted while the mobile
   * list is displayed. Leaflet can be initialized
   * inside a display:none container and then fail
   * when that container becomes visible.
   *
   * Desktop keeps the map mounted even when the
   * desktop list view is selected.
   */
  const isDesktop =
    useIsDesktop();

  const showMap =
    isDesktop ||
    view === "map";

  useEffect(() => {
    const t = setInterval(
      () =>
        setNow(Date.now()),
      60_000,
    );

    return () =>
      clearInterval(t);
  }, []);

  const q = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  /*
   * Listen for database updates.
   *
   * The asynchronous image-search Edge Function
   * updates image_url / image_candidates after the
   * event has already been created.
   *
   * When that UPDATE arrives, refetch immediately
   * instead of waiting for the 60-second interval.
   */
  useEffect(() => {
    const channel = supabase
      .channel("events-image-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
        },
        () => {
          void q.refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [q.refetch]);

  const all = q.data;

  const filtered = useMemo(
    () =>
      applyFilters(
        all ?? [],
        f,
        now,
        user,
      ),
    [all, f, now, user],
  );

  const dq = useDebounced(
    f.q,
    400,
  );

  const place =
    contextPlace(
      vp
        ? filtered.filter(
            (e) =>
              e.lat >=
                vp.bounds[0] &&
              e.lat <=
                vp.bounds[2] &&
              e.lng >=
                vp.bounds[1] &&
              e.lng <=
                vp.bounds[3],
          )
        : filtered,
      vp?.zoom ?? 7,
      f.district,
    );

  const placeCount =
    place === "Kerala"
      ? filtered.length
      : filtered.filter(
          (e) =>
            e.district ===
              place ||
            e.locality ===
              place,
        ).length;

  const fit = useMemo(
    () => {
      const active =
        !!f.district ||
        !!dq ||
        f.category !==
          "All";

      const key =
        JSON.stringify([
          f.district,
          dq,
          f.category,
          f.subcategory,
        ]);

      if (!active) {
        return {
          key,
          bounds:
            KERALA_BOUNDS,
        };
      }

      if (!filtered.length) {
        return {
          key,
          bounds: null,
        };
      }

      const lats =
        filtered.map(
          (e) => e.lat,
        );

      const lngs =
        filtered.map(
          (e) => e.lng,
        );

      return {
        key,
        bounds: [
          [
            Math.min(
              ...lats,
            ),
            Math.min(
              ...lngs,
            ),
          ],
          [
            Math.max(
              ...lats,
            ),
            Math.max(
              ...lngs,
            ),
          ],
        ] as [
          [number, number],
          [number, number],
        ],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      f.district,
      dq,
      f.category,
      f.subcategory,
      all,
    ],
  );

  const selected =
    filtered.find(
      (e) =>
        e.id ===
        selectedId,
    ) ?? null;

  const setQ =
    useCallback(
      (v: string) =>
        setF((x) => ({
          ...x,
          q: v,
        })),
      [],
    );

  const onSelect =
    useCallback(
      (e: KEvent) =>
        setSelectedId(
          e.id,
        ),
      [],
    );

  const pickFromList = (
    e: KEvent,
  ) => {
    /*
     * Set the event selection first.
     */
    setSelectedId(e.id);

    /*
     * Tell the map where the event is.
     * EventMap will consume this after it mounts.
     */
    setFocus({
      id: e.id,
      lat: e.lat,
      lng: e.lng,
    });

    /*
     * On mobile/tablet, switch to map view.
     *
     * Because EventMap is conditionally mounted
     * using showMap, it will now mount into a
     * visible container rather than a display:none
     * container.
     */
    if (view === "list") {
      setView("map");
    }
  };

  const toggleDate = (
    k: DateKey,
  ) => {
    setF((x) => ({
      ...x,
      date:
        x.date === k
          ? "any"
          : k,
    }));
  };

  const askLocation =
    useCallback(
      () =>
        new Promise<boolean>(
          (res) => {
            if (
              !navigator.geolocation
            ) {
              return res(false);
            }

            navigator.geolocation.getCurrentPosition(
              (p) => {
                setUser([
                  p.coords
                    .latitude,
                  p.coords
                    .longitude,
                ]);

                res(true);
              },
              () =>
                res(false),
              {
                timeout:
                  10000,
              },
            );
          },
        ),
      [],
    );

  const countFor =
    useCallback(
      (x: Filters) =>
        applyFilters(
          all ?? [],
          x,
          now,
          user,
        ).length,
      [all, now, user],
    );

  const activeAdvanced =
    [
      f.subcategory,
      f.district,
      f.locality,
      f.nearby,
      f.entry !== "any",
      f.date !==
        "any" &&
        !QUICK.some(
          ([k]) =>
            k === f.date,
        ),
      f.category !==
        "All",
    ].filter(Boolean)
      .length;

  const filtersOn =
    JSON.stringify({
      ...f,
      q: "",
    }) !==
      JSON.stringify(
        DEFAULT_FILTERS,
      ) || !!f.q;

  const list = (
    <ul aria-label="Events">
      {filtered.map((e) => (
        <EventRow
          key={e.id}
          e={e}
          active={
            e.id ===
            selectedId
          }
          onClick={() =>
            pickFromList(e)
          }
        />
      ))}
    </ul>
  );

  const empty =
    q.isSuccess &&
    filtered.length === 0;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background [touch-action:pan-y]">
      <SiteHeader
        search={{
          value: f.q,
          onChange: setQ,
        }}
      />

      {/* =========================================================
          CATEGORIES + QUICK FILTERS
          ========================================================= */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center px-2 py-2 sm:px-4 sm:py-2.5 md:px-6 lg:px-8 xl:px-10">

          <div
            className="flex w-full flex-wrap justify-center gap-1.5 sm:gap-2 md:gap-2.5"
            role="group"
            aria-label="Categories"
          >
            {/* ALL */}
            <Chip
              active={
                f.category ===
                "All"
              }
              onClick={() =>
                setF((x) => ({
                  ...x,
                  category: "All",
                  subcategory:
                    null,
                }))
              }
            >
              <span className="md:text-sm">
                All
              </span>
            </Chip>

            {/* MOBILE COLLAPSED CATEGORIES */}
            {CATEGORIES.slice(
              0,
              2,
            ).map(
              (c) => (
                <Chip
                  key={c}
                  active={
                    f.category ===
                    c
                  }
                  onClick={() =>
                    setF((x) => ({
                      ...x,
                      category:
                        x.category ===
                        c
                          ? "All"
                          : c,
                      subcategory:
                        null,
                    }))
                  }
                >
                  <span
                    className="text-base md:text-lg"
                    aria-hidden="true"
                  >
                    {
                      CATEGORY_META[
                        c
                      ].icon
                    }
                  </span>

                  <span className="md:text-sm">
                    {c}
                  </span>
                </Chip>
              ),
            )}

            {/* MORE BUTTON */}
            {!categoriesExpanded && (
              <button
                type="button"
                onClick={() =>
                  setCategoriesExpanded(
                    true,
                  )
                }
                aria-label="Show all categories"
                className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 text-base font-bold leading-none text-foreground shadow-sm transition-colors hover:bg-muted sm:hidden"
              >
                …
              </button>
            )}

            {/* REMAINING CATEGORIES */}
            <div
              className={`contents ${
                categoriesExpanded
                  ? ""
                  : "hidden sm:contents"
              }`}
            >
              {CATEGORIES.slice(
                2,
              ).map(
                (c) => (
                  <Chip
                    key={c}
                    active={
                      f.category ===
                      c
                    }
                    onClick={() =>
                      setF((x) => ({
                        ...x,
                        category:
                          x.category ===
                          c
                            ? "All"
                            : c,
                        subcategory:
                          null,
                      }))
                    }
                  >
                    <span
                      className="text-base md:text-lg"
                      aria-hidden="true"
                    >
                      {
                        CATEGORY_META[
                          c
                        ].icon
                      }
                    </span>

                    <span className="md:text-sm">
                      {c}
                    </span>
                  </Chip>
                ),
              )}

              {/* COLLAPSE BUTTON */}
              {categoriesExpanded && (
                <button
                  type="button"
                  onClick={() =>
                    setCategoriesExpanded(
                      false,
                    )
                  }
                  aria-label="Collapse categories"
                  className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 text-base font-bold leading-none text-foreground shadow-sm transition-colors hover:bg-muted sm:hidden"
                >
                  …
                </button>
              )}
            </div>
          </div>

          {/* QUICK FILTERS */}
          <div
            className="mt-2 w-full rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-1.5 sm:mt-2.5 md:mt-3 md:p-2"
            role="group"
            aria-label="Quick filters"
          >
            <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
              <div className="flex h-9 shrink-0 items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-[#64748b] md:h-10 md:px-3 md:text-xs">
                <CalendarDays
                  size={14}
                  className="md:h-4 md:w-4"
                  aria-hidden="true"
                />

                <span>
                  Quick filters
                </span>
              </div>

              {QUICK.map(
                ([
                  k,
                  label,
                  tone,
                ]) => {
                  const active =
                    f.date ===
                    k;

                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={
                        active
                      }
                      onClick={() =>
                        toggleDate(
                          k,
                        )
                      }
                      className="flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring md:h-10 md:px-4 md:text-[13px]"
                      style={
                        active
                          ? {
                              borderColor:
                                tone,
                              backgroundColor:
                                tone,
                              color:
                                "#ffffff",
                              boxShadow:
                                `0 1px 2px ${tone}40`,
                            }
                          : {
                              borderColor:
                                `${tone}45`,
                              backgroundColor:
                                "#ffffff",
                              color:
                                tone,
                            }
                      }
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full md:h-2 md:w-2"
                        style={{
                          backgroundColor:
                            tone,
                        }}
                        aria-hidden="true"
                      />

                      {label}
                    </button>
                  );
                },
              )}

              {/* FREE EVENTS */}
              <button
                type="button"
                aria-pressed={
                  f.entry ===
                  "free"
                }
                onClick={() =>
                  setF((x) => ({
                    ...x,
                    entry:
                      x.entry ===
                      "free"
                        ? "any"
                        : "free",
                  }))
                }
                className="flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring md:h-10 md:px-4 md:text-[13px]"
                style={
                  f.entry ===
                  "free"
                    ? {
                        borderColor:
                          "#14b8a6",
                        backgroundColor:
                          "#14b8a6",
                        color:
                          "#ffffff",
                        boxShadow:
                          "0 1px 2px #14b8a640",
                      }
                    : {
                        borderColor:
                          "#14b8a665",
                        backgroundColor:
                          "#ffffff",
                        color:
                          "#0f766e",
                      }
                }
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full md:h-2 md:w-2"
                  style={{
                    backgroundColor:
                      "#14b8a6",
                  }}
                  aria-hidden="true"
                />

                Free events
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          MAIN WORKSPACE
          ========================================================= */}
      <main className="relative flex-1 [touch-action:pan-y]">

        {/* MOBILE / TABLET CONTROLS */}
        <div className="shrink-0 border-b border-border bg-card px-2 py-2 lg:hidden">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFilterOpen(true)
              }
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted sm:h-10 sm:px-4"
            >
              <SlidersHorizontal
                size={16}
                aria-hidden="true"
              />

              Filters

              {activeAdvanced >
                0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {
                    activeAdvanced
                  }
                </span>
              )}
            </button>

            <div
              className="flex overflow-hidden rounded-lg border border-border"
              role="group"
              aria-label="View"
            >
              <button
                type="button"
                aria-pressed={
                  view === "map"
                }
                onClick={() =>
                  setView("map")
                }
                className={`flex h-9 items-center gap-1.5 px-3 text-sm font-medium sm:h-10 sm:px-4 ${
                  view === "map"
                    ? "bg-foreground text-background"
                    : "bg-card hover:bg-muted"
                }`}
              >
                <MapIcon
                  size={15}
                  aria-hidden="true"
                />
                Map
              </button>

              <button
                type="button"
                aria-pressed={
                  view === "list"
                }
                onClick={() =>
                  setView("list")
                }
                className={`flex h-9 items-center gap-1.5 px-3 text-sm font-medium sm:h-10 sm:px-4 ${
                  view === "list"
                    ? "bg-foreground text-background"
                    : "bg-card hover:bg-muted"
                }`}
              >
                <List
                  size={15}
                  aria-hidden="true"
                />
                List
              </button>
            </div>
          </div>
        </div>

        {/* SMALL DESCRIPTION */}
        <div className="mx-auto w-full max-w-[1800px] px-2 pt-2 sm:px-3 sm:pt-3 lg:px-4">
          <p className="text-center text-xs text-muted-foreground sm:text-sm">
            Explore events across Kerala — browse
            the map, filter by category or date, and
            tap an event for details.
          </p>
        </div>

        {/* WORKSPACE */}
        <div className="mx-auto w-full max-w-[1800px] px-1.5 py-1.5 sm:px-2 sm:py-2 md:px-3 lg:px-4">
          <div className="relative flex min-h-0 gap-2 sm:gap-3 lg:h-[calc(100dvh-260px)] lg:min-h-[520px] lg:gap-4">

            {/* ===================================================
                MAP PANEL
                =================================================== */}
            {showMap && (
              <div
                className="relative min-h-[62vh] min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted shadow-sm [touch-action:auto] sm:min-h-[620px] sm:rounded-2xl lg:min-h-0"
              >
                <ClientOnly
                  fallback={
                    <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                      Loading map…
                    </div>
                  }
                >
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                        Loading map…
                      </div>
                    }
                  >
                    <EventMap
                      key="event-map"
                      events={
                        filtered
                      }
                      selectedId={
                        selectedId
                      }
                      focus={focus}
                      fit={fit}
                      onSelect={
                        onSelect
                      }
                      onViewport={
                        setVp
                      }
                      onLocate={(
                        lat,
                        lng,
                      ) =>
                        setUser([
                          lat,
                          lng,
                        ])
                      }
                    />
                  </Suspense>
                </ClientOnly>

                {q.isFetching &&
                  !all && (
                    <p
                      role="status"
                      className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-card px-3 py-1 text-xs shadow"
                    >
                      Loading events…
                    </p>
                  )}

                {q.isError && (
                  <div
                    role="alert"
                    className="absolute left-1/2 top-16 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-lg border border-border bg-card p-4 text-center shadow-lg"
                  >
                    <p className="text-sm font-semibold">
                      We couldn't
                      load events
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Check your
                      connection and
                      try again.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        void q.refetch()
                      }
                      className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {empty &&
                  !selected && (
                    <div className="absolute inset-x-2 bottom-3 z-[500] mx-auto max-w-sm rounded-lg border border-border bg-card p-4 text-center shadow-lg sm:inset-x-3 sm:bottom-4">
                      <p className="text-sm font-semibold">
                        {all?.length
                          ? "No events match these filters"
                          : "No events on the map yet"}
                      </p>

                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {filtersOn && (
                          <button
                            type="button"
                            onClick={() =>
                              setF(
                                DEFAULT_FILTERS,
                              )
                            }
                            className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                          >
                            Clear
                            filters
                          </button>
                        )}

                        <Link
                          to="/submit"
                          className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                        >
                          <Plus
                            size={14}
                            aria-hidden="true"
                          />
                          Post an
                          Event
                        </Link>
                      </div>
                    </div>
                  )}

                {selected &&
                  view === "map" && (
                    <div className="absolute inset-x-0 bottom-0 z-[600] sm:inset-x-2 sm:bottom-2 md:inset-x-3 md:bottom-3 lg:inset-x-auto lg:left-3 lg:w-96">
                      <EventPreview
                        e={selected}
                        onClose={() =>
                          setSelectedId(
                            null,
                          )
                        }
                      />
                    </div>
                  )}
              </div>
            )}

            {/* ===================================================
                DESKTOP EVENT PANEL
                =================================================== */}
            <aside
              aria-label="Event list"
              className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:rounded-2xl lg:w-[360px] xl:w-[400px] 2xl:w-[420px] ${
                view === "map"
                  ? "hidden lg:flex"
                  : "flex"
              }`}
            >
              {/* CONTROLS INSIDE EVENT PANEL */}
              <div className="shrink-0 border-b border-border bg-card">
                <div className="flex items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      aria-live="polite"
                    >
                      {q.isLoading
                        ? "Loading events…"
                        : `${place} · ${placeCount} ${
                            placeCount ===
                            1
                              ? "event"
                              : "events"
                          }`}
                    </p>

                    {f.subcategory && (
                      <p className="truncate text-xs text-muted-foreground">
                        {f.subcategory}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFilterOpen(
                          true,
                        )
                      }
                      className="flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium hover:bg-muted sm:px-3"
                    >
                      <SlidersHorizontal
                        size={16}
                        aria-hidden="true"
                      />

                      <span className="hidden sm:inline">
                        Filters
                      </span>

                      {activeAdvanced >
                        0 && (
                        <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                          {
                            activeAdvanced
                          }
                        </span>
                      )}
                    </button>

                    <div
                      className="flex overflow-hidden rounded-md border border-border"
                      role="group"
                      aria-label="View"
                    >
                      <button
                        type="button"
                        aria-pressed={
                          view ===
                          "map"
                        }
                        onClick={() =>
                          setView(
                            "map",
                          )
                        }
                        className={`flex h-9 items-center gap-1.5 px-2.5 text-sm font-medium ${
                          view ===
                          "map"
                            ? "bg-foreground text-background"
                            : "bg-card hover:bg-muted"
                        }`}
                      >
                        <MapIcon
                          size={15}
                          aria-hidden="true"
                        />

                        <span className="hidden xl:inline">
                          Map
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-pressed={
                          view ===
                          "list"
                        }
                        onClick={() =>
                          setView(
                            "list",
                          )
                        }
                        className={`flex h-9 items-center gap-1.5 px-2.5 text-sm font-medium ${
                          view ===
                          "list"
                            ? "bg-foreground text-background"
                            : "bg-card hover:bg-muted"
                        }`}
                      >
                        <List
                          size={15}
                          aria-hidden="true"
                        />

                        <span className="hidden xl:inline">
                          List
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* EVENT LIST */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {q.isLoading && (
                  <p className="p-4 text-sm text-muted-foreground">
                    Loading
                    events…
                  </p>
                )}

                {q.isError && (
                  <p className="p-4 text-sm text-muted-foreground">
                    Events are
                    unavailable
                    right now.
                  </p>
                )}

                {empty && (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nothing to
                    show for the
                    current
                    filters.
                  </p>
                )}

                {list}
              </div>
            </aside>

            {/* ===================================================
                MOBILE / TABLET LIST VIEW
                =================================================== */}
            {view === "list" && (
              <div className="min-h-[62vh] min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card shadow-sm sm:min-h-[620px] sm:rounded-2xl lg:hidden">
                <div className="border-b border-border px-2.5 py-2 sm:px-3">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-sm font-semibold"
                      aria-live="polite"
                    >
                      {q.isLoading
                        ? "Loading events…"
                        : `${place} · ${placeCount} ${
                            placeCount ===
                            1
                              ? "event"
                              : "events"
                          }`}
                    </p>
                  </div>
                </div>

                {q.isLoading && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Loading
                    events…
                  </p>
                )}

                {q.isError && (
                  <div
                    role="alert"
                    className="p-6 text-center text-sm"
                  >
                    We couldn't
                    load events.{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() =>
                        void q.refetch()
                      }
                    >
                      Retry
                    </button>
                  </div>
                )}

                {empty && (
                  <div className="p-8 text-center text-sm">
                    <p className="font-semibold">
                      {all?.length
                        ? "No events match these filters"
                        : "No events yet"}
                    </p>

                    {filtersOn && (
                      <button
                        type="button"
                        onClick={() =>
                          setF(
                            DEFAULT_FILTERS,
                          )
                        }
                        className="mt-2 text-primary underline"
                      >
                        Clear
                        filters
                      </button>
                    )}
                  </div>
                )}

                {list}
              </div>
            )}
          </div>
        </div>
      </main>

      <FilterSheet
        open={filterOpen}
        onOpenChange={
          setFilterOpen
        }
        filters={f}
        onApply={setF}
        count={countFor}
        hasLocation={!!user}
        askLocation={
          askLocation
        }
      />

      {/* FOOTER */}
      <footer className="flex h-8 shrink-0 items-center justify-center border-t border-border bg-background">
        <p className="text-[11px] text-muted-foreground">
          © 2026 Kerala Events
        </p>
      </footer>
    </div>
  );
}