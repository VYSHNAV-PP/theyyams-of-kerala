import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame } from "lucide-react";
import { useMemo } from "react";
import { FORMS, phaseOf, type KEvent } from "@/lib/events";
import type { TheyyamForm } from "@/lib/taxonomy";
import { FormCard } from "./FormCard";

export function useFormCounts(events: KEvent[], now: number) {
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (phaseOf(e, now) === "ended") continue;
      m.set(e.subcategory, (m.get(e.subcategory) ?? 0) + 1);
    }
    return m;
  }, [events, now]);
}

/** Home page strip: featured forms in two columns beside the calendar. */
export function FormsSection({
  events,
  now,
  onPick,
}: {
  events: KEvent[];
  now: number;
  onPick: (f: TheyyamForm) => void;
}) {
  const counts = useFormCounts(events, now);
  const featured = FORMS.filter((f) => f.featured);

  return (
    <section
      id="forms"
      aria-labelledby="forms-title"
      className="ke-anchor flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="forms-title"
            className="flex items-center gap-2.5 font-display text-[17px] font-semibold uppercase tracking-[0.08em] text-primary sm:text-lg"
          >
            <Flame size={19} aria-hidden="true" />
            Explore Theyyam forms
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each form is a different deity or spirit. Pick one to see where it is performed.
          </p>
        </div>
        <Link
          to="/forms"
          className="tap inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3.5 text-sm font-semibold text-primary hover:border-gold/60 hover:bg-accent"
        >
          View all {FORMS.length} forms
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {featured.map((f) => (
          <FormCard
            key={f.name}
            form={f}
            count={counts.get(f.name) ?? 0}
            onPick={onPick}
            layout="row"
          />
        ))}
      </ul>
    </section>
  );
}
