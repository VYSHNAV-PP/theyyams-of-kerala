import { MapPin, Pencil, Plus } from "lucide-react";
import { useMemo } from "react";
import type { Kavu } from "@/lib/kavus";
import { normSearch } from "@/lib/events";

const MAX_SUGGESTIONS = 6;

/**
 * Temple, kavu or tharavad. The visitor types a name; matching kavus from the database are
 * offered. Choosing one fills in its place. If nothing matches, the typed name is added as a new kavu.
 */
export function KavuPicker({
  value,
  onValue,
  kavus,
  loading,
  selected,
  onSelect,
  onChange,
  error,
}: {
  value: string;
  onValue: (text: string) => void;
  kavus: Kavu[];
  loading: boolean;
  selected: Kavu | null;
  onSelect: (k: Kavu) => void;
  onChange: () => void;
  error?: string | undefined;
}) {
  const query = normSearch(value.trim());

  const matches = useMemo(() => {
    if (query.length < 2) return [];
    return kavus
      .filter((k) => normSearch(`${k.name} ${k.locality}`).includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [kavus, query]);

  const exactName = kavus.some((k) => normSearch(k.name) === query);

  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium">Temple, kavu or tharavad</span>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-gold-line bg-raised px-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              <MapPin size={14} className="shrink-0 text-gold" aria-hidden="true" />
              <span className="truncate">{selected.name}</span>
            </p>
            <p className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">
              {selected.locality}, {selected.district}
            </p>
          </div>
          <button
            type="button"
            onClick={onChange}
            className="tap inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-accent"
          >
            <Pencil size={12} aria-hidden="true" />
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            className="h-11 w-full rounded-md border border-input bg-raised px-3 text-sm text-foreground focus-visible:border-gold"
            value={value}
            maxLength={150}
            autoComplete="off"
            placeholder="Search for a kavu, or type a new name"
            onChange={(e) => onValue(e.target.value)}
          />

          {matches.length > 0 && (
            <ul
              aria-label="Matching kavus"
              className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border bg-card"
            >
              {matches.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(k)}
                    className="tap flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{k.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {k.locality}, {k.district}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">Use this</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && query.length >= 2 && !exactName && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Plus size={13} className="mt-px shrink-0 text-gold" aria-hidden="true" />
              <span>
                <span className="font-semibold text-foreground">&ldquo;{value.trim()}&rdquo;</span>{" "}
                isn't listed yet. It will be added as a new kavu. Fill in the town and pin its
                position below.
              </span>
            </p>
          )}
        </>
      )}

      {error && (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
