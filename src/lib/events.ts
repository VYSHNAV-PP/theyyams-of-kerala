import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { asCategory, formByName, type Category } from "./taxonomy";
import { haversineKm } from "./geo";

export {
  CATEGORIES,
  CATEGORY_META,
  SUBCATEGORIES,
  REPORT_REASONS,
  FORMS,
  formByName,
  type Category,
} from "./taxonomy";

export { DISTRICTS } from "./geo";

/* ============================================================
   TYPES
   ============================================================ */

/** Theyyam performances are normally open to all; the field is kept so older rows still load. */
export type EntryStatus = "free" | "registration" | "ticket";

export type SourceType = "official" | "social" | "poster" | "organizer" | "local";

export type Status = "upcoming" | "now" | "ended";

/** Status plus "tonight", used for map colours, list labels and tabs. */
export type Phase = "now" | "tonight" | "upcoming" | "ended";

export const CONFIRMED_MIN = 10;

const HOUR = 36e5;
const DAY = 864e5;

/** Kerala is on IST all year (UTC+5:30, no daylight saving). All "day" maths happens in IST. */
const IST_OFFSET = 5.5 * HOUR;

export const ENDED_GRACE_DAYS = 2;

type Row = Database["public"]["Tables"]["events"]["Row"];

export type KEvent = {
  id: string;
  title: string;
  /** Family, e.g. "Goddess". */
  category: Category;
  /** Named form, e.g. "Muchilottu Bhagavathi". */
  subcategory: string;
  description: string;

  date: string;
  endDate: string;
  startTime: string;
  endTime: string | null;

  startMs: number;
  endMs: number;

  /** Temple, kavu or tharavad. */
  venue: string;
  locality: string;
  district: string;

  lat: number;
  lng: number;

  /** The kavu this performance is held at, when it was posted against one. */
  kavuId: string | null;

  entry: EntryStatus;
  fee: string | null;

  registrationStart: string | null;
  registrationEnd: string | null;

  sourceTypes: SourceType[];

  contact: string | null;

  ticketUrl: string | null;
  instagram: string | null;
  website: string | null;
  otherUrl: string | null;

  /** Primary image: an uploaded poster, or the best automatically found candidate. */
  imageUrl: string | null;

  /** Automatically discovered images, best first. */
  imageCandidates: string[];

  upvotes: number;
  downvotes: number;
  reports: number;

  /** Lower-cased, spelling-normalised text used by search. */
  hay: string;
};

/* ============================================================
   IST DATE HELPERS
   ============================================================ */

export const istDayStart = (ms: number) => Math.floor((ms + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
export const istDateStr = (ms: number) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10);
export const istDow = (ms: number) => new Date(ms + IST_OFFSET).getUTCDay();
const istHour = (ms: number) => new Date(ms + IST_OFFSET).getUTCHours();

/** Midnight (IST) at the start of a YYYY-MM-DD date. */
export const dayStartOf = (isoDate: string) => Date.parse(`${isoDate}T00:00:00+05:30`);

/** Today's date in Kerala as YYYY-MM-DD. */
export const todayIST = (now = Date.now()) => istDateStr(now);

/** Epoch ms for a date + HH:MM entered in Kerala time. */
export const istMs = (date: string, time: string) => Date.parse(`${date}T${time}:00+05:30`);

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

/** All public feedback for one performance (event_feedback has a public SELECT policy). */
export async function fetchEventFeedback(eventId: string): Promise<EventFeedback[]> {
  // The generated Supabase types may not list event_feedback yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data, error } = await client
    .from("event_feedback")
    .select("id,event_id,type,reason,note,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw error;

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
   SEARCH TEXT
   ============================================================ */

/**
 * Theyyam names are written many ways (Vishnumurthi / Vishnumoorthi, Bhagavathi / Bhagavati…).
 * Both the searchable text and the query go through this so spellings match each other.
 */
export function normSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/theyy?[ua]m|teyyam|thiyyam|theyyum/g, "theyyam")
    .replace(/m[uo]{1,2}r(?:th|t)[iy]/g, "moorthi")
    .replace(/bhag[ao]?[vw][ae]?(?:th|t)[iy]/g, "bhagavathi")
    .replace(/chamund[iye]/g, "chamundi")
    .replace(/kaliyaa?ttam/g, "kaliyattam")
    .replace(/\bkaa?v+u?\b/g, "kavu")
    .replace(/\bgulika\b/g, "gulikan");
}

/* ============================================================
   EVENT DATA
   ============================================================ */

const COLS =
  "id,title,category,subcategory,description,date,end_date,start_time,end_time,starts_at,ends_at,venue,locality,district,lat,lng,kavu_id,entry_status,entry_fee,registration_start,registration_end,contact,ticket_url,instagram,website,other_url,source_types,image_url,image_candidates,upvotes,downvotes,reports";

type DbEvent = Omit<Row, "time" | "link" | "created_at" | "status" | "verification_status">;

function cleanUrls(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim()),
    ),
  );
}

