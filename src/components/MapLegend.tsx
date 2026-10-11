import { PHASE_META, type Phase } from "@/lib/events";

const ITEMS: Phase[] = ["now", "tonight", "upcoming"];

export function MapLegend() {
  return (
    <div
      className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md border border-gold-line bg-popover px-2.5 py-2 text-[11px] sm:bottom-3 sm:left-3 sm:px-3 sm:text-xs"
      aria-label="Map legend"
    >
      <ul className="flex flex-col gap-1">
        {ITEMS.map((p) => (
          <li key={p} className="flex items-center gap-2 text-foreground">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full border-2"
              style={{ borderColor: PHASE_META[p].hex }}
            />
            {PHASE_META[p].label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-foreground">
          <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-gold" />
          Group of performances
        </li>
      </ul>
    </div>
  );
}
