import { createFileRoute, ClientOnly, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroBanner } from "@/components/HeroBanner";
import { MapLegend } from "@/components/MapLegend";
import { NowPanel, type ChipSpec } from "@/components/NowPanel";
import { FormsSection } from "@/components/FormsSection";
import { TheyyamCalendar } from "@/components/TheyyamCalendar";
import { EventPreview } from "@/components/EventViews";
import { FilterSheet } from "@/components/FilterSheet";
import type { Viewport } from "@/components/EventMap";
import {
  DEFAULT_FILTERS,
  applyFilters,
  contextPlace,
  fetchEvents,
  fmtDateShort,
  FORMS,
  inTab,
  phaseOf,
  statusOf,
  todayIST,
  type Filters,
  type KEvent,
  type Tab,
} from "@/lib/events";
import type { TheyyamForm } from "@/lib/taxonomy";
import { KERALA_BOUNDS } from "@/lib/geo";
import { useSaved } from "@/lib/saved";
import { supabase } from "@/integrations/supabase/client";

const EventMap = lazy(() => import("@/components/EventMap"));

const TITLE = "Theyyams of Kerala: find a Theyyam performance near you";
const DESCRIPTION =
  "A live map of Theyyam performances in kavus and temples across Kerala. Browse by form, date or district, and add what you know.";