/** Convert a database row into the application shape. */
function toEvent(r: DbEvent): KEvent {
  const category = asCategory(r.category);

  // Older rows may have NULL / missing image_candidates.
  const imageCandidates = cleanUrls([
    ...(Array.isArray(r.image_candidates) ? (r.image_candidates as unknown[]) : []),
    r.image_url,
  ]);

  const rawEntry = String(r.entry_status ?? "");
  const entry: EntryStatus =
    rawEntry === "registration"
      ? "registration"
      : rawEntry === "ticket" || rawEntry === "paid"
        ? "ticket"
        : "free";

  const rawSources: unknown[] = Array.isArray(r.source_types) ? r.source_types : [];
  const sourceTypes = rawSources.filter(
    (v): v is SourceType =>
      v === "official" || v === "social" || v === "poster" || v === "organizer" || v === "local",
  );

  const form = formByName(r.subcategory);

  return {
    id: r.id,
    title: r.title,
    category,
    subcategory: r.subcategory,
    description: r.description,

    date: r.date,
    endDate: r.end_date ?? r.date,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time?.slice(0, 5) ?? null,

    startMs: Date.parse(r.starts_at),
    endMs: Date.parse(r.ends_at),

    venue: r.venue,
    locality: r.locality,
    district: r.district,

    lat: r.lat,
    lng: r.lng,
    kavuId: r.kavu_id,

    entry,
    fee: r.entry_fee,

    registrationStart: r.registration_start ?? null,
    registrationEnd: r.registration_end ?? null,

    sourceTypes,

    contact: r.contact,

    ticketUrl: r.ticket_url,
    instagram: r.instagram,
    website: r.website,
    otherUrl: r.other_url,

    imageUrl: r.image_url,
    imageCandidates,

    upvotes: r.upvotes,
    downvotes: r.downvotes,
    reports: r.reports,

    hay: normSearch(
      [
        r.title,
        r.description,
        r.venue,
        r.locality,
        r.district,
        category,
        r.subcategory,
        form?.ml ?? "",
      ].join(" "),
    ),
  };
}

/* ============================================================
   FETCH
   ============================================================ */

export async function fetchEvents(): Promise<KEvent[]> {
  const since = new Date(Date.now() - ENDED_GRACE_DAYS * DAY).toISOString();

  const { data, error } = await supabase
    .from("events")
    .select(COLS)
    .gt("ends_at", since)
    .order("starts_at")
    .limit(2000);

  if (error) throw error;

  return ((data ?? []) as unknown as DbEvent[]).map(toEvent);
}

export async function fetchEvent(id: string): Promise<KEvent | null> {
  const { data, error } = await supabase.from("events").select(COLS).eq("id", id).maybeSingle();

  if (error) throw error;

  return data ? toEvent(data as unknown as DbEvent) : null;
}

