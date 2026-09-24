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
][] = [
  ["now", "Happening now"],
  ["today", "Today"],
  ["weekend", "This weekend"],
  ["upcoming", "Upcoming"],
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

      {/* FILTER AREA */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-5 lg:px-8 xl:px-10">
          {/* Categories */}
          <div
            className="flex gap-2 overflow-x-auto pt-2"
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
                  tone={
                    CATEGORY_META[c]
                      .hex
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

          {/* Quick filters */}
          <div
            className="flex gap-2 overflow-x-auto py-2"
            role="group"
            aria-label="Quick filters"
          >
            {QUICK.map(
              ([k, l]) => (
                <Chip
                  key={k}
                  active={
                    f.date === k
                  }
                  onClick={() =>
                    toggleDate(k)
                  }
                >
                  {l}
                </Chip>
              ),
            )}

            <Chip
              active={
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
            >
              Free events
            </Chip>
          </div>
        </div>
      </div>

      {/* LOCATION / CONTROLS */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-2 px-3 py-1.5 sm:px-5 lg:px-8 xl:px-10">
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

            {f.subcategory && (
              <span className="font-normal text-muted-foreground">
                {" "}
                ·{" "}
                {f.subcategory}
              </span>
            )}
          </p>

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
              className="flex overflow-hidden rounded-md border border-border"
              role="group"
              aria-label="View"
            >
              {(
                [
                  [
                    "map",
                    "Map",
                    MapIcon,
                  ],
                  [
                    "list",
                    "List",
                    List,
                  ],
                ] as const
              ).map(
                ([
                  k,
                  l,
                  Icon,
                ]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={
                      view ===
                      k
                    }
                    onClick={() =>
                      setView(
                        k,
                      )
                    }
                    className={`flex h-9 items-center gap-1 px-3 text-sm font-medium ${
                      view ===
                      k
                        ? "bg-foreground text-background"
                        : "bg-card hover:bg-muted"
                    }`}
                  >
                    <Icon
                      size={16}
                      aria-hidden="true"
                    />
                    {l}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <main className="relative min-h-0 flex-1">
        <div className="mx-auto h-full w-full max-w-[1800px]">
          <div className="relative flex h-full min-h-0">
            {/* MAP */}
            <div
              className={`relative min-w-0 flex-1 ${
                view === "map"
                  ? ""
                  : "hidden"
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
            </div>

            {/* DESKTOP EVENT LIST */}
            {view === "map" && (
              <aside
                aria-label="Event list"
                className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border bg-card lg:block"
              >
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
              </aside>
            )}

            {/* LIST VIEW */}
            {view === "list" && (
              <div className="min-w-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl">
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