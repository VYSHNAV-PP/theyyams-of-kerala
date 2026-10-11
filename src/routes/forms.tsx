import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHeading } from "@/components/PageHeading";
import { FormCard } from "@/components/FormCard";
import { useFormCounts } from "@/components/FormsSection";
import { CategoryIcon } from "@/components/EventViews";
import { CATEGORIES, CATEGORY_META, FORMS, fetchEvents, normSearch } from "@/lib/events";
import type { Category, TheyyamForm } from "@/lib/taxonomy";

export const Route = createFileRoute("/forms")({
  head: () => ({
    meta: [
      { title: "Theyyam forms | Theyyams of Kerala" },
      {
        name: "description",
        content: "The deities and spirits of Theyyam, and where each one is being performed.",
      },
    ],
  }),
  component: FormsPage,
});

function FormsPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<Category | "All">("All");
  const now = Date.now();
  const events = useQuery({ queryKey: ["events"], queryFn: fetchEvents, staleTime: 30_000 });
  const counts = useFormCounts(events.data ?? [], now);

  const list = useMemo(() => {
    const raw = q.trim();
    const needle = normSearch(raw);
    return FORMS.filter(
      (f) =>
        (family === "All" || f.family === family) &&
        (!needle ||
          normSearch(`${f.name} ${f.line} ${f.family}`).includes(needle) ||
          (raw !== "" && f.ml.includes(raw))),
    );
  }, [q, family]);

  const open = (f: TheyyamForm) => void nav({ to: "/", search: { form: f.name } });
  const families = CATEGORIES.filter((c) => FORMS.some((f) => f.family === c));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <PageHeading
        title="Explore Theyyam forms"
        subtitle="Discover the diverse forms of Theyyam, each with its own rituals, stories and traditions."
      >
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search forms</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search forms…"
            className="h-10 w-full rounded-md border border-input bg-raised pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus-visible:border-gold"
          />
        </label>
      </PageHeading>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by family">
          {(["All", ...families] as const).map((c) => {
            const active = family === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setFamily(c)}
                className={`tap inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-[13px] font-semibold ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-gold/50 hover:text-foreground"
                }`}
              >
                {c !== "All" && <CategoryIcon category={c} size={13} />}
                {c}
              </button>
            );
          })}
        </div>

        {family !== "All" && (
          <p className="mb-5 text-sm text-muted-foreground">{CATEGORY_META[family].blurb}</p>
        )}

        {list.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No forms match.</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((f) => (
              <FormCard key={f.name} form={f} count={counts.get(f.name) ?? 0} onPick={open} />
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
