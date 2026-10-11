import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import { Bookmark, Check, LocateFixed, X } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_META,
  CONFIRMED_MIN,
  DEFAULT_FILTERS,
  DISTRICTS,
  FORMS,
  type DateKey,
  type Filters,
} from "@/lib/events";
import { CategoryIcon, Chip } from "./EventViews";

const DATES: [DateKey, string][] = [
  ["any", "Any time"],
  ["tonight", "Tonight"],
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["weekend", "This weekend"],
  ["week", "Next 7 days"],
  ["month", "This month"],
  ["custom", "Pick dates"],
];

const field =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-gold";

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 font-sans text-xs font-semibold tracking-wide text-gold first:mt-4">
      {children}
    </h3>
  );
}

export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  count,
  hasLocation,
  askLocation,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: Filters;
  onApply: (f: Filters) => void;
  count: (f: Filters) => number;
  hasLocation: boolean;
  askLocation: () => Promise<boolean>;
}) {
  const [d, setD] = useState(filters);
  const [locErr, setLocErr] = useState("");

  useEffect(() => {
    if (open) {
      setD(filters);
      setLocErr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (p: Partial<Filters>) => setD((x) => ({ ...x, ...p }));
  const n = count(d);

  async function toggleNearby() {
    if (d.nearby) return set({ nearby: false });
    setLocErr("");
    if (hasLocation || (await askLocation())) set({ nearby: true, district: null });
    else
      setLocErr("Couldn't get your location. Allow location access in your browser to use Nearby.");
  }

  const formsOfFamily = d.category === "All" ? [] : FORMS.filter((f) => f.family === d.category);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/70" />
        <Dialog.Content className="ke-dialog fixed inset-x-0 bottom-0 z-[1100] flex max-h-[90dvh] flex-col rounded-t-xl border border-gold-line bg-popover text-foreground md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh] md:w-[580px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="font-display text-base font-semibold uppercase tracking-[0.08em]">
              Filters
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close filters"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Combine Theyyam form, date, place and other filters.
          </Dialog.Description>

          <div className="ke-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <Heading>Type of Theyyam</Heading>
            <div className="flex flex-wrap gap-2">
              <Chip
                active={d.category === "All"}
                onClick={() => set({ category: "All", subcategory: null })}
              >
                All
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  active={d.category === c}
                  tone={CATEGORY_META[c].hex}
                  onClick={() => set({ category: d.category === c ? "All" : c, subcategory: null })}
                >
                  <CategoryIcon category={c} size={14} />
                  {c}
                </Chip>
              ))}
            </div>

            {formsOfFamily.length > 0 && (
              <p className="mb-1.5 mt-3 text-xs text-muted-foreground">
                Narrow to a form of {d.category}
              </p>
            )}
            {formsOfFamily.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={`${d.category} forms`}>
                {formsOfFamily.map((f) => (
                  <Chip
                    key={f.name}
                    active={d.subcategory === f.name}
                    onClick={() => set({ subcategory: d.subcategory === f.name ? null : f.name })}
                  >
                    {f.name}
                  </Chip>
                ))}
              </div>
            )}

            <Heading>Date</Heading>
            <div className="flex flex-wrap gap-2">
              {DATES.map(([k, l]) => (
                <Chip key={k} active={d.date === k} onClick={() => set({ date: k })}>
                  {l}
                </Chip>
              ))}
            </div>
            {d.date === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  From
                  <input
                    type="date"
                    className={field}
                    value={d.from}
                    onChange={(e) => set({ from: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  To
                  <input
                    type="date"
                    className={field}
                    value={d.to}
                    min={d.from}
                    onChange={(e) => set({ to: e.target.value })}
                  />
                </label>
              </div>
            )}

            <Heading>Place</Heading>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                District
                <select
                  className={field}
                  value={d.district ?? ""}
                  onChange={(e) => set({ district: e.target.value || null, nearby: false })}
                >
                  <option value="">All of Kerala</option>
                  {DISTRICTS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Town or locality
                <input
                  className={field}
                  value={d.locality}
                  onChange={(e) => set({ locality: e.target.value })}
                  placeholder="e.g. Payyanur"
                />
              </label>
            </div>
            <div className="mt-2">
              <Chip active={d.nearby} onClick={() => void toggleNearby()}>
                <LocateFixed size={14} aria-hidden="true" />
                Near me (within 25 km)
              </Chip>
            </div>
            {locErr && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {locErr}
              </p>
            )}

            <Heading>More</Heading>
            <div className="flex flex-wrap gap-2">
              <Chip active={d.confirmed} onClick={() => set({ confirmed: !d.confirmed })}>
                <Check size={14} aria-hidden="true" />
                Verified only ({CONFIRMED_MIN}+ confirmations)
              </Chip>
              <Chip active={d.savedOnly} onClick={() => set({ savedOnly: !d.savedOnly })}>
                <Bookmark size={14} aria-hidden="true" />
                Saved on this device
              </Chip>
            </div>
          </div>

          <div className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setD({ ...DEFAULT_FILTERS, q: d.q })}
              className="tap h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(d);
                onOpenChange(false);
              }}
              className="tap h-11 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Show {n} {n === 1 ? "performance" : "performances"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
