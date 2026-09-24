import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { asCategory, type Category } from "./taxonomy";
import { haversineKm } from "./geo";

export {
  CATEGORIES,
  CATEGORY_META,
  SUBCATEGORIES,
  REPORT_REASONS,
  type Category,
} from "./taxonomy";

export { DISTRICTS } from "./geo";

export type EntryStatus =
  | "free"
  | "paid"
  | "registration";

export type Status =
  | "upcoming"
  | "now"
  | "ended";

export const CONFIRMED_MIN = 10;

const DAY = 864e5;

export const ENDED_GRACE_DAYS = 2;

type Row =
  Database["public"]["Tables"]["events"]["Row"];

type EventRow = Row & {
  downvotes: number;
};

export type KEvent = {
  id: string;
  title: string;
  category: Category;
  subcategory: string;
  description: string;

  date: string;
  endDate: string;
  startTime: string;
  endTime: string | null;

  startMs: number;
  endMs: number;

  venue: string;
  locality: string;
  district: string;

  lat: number;
  lng: number;

  entry: EntryStatus;
  fee: string | null;
  contact: string | null;

  ticketUrl: string | null;
  instagram: string | null;
  website: string | null;
  otherUrl: string | null;
  imageUrl: string | null;

  upvotes: number;
  downvotes: number;
  reports: number;

  hay: string;
};

/* ============================================================
   COMMUNITY FEEDBACK
   ============================================================ */

export type EventFeedback = {
  id: string;
  eventId: string;
  type: "downvote" | "report";
  reason: string;
  note: string | null;
  createdAt: string;
};

/**
 * Fetch all public feedback for one event.
 *
 * event_feedback has a public SELECT policy in your database.
 *
 * `as any` is used here because your generated Supabase types
 * may not yet contain the event_feedback table.
 */
