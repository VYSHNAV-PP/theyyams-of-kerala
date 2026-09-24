import {
  createFileRoute,
  ClientOnly,
  Link,
} from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import * as Dialog from "@radix-ui/react-dialog";

import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Flag,
  MapPin,
  Navigation,
  Phone,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  X,
} from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";

import {
  CategoryBadge,
  StatusBadge,
  confirmText,
} from "@/components/EventViews";

import {
  CONFIRMED_MIN,
  DOWNVOTE_REASONS,
  REPORT_REASONS,
  confirmEvent,
  downvoteEvent,
  entryLabel,
  fetchEvent,
  fetchEventFeedback,
  fmtWhen,
  hasConfirmed,
  hasDownvoted,
  hasReported,
  reportEvent,
  type DownvoteReason,
  type EventFeedback,
  type KEvent,
} from "@/lib/events";

const EventMap = lazy(
  () => import("@/components/EventMap"),
);

export const Route = createFileRoute(
  "/event/$id",
)({
  head: () => ({
    meta: [
      {
        title: "Event — Kerala Events",
      },
      {
        name: "description",
        content:
          "Event details on Kerala Events.",
      },
      {
        property: "og:title",
        content:
          "Event — Kerala Events",
      },
      {
        property: "og:description",
        content:
          "See this event on the Kerala Events map.",
      },
      {
        property: "og:type",
        content: "article",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),

  component: EventPage,
});

/* ============================================================
   SHELL
   ============================================================ */

const Shell = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="min-h-dvh bg-background">
    <SiteHeader />

    <main className="mx-auto max-w-2xl px-4 py-4">
      {children}
    </main>
  </div>
);

/* ============================================================
   BACK LINK
   ============================================================ */

const BackLink = () => (
  <Link
    to="/"
    className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
  >
    <ArrowLeft
      size={16}
      aria-hidden="true"
    />

    Back to map
  </Link>
);

/* ============================================================
   EXTERNAL LINK
   ============================================================ */

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
    >
      <ExternalLink
        size={14}
        aria-hidden="true"
      />

      {children}
    </a>
  );
}

/* ============================================================
   FEEDBACK REASON LABEL
   ============================================================ */

function feedbackReasonLabel(
  reason: string,
): string {
  const downvoteReason =
    DOWNVOTE_REASONS.find(
      (r) =>
        r.value === reason,
    );

  if (downvoteReason) {
    return downvoteReason.label;
  }

  const reportReason =
    REPORT_REASONS.find(
      (r) =>
        r.value === reason,
    );

  if (reportReason) {
    return reportReason.label;
  }

  return reason;
}

/* ============================================================
   FORMAT FEEDBACK DATE
   ============================================================ */

function feedbackDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

/* ============================================================
   EVENT PAGE
   ============================================================ */

