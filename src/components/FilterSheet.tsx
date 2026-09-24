import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CATEGORIES, CATEGORY_META, DEFAULT_FILTERS, DISTRICTS, SUBCATEGORIES, type DateKey, type Filters } from "@/lib/events";
import { Chip } from "./EventViews";

const DATES: [DateKey, string][] = [["any", "Any time"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["weekend", "This weekend"], ["week", "This week"], ["month", "This month"], ["custom", "Custom"]];
const ENTRY: [Filters["entry"], string][] = [["any", "Any"], ["free", "Free"], ["paid", "Paid"], ["registration", "Registration required"]];
const field = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function FilterSheet({ open, onOpenChange, filters, onApply, count, hasLocation, askLocation }: {
  open: boolean; onOpenChange: (o: boolean) => void; filters: Filters; onApply: (f: Filters) => void;
  count: (f: Filters) => number; hasLocation: boolean; askLocation: () => Promise<boolean>;
}) {
  const [d, setD] = useState(filters);
  const [locErr, setLocErr] = useState("");
  useEffect(() => { if (open) { setD(filters); setLocErr(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Filters>) => setD((x) => ({ ...x, ...p }));
  const n = count(d);
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;

  async function toggleNearby() {
    if (d.nearby) return set({ nearby: false });
    setLocErr("");
    if (hasLocation || (await askLocation())) set({ nearby: true, district: null });
    else setLocErr("Couldn't get your location. Allow location access in your browser to use Nearby.");
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[1100] flex max-h-[90dvh] flex-col rounded-t-2xl bg-card md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh] md:w-[560px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-base font-bold">Filters</Dialog.Title>
            <Dialog.Close aria-label="Close filters" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"><X size={18} aria-hidden="true" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Combine category, date, location and entry filters.</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <H>Category</H>
            <div className="flex flex-wrap gap-2">
              <Chip active={d.category === "All"} onClick={() => set({ category: "All", subcategory: null })}>All</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={d.category === c} tone={CATEGORY_META[c].hex} onClick={() => set({ category: c, subcategory: null })}>
                  <span aria-hidden="true">{CATEGORY_META[c].icon}</span>{c}
                </Chip>
              ))}
            </div>
            {d.category !== "All" && SUBCATEGORIES[d.category].length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${d.category} subcategories`}>
                {SUBCATEGORIES[d.category].map((s) => <Chip key={s} active={d.subcategory === s} onClick={() => set({ subcategory: d.subcategory === s ? null : s })}>{s}</Chip>)}
              </div>
            )}

            <H>Date</H>
            <div className="flex flex-wrap gap-2">{DATES.map(([k, l]) => <Chip key={k} active={d.date === k} onClick={() => set({ date: k })}>{l}</Chip>)}</div>
            {d.date === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs">From<input type="date" className={field} value={d.from} onChange={(e) => set({ from: e.target.value })} /></label>
                <label className="text-xs">To<input type="date" className={field} value={d.to} min={d.from} onChange={(e) => set({ to: e.target.value })} /></label>
              </div>
            )}

            <H>Location</H>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">District
                <select className={field} value={d.district ?? ""} onChange={(e) => set({ district: e.target.value || null, nearby: false })}>
                  <option value="">Entire Kerala</option>
                  {DISTRICTS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="text-xs">Town / locality
                <input className={field} value={d.locality} onChange={(e) => set({ locality: e.target.value })} placeholder="e.g. Payyanur" />
              </label>
            </div>
            <div className="mt-2"><Chip active={d.nearby} onClick={() => void toggleNearby()}>📍 Nearby (within 25 km)</Chip></div>
            {locErr && <p role="alert" className="mt-1 text-xs text-destructive">{locErr}</p>}

            <H>Entry</H>
            <div className="flex flex-wrap gap-2">{ENTRY.map(([k, l]) => <Chip key={k} active={d.entry === k} onClick={() => set({ entry: k })}>{l}</Chip>)}</div>
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <button type="button" onClick={() => setD({ ...DEFAULT_FILTERS, q: d.q })} className="h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">Reset</button>
            <button type="button" onClick={() => { onApply(d); onOpenChange(false); }} className="h-11 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
              Show {n} {n === 1 ? "Event" : "Events"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
