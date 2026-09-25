import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  MapPin,
  ThumbsUp,
  Ticket,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
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
  const getTint = (hex: string) => {
    const value = hex.replace("#", "");

    if (value.length !== 6) {
      return undefined;
    }

    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, 0.10)`;
  };

  const inactiveQuickStyle = tone
    ? {
        backgroundColor: getTint(tone),
        borderColor: `${tone}45`,
        color: tone,
      }
    : undefined;

  const activeStyle =
    active && tone
      ? {
          background: tone,
          borderColor: tone,
          color: "#fff",
        }
      : undefined;

  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      style={
        active
          ? activeStyle
          : inactiveQuickStyle
      }
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring ${
        active
          ? tone
            ? "shadow-sm"
            : "border-[#075c48] bg-[#075c48] text-white shadow-sm"
          : tone
            ? "hover:brightness-95"
            : "border-[#dfe6e2] bg-white text-[#425b52] hover:border-[#b9cbc3] hover:bg-[#f7faf8]"
      }`}
    >
      {children}
    </button>
  );
}

export function CategoryBadge({
  e,
}: {
  e: Pick<
    KEvent,
    "category" | "subcategory"
  >;
}) {
  const m = CATEGORY_META[e.category];

  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        borderColor: `${m.hex}55`,
        color: m.hex,
        backgroundColor: `${m.hex}0d`,
      }}
    >
      <span aria-hidden="true">
        {m.icon}
      </span>

      <span className="truncate">
        {e.category} · {e.subcategory}
      </span>
    </span>
  );
}

