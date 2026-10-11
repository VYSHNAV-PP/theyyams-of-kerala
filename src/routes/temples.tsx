import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHeading } from "@/components/PageHeading";
import { SlotImage } from "@/components/SlotImage";
import { fetchEvents, normSearch, phaseOf, whenShort, type KEvent } from "@/lib/events";
import { fetchKavus, type Kavu } from "@/lib/kavus";
import { templeImageUrl } from "@/lib/images";

export const Route = createFileRoute("/temples")({
  head: () => ({
    meta: [
      { title: "Temples and kavus | Theyyams of Kerala" },
      {
        name: "description",
        content: "Sacred temples and groves across Kerala where Theyyam performances take place.",
      },
    ],
  }),
  component: TemplesPage,
});

function TemplesPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const now = Date.now();

  const kavuQuery = useQuery({ queryKey: ["kavus"], queryFn: fetchKavus, staleTime: 60_000 });
  const eventQuery = useQuery({ queryKey: ["events"], queryFn: fetchEvents, staleTime: 30_000 });

  // Every kavu is listed, whether or not it has a performance yet.
  const rows = useMemo(() => {
    const byKavu = new Map<string, KEvent[]>();
    for (const e of eventQuery.data ?? []) {
      if (!e.kavuId || phaseOf(e, now) === "ended") continue;
      const list = byKavu.get(e.kavuId);
      if (list) list.push(e);
      else byKavu.set(e.kavuId, [e]);
    }

    const needle = normSearch(q.trim());
    return (kavuQuery.data ?? [])
      .filter(
        (k) => !needle || normSearch(`${k.name} ${k.locality} ${k.district}`).includes(needle),
      )
      .map((k) => ({ kavu: k, events: byKavu.get(k.id) ?? [] }))
      .sort((a, b) => b.events.length - a.events.length || a.kavu.name.localeCompare(b.kavu.name));
  }, [kavuQuery.data, eventQuery.data, q, now]);

  const loading = kavuQuery.isLoading;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <PageHeading
        title="Theyyam temples"
        subtitle="Sacred temples and groves where Theyyam performances take place."
      >
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search temples</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search temples…"
            className="h-10 w-full rounded-md border border-input bg-raised pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus-visible:border-gold"
          />
        </label>
      </PageHeading>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-6 sm:px-6">
        {loading && (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="ke-skeleton h-[120px]" />
            ))}
          </ul>
        )}

        {kavuQuery.isError && (
          <p role="alert" className="py-16 text-center text-sm text-destructive">
            We couldn't load the temples. Check your connection and refresh.
          </p>
        )}

        {kavuQuery.isSuccess && rows.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold">
              {q.trim() ? "No temple matches your search" : "No temples are listed yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              A temple appears here once someone posts a performance at it.
            </p>
            <Link
              to="/submit"
              className="tap mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Post a Theyyam
            </Link>
          </div>
        )}

        <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ kavu, events }) => (
            <TempleCard
              key={kavu.id}
              kavu={kavu}
              events={events}
              now={now}
              expanded={open === kavu.id}
              onToggle={() => setOpen(open === kavu.id ? null : kavu.id)}
            />
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}

function TempleCard({
  kavu,
  events,
  now,
  expanded,
  onToggle,
}: {
  kavu: Kavu;
  events: KEvent[];
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const count = events.length;
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-3 p-3">
        {/* Picture slot: add public/temples/<temple-name>.jpg to fill it. */}
        <SlotImage
          src={kavu.imageUrl ?? templeImageUrl(kavu.name)}
          className="h-[84px] w-[110px] shrink-0 rounded-md border border-border"
          placeholder={<Landmark size={26} className="text-subtle" aria-hidden="true" />}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-display text-[14px] font-semibold uppercase tracking-wide">
            {kavu.name}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              {kavu.locality}, {kavu.district}
            </span>
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <span
              className={`text-xs font-semibold ${count > 0 ? "text-primary" : "text-muted-foreground"}`}
            >
              {count === 0
                ? "No upcoming performances"
                : `${count} upcoming ${count === 1 ? "performance" : "performances"}`}
            </span>
            {count > 0 && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={onToggle}
                className="tap h-8 rounded-md border border-border px-3 text-xs font-semibold text-primary hover:border-gold/60"
              >
                {expanded ? "Hide" : "View"}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && count > 0 && (
        <ul className="border-t border-border">
          {events.map((e) => (
            <li key={e.id} className="border-b border-border last:border-b-0">
              <Link
                to="/event/$id"
                params={{ id: e.id }}
                className="tap flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-raised"
              >
                <span className="min-w-0 truncate text-sm font-semibold">{e.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{whenShort(e, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