function EventPage() {
  const { id } =
    Route.useParams();

  /* ==========================================================
     EVENT QUERY
     ========================================================== */

  const q = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEvent(id),
    staleTime: 15_000,
  });

  /* ==========================================================
     COMMUNITY FEEDBACK QUERY
     ========================================================== */

  const feedbackQuery =
    useQuery({
      queryKey: [
        "event-feedback",
        id,
      ],

      queryFn: () =>
        fetchEventFeedback(id),

      staleTime: 10_000,
    });

  /* ==========================================================
     LOCAL STATE
     ========================================================== */

  const [confirmed, setConfirmed] =
    useState(false);

  const [downvoted, setDownvoted] =
    useState(false);

  const [reported, setReported] =
    useState(false);

  const [msg, setMsg] =
    useState("");

  const [confirmBusy, setConfirmBusy] =
    useState(false);

  const [downvoteOpen, setDownvoteOpen] =
    useState(false);

  const [reportOpen, setReportOpen] =
    useState(false);

  /* ==========================================================
     LOAD LOCAL VOTE STATE
     ========================================================== */

  useEffect(() => {
    setConfirmed(
      hasConfirmed(id),
    );

    setDownvoted(
      hasDownvoted(id),
    );

    setReported(
      hasReported(id),
    );
  }, [id]);

  /* ==========================================================
     LOADING
     ========================================================== */

  if (q.isLoading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-1/3 rounded bg-muted" />

          <div className="h-9 w-3/4 rounded bg-muted" />

          <div className="h-40 rounded bg-muted" />
        </div>
      </Shell>
    );
  }

  /* ==========================================================
     EVENT ERROR
     ========================================================== */

  if (q.isError) {
    return (
      <Shell>
        <BackLink />

        <div
          role="alert"
          className="rounded-lg border border-border p-6 text-center"
        >
          <p className="font-semibold">
            We couldn't load this event
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again.
          </p>

          <button
            type="button"
            onClick={() =>
              void q.refetch()
            }
            className="mt-3 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  const e = q.data;

  /* ==========================================================
     NOT FOUND
     ========================================================== */

  if (!e) {
    return (
      <Shell>
        <BackLink />

        <p className="p-8 text-center">
          This event wasn't found.
          It may have been removed.
        </p>
      </Shell>
    );
  }

  /* ==========================================================
     CONFIRM
     ========================================================== */

  async function confirm(
    ev: KEvent,
  ) {
    /*
     * Once either vote exists, this action is permanently
     * unavailable for this browser/device/event.
     */
    if (
      confirmBusy ||
      confirmed ||
      downvoted
    ) {
      return;
    }

    setMsg("");
    setConfirmBusy(true);

    try {
      await confirmEvent(
        ev.id,
      );

      setConfirmed(true);
      setDownvoted(false);

      await q.refetch();

      await feedbackQuery.refetch();
    } catch {
      setMsg(
        "Couldn't record your confirmation. Please try again.",
      );
    } finally {
      setConfirmBusy(false);
    }
  }

  /* ==========================================================
     SHARE
     ========================================================== */

  const share =
    `https://wa.me/?text=${encodeURIComponent(
      `${e.title} — ${window.location.href}`,
    )}`;

  /* ==========================================================
     HIGH CONFIRMATION
     ========================================================== */

  const highly =
    e.upvotes >= CONFIRMED_MIN;

  return (
    <Shell>
      <BackLink />

      {/* ======================================================
         POSTER
         ====================================================== */}

      {e.imageUrl && (
        <img
          src={e.imageUrl}
          alt={`Poster for ${e.title}`}
          loading="lazy"
          className="mb-4 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      )}

      {/* ======================================================
         BADGES
         ====================================================== */}

      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge e={e} />

        <StatusBadge e={e} />

        {highly && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
            Highly confirmed
          </span>
        )}
      </div>

      {/* ======================================================
         TITLE
         ====================================================== */}

      <h1 className="mt-2 text-2xl font-bold leading-tight">
        {e.title}
      </h1>

      {/* ======================================================
         DESCRIPTION
         ====================================================== */}

      <p className="mt-3 leading-relaxed">
        {e.description}
      </p>

      {/* ======================================================
         EVENT INFO
         ====================================================== */}

      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex gap-2">
          <CalendarDays
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {fmtWhen(e)}
          </span>
        </li>

        <li className="flex gap-2">
          <MapPin
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {e.venue}

            <br />

            <span className="text-muted-foreground">
              {e.locality}, {e.district}
            </span>
          </span>
        </li>

        <li className="flex gap-2">
          <Ticket
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {entryLabel(e)}
          </span>
        </li>

        {e.contact && (
          <li className="flex gap-2">
            <Phone
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {e.contact}
            </span>
          </li>
        )}
      </ul>

      {/* ======================================================
         LINKS
         ====================================================== */}

      <div className="mt-4 flex flex-wrap gap-2">
        {e.ticketUrl && (
          <ExtLink href={e.ticketUrl}>
            {e.entry === "registration"
              ? "Register"
              : "Tickets / registration"}
          </ExtLink>
        )}

        {e.instagram && (
          <ExtLink href={e.instagram}>
            Instagram
          </ExtLink>
        )}

        {e.website && (
          <ExtLink href={e.website}>
            Official website
          </ExtLink>
        )}

        {e.otherUrl && (
          <ExtLink href={e.otherUrl}>
            More info
          </ExtLink>
        )}
      </div>

      {/* ======================================================
         MAP
         ====================================================== */}

      <div className="mt-5 h-56 overflow-hidden rounded-lg border border-border">
        <ClientOnly
          fallback={
            <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
              Loading map…
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="h-full bg-muted" />
            }
          >
            <EventMap
              events={[e]}
              initialView={{
                lat: e.lat,
                lng: e.lng,
                zoom: 15,
              }}
              compact
            />
          </Suspense>
        </ClientOnly>
      </div>

      {/* ======================================================
         COMMUNITY CONFIRMATION
         ====================================================== */}

      <section
        className="mt-5 rounded-lg border border-border bg-card p-4"
        aria-label="Community confirmation"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <ThumbsUp
                size={18}
                aria-hidden="true"
              />

              {confirmText(
                e.upvotes,
              )}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Confirmations tell others this event is real and still on. They aren't likes.
            </p>
          </div>

          {/* COUNTS */}

          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ThumbsUp
                size={15}
                aria-hidden="true"
              />

              {e.upvotes}
            </span>

            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ThumbsDown
                size={15}
                aria-hidden="true"
              />

              {e.downvotes}
            </span>

            {e.reports > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Flag
                  size={15}
                  aria-hidden="true"
                />

                {e.reports}
              </span>
            )}
          </div>
        </div>

        {/* ====================================================
           VOTE BUTTONS
           ==================================================== */}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* UPVOTE */}

          <button
            type="button"
            disabled={
              confirmed ||
              downvoted ||
              confirmBusy
            }
            onClick={() =>
              void confirm(e)
            }
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
              confirmed
                ? "bg-primary/15 text-primary"
                : "bg-primary text-primary-foreground hover:opacity-90"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <ThumbsUp
              size={17}
              aria-hidden="true"
            />

            {confirmed
              ? "You confirmed this event"
              : downvoted
                ? "Already voted on this event"
                : "I can confirm this event"}
          </button>

          {/* DOWNVOTE */}

          <button
            type="button"
            disabled={
              confirmed ||
              downvoted ||
              confirmBusy
            }
            onClick={() =>
              setDownvoteOpen(true)
            }
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
              downvoted
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : confirmed
                  ? "border-border"
                  : "border-border hover:bg-muted"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <ThumbsDown
              size={17}
              aria-hidden="true"
            />

            {downvoted
              ? "You can't confirm this event"
              : confirmed
                ? "Already voted on this event"
                : "I can't confirm this event"}
          </button>
        </div>

        {/* ====================================================
           OTHER ACTIONS
           ==================================================== */}

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={reported}
            onClick={() =>
              setReportOpen(true)
            }
            className="flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <Flag
              size={14}
              aria-hidden="true"
            />

            {reported
              ? "Report sent"
              : "Report a problem"}
          </button>

          <a
            href={share}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            <Share2
              size={14}
              aria-hidden="true"
            />

            Share
          </a>

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${e.lat}%2C${e.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            <Navigation
              size={14}
              aria-hidden="true"
            />

            Directions
          </a>
        </div>

        {msg && (
          <p
            role="alert"
            className="mt-2 text-sm text-destructive"
          >
            {msg}
          </p>
        )}
      </section>

      {/* ======================================================
         COMMUNITY FEEDBACK / REVIEWS
         ====================================================== */}

      <CommunityFeedback
        feedback={
          feedbackQuery.data ??
          []
        }
        loading={
          feedbackQuery.isLoading
        }
        error={
          feedbackQuery.isError
        }
      />

      {/* ======================================================
         DOWNVOTE DIALOG
         ====================================================== */}

      <DownvoteDialog
        open={downvoteOpen}
        onOpenChange={
          setDownvoteOpen
        }
        eventId={e.id}
        onDone={async () => {
          setDownvoted(true);
          setConfirmed(false);
          setMsg("");

          await q.refetch();

          await feedbackQuery.refetch();
        }}
      />

      {/* ======================================================
         REPORT DIALOG
         ====================================================== */}

      <ReportDialog
        open={reportOpen}
        onOpenChange={
          setReportOpen
        }
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
      className="mt-5 rounded-lg border border-border bg-card p-4"
      aria-label="Community feedback"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">
            Community feedback
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Reports and comments from people who checked this event.
          </p>
        </div>

        {!loading &&
          !error &&
          feedback.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {feedback.length}{" "}
              {feedback.length === 1
                ? "response"
                : "responses"}
            </span>
          )}
      </div>

      {/* LOADING */}

      {loading && (
        <div className="mt-4 space-y-3">
          <div className="animate-pulse rounded-md bg-muted p-4">
            <div className="h-4 w-1/2 rounded bg-background" />

            <div className="mt-3 h-3 w-3/4 rounded bg-background" />
          </div>

          <div className="animate-pulse rounded-md bg-muted p-4">
            <div className="h-4 w-1/3 rounded bg-background" />

            <div className="mt-3 h-3 w-2/3 rounded bg-background" />
          </div>
        </div>
      )}

      {/* ERROR */}

      {!loading && error && (
        <div className="mt-4 rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            Community feedback couldn't be loaded.
          </p>
        </div>
      )}

      {/* EMPTY */}

      {!loading &&
        !error &&
        feedback.length === 0 && (
          <div className="mt-4 rounded-md border border-dashed p-5 text-center">
            <p className="text-sm font-medium">
              No community feedback yet.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Be the first person to confirm or report something about this event.
            </p>
          </div>
        )}

      {/* FEEDBACK */}

      {!loading &&
        !error &&
        feedback.length > 0 && (
          <div className="mt-4 space-y-3">
            {feedback.map(
              (item) => (
                <FeedbackCard
                  key={item.id}
                  feedback={item}
                />
              ),
            )}
          </div>
        )}
    </section>
  );
}

