import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Flag,
  Info,
  MapPin,
  Navigation,
  Phone,
  Share2,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  BookmarkButton,
  CategoryBadge,
  EventImage,
  PhaseBadge,
  VerifiedBadge,
} from "@/components/EventViews";
import {
  CONFIRMED_MIN,
  DOWNVOTE_REASONS,
  confirmText,
  REPORT_REASONS,
  confirmEvent,
  downvoteEvent,
  fetchEvent,
  fetchEventFeedback,
  fmtWhen,
  formByName,
  hasConfirmed,
  hasDownvoted,
  hasReported,
  icsFor,
  isFlagged,
  phaseOf,
  reportEvent,
  type DownvoteReason,
  type EventFeedback,
  type KEvent,
} from "@/lib/events";

const EventMap = lazy(() => import("@/components/EventMap"));

export const Route = createFileRoute("/event/$id")({
  // Loaded on the server too, so shared links carry the right title. Failures fall back to the client query.
  loader: async ({ params }) => {
    try {
      return await fetchEvent(params.id);
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.title} | Theyyams of Kerala`
      : "Performance | Theyyams of Kerala";
    const description = loaderData
      ? `${loaderData.subcategory} at ${loaderData.venue}, ${loaderData.locality}, ${loaderData.district}. ${fmtWhen(loaderData)}.`
      : "Theyyam performance details on Theyyams of Kerala.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: EventPage,
});

const btn =
  "tap inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border px-3.5 text-sm font-semibold text-foreground hover:border-gold-line hover:bg-accent disabled:opacity-60";

/* ============================================================
   SHELL
   ============================================================ */

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-dvh flex-col bg-background">
    <SiteHeader />
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">{children}</main>
    <SiteFooter />
  </div>
);

const BackLink = () => (
  <Link
    to="/"
    className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold underline-offset-4 hover:underline"
  >
    <ArrowLeft size={16} aria-hidden="true" />
    Back to the map
  </Link>
);

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={btn}>
      <ExternalLink size={14} aria-hidden="true" />
      {children}
    </a>
  );
}

function feedbackReasonLabel(reason: string): string {
  return (
    DOWNVOTE_REASONS.find((r) => r.value === reason)?.label ??
    REPORT_REASONS.find((r) => r.value === reason)?.label ??
    reason
  );
}

function feedbackDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ============================================================
   POSTER
   ============================================================ */

function EventPoster({ e }: { e: KEvent }) {
  const form = formByName(e.subcategory);
  const urls = [...e.imageCandidates, ...(e.imageUrl ? [e.imageUrl] : [])];

  return (
    <div className="overflow-hidden rounded-lg border border-gold-line bg-raised">
      <EventImage
        urls={urls}
        alt={`Photo or poster for ${e.title}`}
        className="max-h-[420px] w-full object-cover"
        fallback={
          <div className="flex min-h-56 w-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <img
              src="/logo-mark.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
            />
            <p className="font-ml text-2xl font-bold text-foreground">
              {form?.ml ?? e.subcategory}
            </p>
            <p className="text-xs text-muted-foreground">
              No photo has been added for this performance yet.
            </p>
          </div>
        }
      />
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

function EventPage() {
  const { id } = Route.useParams();
  const loaded = Route.useLoaderData();

  const q = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEvent(id),
    staleTime: 15_000,
    ...(loaded ? { initialData: loaded } : {}),
  });

  const feedbackQuery = useQuery({
    queryKey: ["event-feedback", id],
    queryFn: () => fetchEventFeedback(id),
    staleTime: 10_000,
  });

  const [confirmed, setConfirmed] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [reported, setReported] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [downvoteOpen, setDownvoteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setConfirmed(hasConfirmed(id));
    setDownvoted(hasDownvoted(id));
    setReported(hasReported(id));
    setPageUrl(window.location.href);
  }, [id]);

  // The image search runs after the performance is created: poll briefly so a found image appears.
  useEffect(() => {
    if (!q.data || q.data.imageUrl) return;

    let stopped = false;
    const startedAt = Date.now();

    const interval = window.setInterval(async () => {
      if (stopped) return;
      if (Date.now() - startedAt >= 30_000) {
        window.clearInterval(interval);
        return;
      }
      try {
        const result = await q.refetch();
        if (result.data?.imageUrl) window.clearInterval(interval);
      } catch {
        // Ignore a failed poll; normal query error handling stays in place.
      }
    }, 3_000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, q.data?.imageUrl]);

  if (q.isLoading) {
    return (
      <Shell>
        <div className="space-y-3">
          <div className="ke-skeleton h-6 w-1/3" />
          <div className="ke-skeleton h-10 w-3/4" />
          <div className="ke-skeleton h-56" />
        </div>
      </Shell>
    );
  }

  if (q.isError) {
    return (
      <Shell>
        <BackLink />
        <div role="alert" className="rounded-lg border border-gold-line bg-card p-6 text-center">
          <p className="font-semibold">We couldn't load this performance</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="tap mt-3 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const e = q.data;

  if (!e) {
    return (
      <Shell>
        <BackLink />
        <div className="rounded-lg border border-gold-line bg-card p-8 text-center">
          <p className="font-semibold">This performance wasn't found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been removed, or the link may be incomplete.
          </p>
        </div>
      </Shell>
    );
  }

  const form = formByName(e.subcategory);
  const phase = phaseOf(e);
  const flagged = isFlagged(e);
  const locked = confirmed || downvoted || confirmBusy;

  async function confirm(ev: KEvent) {
    if (locked) return;
    setMsg("");
    setConfirmBusy(true);
    try {
      await confirmEvent(ev.id);
      setConfirmed(true);
      setDownvoted(false);
      await q.refetch();
      await feedbackQuery.refetch();
    } catch {
      setMsg("Couldn't record your confirmation. Please try again.");
    } finally {
      setConfirmBusy(false);
    }
  }

  function downloadCalendar(ev: KEvent) {
    const blob = new Blob([icsFor(ev)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const share = `https://wa.me/?text=${encodeURIComponent(`${e.title}, ${e.locality}. ${pageUrl}`)}`;

  return (
    <Shell>
      <BackLink />

      {flagged && (
        <div
          role="status"
          className="mb-4 flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert
            size={18}
            className="mt-0.5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p>
            Several people have reported a problem with this listing, so it is hidden from the map.
            Check with the temple committee before travelling.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main column */}
        <div className="min-w-0">
          <EventPoster e={e} />

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <PhaseBadge phase={phase} />
            <CategoryBadge e={e} />
            <VerifiedBadge e={e} />
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
                {e.title}
              </h1>
              {form && <p className="mt-1 font-ml text-lg text-gold">{form.ml}</p>}
            </div>
            <BookmarkButton id={e.id} title={e.title} className="mt-1" />
          </div>

          <p className="mt-4 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed">
            {e.description}
          </p>

          {form && (
            <p className="mt-4 max-w-[68ch] border-l-2 border-gold-line pl-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">About {form.name}.</span> {form.line}
            </p>
          )}

          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <CalendarDays size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
              <span>
                {fmtWhen(e)}
                <span className="block text-xs text-muted-foreground">Kerala time (IST)</span>
              </span>
            </li>
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
              <span>
                {e.venue}
                <span className="block text-muted-foreground">
                  {e.locality}, {e.district}
                </span>
              </span>
            </li>
            {e.contact && (
              <li className="flex gap-3">
                <Phone size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                <span>{e.contact}</span>
              </li>
            )}
          </ul>

          {(e.ticketUrl || e.instagram || e.website || e.otherUrl) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {e.website && <ExtLink href={e.website}>Temple or committee page</ExtLink>}
              {e.instagram && <ExtLink href={e.instagram}>Instagram</ExtLink>}
              {e.ticketUrl && <ExtLink href={e.ticketUrl}>Event page</ExtLink>}
              {e.otherUrl && <ExtLink href={e.otherUrl}>More information</ExtLink>}
            </div>
          )}

          <aside
            aria-label="Visiting a Theyyam"
            className="mt-7 flex gap-3 rounded-lg border border-gold-line bg-card p-4"
          >
            <Info size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">Visiting a Theyyam</p>
              <p className="mt-1">
                This is a sacred ritual, not a staged show. Dress modestly, keep a respectful
                distance from the performer, and ask before you photograph. Customs differ from kavu
                to kavu, so follow the committee's guidance. Start times often shift, so confirm
                locally if you are travelling a long way.
              </p>
            </div>
          </aside>

          <CommunityFeedback
            feedback={feedbackQuery.data ?? []}
            loading={feedbackQuery.isLoading}
            error={feedbackQuery.isError}
          />
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="h-64 overflow-hidden rounded-lg border border-gold-line bg-raised">
            <ClientOnly fallback={<div className="h-full bg-raised" />}>
              <Suspense fallback={<div className="h-full bg-raised" />}>
                <EventMap events={[e]} initialView={{ lat: e.lat, lng: e.lng, zoom: 15 }} compact />
              </Suspense>
            </ClientOnly>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${e.lat}%2C${e.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} flex-col gap-1 py-2 h-auto`}
            >
              <Navigation size={16} aria-hidden="true" />
              Directions
            </a>
            <button
              type="button"
              onClick={() => downloadCalendar(e)}
              className={`${btn} flex-col gap-1 py-2 h-auto`}
            >
              <CalendarPlus size={16} aria-hidden="true" />
              Add to calendar
            </button>
            <a
              href={share}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} flex-col gap-1 py-2 h-auto`}
            >
              <Share2 size={16} aria-hidden="true" />
              Share
            </a>
          </div>

          <section
            className="rounded-lg border border-gold-line bg-card p-4"
            aria-label="Community confirmation"
          >
            <p className="flex items-center gap-2 font-semibold">
              <ThumbsUp size={18} className="text-gold" aria-hidden="true" />
              {confirmText(e.upvotes)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Confirmations tell others this performance is real and still on. They aren't likes.{" "}
              {e.upvotes >= CONFIRMED_MIN
                ? "It has enough confirmations to be marked Verified."
                : `${CONFIRMED_MIN - e.upvotes} more ${CONFIRMED_MIN - e.upvotes === 1 ? "confirmation makes" : "confirmations make"} it Verified.`}
            </p>

            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp size={14} aria-hidden="true" />
                {e.upvotes}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsDown size={14} aria-hidden="true" />
                {e.downvotes}
              </span>
              {e.reports > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Flag size={14} aria-hidden="true" />
                  {e.reports}
                </span>
              )}
            </div>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => void confirm(e)}
                className={`tap flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed ${
                  confirmed
                    ? "border border-gold bg-transparent text-gold"
                    : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                }`}
              >
                <ThumbsUp size={17} aria-hidden="true" />
                {confirmed
                  ? "You confirmed this performance"
                  : downvoted
                    ? "You already responded"
                    : confirmBusy
                      ? "Saving…"
                      : "I can confirm this performance"}
              </button>

              <button
                type="button"
                disabled={locked}
                onClick={() => setDownvoteOpen(true)}
                className={`tap flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold disabled:cursor-not-allowed ${
                  downvoted
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border hover:bg-accent disabled:opacity-60"
                }`}
              >
                <ThumbsDown size={17} aria-hidden="true" />
                {downvoted
                  ? "You said you can't confirm this"
                  : confirmed
                    ? "You already responded"
                    : "I can't confirm this performance"}
              </button>

              <button
                type="button"
                disabled={reported}
                onClick={() => setReportOpen(true)}
                className={`${btn} w-full`}
              >
                <Flag size={14} aria-hidden="true" />
                {reported ? "Report sent" : "Report a problem"}
              </button>
            </div>

            {msg && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {msg}
              </p>
            )}
          </section>
        </div>
      </div>

      <DownvoteDialog
        open={downvoteOpen}
        onOpenChange={setDownvoteOpen}
        eventId={e.id}
        onDone={async () => {
          setDownvoted(true);
          setConfirmed(false);
          setMsg("");
          await q.refetch();
          await feedbackQuery.refetch();
        }}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        eventId={e.id}
        onDone={async () => {
          setReported(true);
          setMsg("");
          await q.refetch();
          await feedbackQuery.refetch();
        }}
      />
    </Shell>
  );
}