export function StatusBadge({
  e,
}: {
  e: KEvent;
}) {
  const s = statusOf(e);

  const cls =
    s === "now"
      ? "bg-primary text-primary-foreground"
      : s === "ended"
        ? "border border-border bg-background text-muted-foreground"
        : "bg-muted text-foreground";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${cls}`}
    >
      {s === "now" && (
        <span
          aria-hidden="true"
          className="mr-1"
        >
          ●
        </span>
      )}

      {STATUS_LABEL[s]}
    </span>
  );
}

export const confirmText = (
  n: number,
) =>
  `${n} ${n === 1 ? "person" : "people"} confirmed this event`;

/* ============================================================
   EVENT IMAGE
   ============================================================ */

export function EventImage({
  urls,
  alt,
  className,
  fallback,
}: {
  urls: string[];
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const candidates = Array.from(
    new Set(
      urls.filter(
        (url): url is string =>
          typeof url === "string" &&
          url.trim().length > 0,
      ),
    ),
  );

  const candidateKey =
    candidates.join("|");

  const [index, setIndex] =
    useState(0);
  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [candidateKey]);

  const currentUrl =
    candidates[index];

  if (!currentUrl || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={currentUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (
          index + 1 <
          candidates.length
        ) {
          setIndex(
            (current) =>
              current + 1,
          );
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

/* ============================================================
   EVENT THUMBNAIL
   ============================================================ */

function EventThumbnail({
  e,
  color,
  icon,
}: {
  e: KEvent;
  color: string;
  icon: React.ReactNode;
}) {
  const candidates = Array.from(
    new Set(
      [
        ...(e.imageCandidates ??
          []),
        ...(e.imageUrl
          ? [e.imageUrl]
          : []),
      ].filter(
        (url): url is string =>
          typeof url === "string" &&
          url.trim().length > 0,
      ),
    ),
  );

  return (
    <EventImage
      urls={candidates}
      alt=""
      className="h-full w-full object-cover"
      fallback={
        <span
          className="flex h-full w-full items-center justify-center"
          style={{
            color,
            backgroundColor: `${color}12`,
          }}
        >
          {icon}
        </span>
      }
    />
  );
}

/* ============================================================
   EVENT PREVIEW / MOBILE BOTTOM SHEET
   ============================================================ */

export function EventPreview({
  e,
  onClose,
}: {
  e: KEvent;
  onClose: () => void;
}) {
  const [expanded, setExpanded] =
    useState(false);

  const touchStartY =
    useRef<number | null>(null);

  const touchStartScrollTop =
    useRef(0);

  /*
   * Whenever a different event is selected,
   * start that event in the compact state.
   */
  useEffect(() => {
    setExpanded(false);
    touchStartY.current = null;
    touchStartScrollTop.current = 0;
  }, [e.id]);

  const handleTouchStart = (
    event: React.TouchEvent<HTMLElement>,
  ) => {
    touchStartY.current =
      event.touches[0]?.clientY ??
      null;

    touchStartScrollTop.current =
      event.currentTarget.scrollTop;
  };

  const handleTouchEnd = (
    event: React.TouchEvent<HTMLElement>,
  ) => {
    const startY =
      touchStartY.current;

    if (startY === null) {
      return;
    }

    const endY =
      event.changedTouches[0]
        ?.clientY ?? startY;

    const deltaY =
      endY - startY;

    touchStartY.current = null;

    /*
     * A meaningful upward swipe expands
     * the sheet.
     */
    if (deltaY < -45) {
      setExpanded(true);
      return;
    }

    /*
     * A downward swipe collapses the sheet
     * only when the content is already at
     * the top.
     */
    if (
      deltaY > 45 &&
      touchStartScrollTop.current <=
        2
    ) {
      setExpanded(false);
    }
  };

  const m =
    CATEGORY_META[e.category];

  return (
    <section
      aria-label={`Preview: ${e.title}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-card p-4 shadow-lg transition-[max-height] duration-300 ease-out lg:mx-auto lg:max-w-2xl lg:rounded-2xl ${
        expanded
          ? "max-h-[88dvh]"
          : "max-h-[38dvh]"
      }`}
      style={{
        touchAction: "pan-y",
      }}
    >
      {/* Mobile drag handle */}
      <div
        className="mx-auto mb-3 flex h-5 w-16 items-start justify-center lg:hidden"
        aria-hidden="true"
      >
        <span
          className={`mt-1 h-1.5 w-12 rounded-full transition-colors ${
            expanded
              ? "bg-muted-foreground/40"
              : "bg-muted-foreground/50"
          }`}
        />
      </div>

      {/* Mobile swipe hint */}
      {!expanded && (
        <div className="mb-2 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:hidden">
          <span aria-hidden="true">
            ↑
          </span>
          Swipe up for details
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryBadge e={e} />
          <StatusBadge e={e} />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
        >
          <X
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>

      <h2 className="mt-2 text-lg font-bold leading-snug">
        {e.title}
      </h2>

      {/* Event image on expanded mobile sheet */}
      <div
        className={`mt-3 overflow-hidden rounded-xl border border-border bg-muted transition-[height,opacity] duration-300 lg:hidden ${
          expanded
            ? "h-40 opacity-100"
            : "h-0 opacity-0"
        }`}
      >
        <EventThumbnail
          e={e}
          color={m.hex}
          icon={m.icon}
        />
      </div>

      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex gap-2">
          <MapPin
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {e.venue},{" "}
            {e.locality},{" "}
            {e.district}
          </span>
        </li>

        <li className="flex gap-2">
          <CalendarDays
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {fmtWhen(e)}
          </span>
        </li>

        <li className="flex gap-2">
          <Ticket
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {entryLabel(e)}
          </span>
        </li>
      </ul>

      <p
        className={`mt-2 text-sm text-muted-foreground ${
          expanded
            ? ""
            : "line-clamp-3"
        }`}
      >
        {e.description}
      </p>

      {/* Additional information becomes available naturally when expanded */}
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Location
            </p>

            <p className="mt-1 text-sm font-medium">
              {e.venue}
            </p>

            <p className="text-sm text-muted-foreground">
              {e.locality},{" "}
              {e.district}
            </p>
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date & time
            </p>

            <p className="mt-1 text-sm font-medium">
              {fmtWhen(e)}
            </p>
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Entry
            </p>

            <p className="mt-1 text-sm font-medium">
              {entryLabel(e)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1 text-sm">
          <ThumbsUp
            size={14}
            aria-hidden="true"
          />

          {confirmText(
            e.upvotes,
          )}
        </span>

        <Link
          to="/event/$id"
          params={{ id: e.id }}
          className="flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          View Event
        </Link>
      </div>
    </section>
  );
}

/* ============================================================
   EVENT ROW
   ============================================================ */

export function EventRow({
  e,
  active,
  onClick,
}: {
  e: KEvent;
  active: boolean;
  onClick: () => void;
}) {
  const m =
    CATEGORY_META[e.category];

  const s = statusOf(e);

  return (
    <li className="w-full px-2 py-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-current={active}
        className={`group flex w-full gap-3 rounded-2xl border p-3 text-left transition-all ${
          active
            ? "border-[#b4cec2] bg-[#f0f7f3] shadow-sm"
            : "border-transparent bg-white hover:border-[#e0e7e3] hover:bg-[#fafcfb] hover:shadow-sm"
        }`}
      >
        <span
          className="mt-0.5 flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e1e7e3] bg-[#f1f5f2] text-2xl"
          aria-hidden="true"
        >
          <EventThumbnail
            e={e}
            color={m.hex}
            icon={m.icon}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {e.category}
              {e.subcategory
                ? ` · ${e.subcategory}`
                : ""}
            </span>

            <StatusBadge e={e} />
          </span>

          <span className="mt-1 block line-clamp-2 text-[14px] font-bold leading-snug text-foreground">
            {e.title}
          </span>

          <span
            className={`mt-1 block text-xs font-semibold ${
              s === "now"
                ? "text-primary"
                : "text-foreground"
            }`}
          >
            {fmtWhen(e)}
          </span>

          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {e.locality},{" "}
            {e.district} ·{" "}
            {entryLabel(e)}
          </span>
        </span>
      </button>
    </li>
  );
}