/* ============================================================
   FEEDBACK CARD
   ============================================================ */

function FeedbackCard({
  feedback,
}: {
  feedback: EventFeedback;
}) {
  const isDownvote =
    feedback.type ===
    "downvote";

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isDownvote
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isDownvote ? (
            <ThumbsDown
              size={16}
              aria-hidden="true"
            />
          ) : (
            <Flag
              size={16}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isDownvote
                ? "Can't confirm"
                : "Report"}
            </span>
          </div>

          <p className="mt-1 font-semibold">
            {feedbackReasonLabel(
              feedback.reason,
            )}
          </p>

          {feedback.note && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              “{feedback.note}”
            </p>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Anonymous

            {feedback.createdAt && (
              <>
                {" · "}
                {feedbackDate(
                  feedback.createdAt,
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DOWNVOTE DIALOG
   ============================================================ */

function DownvoteDialog({
  open,
  onOpenChange,
  eventId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (
    open: boolean,
  ) => void;
  eventId: string;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] =
    useState<DownvoteReason | "">("");

  const [note, setNote] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [err, setErr] =
    useState("");

  function reset() {
    setReason("");
    setNote("");
    setErr("");
    setBusy(false);
  }

  function handleOpenChange(
    value: boolean,
  ) {
    if (!value) {
      reset();
    }

    onOpenChange(value);
  }

  async function send() {
    if (!reason) {
      setErr(
        "Choose a reason.",
      );

      return;
    }

    setBusy(true);
    setErr("");

    try {
      await downvoteEvent(
        eventId,
        reason,
        note,
      );

      await onDone();

      reset();

      onOpenChange(false);
    } catch (error) {
      console.error(
        "Downvote failed:",
        error,
      );

      setErr(
        "Couldn't record your response. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={
        handleOpenChange
      }
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/40" />

        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[1100] max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl md:inset-auto md:left-1/2 md:top-1/2 md:w-[460px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-bold">
                <ThumbsDown
                  size={18}
                  aria-hidden="true"
                />

                I can't confirm this event
              </Dialog.Title>

              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Tell us why you can't confirm it.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            >
              <X
                size={18}
                aria-hidden="true"
              />
            </Dialog.Close>
          </div>

          {/* REASONS */}

          <fieldset className="mt-4 space-y-1">
            <legend className="mb-2 text-sm font-semibold">
              What's wrong?
            </legend>

            {DOWNVOTE_REASONS.map(
              (r) => (
                <label
                  key={r.value}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition ${
                    reason ===
                    r.value
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="downvote-reason"
                    value={r.value}
                    checked={
                      reason ===
                      r.value
                    }
                    onChange={() =>
                      setReason(
                        r.value,
                      )
                    }
                    className="h-4 w-4"
                  />

                  <span>
                    {r.label}
                  </span>
                </label>
              ),
            )}
          </fieldset>

          {/* NOTE */}

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">
              Additional note

              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </span>

            <textarea
              value={note}
              maxLength={500}
              onChange={(event) =>
                setNote(
                  event.target.value,
                )
              }
              placeholder="Tell us anything else that may help..."
              className="min-h-24 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <span className="mt-1 block text-right text-xs text-muted-foreground">
              {note.length}/500
            </span>
          </label>

          {err && (
            <p
              role="alert"
              className="mt-2 text-sm text-destructive"
            >
              {err}
            </p>
          )}

          {/* SUBMIT */}

          <button
            type="button"
            disabled={
              busy ||
              !reason
            }
            onClick={() =>
              void send()
            }
            className="mt-3 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Submitting…"
              : "Submit"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ============================================================
   REPORT DIALOG
   ============================================================ */

function ReportDialog({
  open,
  onOpenChange,
  eventId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (
    open: boolean,
  ) => void;
  eventId: string;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] =
    useState("");

  const [note, setNote] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [err, setErr] =
    useState("");

  function reset() {
    setReason("");
    setNote("");
    setErr("");
    setBusy(false);
  }

  function handleOpenChange(
    value: boolean,
  ) {
    if (!value && !busy) {
      reset();
    }

    onOpenChange(value);
  }

  async function send() {
    if (!reason) {
      setErr(
        "Choose what's wrong with this event.",
      );

      return;
    }

    setBusy(true);
    setErr("");

    try {
      await reportEvent(
        eventId,
        reason,
        note,
      );

      await onDone();

      reset();

      onOpenChange(false);
    } catch (error) {
      console.error(
        "Report failed:",
        error,
      );

      setErr(
        "Couldn't send your report. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={
        handleOpenChange
      }
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/40" />

        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[1100] max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-card p-4 md:inset-auto md:left-1/2 md:top-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-bold">
              Report this event
            </Dialog.Title>

            <Dialog.Close
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            >
              <X
                size={18}
                aria-hidden="true"
              />
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Reports help keep the map accurate. You can report an event once.
          </Dialog.Description>

          <fieldset className="mt-3 space-y-1">
            <legend className="sr-only">
              Reason
            </legend>

            {REPORT_REASONS.map(
              (r) => (
                <label
                  key={r.value}
                  className={`flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted ${
                    reason ===
                    r.value
                      ? "bg-muted"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={
                      reason ===
                      r.value
                    }
                    onChange={() =>
                      setReason(
                        r.value,
                      )
                    }
                  />

                  {r.label}
                </label>
              ),
            )}
          </fieldset>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">
              Details (optional)
            </span>

            <textarea
              value={note}
              maxLength={500}
              onChange={(event) =>
                setNote(
                  event.target.value,
                )
              }
              placeholder="Add any useful details..."
              className="h-20 w-full resize-none rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <span className="mt-1 block text-right text-xs text-muted-foreground">
              {note.length}/500
            </span>
          </label>

          {err && (
            <p
              role="alert"
              className="mt-2 text-sm text-destructive"
            >
              {err}
            </p>
          )}

          <button
            type="button"
            disabled={
              busy ||
              !reason
            }
            onClick={() =>
              void send()
            }
            className="mt-3 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Sending…"
              : "Send report"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}