export const Route = createFileRoute("/")({
  // Other pages link here with a form, a search text or a day already chosen.
  validateSearch: (
    search: Record<string, unknown>,
  ): { form?: string; q?: string; day?: string } => ({
    ...(typeof search["form"] === "string" && search["form"] ? { form: search["form"] } : {}),
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
    ...(typeof search["day"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["day"])
      ? { day: search["day"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

const MapFallback = (
  <div className="flex h-full items-center justify-center bg-raised text-sm text-muted-foreground">
    Loading map…
  </div>
);

/** Same height for the map and the Theyyam Now panel, so they always line up. */
const ROW_H = "lg:h-[clamp(540px,calc(100dvh-var(--header-h)-230px),780px)]";

function Home() {
  const search = Route.useSearch();
  const [f, setF] = useState<Filters>(() => {
    const form = search.form ? FORMS.find((x) => x.name === search.form) : undefined;
    return {
      ...DEFAULT_FILTERS,
      ...(search.q ? { q: search.q } : {}),
      ...(form ? { category: form.family, subcategory: form.name } : {}),
      ...(search.day ? { date: "custom" as const, from: search.day, to: search.day } : {}),
    };
  });
  const [tab, setTab] = useState<Tab>(() => (search.form || search.day ? "all" : "upcoming"));
  const [tabChosen, setTabChosen] = useState(() => !!(search.form || search.day));
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [vp, setVp] = useState<Viewport | null>(null);
  const [user, setUser] = useState<[number, number] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isDesktop = useIsDesktop();
  const saved = useSaved();
  const mapAnchor = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const showMap = isDesktop || view === "map";

  // Clock: statuses (now / tonight / ended) move on without a reload.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const q = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { refetch } = q;

  // Pick up newly found images without a reload.
  useEffect(() => {
    const channel = supabase
      .channel("events-image-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events" }, () => {
        void refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  const all = q.data;

  /* ---------- Filtering ---------- */

  const filtered = useMemo(
    () => applyFilters(all ?? [], f, now, user, saved),
    [all, f, now, user, saved],
  );
  const dq = useDebounced(f.q, 400);

  const counts = useMemo(() => {
    const c = { now: 0, tonight: 0, upcoming: 0, ended: 0 };
    for (const e of filtered) {
      if (inTab(e, "now", now)) c.now++;
      if (inTab(e, "tonight", now)) c.tonight++;
      if (inTab(e, "upcoming", now)) c.upcoming++;
      if (inTab(e, "ended", now)) c.ended++;
    }
    return c;
  }, [filtered, now]);

  // Open on the most useful tab once, unless the visitor already chose one.
  useEffect(() => {
    if (tabChosen || !q.isSuccess) return;
    setTab(counts.now > 0 ? "now" : counts.tonight > 0 ? "tonight" : "upcoming");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.isSuccess, tabChosen]);

  const listEvents = useMemo(
    () => filtered.filter((e) => inTab(e, tab, now)),
    [filtered, tab, now],
  );
  const mapEvents = useMemo(
    () => filtered.filter((e) => statusOf(e, now) !== "ended"),
    [filtered, now],
  );

  /* ---------- Map context ---------- */

  const place = contextPlace(
    vp
      ? mapEvents.filter(
          (e) =>
            e.lat >= vp.bounds[0] &&
            e.lat <= vp.bounds[2] &&
            e.lng >= vp.bounds[1] &&
            e.lng <= vp.bounds[3],
        )
      : mapEvents,
    vp?.zoom ?? 7,
    f.district,
  );

  const fit = useMemo(() => {
    const active = !!f.district || !!dq || f.category !== "All" || !!f.subcategory;
    const hasEvents = mapEvents.length > 0;
    const key = JSON.stringify([f.district, dq, f.category, f.subcategory, !active && hasEvents]);

    // Unfiltered: frame the performances that exist (mostly North Malabar), else all of Kerala.
    if (!active && !hasEvents) return { key, bounds: KERALA_BOUNDS };
    if (!hasEvents) return { key, bounds: null };

    const lats = mapEvents.map((e) => e.lat);
    const lngs = mapEvents.map((e) => e.lng);
    return {
      key,
      bounds: [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ] as [[number, number], [number, number]],
    };
  }, [f.district, dq, f.category, f.subcategory, mapEvents]);

  /* ---------- Selection ---------- */

  const selected = mapEvents.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !mapEvents.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [selectedId, mapEvents]);

  const onSelect = useCallback((e: KEvent) => {
    if (statusOf(e, Date.now()) === "ended") return;
    setSelectedId(e.id);
  }, []);

  const scrollToMap = () =>
    mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pickFromList = (e: KEvent) => {
    if (statusOf(e, now) === "ended") {
      // Ended performances are not on the map: open their page instead.
      void nav({ to: "/event/$id", params: { id: e.id } });
      return;
    }
    setSelectedId(e.id);
    setFocus({ id: e.id, lat: e.lat, lng: e.lng });
    if (view === "list") {
      setView("map");
      requestAnimationFrame(scrollToMap);
    }
  };

  /* ---------- Controls ---------- */

  const setQ = useCallback((v: string) => setF((x) => ({ ...x, q: v })), []);

  const chooseTab = (t: Tab) => {
    setTab(t);
    setTabChosen(true);
    setSelectedId(null);
  };

  const askLocation = useCallback(
    () =>
      new Promise<boolean>((res) => {
        if (!navigator.geolocation) return res(false);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            setUser([p.coords.latitude, p.coords.longitude]);
            res(true);
          },
          () => res(false),
          { timeout: 10000 },
        );
      }),
    [],
  );

  const countFor = useCallback(
    (x: Filters) =>
      applyFilters(all ?? [], x, now, user, saved).filter((e) => statusOf(e, now) !== "ended")
        .length,
    [all, now, user, saved],
  );

  const pickForm = (form: TheyyamForm) => {
    setF((x) => ({ ...x, category: form.family, subcategory: form.name }));
    chooseTab("all");
    setView("map");
    requestAnimationFrame(scrollToMap);
  };

  const selectedDay = f.date === "custom" && f.from && f.from === f.to ? f.from : null;

  const pickDay = (iso: string | null) => {
    if (!iso) {
      setF((x) => ({ ...x, date: "any", from: "", to: "" }));
      chooseTab("upcoming");
      return;
    }
    setF((x) => ({ ...x, date: "custom", from: iso, to: iso }));
    chooseTab(iso < todayIST(now) ? "ended" : "all");
    if (isDesktop) {
      // The list sits at the top of the right column, so bring it into view.
      requestAnimationFrame(scrollToMap);
    } else {
      setView("list");
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  };

  const clearAll = () => setF(DEFAULT_FILTERS);

  /* ---------- Active filter chips ---------- */

  const chips: ChipSpec[] = [];
  if (f.q.trim()) chips.push({ key: "q", label: `“${f.q.trim()}”`, onRemove: () => setQ("") });
  if (f.category !== "All")
    chips.push({
      key: "cat",
      label: f.category,
      onRemove: () => setF((x) => ({ ...x, category: "All", subcategory: null })),
    });
  if (f.subcategory)
    chips.push({
      key: "sub",
      label: f.subcategory,
      onRemove: () => setF((x) => ({ ...x, subcategory: null })),
    });
  if (f.district)
    chips.push({
      key: "dist",
      label: f.district,
      onRemove: () => setF((x) => ({ ...x, district: null })),
    });
  if (f.locality.trim())
    chips.push({
      key: "loc",
      label: f.locality.trim(),
      onRemove: () => setF((x) => ({ ...x, locality: "" })),
    });
  if (f.nearby)
    chips.push({
      key: "near",
      label: "Near me",
      onRemove: () => setF((x) => ({ ...x, nearby: false })),
    });
  if (f.date !== "any") {
    const labels: Record<string, string> = {
      now: "Performing now",
      today: "Today",
      tonight: "Tonight",
      tomorrow: "Tomorrow",
      weekend: "This weekend",
      week: "Next 7 days",
      month: "This month",
      upcoming: "Upcoming",
    };
    const label =
      f.date === "custom"
        ? f.from && f.from === f.to
          ? fmtDateShort(f.from)
          : `${f.from ? fmtDateShort(f.from) : "Today"} to ${f.to ? fmtDateShort(f.to) : "later"}`
        : (labels[f.date] ?? f.date);
    chips.push({
      key: "date",
      label,
      onRemove: () => setF((x) => ({ ...x, date: "any", from: "", to: "" })),
    });
  }
  if (f.confirmed)
    chips.push({
      key: "ver",
      label: "Verified only",
      onRemove: () => setF((x) => ({ ...x, confirmed: false })),
    });
  if (f.savedOnly)
    chips.push({
      key: "sav",
      label: "Saved",
      onRemove: () => setF((x) => ({ ...x, savedOnly: false })),
    });

  const filterCount = [
    f.category !== "All",
    !!f.subcategory,
    !!f.district,
    !!f.locality.trim(),
    f.nearby,
    f.date !== "any",
    f.confirmed,
    f.savedOnly,
  ].filter(Boolean).length;

  const panel = (
    <NowPanel
      tab={tab}
      onTab={chooseTab}
      counts={counts}
      events={listEvents}
      now={now}
      selectedId={selectedId}
      onPick={pickFromList}
      onOpenFilters={() => setFilterOpen(true)}
      filterCount={filterCount}
      chips={chips}
      onClearAll={clearAll}
      place={place}
      loading={q.isLoading}
      failed={q.isError}
      onRetry={() => void q.refetch()}
      scrollable={isDesktop}
    />
  );

  const noMapResults = q.isSuccess && mapEvents.length === 0 && !selected;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <SiteHeader search={{ value: f.q, onChange: setQ }} />
      <HeroBanner />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-3 sm:px-4 lg:px-6 lg:py-5">
        {/* Phone and tablet: switch between map and list; the Filters button stays beside them. */}
        <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
          <div
            className="flex overflow-hidden rounded-md border border-border"
            role="group"
            aria-label="View"
          >
            {(
              [
                ["map", "Map", MapIcon],
                ["list", "List", List],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`tap flex h-10 items-center gap-1.5 px-4 text-sm font-semibold ${
                  view === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`tap h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-semibold hover:bg-accent ${
              view === "list" ? "hidden" : "flex"
            } ${filterCount > 0 ? "border-gold text-gold" : "border-border"}`}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {filterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 1: map and Theyyam Now, the same height. The list scrolls inside its panel. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <div id="map" ref={mapAnchor} className="ke-anchor" />

            {showMap && (
              <div
                className={`relative h-[64dvh] min-h-[420px] overflow-hidden rounded-2xl border border-gold-line bg-raised lg:min-h-0 ${ROW_H}`}
              >
                <ClientOnly fallback={MapFallback}>
                  <Suspense fallback={MapFallback}>
                    <EventMap
                      key="event-map"
                      events={mapEvents}
                      selectedId={selectedId}
                      focus={focus}
                      fit={fit}
                      onSelect={onSelect}
                      onViewport={setVp}
                      onLocate={(lat, lng) => setUser([lat, lng])}
                    />
                  </Suspense>
                </ClientOnly>

                <MapLegend />

                {noMapResults && !q.isError && (
                  <div className="absolute inset-x-3 top-3 z-[500] mx-auto max-w-sm rounded-md border border-gold-line bg-popover p-4 text-center shadow-lg">
                    <p className="text-sm font-semibold">
                      {all?.length
                        ? "No performances on the map match"
                        : "No performances on the map yet"}
                    </p>
                    {chips.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="tap mt-3 h-9 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}

                {selected && (
                  <div className="absolute bottom-3 right-3 z-[600] hidden w-[380px] max-w-[calc(100%-1.5rem)] lg:block">
                    <EventPreview e={selected} onClose={() => setSelectedId(null)} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Theyyam Now. Fixed to the map's height on desktop; extra events scroll inside. */}
          <div
            className={`min-w-0 ${ROW_H} ${view === "list" ? "order-first" : "hidden"} lg:order-none lg:block`}
          >
            {panel}
          </div>
        </div>

        {/* Row 2: forms on the left, a full calendar on the right. */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
          <FormsSection events={all ?? []} now={now} onPick={pickForm} />

          <div
            id="calendar"
            className="ke-anchor min-w-0 self-start overflow-hidden rounded-xl border border-gold-line bg-card"
          >
            <TheyyamCalendar
              events={filtered}
              now={now}
              selectedDay={selectedDay}
              onPickDay={pickDay}
            />
          </div>
        </div>
      </main>

      {/* Phone and tablet: bottom sheet for the selected performance */}
      {selected && view === "map" && !isDesktop && (
        <EventPreview e={selected} mobile onClose={() => setSelectedId(null)} />
      )}

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={f}
        onApply={setF}
        count={countFor}
        hasLocation={!!user}
        askLocation={askLocation}
      />

      <SiteFooter />
    </div>
  );
}
