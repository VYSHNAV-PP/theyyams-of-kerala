import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHeading } from "@/components/PageHeading";
import { TheyyamCalendar } from "@/components/TheyyamCalendar";
import { fetchEvents, istDateStr } from "@/lib/events";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Theyyam calendar | Theyyams of Kerala" },
      {
        name: "description",
        content: "A month-by-month calendar of Theyyam performances across Kerala.",
      },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const [now, setNow] = useState(() => Date.now());
  const [day, setDay] = useState<string | null>(() => istDateStr(Date.now()));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const query = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <PageHeading
        title="Theyyam calendar"
        subtitle="Pick any month and year, then a day, to see what is being performed."
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-5 sm:px-4">
        <div className="overflow-hidden rounded-xl border border-gold-line bg-card">
          <TheyyamCalendar
            title={false}
            agenda
            events={query.data ?? []}
            now={now}
            selectedDay={day}
            onPickDay={setDay}
          />
        </div>
        {query.isError && (
          <p role="alert" className="mt-3 text-center text-sm text-destructive">
            We couldn't load performances. Check your connection and refresh.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
