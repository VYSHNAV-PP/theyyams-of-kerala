import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  Clock,
  Flower2,
  Landmark,
  MapPin,
  Shield,
  Sun,
  Swords,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CATEGORY_META,
  CONFIRMED_MIN,
  PHASE_META,
  formByName,
  fmtWhen,
  phaseOf,
  whenShort,
  type Category,
  type KEvent,
  type Phase,
} from "@/lib/events";
import { toggleSaved, useSaved } from "@/lib/saved";

/* ============================================================
   FAMILY ICON
   ============================================================ */

export function CategoryIcon({
  category,
  size = 14,
  className,
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  const props = { size, "aria-hidden": true as const, ...(className ? { className } : {}) };
  switch (CATEGORY_META[category].icon) {
    case "flower":
      return <Flower2 {...props} />;
    case "sun":
      return <Sun {...props} />;
    case "swords":
      return <Swords {...props} />;
    case "shield":
      return <Shield {...props} />;
    default:
      return <Landmark {...props} />;
  }
}

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
  const style = tone
    ? active
      ? { backgroundColor: tone, borderColor: tone, color: "#0b0f13" }
      : { borderColor: `${tone}66`, color: tone }
    : undefined;

  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      style={style}
      className={`tap inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3.5 text-[13px] font-semibold ${
        tone
          ? active
            ? ""
            : "bg-card hover:bg-accent"
          : active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:border-gold-line hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================================================
   BADGES
   ============================================================ */

export function CategoryBadge({ e }: { e: Pick<KEvent, "category" | "subcategory"> }) {
  const m = CATEGORY_META[e.category];
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold"
      style={{ borderColor: `${m.hex}66`, color: m.hex }}
    >
      <CategoryIcon category={e.category} size={12} />
      <span className="truncate">
        {e.subcategory && e.subcategory !== e.category
          ? `${e.category}, ${e.subcategory}`
          : e.category}
      </span>
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: Phase }) {
  const m = PHASE_META[phase];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold"
      style={{ color: m.hex }}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${phase === "now" ? "ke-live-dot" : ""}`}
        style={{ backgroundColor: m.hex }}
      />
      {m.label}
    </span>
  );
}

export function StatusBadge({ e }: { e: KEvent }) {
  return <PhaseBadge phase={phaseOf(e)} />;
}

export function VerifiedBadge({ e }: { e: Pick<KEvent, "upvotes"> }) {
  if (e.upvotes < CONFIRMED_MIN) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gold">
      <Check size={12} aria-hidden="true" />
      Verified
    </span>
  );
}

/* ============================================================
   IMAGES
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
  const candidates = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.trim())));
  const candidateKey = candidates.join("|");

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [candidateKey]);

  const currentUrl = candidates[index];
  if (!currentUrl || failed) return <>{fallback}</>;

  return (
    <img
      src={currentUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (index + 1 < candidates.length) setIndex((c) => c + 1);
        else setFailed(true);
      }}
    />
  );
}

/** The emblem on a flat tile, used whenever a performance has no photo. */
export function EmblemTile({ size = 34 }: { size?: number }) {
  return (
    <span className="flex h-full w-full items-center justify-center bg-raised">
      <img
        src="/logo-mark-96.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
      />
    </span>
  );
}

export function EventThumbnail({ e, size }: { e: KEvent; size?: number }) {
  const urls = [...e.imageCandidates, ...(e.imageUrl ? [e.imageUrl] : [])];
  return (
    <EventImage
      urls={urls}
      alt=""
      className="h-full w-full object-cover"
      fallback={<EmblemTile {...(size ? { size } : {})} />}
    />
  );
}

/* ============================================================
   BOOKMARK
   ============================================================ */