/* ============================================================
   ADD
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
  | "kavuId"
  | "entry"
  | "fee"
  | "registrationStart"
  | "registrationEnd"
  | "sourceTypes"
  | "contact"
  | "ticketUrl"
  | "instagram"
  | "website"
  | "otherUrl"
  | "imageUrl"
  | "imageCandidates"
>;

function toRow(e: NewEvent) {
  return {
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
    kavu_id: e.kavuId,
    entry_status: e.entry,
    entry_fee: e.fee,
    registration_start: e.registrationStart,
    registration_end: e.registrationEnd,
    contact: e.contact,
    ticket_url: e.ticketUrl,
    instagram: e.instagram,
    website: e.website,
    other_url: e.otherUrl,
    source_types: e.sourceTypes,
    image_url: e.imageUrl,
    image_candidates: e.imageCandidates,
  };
}

/**
 * Add several performances (for example different Theyyams at one temple, at different times)
 * in a single request. Postgres runs one INSERT as one statement, so either all of them are
 * saved or none are.
 */
export async function addEvents(list: NewEvent[]) {
  if (list.length === 0) return;
  const { error } = await supabase.from("events").insert(list.map(toRow) as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (error) throw error;
}

export const addEvent = (e: NewEvent) => addEvents([e]);

/* ============================================================
   AUTOMATIC IMAGE
   ============================================================ */

/** Ask the `search-event-image` Edge Function for ranked image URLs. */
export async function findEventImage(
  e: Pick<NewEvent, "title" | "category" | "subcategory" | "venue" | "locality" | "district">,
): Promise<{ imageUrl: string | null; imageCandidates: string[] }> {
  try {
    const { data, error } = await supabase.functions.invoke("search-event-image", {
      body: {
        title: e.title,
        category: e.category,
        subcategory: e.subcategory,
        venue: e.venue,
        locality: e.locality,
        district: e.district,
      },
    });

    if (error) {
      console.warn("Automatic image search failed:", error);
      return { imageUrl: null, imageCandidates: [] };
    }

    const imageCandidates = cleanUrls([
      ...(Array.isArray(data?.imageUrls) ? (data.imageUrls as unknown[]) : []),
      data?.imageUrl,
    ]);

    return { imageUrl: imageCandidates[0] ?? null, imageCandidates };
  } catch (error) {
    console.warn("Automatic image search failed:", error);
    return { imageUrl: null, imageCandidates: [] };
  }
}

/* ============================================================
   POSTER
   ============================================================ */

export async function uploadPoster(blob: Blob): Promise<string> {
  const path = `${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from("event-posters")
    .upload(path, blob, { contentType: "image/jpeg" });

  if (error) throw error;

  return supabase.storage.from("event-posters").getPublicUrl(path).data.publicUrl;
}

/** Downscale to max 1200px JPEG. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));

  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);

  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("image"))), "image/jpeg", 0.82),
  );
}

/* ============================================================
   LOCAL STORAGE (private mode safe)
   ============================================================ */

const memory = new Map<string, string>();

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function lsRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
}

function voterId(): string {
  let v = lsGet("ke-voter");
  if (!v) {
    v = crypto.randomUUID();
    lsSet("ke-voter", v);
  }
  return v;
}

/* ============================================================
   VOTES
   ============================================================ */

export type LocalVote = "up" | "down";

const VOTE_KEY_PREFIX = "ke-vote-";

export function getLocalVote(id: string): LocalVote | null {
  const current = lsGet(VOTE_KEY_PREFIX + id);
  if (current === "up" || current === "down") return current;
  // Keys written by earlier versions.
  if (lsGet("ke-confirmed-" + id) === "1") return "up";
  if (lsGet("ke-downvoted-" + id) === "1") return "down";
  return null;
}

function setLocalVote(id: string, vote: LocalVote) {
  lsSet(VOTE_KEY_PREFIX + id, vote);
  lsRemove("ke-confirmed-" + id);
  lsRemove("ke-downvoted-" + id);
}

export const confirmText = (n: number) =>
  `${n} ${n === 1 ? "person" : "people"} confirmed this performance`;

export const hasConfirmed = (id: string) => getLocalVote(id) === "up";
export const hasDownvoted = (id: string) => getLocalVote(id) === "down";
export const hasVoted = (id: string) => getLocalVote(id) !== null;

export async function confirmEvent(id: string) {
  if (getLocalVote(id)) throw new Error("You have already voted on this performance.");

  const { error } = await supabase.rpc("vote_event", {
    _event_id: id,
    _voter_id: voterId(),
    _kind: "up",
  });

  if (error) throw error;

  setLocalVote(id, "up");
}

export const DOWNVOTE_REASONS = [
  { value: "cancelled", label: "It has been cancelled" },
  { value: "wrong_datetime", label: "The date or time is wrong" },
  { value: "wrong_location", label: "The temple or location is wrong" },
  { value: "incorrect_info", label: "The information is incorrect" },
  { value: "duplicate", label: "It is a duplicate listing" },
  { value: "ended", label: "It has already ended" },
  { value: "not_happening", label: "It is not happening" },
  { value: "other", label: "Something else" },
] as const;

export type DownvoteReason = (typeof DOWNVOTE_REASONS)[number]["value"];

export async function downvoteEvent(id: string, reason: DownvoteReason, note = "") {
  if (getLocalVote(id)) throw new Error("You have already voted on this performance.");

  const voter = voterId();

  const { error: voteError } = await supabase.rpc("vote_event", {
    _event_id: id,
    _voter_id: voter,
    _kind: "down",
  });
  if (voteError) throw voteError;

  const { error: feedbackError } = await supabase.rpc("submit_downvote", {
    _event_id: id,
    _author_id: voter,
    _reason: reason,
    _note: note.trim() || null,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (feedbackError) throw feedbackError;

  setLocalVote(id, "down");
}

/* ============================================================
   REPORT
   ============================================================ */

export async function reportEvent(id: string, reason: string, note: string) {
  const { error } = await supabase.rpc("report_event", {
    _event_id: id,
    _reporter_id: voterId(),
    _reason: reason,
    ...(note.trim() ? { _note: note.trim() } : {}),
  });

  if (error) throw error;

  lsSet("ke-reported-" + id, "1");
}

export const hasReported = (id: string) => lsGet("ke-reported-" + id) === "1";

/* ============================================================
   LIFECYCLE
   ============================================================ */

export function statusOf(e: KEvent, now = Date.now()): Status {
  return now < e.startMs ? "upcoming" : now <= e.endMs ? "now" : "ended";
}

export const STATUS_LABEL: Record<Status, string> = {
  upcoming: "Upcoming",
  now: "Performing now",
  ended: "Ended",
};

export const isFlagged = (e: KEvent) => e.reports >= 3;

/**
 * "Tonight" is the stretch of night that Theyyams are usually performed in:
 * 5 PM until 6 AM. Between midnight and 6 AM we are still inside last night's window.
 */
export function tonightWindow(now: number): [number, number] {
  const day = istDayStart(now);
  const start = istHour(now) < 6 ? day - DAY + 17 * HOUR : day + 17 * HOUR;
  return [start, start + 13 * HOUR];
}

export function phaseOf(e: KEvent, now = Date.now()): Phase {
  const s = statusOf(e, now);
  if (s !== "upcoming") return s;
  const [a, b] = tonightWindow(now);
  return e.startMs < b && e.endMs > a ? "tonight" : "upcoming";
}

/** One source of truth for phase colours (map pins, calendar dots, badges). */
export const PHASE_META: Record<Phase, { label: string; hex: string }> = {
  now: { label: "Performing now", hex: "#e5533d" },
  tonight: { label: "Tonight", hex: "#d9893f" },
  upcoming: { label: "Upcoming", hex: "#d4ad6b" },
  ended: { label: "Ended", hex: "#6b747e" },
};

/* ============================================================
   FORMATTING
   ============================================================ */

export function fmtTime(t: string) {
  const [h = "0", m = "00"] = t.split(":");
  const hh = Number(h);
  return `${hh % 12 || 12}:${m} ${hh < 12 ? "AM" : "PM"}`;
}

const dfmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dshort = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const fmtDate = (iso: string) => dfmt.format(new Date(iso + "T00:00:00Z"));
export const fmtDateShort = (iso: string) => dshort.format(new Date(iso + "T00:00:00Z"));

/**
 * Theyyams usually run through the night, so an end time "tomorrow" in the early morning is
 * the same performance, not a multi-day event.
 */
function isOvernight(e: Pick<KEvent, "date" | "endDate" | "endTime">): boolean {
  if (e.endDate === e.date) return false;
  const next = istDateStr(dayStartOf(e.date) + DAY + 12 * HOUR);
  return e.endDate === next && !!e.endTime && e.endTime <= "12:00";
}

export function fmtWhen(e: KEvent) {
  const times = `${fmtTime(e.startTime)}${e.endTime ? ` – ${fmtTime(e.endTime)}` : ""}`;
  if (e.endDate === e.date) return `${fmtDate(e.date)} · ${times}`;
  if (isOvernight(e)) return `${fmtDate(e.date)} · ${times} (next morning)`;
  return `${fmtDate(e.date)} – ${fmtDate(e.endDate)} · ${times}`;
}

/** Short list label: "Tonight · 8:30 PM", "Tomorrow · 7:30 PM", "8 Oct · 9:00 PM". */
export function whenShort(e: KEvent, now = Date.now()): string {
  const today = istDateStr(now);
  const tomorrow = istDateStr(now + DAY);
  const hour = Number(e.startTime.slice(0, 2));
  let day: string;
  if (e.date === today) day = hour >= 17 ? "Tonight" : "Today";
  else if (e.date === tomorrow) day = "Tomorrow";
  else day = fmtDateShort(e.date);
  const span = e.endDate !== e.date && !isOvernight(e) ? ` – ${fmtDateShort(e.endDate)}` : "";
  return `${day}${span} · ${fmtTime(e.startTime)}`;
}

/* ============================================================
   FILTERING
   ============================================================ */

export type DateKey =
  | "any"
  | "now"
  | "today"
  | "tonight"
  | "tomorrow"
  | "weekend"
  | "week"
  | "month"
  | "upcoming"
  | "custom";

export type Filters = {
  q: string;
  category: Category | "All";
  subcategory: string | null;
  date: DateKey;
  from: string;
  to: string;
  district: string | null;
  locality: string;
  nearby: boolean;
  confirmed: boolean;
  /** Only performances the visitor has bookmarked on this device. */
  savedOnly: boolean;
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
  confirmed: false,
  savedOnly: false,
};

export const NEARBY_KM = 25;

export function dateRange(key: DateKey, now: number, from = "", to = ""): [number, number] | null {
  const t = istDayStart(now);

  switch (key) {
    case "today":
      return [t, t + DAY - 1];
    case "tonight":
      return tonightWindow(now);
    case "tomorrow":
      return [t + DAY, t + 2 * DAY - 1];
    case "week":
      return [t, t + 7 * DAY - 1];
    case "month": {
      const [y = 1970, m = 1] = istDateStr(now).split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return [t, dayStartOf(next) - 1];
    }
    case "weekend": {
      const dow = istDow(now);
      const sat = dow === 0 ? t - DAY : t + ((6 - dow + 7) % 7) * DAY;
      return [sat, sat + 2 * DAY - 1];
    }
    case "custom": {
      const a = from ? dayStartOf(from) : t;
      const b = to ? dayStartOf(to) + DAY - 1 : Number.MAX_SAFE_INTEGER;
      return [a, b];
    }
    default:
      return null;
  }
}

const STOP = new Set([
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
  "performance",
  "performances",
  "theyyam",
]);

const SYN: Record<string, string> = {
  gulika: "gulikan",
};

/* ============================================================
   QUERY PARSER
   ============================================================ */

export function parseQuery(q: string): { tokens: string[]; date: DateKey | null } {
  let s = " " + normSearch(q).replace(/[^a-z0-9\p{Script=Malayalam}\s]/gu, " ") + " ";

  let date: DateKey | null = null;

  const rules: [RegExp, DateKey][] = [
    [/ this weekend | weekend /, "weekend"],
    [/ tomorrow /, "tomorrow"],
    [/ tonight /, "tonight"],
    [/ today /, "today"],
    [/ this week /, "week"],
    [/ this month /, "month"],
    [/ (happening )?now /, "now"],
    [/ upcoming /, "upcoming"],
  ];

  for (const [re, k] of rules) {
    if (re.test(s)) {
      date = k;
      s = s.replace(re, " ");
    }
  }

  const tokens = s
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => SYN[t] ?? (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));

  return { tokens, date };
}

/* ============================================================
   DATE MATCHING
   ============================================================ */

export function matchesDate(e: KEvent, key: DateKey, now: number, from = "", to = "") {
  if (key === "any") return true;
  if (key === "now") return statusOf(e, now) === "now";
  if (key === "upcoming") return statusOf(e, now) === "upcoming";

  const r = dateRange(key, now, from, to);
  return !r || (e.startMs <= r[1] && e.endMs >= r[0]);
}

/* ============================================================
   TABS (Now / Tonight / Upcoming / Ended)
   ============================================================ */

export type Tab = "now" | "tonight" | "upcoming" | "ended" | "all";

export function inTab(e: KEvent, tab: Tab, now: number): boolean {
  const p = phaseOf(e, now);
  switch (tab) {
    case "now":
      return p === "now";
    case "tonight":
      return p === "now" || p === "tonight";
    case "upcoming":
      return p === "tonight" || p === "upcoming";
    case "ended":
      return p === "ended";
    case "all":
      return p !== "ended";
  }
}

/* ============================================================
   APPLY FILTERS
   ============================================================ */

export function applyFilters(
  events: KEvent[],
  f: Filters,
  now: number,
  user: [number, number] | null,
  savedIds: ReadonlySet<string> | null = null,
): KEvent[] {
  const pq = parseQuery(f.q);
  const loc = f.locality.trim().toLowerCase();

  const out = events.filter((e) => {
    if (isFlagged(e)) return false;
    if (f.category !== "All" && e.category !== f.category) return false;
    if (f.subcategory && e.subcategory !== f.subcategory) return false;
    if (f.district && e.district !== f.district) return false;
    if (loc && !e.locality.toLowerCase().includes(loc)) return false;
    if (f.nearby && user && haversineKm(user, [e.lat, e.lng]) > NEARBY_KM) return false;
    if (f.confirmed && e.upvotes < CONFIRMED_MIN) return false;
    if (f.savedOnly && !savedIds?.has(e.id)) return false;
    if (!matchesDate(e, f.date, now, f.from, f.to)) return false;
    if (pq.date && !matchesDate(e, pq.date, now)) return false;
    return pq.tokens.every((t) => e.hay.includes(t));
  });

  const rank = (e: KEvent) => {
    const s = statusOf(e, now);
    return s === "now" ? 0 : s === "upcoming" ? 1 : 2;
  };

  return out.sort((a, b) => rank(a) - rank(b) || a.startMs - b.startMs);
}

/* ============================================================
   CONTEXT PLACE
   ============================================================ */

/** Wording for "Kerala · 24 performances" depending on what the map is showing. */
export function contextPlace(visible: KEvent[], zoom: number, district: string | null): string {
  if (district) return district;

  if (zoom >= 11 && visible.length) {
    const top = mode(visible.map((e) => e.locality));
    if (top && top.n / visible.length >= 0.6) return top.k;
  }

  if (zoom >= 8 && visible.length) {
    const top = mode(visible.map((e) => e.district));
    if (top && top.n / visible.length >= 0.8) return top.k;
  }

  return "Kerala";
}

function mode(xs: string[]) {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);

  let best: { k: string; n: number } | null = null;
  for (const [k, n] of m) {
    if (!best || n > best.n) best = { k, n };
  }
  return best;
}

/* ============================================================
   CALENDAR FILE (.ics)
   ============================================================ */

const icsStamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const icsText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** An iCalendar file so a performance can be added to any calendar app. */
export function icsFor(e: KEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Theyyams of Kerala//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@theyyams-of-kerala`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(e.startMs)}`,
    `DTEND:${icsStamp(e.endMs)}`,
    `SUMMARY:${icsText(e.title)}`,
    `LOCATION:${icsText(`${e.venue}, ${e.locality}, ${e.district}, Kerala`)}`,
    `GEO:${e.lat};${e.lng}`,
    `DESCRIPTION:${icsText(e.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
