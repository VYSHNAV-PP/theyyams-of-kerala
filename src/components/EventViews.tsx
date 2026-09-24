import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  MapPin,
  ThumbsUp,
  Ticket,
  X,
} from "lucide-react";
import {
  CATEGORY_META,
  STATUS_LABEL,
  entryLabel,
  fmtWhen,
  statusOf,
  type KEvent,
} from "@/lib/events";

export function Chip({
  active,
  onClick,
  children,
  tone,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      style={
        active && tone
          ? {
              background: tone,
              borderColor: tone,
              color: "#fff",
            }
          : undefined
      }
      className={`inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
        active
          ? tone
            ? ""
            : "border-foreground bg-foreground text-background"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function CategoryBadge({
  e,
}: {
  e: Pick<KEvent, "category" | "subcategory">;
}) {
  const m = CATEGORY_META[e.category];

  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: m.hex }}
    >
      <span aria-hidden="true">{m.icon}</span>
      <span className="truncate">
        {e.category} · {e.subcategory}
      </span>
    </span>
  );
}

export function StatusBadge({ e }: { e: KEvent }) {
  const s = statusOf(e);

  const cls =
    s === "now"
      ? "bg-primary text-primary-foreground"
      : s === "ended"
        ? "border border-border bg-background text-muted-foreground"
        : "bg-muted text-foreground";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {s === "now" && (
        <span aria-hidden="true" className="mr-1">
          ●
        </span>
      )}
      {STATUS_LABEL[s]}
    </span>
  );
}

export const confirmText = (n: number) =>
  `${n} ${n === 1 ? "person" : "people"} confirmed this event`;

export function EventPreview({
  e,
  onClose,
}: {
  e: KEvent;
  onClose: () => void;
}) {
  return (
    <section
      aria-label={`Preview: ${e.title}`}
      className="max-h-[55dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-lg lg:mx-auto lg:max-w-2xl lg:rounded-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryBadge e={e} />
          <StatusBadge e={e} />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <h2 className="mt-2 text-lg font-bold leading-snug">
        {e.title}
      </h2>

      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex gap-2">
          <MapPin
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {e.venue}, {e.locality}, {e.district}
          </span>
        </li>

        <li className="flex gap-2">
          <CalendarDays
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{fmtWhen(e)}</span>
        </li>

        <li className="flex gap-2">
          <Ticket
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{entryLabel(e)}</span>
        </li>
      </ul>

      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
        {e.description}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm">
          <ThumbsUp size={14} aria-hidden="true" />
          {confirmText(e.upvotes)}
        </span>

        <Link
          to="/event/$id"
          params={{ id: e.id }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          View Event
        </Link>
      </div>
    </section>
  );
}

export function EventRow({
  e,
  active,
  onClick,
}: {
  e: KEvent;
  active: boolean;
  onClick: () => void;
}) {
  const m = CATEGORY_META[e.category];
  const s = statusOf(e);

  return (
    <li className="w-full">
      <button
        type="button"
        onClick={onClick}
        aria-current={active}
        className={`group flex w-full gap-3 border-b border-border px-3 py-3.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-4 lg:px-5 ${
          active ? "bg-accent" : ""
        }`}
      >
        {/* Category icon */}
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg"
          style={{ borderColor: m.hex }}
          aria-hidden="true"
        >
          {m.icon}
        </span>

        {/* Main event information */}
        <span className="min-w-0 flex-1">
          {/* Category + status */}
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-xs font-medium text-muted-foreground">
              {e.category} · {e.subcategory}
            </span>

            <StatusBadge e={e} />
          </span>

          {/* Event title */}
          <span className="mt-0.5 block truncate text-sm font-semibold text-foreground sm:text-[15px]">
            {e.title}
          </span>

          {/* Date / time */}
          <span
            className={`mt-1 block text-xs font-medium ${
              s === "now"
                ? "text-primary"
                : "text-foreground"
            }`}
          >
            {fmtWhen(e)}
          </span>

          {/* Location / entry */}
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {e.locality}, {e.district} · {entryLabel(e)}
          </span>
        </span>
      </button>
    </li>
  );
}