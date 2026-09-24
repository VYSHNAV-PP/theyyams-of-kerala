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

  const [now, setNow] =
    useState(() =>
      Date.now(),
    );

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
    setSelectedId(e.id);

    setFocus({
      id: e.id,
      lat: e.lat,
      lng: e.lng,
    });

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
    <div className="flex h-dvh flex-col bg-background">
      <SiteHeader
        search={{
          value: f.q,
          onChange: setQ,
        }}
      />

      {/* CATEGORIES + QUICK FILTERS */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center px-3 py-2 sm:px-5 lg:px-8 xl:px-10">

          {/* CATEGORIES */}
          <div
            className="flex w-full flex-wrap justify-center gap-2"
            role="group"
            aria-label="Categories"
          >
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
              All
            </Chip>

            {CATEGORIES.map(
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
                  <span aria-hidden="true">
                    {
                      CATEGORY_META[
                        c
                      ].icon
                    }
                  </span>

                  {c}
                </Chip>
              ),
            )}
          </div>

          {/* QUICK FILTERS */}
          <div
            className="mt-2 w-full rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-1.5"
            role="group"
            aria-label="Quick filters"
          >
            <div className="flex flex-wrap items-center justify-center gap-1.5">

              <div className="flex h-9 shrink-0 items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-[#64748b] lg:h-10 lg:px-3 lg:text-xs">
                <CalendarDays
                  size={14}
                  aria-hidden="true"
                />

                Quick filters
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
                      className="flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring lg:h-10 lg:px-4 lg:text-[13px]"
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
                        className="h-1.5 w-1.5 rounded-full"
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
                className="flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring lg:h-10 lg:px-4 lg:text-[13px]"
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
                  className="h-1.5 w-1.5 rounded-full"
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

      {/* MAIN WORKSPACE */}
      <main className="relative min-h-0 flex-1">
        <div className="mx-auto h-full w-full max-w-[1800px] px-2 py-2 sm:px-3 lg:px-4">
          <div className="relative flex h-full min-h-0 gap-3">

            {/* MAP PANEL */}
            <div
              className={`relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-muted shadow-sm ${
                view === "map"
                  ? ""
                  : "hidden lg:block"
              }`}
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
                  <div className="absolute inset-x-3 bottom-4 z-[500] mx-auto max-w-sm rounded-lg border border-border bg-card p-4 text-center shadow-lg">
                    <p className="text-sm font-semibold">
                      {all?.length
                        ? "No events match these filters"
                        : "No events on the map yet"}
                    </p>

                    <div className="mt-3 flex justify-center gap-2">
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
                  <div className="absolute inset-x-0 bottom-0 z-[600] lg:inset-x-auto lg:bottom-3 lg:left-3 lg:w-96">
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

              {/* MOBILE VIEW SWITCHER */}
              <div className="absolute right-3 top-3 z-[600] flex overflow-hidden rounded-lg border border-border bg-card shadow-md lg:hidden">
                <button
                  type="button"
                  aria-pressed={
                    view === "map"
                  }
                  onClick={() =>
                    setView("map")
                  }
                  className={`flex h-9 items-center gap-1.5 px-3 text-sm font-medium ${
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
                  className={`flex h-9 items-center gap-1.5 px-3 text-sm font-medium ${
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

            {/* DESKTOP EVENT PANEL */}
            <aside
              aria-label="Event list"
              className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:w-[380px] xl:w-[420px] ${
                view === "map"
                  ? "hidden lg:flex"
                  : "flex"
              }`}
            >
              {/* CONTROLS INSIDE EVENT PANEL */}
              <div className="shrink-0 border-b border-border bg-card">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
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

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFilterOpen(
                          true,
                        )
                      }
                      className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
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

            {/* MOBILE LIST VIEW */}
            {view === "list" && (
              <div className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card shadow-sm lg:hidden">
                <div className="border-b border-border px-3 py-2">
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

                    <button
                      type="button"
                      onClick={() =>
                        setFilterOpen(
                          true,
                        )
                      }
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
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
    </div>
  );
}