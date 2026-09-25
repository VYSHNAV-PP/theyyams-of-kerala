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
  type ReactNode,
} from "react";

import {
  CATEGORY_META,
  STATUS_LABEL,
  entryLabel,
  fmtWhen,
  statusOf,
  type KEvent,
} from "@/lib/events";

/* ============================================================
   CHIP
   ============================================================ */

export function Chip({
  active,
  onClick,
  children,
  tone,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: string;
}) {
  const getTint = (hex: string) => {
    const value = hex.replace("#", "");

    if (value.length !== 6) {
      return undefined;
    }

    const r = parseInt(
      value.slice(0, 2),
      16,
    );
    const g = parseInt(
      value.slice(2, 4),
      16,
    );
    const b = parseInt(
      value.slice(4, 6),
      16,
    );

    return `rgba(${r}, ${g}, ${b}, 0.10)`;
  };

  const inactiveStyle = tone
    ? {
        backgroundColor:
          getTint(tone),
        borderColor: `${tone}45`,
        color: tone,
      }
    : undefined;

  const activeStyle =
    active && tone
      ? {
          background: tone,
          borderColor: tone,
          color: "#ffffff",
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
          : inactiveStyle
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

/* ============================================================
   CATEGORY BADGE
   ============================================================ */

export function CategoryBadge({
  e,
}: {
  e: Pick<
    KEvent,
    "category" | "subcategory"
  >;
}) {
  const m =
    CATEGORY_META[e.category];

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
        {e.category} ·{" "}
        {e.subcategory}
      </span>
    </span>
  );
}

/* ============================================================
   STATUS BADGE
   ============================================================ */

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

/* ============================================================
   CONFIRMATION TEXT
   ============================================================ */

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
  fallback: ReactNode;
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
  icon: ReactNode;
}) {
  const candidates = Array.from(
    new Set(
      [
        ...(e.imageCandidates ?? []),
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
   EVENT PREVIEW
   ============================================================ */

export function EventPreview({
  e,
  onClose,
  mobile = false,
}: {
  e: KEvent;
  onClose: () => void;
  mobile?: boolean;
}) {
  /*
   * Desktop and mobile are deliberately
   * kept as separate components.
   */
  if (!mobile) {
    return (
      <DesktopEventPreview
        e={e}
        onClose={onClose}
      />
    );
  }

  return (
    <MobileEventPreview
      e={e}
      onClose={onClose}
    />
  );
}

/* ============================================================
   DESKTOP EVENT PREVIEW
   ============================================================ */

function DesktopEventPreview({
  e,
  onClose,
}: {
  e: KEvent;
  onClose: () => void;
}) {
  return (
    <section
      aria-label={`Preview: ${e.title}`}
      className="relative flex max-h-[55dvh] flex-col overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl lg:mx-auto lg:max-w-2xl"
    >
      {/* HEADER */}

      <div className="shrink-0 px-5 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
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

        <h2 className="mt-3 text-xl font-bold leading-snug">
          {e.title}
        </h2>
      </div>

      {/* CONTENT */}

      <div className="min-h-0 flex-1 px-5 pb-4">
        <ul className="space-y-2.5 text-sm">
          <li className="flex gap-2.5">
            <MapPin
              size={17}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {e.venue},{" "}
              {e.locality},{" "}
              {e.district}
            </span>
          </li>

          <li className="flex gap-2.5">
            <CalendarDays
              size={17}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {fmtWhen(e)}
            </span>
          </li>

          <li className="flex gap-2.5">
            <Ticket
              size={17}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {entryLabel(e)}
            </span>
          </li>
        </ul>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {e.description}
        </p>
      </div>

      {/* FOOTER */}

      <div className="shrink-0 border-t border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <ThumbsUp
              size={14}
              aria-hidden="true"
            />

            <span className="truncate">
              {confirmText(
                e.upvotes,
              )}
            </span>
          </span>

          <Link
            to="/event/$id"
            params={{ id: e.id }}
            className="flex h-10 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            View Event
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   MOBILE / TABLET EVENT PREVIEW
   ============================================================ */

function MobileEventPreview({
  e,
  onClose,
}: {
  e: KEvent;
  onClose: () => void;
}) {
  const [expanded, setExpanded] =
    useState(false);

  /*
   * Actual compact height of the
   * naturally-sized card.
   */
  const [collapsedHeight, setCollapsedHeight] =
    useState<number | null>(null);

  const [dragging, setDragging] =
    useState(false);

  const sheetRef =
    useRef<HTMLElement | null>(null);

  const startY =
    useRef<number | null>(null);

  const startExpanded =
    useRef(false);

  const activePointer =
    useRef<number | null>(null);

  const collapsedHeightRef =
    useRef<number | null>(null);

  const m =
    CATEGORY_META[e.category];

  /*
   * Keep the ref synchronized with
   * the state.
   */
  useEffect(() => {
    collapsedHeightRef.current =
      collapsedHeight;
  }, [collapsedHeight]);

  /*
   * Measure the natural compact
   * height whenever the selected
   * event changes.
   */
  useEffect(() => {
    setExpanded(false);
    setDragging(false);

    startY.current = null;
    activePointer.current = null;

    /*
     * Wait until the collapsed
     * version has rendered.
     */
    requestAnimationFrame(() => {
      const element =
        sheetRef.current;

      if (!element) {
        return;
      }

      const height =
        element.scrollHeight;

      if (height > 0) {
        setCollapsedHeight(
          height,
        );
      }
    });
  }, [e.id]);

  /*
   * Re-measure the compact card
   * when viewport dimensions change.
   */
  useEffect(() => {
    const measure = () => {
      if (expanded) {
        return;
      }

      const element =
        sheetRef.current;

      if (!element) {
        return;
      }

      const height =
        element.scrollHeight;

      if (height > 0) {
        setCollapsedHeight(
          height,
        );
      }
    };

    window.addEventListener(
      "resize",
      measure,
    );

    return () => {
      window.removeEventListener(
        "resize",
        measure,
      );
    };
  }, [expanded]);

  /*
   * Lock page scrolling only while
   * the swipe gesture is active.
   */
  useEffect(() => {
    if (!dragging) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const previousTouchAction =
      document.body.style.touchAction;

    document.body.style.overflow =
      "hidden";

    document.body.style.touchAction =
      "none";

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.body.style.touchAction =
        previousTouchAction;
    };
  }, [dragging]);

  /*
   * Begin swipe gesture.
   *
   * This is attached to the handle +
   * header, not the scrollable content.
   */
  const beginDrag = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.pointerType === "mouse"
    ) {
      return;
    }

    startY.current =
      event.clientY;

    startExpanded.current =
      expanded;

    activePointer.current =
      event.pointerId;

    setDragging(true);

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
  };

  /*
   * We intentionally DO NOT move the
   * sheet while the finger moves.
   *
   * This makes the interaction feel
   * like a proper bottom sheet instead
   * of a card being physically dragged.
   */
  const moveDrag = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !dragging ||
      startY.current === null ||
      activePointer.current !==
        event.pointerId
    ) {
      return;
    }

    /*
     * Prevent browser gestures from
     * interfering with the gesture.
     */
    event.preventDefault();
  };

  /*
   * Finish the swipe and snap to the
   * next state.
   */
  const finishDrag = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !dragging ||
      startY.current === null
    ) {
      return;
    }

    const delta =
      event.clientY -
      startY.current;

    const threshold = 55;

    const wasExpanded =
      startExpanded.current;

    setDragging(false);

    startY.current = null;
    activePointer.current = null;

    /*
     * Swipe UP from collapsed.
     */
    if (
      !wasExpanded &&
      delta < -threshold
    ) {
      setExpanded(true);
      return;
    }

    /*
     * Swipe DOWN from expanded.
     */
    if (
      wasExpanded &&
      delta > threshold
    ) {
      setExpanded(false);
    }
  };

  const cancelDrag = () => {
    setDragging(false);

    startY.current = null;
    activePointer.current = null;
  };

  /*
   * If the compact height hasn't
   * been measured yet, let the browser
   * naturally size the first render.
   *
   * After that we animate between:
   *
   * compactHeight
   *
   * and
   *
   * viewportHeight
   */
  const targetHeight =
    expanded
      ? "calc(100dvh - 8px)"
      : collapsedHeight
        ? `${collapsedHeight}px`
        : "auto";

  return (
    <>
      {/* ======================================================
          EXPANDED BACKDROP
          ====================================================== */}

      {expanded && (
        <div
          className="fixed inset-0 z-[999] bg-black/15 backdrop-blur-[1px]"
          aria-hidden="true"
          onClick={() =>
            setExpanded(false)
          }
        />
      )}

      {/* ======================================================
          SHEET
          ====================================================== */}

      <section
        ref={sheetRef}
        aria-label={`Preview: ${e.title}`}
        className="fixed inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl"
        style={{
          height: targetHeight,
          maxHeight:
            "calc(100dvh - 8px)",

          /*
           * No translate transform.
           *
           * The sheet itself smoothly
           * expands/collapses.
           */
          transition: dragging
            ? "none"
            : "height 360ms cubic-bezier(0.22, 1, 0.36, 1)",

          willChange: "height",
        }}
      >
        {/* ====================================================
            GESTURE HEADER
            ==================================================== */}

        <div
          className="relative z-10 shrink-0"
          style={{
            touchAction: "none",
          }}
          onPointerDown={
            beginDrag
          }
          onPointerMove={
            moveDrag
          }
          onPointerUp={
            finishDrag
          }
          onPointerCancel={
            cancelDrag
          }
        >
          {/* HANDLE */}

          <div className="flex h-9 items-center justify-center">
            <span
              aria-hidden="true"
              className="block h-1.5 w-12 rounded-full bg-muted-foreground/35"
            />
          </div>

          {/* HEADER */}

          <div className="px-4 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <CategoryBadge e={e} />

                <StatusBadge e={e} />
              </div>

              <button
                type="button"
                onPointerDown={(event) => {
                  /*
                   * Prevent the close button
                   * from starting the sheet
                   * swipe gesture.
                   */
                  event.stopPropagation();
                }}
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
          </div>
        </div>

        {/* ====================================================
            SCROLLABLE CONTENT
            ==================================================== */}

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 ${
            expanded
              ? "touch-pan-y"
              : "overflow-hidden"
          }`}
          style={{
            WebkitOverflowScrolling:
              "touch",
          }}
        >
          {/* IMAGE */}

          {expanded && (
            <div className="mb-4 h-44 overflow-hidden rounded-xl border border-border bg-muted">
              <EventThumbnail
                e={e}
                color={m.hex}
                icon={m.icon}
              />
            </div>
          )}

          {/* EVENT DETAILS */}

          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <MapPin
                size={17}
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
                size={17}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <span>
                {fmtWhen(e)}
              </span>
            </li>

            <li className="flex gap-2">
              <Ticket
                size={17}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <span>
                {entryLabel(e)}
              </span>
            </li>
          </ul>

          {/* DESCRIPTION */}

          <p
            className={`mt-3 text-sm leading-relaxed text-muted-foreground ${
              expanded
                ? ""
                : "line-clamp-3"
            }`}
          >
            {e.description}
          </p>

          {/* EXTRA DETAILS */}

          {expanded && (
            <div className="mt-5 space-y-3 pb-2">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
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

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date & time
                </p>

                <p className="mt-1 text-sm font-medium">
                  {fmtWhen(e)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Entry
                </p>

                <p className="mt-1 text-sm font-medium">
                  {entryLabel(e)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            FOOTER
            ==================================================== */}

        <div className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1 text-sm">
              <ThumbsUp
                size={14}
                aria-hidden="true"
              />

              <span className="truncate">
                {confirmText(
                  e.upvotes,
                )}
              </span>
            </span>

            <Link
              to="/event/$id"
              params={{ id: e.id }}
              className="flex h-10 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              View Event
            </Link>
          </div>
        </div>
      </section>
    </>
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