/* ============================================================
   COMMUNITY FEEDBACK
   ============================================================ */

function CommunityFeedback({
  feedback,
  loading,
  error,
}: {
  feedback: EventFeedback[];
  loading: boolean;
  error: boolean;
}) {
  return (
    <section
      className="mt-7 rounded-lg border border-border bg-card p-4"
      aria-label="Community feedback"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold uppercase tracking-[0.08em]">
            Community feedback
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reports and comments from people who checked this performance.
          </p>
        </div>
        {!loading && !error && feedback.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {feedback.length} {feedback.length === 1 ? "response" : "responses"}
          </span>
        )}
      </div>

      {loading && (
        <div className="mt-4 space-y-3">
          <div className="ke-skeleton h-16" />
          <div className="ke-skeleton h-16" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-md border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">Community feedback couldn't be loaded.</p>
        </div>
      )}

      {!loading && !error && feedback.length === 0 && (
        <div className="mt-4 rounded-md border border-dashed border-border p-5 text-center">
          <p className="text-sm font-medium">No feedback yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Be the first to confirm or report something about this performance.
          </p>
        </div>
      )}

      {!loading && !error && feedback.length > 0 && (
        <div className="mt-4 space-y-3">
          {feedback.map((item) => (
            <FeedbackCard key={item.id} feedback={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedbackCard({ feedback }: { feedback: EventFeedback }) {
  const isDownvote = feedback.type === "downvote";

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isDownvote ? "bg-destructive/15 text-destructive" : "bg-raised text-muted-foreground"
          }`}
        >
          {isDownvote ? (
            <ThumbsDown size={16} aria-hidden="true" />
          ) : (
            <Flag size={16} aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted-foreground">
            {isDownvote ? "Can't confirm" : "Report"}
          </span>
          <p className="mt-0.5 font-semibold">{feedbackReasonLabel(feedback.reason)}</p>
          {feedback.note && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              “{feedback.note}”
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Anonymous{feedback.createdAt && ` · ${feedbackDate(feedback.createdAt)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DIALOGS
   ============================================================ */

const dialogBox =
  "ke-dialog fixed inset-x-0 bottom-0 z-[1100] max-h-[90dvh] overflow-y-auto rounded-t-xl border border-gold-line bg-popover p-4 text-foreground md:inset-auto md:left-1/2 md:top-1/2 md:w-[460px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg";
const dialogClose = "flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent";
const textarea =
  "w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-gold";
const submitBtn =
  "tap mt-3 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

function DownvoteDialog({
  open,
  onOpenChange,
  eventId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState<DownvoteReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setReason("");
    setNote("");
    setErr("");
    setBusy(false);
  }

  function handleOpenChange(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  async function send() {
    if (!reason) {
      setErr("Choose a reason.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await downvoteEvent(eventId, reason, note);
      await onDone();
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Downvote failed:", error);
      setErr("Couldn't record your response. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/70" />
        <Dialog.Content className={dialogBox}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-[0.06em]">
                <ThumbsDown size={18} aria-hidden="true" />I can't confirm this
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Tell us why you can't confirm this performance.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className={dialogClose}>
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <fieldset className="mt-4 space-y-1">
            <legend className="mb-2 text-sm font-semibold">What's wrong?</legend>
            {DOWNVOTE_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition ${
                  reason === r.value
                    ? "border-gold bg-accent"
                    : "border-transparent hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name="downvote-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="h-4 w-4 accent-[#d4ad6b]"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </fieldset>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">
              Anything else?
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything that may help others…"
              className={`${textarea} min-h-24`}
            />
            <span className="mt-1 block text-right text-xs text-muted-foreground">
              {note.length}/500
            </span>
          </label>

          {err && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {err}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !reason}
            onClick={() => void send()}
            className={submitBtn}
          >
            {busy ? "Sending…" : "Send response"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  eventId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setReason("");
    setNote("");
    setErr("");
    setBusy(false);
  }

  function handleOpenChange(value: boolean) {
    if (!value && !busy) reset();
    onOpenChange(value);
  }

  async function send() {
    if (!reason) {
      setErr("Choose what's wrong with this performance.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await reportEvent(eventId, reason, note);
      await onDone();
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Report failed:", error);
      setErr("Couldn't send your report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/70" />
        <Dialog.Content className={dialogBox}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-base font-semibold uppercase tracking-[0.06em]">
              Report this performance
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className={dialogClose}>
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Reports keep the map accurate. You can report a performance once.
          </Dialog.Description>

          <fieldset className="mt-3 space-y-1">
            <legend className="sr-only">Reason</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md border px-2.5 text-sm ${
                  reason === r.value
                    ? "border-gold bg-accent"
                    : "border-transparent hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="h-4 w-4 accent-[#d4ad6b]"
                />
                {r.label}
              </label>
            ))}
          </fieldset>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">
              Details <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add anything useful…"
              className={`${textarea} h-20`}
            />
            <span className="mt-1 block text-right text-xs text-muted-foreground">
              {note.length}/500
            </span>
          </label>

          {err && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {err}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !reason}
            onClick={() => void send()}
            className={submitBtn}
          >
            {busy ? "Sending…" : "Send report"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
