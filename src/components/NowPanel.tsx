import { Link } from "@tanstack/react-router";
import { Flame, Plus, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import type { KEvent, Tab } from "@/lib/events";
import { EventRow } from "./EventViews";

export type ChipSpec = { key: string; label: string; onRemove: () => void };

const TABS: { key: Exclude<Tab, "all">; label: string }[] = [
  { key: "now", label: "Now" },
  { key: "tonight", label: "Tonight" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ended", label: "Ended" },
];

const EMPTY_COPY: Record<Tab, { title: string; body: string }> = {
  now: {
    title: "No Theyyam is being performed right now",
    body: "Most performances begin after dusk and run into the early morning.",
  },
  tonight: {
    title: "Nothing is listed for tonight",
    body: "Check the upcoming tab, or add a performance you know about.",
  },
  upcoming: {
    title: "No upcoming performances match",
    body: "The main Theyyam season runs roughly from October to May. If you know of one, please add it.",
  },
  ended: {
    title: "No recently ended performances",
    body: "Performances stay here for two days after they finish.",
  },
  all: {
    title: "No performances match",
    body: "Try another day or clear the filters.",
  },
};

export function NowPanel({
  tab,
  onTab,
  counts,
  events,
  now,
  selectedId,
  onPick,
  onOpenFilters,
  filterCount,
  chips,
  onClearAll,
  place,
  loading,
  failed,
  onRetry,
  scrollable,
  footer,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: Record<"now" | "tonight" | "upcoming" | "ended", number>;
  events: KEvent[];
  now: number;
  selectedId: string | null;
  onPick: (e: KEvent) => void;
  onOpenFilters: () => void;
  filterCount: number;
  chips: ChipSpec[];
  onClearAll: () => void;
  place: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** Desktop: fixed-height panel whose list scrolls. Mobile: the page scrolls. */
  scrollable: boolean;
  footer?: ReactNode;
}) {
  const empty = !loading && !failed && events.length === 0;
  const copy = EMPTY_COPY[tab];
  const suggestion: "tonight" | "upcoming" | null =
    tab === "now"
      ? counts.tonight > 0
        ? "tonight"
        : counts.upcoming > 0
          ? "upcoming"
          : null
      : tab === "tonight" && counts.upcoming > 0
        ? "upcoming"
        : null;

  return (
    <aside
      aria-label="Theyyam performances"
      className={`flex w-full flex-col overflow-hidden rounded-2xl border border-gold-line bg-card ${
        scrollable ? "h-full min-h-0" : ""
      }`}
    >
      {/* Header: title and the Filters button, right beside the event view */}
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold uppercase tracking-[0.08em]">
            <Flame size={20} className="shrink-0 text-gold" aria-hidden="true" />
            Theyyam now
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            Performances {place === "Kerala" ? "across" : "around"} {place}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
          className={`tap relative flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold hover:bg-accent ${
            filterCount > 0 ? "border-gold text-gold" : "border-border text-foreground"
          }`}
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

      {/* Tabs */}
      <div className="shrink-0 px-4">
        <div
          role="tablist"
          aria-label="When"
          className="grid grid-cols-4 overflow-hidden rounded-md border border-border"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onTab(t.key)}
                className={`tap flex h-10 items-center justify-center gap-1.5 border-l border-border text-[13px] font-semibold first:border-l-0 ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {t.label}
                <span
                  className={`text-[11px] ${active ? "text-primary-foreground/80" : "text-subtle"}`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filters */}
      {chips.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-4 pt-3">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              aria-label={`Remove filter: ${c.label}`}
              className="tap inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-gold-line bg-raised pl-2.5 pr-1.5 text-xs font-medium text-foreground hover:border-gold"
            >
              <span className="truncate">{c.label}</span>
              <X size={13} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="h-7 px-1.5 text-xs font-semibold text-gold underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* List */}
      <div
        role="tabpanel"
        className={`pt-3 ${scrollable ? "ke-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}`}
      >
        {loading && (
          <ul aria-label="Loading performances" className="space-y-2 px-2.5">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="ke-skeleton h-[96px]" />
            ))}
          </ul>
        )}

        {failed && (
          <div role="alert" className="px-6 py-8 text-center">
            <p className="text-sm font-semibold">We couldn't load performances</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="tap mt-3 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Try again
            </button>
          </div>
        )}

        {empty && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-semibold">{copy.title}</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {copy.body}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestion && (
                <button
                  type="button"
                  onClick={() => onTab(suggestion)}
                  className="tap h-10 rounded-md border border-gold px-3.5 text-sm font-semibold text-gold hover:bg-gold hover:text-background"
                >
                  See {suggestion === "tonight" ? "tonight" : "upcoming"} ({counts[suggestion]})
                </button>
              )}
              {chips.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="tap h-10 rounded-md border border-border px-3.5 text-sm font-semibold hover:bg-accent"
                >
                  Clear filters
                </button>
              )}
              <Link
                to="/submit"
                className="tap inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Plus size={15} aria-hidden="true" />
                Post a Theyyam
              </Link>
            </div>
          </div>
        )}

        {events.length > 0 && (
          <ul aria-label="Performances" className="pb-2">
            {events.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                now={now}
                active={e.id === selectedId}
                onClick={() => onPick(e)}
              />
            ))}
          </ul>
        )}
      </div>

      {footer && <div className="shrink-0 border-t border-gold-line">{footer}</div>}
    </aside>
  );
}
