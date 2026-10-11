import { ChevronLeft, ChevronRight, Flame, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PHASE_META, dayStartOf, fmtTime, istDateStr, phaseOf, type KEvent } from "@/lib/events";

const DAY = 864e5;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * Fixed English text, not Intl: server and browser format locale dates differently,
 * which makes the server-rendered page disagree with the client (a hydration error).
 */
const longDate = (iso: string) => {
  const d = utc(iso);
  return `${DAYS_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

type Cell = { iso: string; day: number; inMonth: boolean };

/** Six weeks (Sunday first) that cover the month, so the grid never changes height. */
function monthCells(y: number, m: number): Cell[] {
  const first = Date.UTC(y, m, 1);
  const lead = new Date(first).getUTCDay();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first + (i - lead) * DAY);
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m,
    };
  });
}

export function TheyyamCalendar({
  events,
  now,
  selectedDay,
  onPickDay,
  agenda = false,
  title = true,
}: {
  events: KEvent[];
  now: number;
  selectedDay: string | null;
  onPickDay: (iso: string | null) => void;
  /** Also list the performances of the selected day under the grid. */
  agenda?: boolean;
  title?: boolean;
}) {
  const today = istDateStr(now);
  const [ty, tm] = today.split("-").map(Number) as [number, number];

  const [view, setView] = useState<{ y: number; m: number }>(() => {
    if (selectedDay) {
      const [sy, sm] = selectedDay.split("-").map(Number) as [number, number];
      return { y: sy, m: sm - 1 };
    }
    return { y: ty, m: tm - 1 };
  });

  const cells = useMemo(() => monthCells(view.y, view.m), [view]);

  const byDay = useMemo(() => {
    const map = new Map<string, KEvent[]>();
    const first = cells[0]?.iso;
    const last = cells[cells.length - 1]?.iso;
    if (!first || !last) return map;
    const from = dayStartOf(first);
    const to = dayStartOf(last) + DAY;
    for (const e of events) {
      if (e.endMs < from || e.startMs >= to) continue;
      const a = Math.max(e.startMs, from);
      const b = Math.min(e.endMs, to - 1);
      for (let t = Math.floor((a - from) / DAY); t <= Math.floor((b - from) / DAY); t++) {
        const key = istDateStr(from + t * DAY + 12 * 36e5);
        const list = map.get(key);
        if (list) list.push(e);
        else map.set(key, [e]);
      }
    }
    return map;
  }, [cells, events]);

  const years = useMemo(() => {
    const start = Math.min(ty - 1, view.y);
    const end = Math.max(ty + 15, view.y);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [ty, view.y]);

  const step = (n: number) =>
    setView(({ y, m }) => {
      const t = y * 12 + m + n;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });

  const goToday = () => setView({ y: ty, m: tm - 1 });
  const onThisMonth = view.y === ty && view.m === tm - 1;

  function dotColor(d: string, e: KEvent): string {
    if (d < today) return PHASE_META.ended.hex;
    if (phaseOf(e, now) === "now") return PHASE_META.now.hex;
    if (d === today) return PHASE_META.tonight.hex;
    return PHASE_META.upcoming.hex;
  }

  const picked = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const select = "h-9 rounded-md border border-border bg-raised px-2 text-sm font-semibold";

  return (
    <section aria-labelledby={title ? "calendar-title" : undefined} className="p-4">
      {title && (
        <h2
          id="calendar-title"
          className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold uppercase tracking-[0.08em]"
        >
          <Flame size={16} className="text-gold" aria-hidden="true" />
          Theyyam calendar
        </h2>
      )}

      {/* Month and year controls: any month of any listed year can be reached. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="tap flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <select
          aria-label="Month"
          value={view.m}
          onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
          className={select}
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>

        <select
          aria-label="Year"
          value={view.y}
          onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
          className={select}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="tap flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={goToday}
          disabled={onThisMonth}
          className="tap ml-auto h-9 rounded-md border border-gold-line px-3 text-sm font-semibold text-gold hover:border-gold disabled:opacity-40"
        >
          Today
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>

      <ol className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const list = byDay.get(c.iso) ?? [];
          const selected = selectedDay === c.iso;
          const isToday = c.iso === today;
          return (
            <li key={c.iso}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${longDate(c.iso)}, ${
                  list.length === 0
                    ? "no performances"
                    : `${list.length} ${list.length === 1 ? "performance" : "performances"}`
                }`}
                onClick={() => onPickDay(selected ? null : c.iso)}
                className={`tap flex aspect-square min-h-[44px] w-full flex-col items-center justify-center gap-1 rounded-md border text-sm ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : isToday
                      ? "border-gold text-foreground hover:bg-accent"
                      : c.inMonth
                        ? "border-transparent text-foreground hover:border-gold-line hover:bg-accent"
                        : "border-transparent text-subtle/60 hover:bg-accent"
                }`}
              >
                <span className="font-display text-[15px] font-semibold leading-none">{c.day}</span>
                <span className="flex h-2 items-center gap-0.5">
                  {list.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: selected ? "#f4efe6" : dotColor(c.iso, e) }}
                    />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {(
          [
            [PHASE_META.now.hex, "Performing now"],
            [PHASE_META.tonight.hex, "Today"],
            [PHASE_META.upcoming.hex, "Later"],
            [PHASE_META.ended.hex, "Past"],
          ] as const
        ).map(([color, label]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </li>
        ))}
      </ul>

      {agenda && (
        <div className="mt-4 border-t border-border pt-4">
          {!selectedDay ? (
            <p className="text-sm text-muted-foreground">
              Pick a day to see the performances on it.
            </p>
          ) : (
            <>
              <h3 className="font-display text-sm font-semibold uppercase tracking-[0.08em]">
                {longDate(selectedDay)}
              </h3>
              {picked.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No performances are listed for this day.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {picked.map((e) => (
                    <li key={e.id}>
                      <Link
                        to="/event/$id"
                        params={{ id: e.id }}
                        className="tap flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 hover:border-gold-line hover:bg-raised"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-display text-[13.5px] font-semibold uppercase tracking-wide">
                            {e.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin size={12} aria-hidden="true" />
                            <span className="truncate">
                              {e.venue}, {e.locality}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-gold">
                          {fmtTime(e.startTime)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