export async function fetchEventFeedback(
  eventId: string,
): Promise<EventFeedback[]> {
  const client = supabase as any;

  const {
    data,
    error,
  } = await client
    .from("event_feedback")
    .select(
      "id,event_id,type,reason,note,created_at",
    )
    .eq("event_id", eventId)
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      event_id: string;
      type: "downvote" | "report";
      reason: string;
      note: string | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    reason: row.reason,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/* ============================================================
   EVENT DATA
   ============================================================ */

const COLS =
  "id,title,category,subcategory,description,date,end_date,start_time,end_time,starts_at,ends_at,venue,locality,district,lat,lng,entry_status,entry_fee,contact,ticket_url,instagram,website,other_url,image_url,upvotes,downvotes,reports";

type DbEvent = Omit<
  EventRow,
  "time" | "link" | "created_at" | "status"
>;

function toEvent(
  r: DbEvent,
): KEvent {
  const category = asCategory(r.category);

  return {
    id: r.id,
    title: r.title,
    category,
    subcategory: r.subcategory,
    description: r.description,

    date: r.date,
    endDate: r.end_date ?? r.date,

    startTime:
      r.start_time.slice(0, 5),

    endTime:
      r.end_time?.slice(0, 5) ?? null,

    startMs:
      Date.parse(r.starts_at),

    endMs:
      Date.parse(r.ends_at),

    venue: r.venue,
    locality: r.locality,
    district: r.district,

    lat: r.lat,
    lng: r.lng,

    entry:
      (
        [
          "free",
          "paid",
          "registration",
        ].includes(r.entry_status)
          ? r.entry_status
          : "free"
      ) as EntryStatus,

    fee: r.entry_fee,
    contact: r.contact,

    ticketUrl: r.ticket_url,
    instagram: r.instagram,
    website: r.website,
    otherUrl: r.other_url,
    imageUrl: r.image_url,

    upvotes: r.upvotes,
    downvotes: r.downvotes,
    reports: r.reports,

    hay: [
      r.title,
      r.description,
      r.venue,
      r.locality,
      r.district,
      category,
      r.subcategory,
      r.entry_status,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

/* ============================================================
   FETCH EVENTS
   ============================================================ */

export async function fetchEvents(): Promise<KEvent[]> {
  const since =
    new Date(
      Date.now() -
        ENDED_GRACE_DAYS * DAY,
    ).toISOString();

  const {
    data,
    error,
  } = await supabase
    .from("events")
    .select(COLS)
    .gt("ends_at", since)
    .order("starts_at")
    .limit(2000);

  if (error) throw error;

  return (
    (data ?? []) as unknown as DbEvent[]
  ).map(toEvent);
}

export async function fetchEvent(
  id: string,
): Promise<KEvent | null> {
  const {
    data,
    error,
  } = await supabase
    .from("events")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data
    ? toEvent(
        data as unknown as DbEvent,
      )
    : null;
}

/* ============================================================
   ADD EVENT
   ============================================================ */

export type NewEvent = Pick<
  KEvent,
  | "id"
  | "title"
  | "category"
  | "subcategory"
  | "description"
  | "date"
  | "endDate"
  | "startTime"
  | "endTime"
  | "venue"
  | "locality"
  | "district"
  | "lat"
  | "lng"
  | "entry"
  | "fee"
  | "contact"
  | "ticketUrl"
  | "instagram"
  | "website"
  | "otherUrl"
  | "imageUrl"
>;

export async function addEvent(
  e: NewEvent,
) {
  const {
    error,
  } = await supabase
    .from("events")
    .insert({
      id: e.id,
      title: e.title,
      category: e.category,
      subcategory: e.subcategory,
      description: e.description,

      date: e.date,
      end_date: e.endDate,

      start_time: e.startTime,
      time: e.startTime,
      end_time: e.endTime,

      venue: e.venue,
      locality: e.locality,
      district: e.district,

      lat: e.lat,
      lng: e.lng,

      entry_status: e.entry,
      entry_fee: e.fee,
      contact: e.contact,

      ticket_url: e.ticketUrl,
      instagram: e.instagram,
      website: e.website,
      other_url: e.otherUrl,
      image_url: e.imageUrl,
    });

  if (error) throw error;
}

/* ============================================================
   POSTER
   ============================================================ */

export async function uploadPoster(
  blob: Blob,
): Promise<string> {
  const path =
    `${crypto.randomUUID()}.jpg`;

  const {
    error,
  } = await supabase.storage
    .from("event-posters")
    .upload(
      path,
      blob,
      {
        contentType: "image/jpeg",
      },
    );

  if (error) throw error;

  return supabase.storage
    .from("event-posters")
    .getPublicUrl(path)
    .data.publicUrl;
}

/** Downscale to max 1200px JPEG so posters stay light on mobile networks. */
export async function shrinkImage(
  file: File,
): Promise<Blob> {
  const bmp =
    await createImageBitmap(file);

  const k =
    Math.min(
      1,
      1200 /
        Math.max(
          bmp.width,
          bmp.height,
        ),
    );

  const c =
    document.createElement("canvas");

  c.width =
    Math.round(
      bmp.width * k,
    );

  c.height =
    Math.round(
      bmp.height * k,
    );

  c
    .getContext("2d")
    ?.drawImage(
      bmp,
      0,
      0,
      c.width,
      c.height,
    );

  return new Promise(
    (res, rej) =>
      c.toBlob(
        (b) =>
          b
            ? res(b)
            : rej(
                new Error("image"),
              ),
        "image/jpeg",
        0.82,
      ),
  );
}

/* ============================================================
   VOTER ID
   ============================================================ */

function voterId(): string {
  let v =
    localStorage.getItem(
      "ke-voter",
    );

  if (!v) {
    v = crypto.randomUUID();

    localStorage.setItem(
      "ke-voter",
      v,
    );
  }

  return v;
}

/* ============================================================
   LOCAL VOTE STATE
   ============================================================ */

/*
 * There is exactly one local vote state per event:
 *
 *   ke-vote-EVENT_ID = "up"
 *   ke-vote-EVENT_ID = "down"
 *
 * This prevents:
 *
 *   up -> up
 *   up -> down
 *   down -> down
 *   down -> up
 *
 * Existing users who still have the old keys are also
 * recognized so their previous vote is not lost.
 */

export type LocalVote =
  | "up"
  | "down";

const VOTE_KEY_PREFIX =
  "ke-vote-";

export function getLocalVote(
  id: string,
): LocalVote | null {
  try {
    const current =
      localStorage.getItem(
        VOTE_KEY_PREFIX + id,
      );

    if (
      current === "up" ||
      current === "down"
    ) {
      return current;
    }

    /*
     * Backwards compatibility with the
     * previous localStorage implementation.
     */
    if (
      localStorage.getItem(
        "ke-confirmed-" + id,
      ) === "1"
    ) {
      return "up";
    }

    if (
      localStorage.getItem(
        "ke-downvoted-" + id,
      ) === "1"
    ) {
      return "down";
    }
  } catch {
    return null;
  }

  return null;
}

function setLocalVote(
  id: string,
  vote: LocalVote,
) {
  try {
    /*
     * Write the new single source of truth.
     */
    localStorage.setItem(
      VOTE_KEY_PREFIX + id,
      vote,
    );

    /*
     * Remove legacy keys after the new state
     * has been successfully written.
     */
    localStorage.removeItem(
      "ke-confirmed-" + id,
    );

    localStorage.removeItem(
      "ke-downvoted-" + id,
    );
  } catch {
    // Ignore storage errors.
  }
}

export const hasConfirmed = (
  id: string,
) =>
  getLocalVote(id) === "up";

export const hasDownvoted = (
  id: string,
) =>
  getLocalVote(id) === "down";

export const hasVoted = (
  id: string,
) =>
  getLocalVote(id) !== null;

/* ============================================================
   UPVOTE / CONFIRM
   ============================================================ */

export async function confirmEvent(
  id: string,
) {
  /*
   * Block a second vote locally before
   * making another database request.
   */
  if (getLocalVote(id)) {
    throw new Error(
      "You have already voted on this event.",
    );
  }

  const {
    error,
  } = await supabase.rpc(
    "vote_event",
    {
      _event_id: id,
      _voter_id: voterId(),
      _kind: "up",
    },
  );

  if (error) throw error;

  setLocalVote(
    id,
    "up",
  );
}

/* ============================================================
   DOWNVOTE REASONS
   ============================================================ */

export const DOWNVOTE_REASONS = [
  {
    value: "cancelled",
    label: "Event is cancelled",
  },
  {
    value: "wrong_datetime",
    label: "Wrong date or time",
  },
  {
    value: "wrong_location",
    label: "Wrong location",
  },
  {
    value: "incorrect_info",
    label: "Information is incorrect",
  },
  {
    value: "duplicate",
    label: "This is a duplicate event",
  },
  {
    value: "ended",
    label: "Event has already ended",
  },
  {
    value: "not_happening",
    label: "This event is not happening",
  },
  {
    value: "other",
    label: "Other",
  },
] as const;

export type DownvoteReason =
  (typeof DOWNVOTE_REASONS)[number]["value"];

/* ============================================================
   DOWNVOTE + REASON
   ============================================================ */

export async function downvoteEvent(
  id: string,
  reason: DownvoteReason,
  note = "",
) {
  /*
   * One vote total per event.
   */
  if (getLocalVote(id)) {
    throw new Error(
      "You have already voted on this event.",
    );
  }

  const voter = voterId();

  /*
   * Record the public downvote.
   */
  const {
    error: voteError,
  } = await supabase.rpc(
    "vote_event",
    {
      _event_id: id,
      _voter_id: voter,
      _kind: "down",
    },
  );

  if (voteError) {
    throw voteError;
  }

  /*
   * Save the reason and optional note.
   */
  const {
    error: feedbackError,
  } = await supabase.rpc(
    "submit_downvote",
    {
      _event_id: id,
      _author_id: voter,
      _reason: reason,
      _note:
        note.trim() || null,
    } as any,
  );

  if (feedbackError) {
    throw feedbackError;
  }

  setLocalVote(
    id,
    "down",
  );
}

/* ============================================================
   REPORT
   ============================================================ */

export async function reportEvent(
  id: string,
  reason: string,
  note: string,
) {
  const {
    error,
  } = await supabase.rpc(
    "report_event",
    {
      _event_id: id,
      _reporter_id: voterId(),
      _reason: reason,
      ...(note.trim()
        ? {
            _note: note.trim(),
          }
        : {}),
    },
  );

  if (error) throw error;

  localStorage.setItem(
    "ke-reported-" + id,
    "1",
  );
}

export const hasReported = (
  id: string,
) =>
  localStorage.getItem(
    "ke-reported-" + id,
  ) === "1";

/* ============================================================
   LIFECYCLE
   ============================================================ */

export function statusOf(
  e: KEvent,
  now = Date.now(),
): Status {
  return now < e.startMs
    ? "upcoming"
    : now <= e.endMs
      ? "now"
      : "ended";
}

export const STATUS_LABEL: Record<
  Status,
  string
> = {
  upcoming: "Upcoming",
  now: "Happening now",
  ended: "Ended",
};

export const isFlagged = (
  e: KEvent,
) =>
  e.reports >= 3;

/* ============================================================
   FORMATTING
   ============================================================ */

export function fmtTime(
  t: string,
) {
  const [
    h = "0",
    m = "00",
  ] = t.split(":");

  const hh = Number(h);

  return `${
    hh % 12 || 12
  }:${m} ${
    hh < 12
      ? "AM"
      : "PM"
  }`;
}

const dfmt =
  new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  );

export const fmtDate = (
  iso: string,
) =>
  dfmt.format(
    new Date(
      iso + "T00:00:00Z",
    ),
  );

export function fmtWhen(
  e: KEvent,
) {
  const d =
    e.endDate !== e.date
      ? `${fmtDate(
          e.date,
        )} – ${fmtDate(
          e.endDate,
        )}`
      : fmtDate(e.date);

  return `${d} · ${fmtTime(
    e.startTime,
  )}${
    e.endTime
      ? ` – ${fmtTime(
          e.endTime,
        )}`
      : ""
  }`;
}

export function entryLabel(
  e: KEvent,
) {
  return e.entry === "free"
    ? "Free entry"
    : e.entry === "paid"
      ? e.fee
        ? `Paid · ${e.fee}`
        : "Paid entry"
      : "Registration required";
}

/* ============================================================
   FILTERING
   ============================================================ */

export type DateKey =
  | "any"
  | "now"
  | "today"
  | "tomorrow"
  | "weekend"
  | "week"
  | "month"
  | "upcoming"
  | "custom";

export type Filters = {
  q: string;

  category:
    | Category
    | "All";

  subcategory:
    | string
    | null;

  date: DateKey;

  from: string;
  to: string;

  district:
    | string
    | null;

  locality: string;

  nearby: boolean;

  entry:
    | "any"
    | EntryStatus;

  confirmed: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  q: "",
  category: "All",
  subcategory: null,
  date: "any",
  from: "",
  to: "",
  district: null,
  locality: "",
  nearby: false,
  entry: "any",
  confirmed: false,
};

export const NEARBY_KM = 25;

const sod = (
  ms: number,
) => {
  const d =
    new Date(ms);

  d.setHours(
    0,
    0,
    0,
    0,
  );

  return d.getTime();
};

export function dateRange(
  key: DateKey,
  now: number,
  from = "",
  to = "",
): [number, number] | null {
  const t = sod(now);

  switch (key) {
    case "today":
      return [
        t,
        t + DAY - 1,
      ];

    case "tomorrow":
      return [
        t + DAY,
        t + 2 * DAY - 1,
      ];

    case "week":
      return [
        t,
        t + 7 * DAY - 1,
      ];

    case "month": {
      const d =
        new Date(now);

      return [
        t,
        new Date(
          d.getFullYear(),
          d.getMonth() + 1,
          1,
        ).getTime() - 1,
      ];
    }

    case "weekend": {
      const dow =
        new Date(now).getDay();

      const sat =
        dow === 0
          ? t - DAY
          : t +
            ((6 - dow + 7) % 7) *
              DAY;

      return [
        sat,
        sat + 2 * DAY - 1,
      ];
    }

    case "custom": {
      const a = from
        ? new Date(
            from +
              "T00:00:00",
          ).getTime()
        : t;

      const b = to
        ? new Date(
            to +
              "T23:59:59",
          ).getTime()
        : Number.MAX_SAFE_INTEGER;

      return [a, b];
    }

    default:
      return null;
  }
}

const STOP =
  new Set([
    "in",
    "at",
    "near",
    "around",
    "on",
    "for",
    "the",
    "a",
    "an",
    "of",
    "event",
    "events",
    "this",
    "kerala",
    "and",
    "to",
    "happening",
  ]);

const SYN: Record<
  string,
  string
> = {
  soccer: "football",
  gig: "concert",
  gigs: "concert",
  film: "movie",
  movies: "movie",
  show: "concert",
  kids: "kid",
};

/* ============================================================
   QUERY PARSER
   ============================================================ */

export function parseQuery(
  q: string,
): {
  tokens: string[];
  date: DateKey | null;
  free: boolean;
} {
  let s =
    " " +
    q
      .toLowerCase()
      .replace(
        /[^a-z0-9\u0d00-\u0d7f\s]/g,
        " ",
      ) +
    " ";

  let date:
    | DateKey
    | null = null;

  const rules: [
    RegExp,
    DateKey,
  ][] = [
    [
      / this weekend | weekend /,
      "weekend",
    ],
    [
      / tomorrow /,
      "tomorrow",
    ],
    [
      / today /,
      "today",
    ],
    [
      / this week /,
      "week",
    ],
    [
      / this month /,
      "month",
    ],
    [
      / (happening )?now /,
      "now",
    ],
    [
      / upcoming /,
      "upcoming",
    ],
  ];

  for (
    const [re, k] of rules
  ) {
    if (re.test(s)) {
      date = k;

      s = s.replace(
        re,
        " ",
      );
    }
  }

  const free =
    / free /.test(s);

  s = s.replace(
    / free /,
    " ",
  );

  const tokens = s
    .split(/\s+/)
    .filter(
      (t) =>
        t &&
        !STOP.has(t),
    )
    .map(
      (t) =>
        SYN[t] ??
        (
          t.length > 4 &&
          t.endsWith("s")
            ? t.slice(0, -1)
            : t
        ),
    );

  return {
    tokens,
    date,
    free,
  };
}

/* ============================================================
   DATE MATCHING
   ============================================================ */

export function matchesDate(
  e: KEvent,
  key: DateKey,
  now: number,
  from = "",
  to = "",
) {
  if (key === "any")
    return true;

  if (key === "now")
    return (
      statusOf(e, now) === "now"
    );

  if (key === "upcoming")
    return (
      statusOf(
        e,
        now,
      ) === "upcoming"
    );

  const r =
    dateRange(
      key,
      now,
      from,
      to,
    );

  return (
    !r ||
    (
      e.startMs <= r[1] &&
      e.endMs >= r[0]
    )
  );
}

/* ============================================================
   APPLY FILTERS
   ============================================================ */

export function applyFilters(
  events: KEvent[],
  f: Filters,
  now: number,
  user:
    | [number, number]
    | null,
): KEvent[] {
  const pq =
    parseQuery(f.q);

  const loc =
    f.locality
      .trim()
      .toLowerCase();

  const out =
    events.filter(
      (e) => {
        if (isFlagged(e))
          return false;

        if (
          f.category !== "All" &&
          e.category !== f.category
        )
          return false;

        if (
          f.subcategory &&
          e.subcategory !==
            f.subcategory
        )
          return false;

        if (
          f.district &&
          e.district !==
            f.district
        )
          return false;

        if (
          loc &&
          !e.locality
            .toLowerCase()
            .includes(loc)
        )
          return false;

        if (
          f.nearby &&
          user &&
          haversineKm(
            user,
            [
              e.lat,
              e.lng,
            ],
          ) > NEARBY_KM
        )
          return false;

        if (
          f.entry !== "any" &&
          e.entry !== f.entry
        )
          return false;

        if (
          pq.free &&
          e.entry !== "free"
        )
          return false;

        if (
          f.confirmed &&
          e.upvotes < CONFIRMED_MIN
        )
          return false;

        if (
          !matchesDate(
            e,
            f.date,
            now,
            f.from,
            f.to,
          )
        )
          return false;

        if (
          pq.date &&
          !matchesDate(
            e,
            pq.date,
            now,
          )
        )
          return false;

        return pq.tokens.every(
          (t) =>
            e.hay.includes(t),
        );
      },
    );

  const rank = (
    e: KEvent,
  ) => {
    const s =
      statusOf(
        e,
        now,
      );

    return s === "now"
      ? 0
      : s === "upcoming"
        ? 1
        : 2;
  };

  return out.sort(
    (a, b) =>
      rank(a) -
        rank(b) ||
      a.startMs -
        b.startMs,
  );
}

/* ============================================================
   CONTEXT PLACE
   ============================================================ */

/** Wording for "Kerala · 248 events" depending on what the map is showing. */
export function contextPlace(
  visible: KEvent[],
  zoom: number,
  district:
    | string
    | null,
): string {
  if (district)
    return district;

  if (
    zoom >= 11 &&
    visible.length
  ) {
    const top =
      mode(
        visible.map(
          (e) =>
            e.locality,
        ),
      );

    if (
      top &&
      top.n /
        visible.length >=
        0.6
    )
      return top.k;
  }

  if (
    zoom >= 8 &&
    visible.length
  ) {
    const top =
      mode(
        visible.map(
          (e) =>
            e.district,
        ),
      );

    if (
      top &&
      top.n /
        visible.length >=
        0.8
    )
      return top.k;
  }

  return "Kerala";
}

function mode(
  xs: string[],
) {
  const m =
    new Map<
      string,
      number
    >();

  for (
    const x of xs
  ) {
    m.set(
      x,
      (m.get(x) ?? 0) + 1,
    );
  }

  let best:
    | {
        k: string;
        n: number;
      }
    | null = null;

  for (
    const [k, n] of m
  ) {
    if (
      !best ||
      n > best.n
    ) {
      best = {
        k,
        n,
      };
    }
  }

  return best;
}