import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHeading, selectClass } from "@/components/PageHeading";
import { EventCard } from "@/components/EventCard";
import {
  DEFAULT_FILTERS,
  DISTRICTS,
  applyFilters,
  fetchEvents,
  inTab,
  type DateKey,
  type Filters,
  type Tab,
} from "@/lib/events";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Theyyam today | Theyyams of Kerala" },
      {
        name: "description",
        content: "Browse Theyyam performances across Kerala: live now, tonight and coming up.",
      },
    ],
  }),
  component: TodayPage,
});

const STATUS: { value: Tab; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "now", label: "Live now" },
  { value: "tonight", label: "Tonight" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ended", label: "Recently ended" },
];

const WHEN: { value: DateKey; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "This month" },
];

function TodayPage() {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState<Tab>("all");
  const [when, setWhen] = useState<DateKey>("any");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const query = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const list = useMemo(() => {
    const f: Filters = {
      ...DEFAULT_FILTERS,
      q,
      district: district || null,
      date: when,
    };
    return applyFilters(query.data ?? [], f, now, null).filter((e) => inTab(e, status, now));
  }, [query.data, q, district, when, status, now]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader search={{ value: q, onChange: setQ }} />
      <PageHeading
        title="Theyyam performances"
        subtitle="Browse and discover Theyyam events across Kerala."
      >
        <select
          aria-label="District"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className={selectClass}
        >
          <option value="">All districts</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Tab)}
          className={selectClass}
        >
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Date"
          value={when}
          onChange={(e) => setWhen(e.target.value as DateKey)}
          className={selectClass}
        >
          {WHEN.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </PageHeading>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-5 sm:px-4 lg:px-6">
        {query.isLoading && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <li key={i} className="ke-skeleton h-[240px]" />
            ))}
          </ul>
        )}

        {query.isError && (
          <div role="alert" className="py-16 text-center">
            <p className="text-sm font-semibold">We couldn't load performances</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="tap mt-3 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {query.isSuccess && list.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold">No performances match</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another district, status or date.
            </p>
          </div>
        )}

        {list.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((e) => (
              <EventCard key={e.id} e={e} now={now} />
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
