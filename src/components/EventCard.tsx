import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { PHASE_META, formByName, phaseOf, whenShort, type KEvent } from "@/lib/events";
import { EventThumbnail } from "./EventViews";

/** A performance as a card: picture on top (placeholder when none), details below. */
export function EventCard({ e, now }: { e: KEvent; now: number }) {
  const phase = phaseOf(e, now);
  const meta = PHASE_META[phase];
  const form = formByName(e.subcategory);

  return (
    <li className="min-w-0">
      <Link
        to="/event/$id"
        params={{ id: e.id }}
        className="tap group flex h-full flex-col overflow-hidden rounded-xl border border-gold-line bg-card hover:border-gold"
      >
        <span className="relative block aspect-[16/9] w-full overflow-hidden bg-raised">
          <EventThumbnail e={e} size={56} />
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-background/85 px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: meta.hex }}
          >
            {phase === "now" && <span className="ke-live-dot h-1.5 w-1.5" />}
            {phase === "now" ? "Live now" : meta.label}
          </span>
        </span>
        <span className="flex flex-1 flex-col p-3">
          <span className="truncate font-display text-[14px] font-semibold uppercase tracking-wide group-hover:text-gold">
            {e.title}
          </span>
          {form && <span className="truncate font-ml text-[12px] text-gold">{form.ml}</span>}
          <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              {e.venue}, {e.locality}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{whenShort(e, now)}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
