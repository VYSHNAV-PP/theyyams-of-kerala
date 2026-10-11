import { ArrowRight, Flame } from "lucide-react";
import type { TheyyamForm } from "@/lib/taxonomy";
import { CATEGORY_META } from "@/lib/taxonomy";
import { formImageUrl } from "@/lib/images";
import { CategoryIcon } from "./EventViews";
import { SlotImage } from "./SlotImage";

/** Placeholder shown until a picture is added: the form's Malayalam name on a dark panel. */
function FormPlaceholder({ ml, small }: { ml: string; small: boolean }) {
  return (
    <span
      className={`absolute inset-0 flex flex-col items-center justify-center bg-raised text-center ${
        small ? "gap-2 px-2" : "gap-3 px-4"
      }`}
    >
      <span aria-hidden="true" className={`h-px bg-gold-line ${small ? "w-6" : "w-10"}`} />
      <span
        className={`font-ml font-semibold leading-snug text-foreground/90 ${
          small ? "text-[12.5px]" : "text-[20px]"
        }`}
      >
        {ml}
      </span>
    </span>
  );
}

/** One Theyyam form: picture slot, family, name, a line about it, and a link into the map. */
export function FormCard({
  form,
  count,
  onPick,
  layout = "stack",
}: {
  form: TheyyamForm;
  count: number;
  onPick: (f: TheyyamForm) => void;
  /** "stack": picture above text (forms page). "row": picture beside text (compact strips). */
  layout?: "stack" | "row";
}) {
  const meta = CATEGORY_META[form.family];
  const row = layout === "row";

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => onPick(form)}
        className={`tap group flex h-full w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-gold/50 ${
          row ? "items-stretch gap-0" : "flex-col"
        }`}
      >
        <SlotImage
          src={formImageUrl(form.name)}
          className={
            row
              ? "h-auto w-[112px] shrink-0 self-stretch sm:w-[128px]"
              : "aspect-[16/10] w-full rounded-none"
          }
          placeholder={<FormPlaceholder ml={form.ml} small={row} />}
        />

        <span className={`flex min-w-0 flex-1 flex-col ${row ? "p-3.5" : "p-4"}`}>
          <span className="flex items-center gap-1.5" style={{ color: meta.hex }}>
            <CategoryIcon category={form.family} size={12} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
              {form.family}
            </span>
          </span>
          <span className="mt-1.5 font-display text-[14px] font-semibold uppercase leading-snug tracking-[0.04em] text-foreground">
            {form.name}
          </span>
          <span
            className={`mt-1.5 text-[13px] leading-relaxed text-muted-foreground ${
              row ? "line-clamp-2" : ""
            }`}
          >
            {form.line}
          </span>

          <span className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary group-hover:underline">
              Explore form
              <ArrowRight size={13} aria-hidden="true" />
            </span>
            {count > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-ember">
                <Flame size={12} aria-hidden="true" />
                {count} listed
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