export function BookmarkButton({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const saved = useSaved().has(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      title={saved ? "Saved on this device" : "Save on this device"}
      onClick={(ev) => {
        ev.stopPropagation();
        toggleSaved(id);
      }}
      className={`tap flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent ${
        saved ? "text-gold" : "text-subtle hover:text-foreground"
      } ${className ?? ""}`}
    >
      <Bookmark size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/* ============================================================
   PREVIEW (map popup on desktop, bottom sheet on mobile)
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
  // Desktop and mobile are deliberately separate components.
  return mobile ? (
    <MobileEventPreview e={e} onClose={onClose} />
  ) : (
    <DesktopEventPreview e={e} onClose={onClose} />
  );
}

function PreviewFacts({ e }: { e: KEvent }) {
  return (
    <ul className="space-y-2 text-sm">
      <li className="flex gap-2.5">
        <MapPin size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
        <span>
          {e.venue}, {e.locality}, {e.district}
        </span>
      </li>
      <li className="flex gap-2.5">
        <CalendarDays size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
        <span>{fmtWhen(e)}</span>
      </li>
    </ul>
  );
}

function DesktopEventPreview({ e, onClose }: { e: KEvent; onClose: () => void }) {
  const phase = phaseOf(e);
  const form = formByName(e.subcategory);
  return (
    <section
      aria-label={`Preview: ${e.title}`}
      className="relative flex max-h-[60dvh] flex-col overflow-hidden rounded-lg border border-gold-line bg-popover shadow-2xl"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="tap absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={17} aria-hidden="true" />
      </button>

      <div className="ke-scroll flex min-h-0 gap-3.5 overflow-y-auto p-3.5 pr-10">
        <span className="block h-20 w-20 shrink-0 overflow-hidden rounded-md border border-gold-line">
          <EventThumbnail e={e} />
        </span>
        <div className="min-w-0">
          <PhaseBadge phase={phase} />
          <h2 className="mt-0.5 font-display text-[17px] font-semibold leading-snug">{e.title}</h2>
          {form && <p className="font-ml text-[13px] text-gold">{form.ml}</p>}
        </div>
      </div>

      <div className="ke-scroll min-h-0 overflow-y-auto border-t border-border px-3.5 py-3">
        <PreviewFacts e={e} />
        <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
          {e.description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-3">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ThumbsUp size={13} aria-hidden="true" />
          <span className="truncate">{e.upvotes} confirmed</span>
        </span>
        <Link
          to="/event/$id"
          params={{ id: e.id }}
          className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold hover:text-background"
        >
          View performance
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Mobile sheet. It is always rendered at a constant height and moves purely with
 * `transform: translateY()`, which the browser animates on the compositor thread.
 * During a drag the transform is written straight to the DOM node (no React state),
 * so the sheet follows the finger with no lag; on release a short transition snaps it.
 */
function MobileEventPreview({ e, onClose }: { e: KEvent; onClose: () => void }) {
  const PEEK_HEIGHT = 262;
  const FULL_HEIGHT = "calc(100dvh - 8px)";
  const SNAP_TRANSITION = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";

  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);

  const sheetRef = useRef<HTMLElement | null>(null);
  const sheetHeightRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const startY = useRef<number | null>(null);
  const startOffsetRef = useRef(0);
  const activePointer = useRef<number | null>(null);

  const phase = phaseOf(e);
  const form = formByName(e.subcategory);

  const maxOffset = () => Math.max(sheetHeightRef.current - PEEK_HEIGHT, 0);
  const restingOffset = (isExpanded: boolean) => (isExpanded ? 0 : maxOffset());

  const applyTransform = (offset: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate ? SNAP_TRANSITION : "none";
    el.style.transform = `translateY(${offset}px)`;
    currentOffsetRef.current = offset;
  };

  // Measure and collapse whenever the selected performance changes.
  useEffect(() => {
    setExpanded(false);
    setDragging(false);
    startY.current = null;
    activePointer.current = null;

    requestAnimationFrame(() => {
      const el = sheetRef.current;
      if (!el) return;
      sheetHeightRef.current = el.getBoundingClientRect().height;
      applyTransform(restingOffset(false), false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.id]);

  // Re-measure on resize (keyboard, rotation) and re-snap.
  useEffect(() => {
    const onResize = () => {
      const el = sheetRef.current;
      if (!el || dragging) return;
      sheetHeightRef.current = el.getBoundingClientRect().height;
      applyTransform(restingOffset(expanded), false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, dragging]);

  // Lock page scroll only while a swipe is active.
  useEffect(() => {
    if (!dragging) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [dragging]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    startY.current = event.clientY;
    startOffsetRef.current = currentOffsetRef.current;
    activePointer.current = event.pointerId;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null || activePointer.current !== event.pointerId) return;
    event.preventDefault();
    const delta = event.clientY - startY.current;
    const clamped = Math.min(Math.max(startOffsetRef.current + delta, 0), maxOffset());
    applyTransform(clamped, false);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || startY.current === null) return;

    const delta = event.clientY - startY.current;
    const threshold = maxOffset() * 0.25 || 55;
    const wasExpanded = startOffsetRef.current === 0;
    let nextExpanded = wasExpanded;

    if (wasExpanded && delta > threshold) nextExpanded = false;
    if (!wasExpanded && delta < -threshold) nextExpanded = true;

    setDragging(false);
    startY.current = null;
    activePointer.current = null;
    setExpanded(nextExpanded);
    applyTransform(restingOffset(nextExpanded), true);
  };

  const cancelDrag = () => {
    setDragging(false);
    startY.current = null;
    activePointer.current = null;
    applyTransform(restingOffset(expanded), true);
  };

  const closeSheet = () => {
    setExpanded(false);
    applyTransform(restingOffset(false), true);
    onClose();
  };

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-[999] bg-black/50"
          aria-hidden="true"
          onClick={() => {
            setExpanded(false);
            applyTransform(restingOffset(false), true);
          }}
        />
      )}

      <section
        ref={sheetRef}
        aria-label={`Preview: ${e.title}`}
        className="fixed inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-gold-line bg-popover shadow-2xl"
        style={{ height: FULL_HEIGHT, willChange: "transform" }}
      >
        <div
          className="relative z-10 shrink-0"
          style={{ touchAction: "none" }}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
        >
          <div className="flex h-8 items-center justify-center">
            <span aria-hidden="true" className="block h-1 w-11 rounded-full bg-gold-line" />
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <PhaseBadge phase={phase} />
                <VerifiedBadge e={e} />
              </div>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={closeSheet}
                aria-label="Close preview"
                className="tap -m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold leading-snug">{e.title}</h2>
            {form && <p className="font-ml text-sm text-gold">{form.ml}</p>}
          </div>
        </div>

        <div className="shrink-0 border-y border-border bg-popover px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <ThumbsUp size={14} aria-hidden="true" />
              <span className="truncate">{e.upvotes} confirmed</span>
            </span>
            <Link
              to="/event/$id"
              params={{ id: e.id }}
              className="tap inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              View performance
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="ke-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {expanded && (
            <div className="mb-4 h-44 overflow-hidden rounded-md border border-gold-line bg-raised">
              <EventThumbnail e={e} size={64} />
            </div>
          )}

          <PreviewFacts e={e} />

          <p
            className={`mt-3 text-sm leading-relaxed text-muted-foreground ${expanded ? "" : "line-clamp-3"}`}
          >
            {e.description}
          </p>

          {expanded && (
            <div className="mt-4">
              <CategoryBadge e={e} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ============================================================
   LIST ROW
   ============================================================ */

export function EventRow({
  e,
  active,
  now,
  onClick,
}: {
  e: KEvent;
  active: boolean;
  now: number;
  onClick: () => void;
}) {
  const phase = phaseOf(e, now);
  const meta = PHASE_META[phase];
  const form = formByName(e.subcategory);

  return (
    <li className="w-full px-2.5 py-1">
      <div
        className={`relative rounded-md border transition-colors ${
          active
            ? "border-gold bg-accent"
            : "border-border bg-card hover:border-gold-line hover:bg-raised"
        }`}
      >
        <button
          type="button"
          onClick={onClick}
          aria-current={active}
          className="flex w-full gap-3 rounded-md p-2.5 pr-12 text-left"
        >
          <span
            className="block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md border border-gold-line"
            aria-hidden="true"
          >
            <EventThumbnail e={e} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[13.5px] font-semibold uppercase leading-snug tracking-wide">
              {e.title}
            </span>
            {form && (
              <span className="block truncate font-ml text-[12px] text-gold">{form.ml}</span>
            )}
            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} className="shrink-0" aria-hidden="true" />
              <span className="truncate">
                {e.locality}, {e.district}
              </span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{whenShort(e, now)}</span>
            </span>
            <span className="mt-1 flex items-center gap-3">
              <span className="text-[11px] font-semibold" style={{ color: meta.hex }}>
                {phase === "now" && (
                  <span className="ke-live-dot mr-1.5 h-1.5 w-1.5 align-middle" />
                )}
                {phase === "tonight" ? "Performing tonight" : meta.label}
              </span>
              <VerifiedBadge e={e} />
            </span>
          </span>
        </button>

        <BookmarkButton id={e.id} title={e.title} className="absolute right-1.5 top-1.5" />
      </div>
    </li>
  );
}
