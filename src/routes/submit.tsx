import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { z } from "zod";
import { ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KavuPicker } from "@/components/KavuPicker";
import { addKavu, fetchKavus, type Kavu } from "@/lib/kavus";
import { SiteHeader } from "@/components/SiteHeader";
import {
  CATEGORIES,
  DISTRICTS,
  SUBCATEGORIES,
  addEvents,
  istMs,
  shrinkImage,
  todayIST,
  uploadPoster,
  type Category,
  type NewEvent,
  type SourceType,
} from "@/lib/events";
import { districtAt } from "@/lib/geo";

const EventMap = lazy(() => import("@/components/EventMap"));

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Post a Theyyam | Theyyams of Kerala" },
      {
        name: "description",
        content:
          "Post one or more Theyyam performances at a temple or kavu. They go live straight away.",
      },
      { property: "og:title", content: "Post a Theyyam | Theyyams of Kerala" },
      { property: "og:description", content: "Put Theyyam performances on the community map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Submit,
});

/* ============================================================
   TYPES
   ============================================================ */

/** One Theyyam at the place: several of these can share a temple, on different days or times. */
type Perf = {
  key: string;
  category: Category;
  subcategory: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

type Place = {
  /** The temple, kavu or tharavad name as shown. */
  venue: string;
  /** Set when an existing kavu was chosen; null means a new kavu is added on post. */
  kavuId: string | null;
  locality: string;
  district: string;
  pos: { lat: number; lng: number } | null;
  description: string;
  poster: File | null;
  ticketUrl: string;
  instagram: string;
  website: string;
  contact: string;
  otherUrl: string;
  sourceTypes: SourceType[];
};

const newKey = () => Math.random().toString(36).slice(2, 9);

const blankPerf = (from?: Perf): Perf => ({
  key: newKey(),
  category: from?.category ?? "Goddess",
  subcategory: "",
  title: "",
  // A second Theyyam at the same place is usually on the same day, so carry the date over.
  date: from?.date ?? "",
  endDate: "",
  startTime: "",
  endTime: "",
});

const EMPTY_PLACE: Place = {
  venue: "",
  kavuId: null,
  locality: "",
  district: "",
  pos: null,
  description: "",
  poster: null,
  ticketUrl: "",
  instagram: "",
  website: "",
  contact: "",
  otherUrl: "",
  sourceTypes: [],
};

type Errs = Record<string, string>;

const sourceOptions = [
  ["official", "Temple or committee page"],
  ["social", "Social media"],
  ["organizer", "Organiser"],
  ["local", "Local knowledge"],
] as const;

const MAX_PERFORMANCES = 12;

/* ============================================================
   URL HELPERS
   ============================================================ */

function normUrl(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t.replace(/^http:/i, "https:") : `https://${t}`;
}

function normInsta(s: string): string {
  const t = s.trim().replace(/^@/, "");
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? normUrl(t) : `https://instagram.com/${t}`;
}

const urlSchema = z.string().url("Enter a valid link").max(300, "Link is too long");

/** Theyyams are often performed overnight: the end can fall on the next day. */
const HOUR = 36e5;

/* ============================================================
   TIME PICKER
   ============================================================ */

function splitTime(time: string) {
  if (!time) return { hour: "", minute: "", period: "PM" as "AM" | "PM" };
  const [h, m] = time.split(":");
  const hour24 = Number(h);
  return {
    hour: String(hour24 % 12 || 12).padStart(2, "0"),
    minute: m ?? "00",
    period: (hour24 >= 12 ? "PM" : "AM") as "AM" | "PM",
  };
}

function to24Hour(hour: string, minute: string, period: "AM" | "PM") {
  if (!hour || !minute) return "";
  let h = Number(hour);
  if (period === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${minute}`;
}

const box =
  "h-11 rounded-md border border-input bg-raised text-sm text-foreground focus-visible:border-gold";
const input = `${box} w-full px-3`;

function TimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const initial = splitTime(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.period);

  useEffect(() => {
    const next = splitTime(value);
    setHour(next.hour);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [value]);

  const commit = (h: string, m: string, p: "AM" | "PM") => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
    if (!h || !m) {
      onChange("");
      return;
    }
    const hn = Number(h);
    const mn = Number(m);
    if (!Number.isInteger(hn) || hn < 1 || hn > 12 || !Number.isInteger(mn) || mn < 0 || mn > 59)
      return;
    onChange(to24Hour(String(hn), String(mn).padStart(2, "0"), p));
  };

  const handleHour = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next === "") return commit("", minute, period);
    if (!/^\d{1,2}$/.test(next)) return;
    const n = Number(next);
    if (n < 1 || n > 12) return;
    commit(next, minute, period);
  };

  const handleMinute = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next === "") return commit(hour, "", period);
    if (!/^\d{1,2}$/.test(next)) return;
    const n = Number(next);
    if (n < 0 || n > 59) return;
    commit(hour, next, period);
  };

  const blurHour = () => {
    if (!hour) return;
    const h = Number(hour);
    if (h >= 1 && h <= 12) {
      const f = String(h).padStart(2, "0");
      setHour(f);
      if (minute) onChange(to24Hour(f, minute.padStart(2, "0"), period));
    }
  };

  const blurMinute = () => {
    if (!minute) return;
    const m = Number(minute);
    if (m >= 0 && m <= 59) {
      const f = String(m).padStart(2, "0");
      setMinute(f);
      if (hour) onChange(to24Hour(hour.padStart(2, "0"), f, period));
    }
  };

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <input
        type="number"
        aria-label={`${label}, hour`}
        min={1}
        max={12}
        step={1}
        inputMode="numeric"
        placeholder="HH"
        value={hour}
        onChange={handleHour}
        onBlur={blurHour}
        className={`${box} min-w-0 flex-1 px-1 text-center`}
      />
      <span className="shrink-0 text-lg text-muted-foreground">:</span>
      <input
        type="number"
        aria-label={`${label}, minute`}
        min={0}
        max={59}
        step={1}
        inputMode="numeric"
        placeholder="MM"
        value={minute}
        onChange={handleMinute}
        onBlur={blurMinute}
        className={`${box} min-w-0 flex-1 px-1 text-center`}
      />
      <select
        aria-label={`${label}, AM or PM`}
        value={period}
        onChange={(e) => {
          const next = e.target.value as "AM" | "PM";
          setPeriod(next);
          if (hour && minute) onChange(to24Hour(hour, minute.padStart(2, "0"), next));
        }}
        className={`${box} w-[4.5rem] shrink-0 px-2`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

/* ============================================================
   VALIDATION
   ============================================================ */

const chk = (
  e: Errs,
  key: string,
  result: { success: true } | { success: false; error: { issues: { message: string }[] } },
) => {
  if (!result.success) e[key] = result.error.issues[0]?.message ?? "Invalid value";
};

function validate(place: Place, perfs: Perf[]): Errs {
  const e: Errs = {};

  chk(
    e,
    "venue",
    z
      .string()
      .trim()
      .min(2, "Enter the temple or kavu")
      .max(150, "Too long")
      .safeParse(place.venue),
  );
  if (!place.kavuId)
    chk(
      e,
      "locality",
      z
        .string()
        .trim()
        .min(2, "Enter the town or locality")
        .max(100, "Too long")
        .safeParse(place.locality),
    );
  if (!place.kavuId) {
    if (!place.district) e["district"] = "Choose a district";
    if (!place.pos) e["pos"] = "Tap the map to place the temple or kavu";
  }

  chk(
    e,
    "description",
    z
      .string()
      .trim()
      .min(10, "Add a short description (10+ characters)")
      .max(300, "Keep it under 300 characters")
      .safeParse(place.description),
  );

  const seen = new Set<string>();

  perfs.forEach((p, i) => {
    const k = (f: string) => `p${i}.${f}`;

    chk(
      e,
      k("subcategory"),
      z
        .string()
        .trim()
        .min(2, p.category === "Other" ? "Say which form it is" : "Choose the form")
        .max(50, "Too long")
        .safeParse(p.subcategory),
    );
    chk(
      e,
      k("title"),
      z
        .string()
        .trim()
        .min(3, "Give the performance a name (3+ characters)")
        .max(100, "Keep the name under 100 characters")
        .safeParse(p.title),
    );

    if (!p.date) e[k("date")] = "Pick a date";
    else if (p.date < todayIST()) e[k("date")] = "The date can't be in the past";

    if (!p.startTime) e[k("startTime")] = "Pick a start time";

    if (p.endDate && p.endDate < p.date) e[k("endDate")] = "End date can't be before the start";

    const endDate = p.endDate || p.date;

    if (
      p.endTime &&
      p.startTime &&
      p.date &&
      istMs(endDate, p.endTime) <= istMs(p.date, p.startTime)
    ) {
      e[k("endTime")] =
        "End must be after the start. For overnight, set the end date to the next day.";
    }

    if (!e[k("date")] && !e[k("startTime")] && !e[k("endTime")] && p.date && p.startTime) {
      const end = p.endTime ? istMs(endDate, p.endTime) : istMs(p.date, p.startTime) + 3 * HOUR;
      if (end < Date.now()) e[k("startTime")] = "This performance would already be over";

      const id = `${p.subcategory.trim().toLowerCase()}|${p.date}|${p.startTime}`;
      if (seen.has(id)) e[k("startTime")] = "Same Theyyam, day and time as another one above";
      seen.add(id);
    }
  });

  const links = [
    ["ticketUrl", normUrl(place.ticketUrl)],
    ["website", normUrl(place.website)],
    ["otherUrl", normUrl(place.otherUrl)],
    ["instagram", normInsta(place.instagram)],
  ] as const;
  for (const [key, value] of links) {
    if (value) chk(e, key, urlSchema.safeParse(value));
  }
  if (place.contact.length > 100) e["contact"] = "Too long";

  if (place.poster) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(place.poster.type))
      e["poster"] = "The image must be a JPG, PNG or WebP";
    else if (place.poster.size > 10 * 1024 * 1024) e["poster"] = "The image must be under 10 MB";
  }

  return e;
}

/* ============================================================
   SMALL PARTS
   ============================================================ */

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}

const pill = (selected: boolean) =>
  `tap h-9 rounded-md border px-3 text-sm font-medium ${
    selected
      ? "border-gold bg-accent text-gold"
      : "border-border text-muted-foreground hover:border-gold-line hover:text-foreground"
  }`;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-gold">
      {children}
    </h2>
  );
}

/* ============================================================
   ONE PERFORMANCE
   ============================================================ */

function PerfCard({
  index,
  perf,
  errs,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  perf: Perf;
  errs: Errs;
  canRemove: boolean;
  onChange: (patch: Partial<Perf>) => void;
  onRemove: () => void;
}) {
  const err = (f: string) => errs[`p${index}.${f}`];
  const subs = SUBCATEGORIES[perf.category];

  /** Picking a form suggests a name, unless the visitor has already written their own. */
  function chooseForm(name: string) {
    const suggest = (n: string) => (/theyyam/i.test(n) ? n : `${n} Theyyam`);
    const wasAuto = !perf.title || (perf.subcategory && perf.title === suggest(perf.subcategory));
    const isOther = /^other /i.test(name);
    onChange({
      subcategory: name,
      title: wasAuto ? (isOther ? "" : suggest(name)) : perf.title,
    });
  }

  return (
    <fieldset className="rounded-xl border border-border bg-background/40 p-3.5 sm:p-4">
      <legend className="sr-only">Theyyam {index + 1}</legend>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.08em]">
          Theyyam {index + 1}
        </h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="tap inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 size={13} aria-hidden="true" />
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type of Theyyam">
          <select
            className={input}
            value={perf.category}
            onChange={(e) => onChange({ category: e.target.value as Category, subcategory: "" })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        {perf.category === "Other" ? (
          <Field label="Which form is it?" error={err("subcategory")}>
            <input
              className={input}
              value={perf.subcategory}
              maxLength={50}
              onChange={(e) => onChange({ subcategory: e.target.value })}
              placeholder="e.g. Thira, Kaliyattam"
            />
          </Field>
        ) : (
          <Field label="Form" error={err("subcategory")}>
            <select
              className={input}
              value={perf.subcategory}
              onChange={(e) => chooseForm(e.target.value)}
            >
              <option value="">Select a form…</option>
              {subs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="sm:col-span-2">
          <Field label="Name of the performance" error={err("title")}>
            <input
              className={input}
              value={perf.title}
              maxLength={100}
              onChange={(e) => onChange({ title: e.target.value })}
              autoComplete="off"
              placeholder="e.g. Muchilottu Bhagavathi"
            />
          </Field>
        </div>

        <Field label="Date" error={err("date")}>
          <input
            type="date"
            className={input}
            min={todayIST()}
            value={perf.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>
        <Field label="Start time" error={err("startTime")}>
          <TimePicker
            label="Start time"
            value={perf.startTime}
            onChange={(v) => onChange({ startTime: v })}
          />
        </Field>
        <Field label="End date (optional, if overnight)" error={err("endDate")}>
          <input
            type="date"
            className={input}
            min={perf.date || todayIST()}
            value={perf.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </Field>
        <Field label="End time (optional)" error={err("endTime")}>
          <TimePicker
            label="End time"
            value={perf.endTime}
            onChange={(v) => onChange({ endTime: v })}
          />
        </Field>
      </div>
    </fieldset>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

function Submit() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const kavuQuery = useQuery({ queryKey: ["kavus"], queryFn: fetchKavus, staleTime: 60_000 });
  const kavus = kavuQuery.data ?? [];
  const [place, setPlace] = useState<Place>(EMPTY_PLACE);
  const [perfs, setPerfs] = useState<Perf[]>(() => [blankPerf()]);
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const setP = (patch: Partial<Place>) => setPlace((x) => ({ ...x, ...patch }));

  const selectedKavu = place.kavuId ? (kavus.find((k) => k.id === place.kavuId) ?? null) : null;

  /** Choosing a kavu fills in its name, town, district and position from the database. */
  const chooseKavu = (k: Kavu) => {
    setP({
      venue: k.name,
      kavuId: k.id,
      locality: k.locality,
      district: k.district,
      pos: { lat: k.lat, lng: k.lng },
    });
    setErrs((x) => ({ ...x, venue: "", locality: "", district: "", pos: "" }));
  };

  /** Back to typing: the town, district and pin are free to be set again. */
  const changeKavu = () => setP({ kavuId: null, locality: "", district: "", pos: null });

  const noopPick = useCallback(() => {}, []);
  const setPerf = (key: string, patch: Partial<Perf>) =>
    setPerfs((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  useEffect(() => {
    if (!place.poster) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(place.poster);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [place.poster]);

  const onPick = useCallback((lat: number, lng: number) => {
    setPlace((x) => ({ ...x, pos: { lat, lng } }));
    void districtAt(lat, lng).then((district) => {
      if (district) {
        setPlace((x) => ({ ...x, district }));
        setErrs((x) => ({ ...x, pos: "", district: "" }));
      } else {
        // Outside Kerala: drop the pin as well, so the form can't post it.
        setPlace((x) => ({ ...x, pos: null, district: "" }));
        setErrs((x) => ({
          ...x,
          pos: "That spot is outside Kerala. Choose a place inside a district.",
        }));
      }
    });
  }, []);

  async function submit() {
    const errors = validate(place, perfs);
    setErrs(errors);

    if (Object.keys(errors).length > 0 || !place.pos) {
      setFail("Some details need fixing. Check the highlighted fields.");
      requestAnimationFrame(() =>
        document
          .querySelector('[role="alert"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      return;
    }

    setBusy(true);
    setFail("");

    try {
      // The kavu comes first: if it can't be saved, nothing else is written.
      let kavu: Kavu | undefined;
      if (place.kavuId) {
        kavu = kavus.find((k) => k.id === place.kavuId);
      } else {
        kavu = await addKavu({
          name: place.venue.trim(),
          locality: place.locality.trim(),
          district: place.district,
          lat: place.pos!.lat,
          lng: place.pos!.lng,
        });
        void queryClient.invalidateQueries({ queryKey: ["kavus"] });
      }
      if (!kavu) throw new Error("The kavu could not be found");

      const imageUrl = place.poster ? await uploadPoster(await shrinkImage(place.poster)) : null;
      const sources: SourceType[] = place.poster
        ? Array.from(new Set<SourceType>([...place.sourceTypes, "poster"]))
        : place.sourceTypes;

      const list: NewEvent[] = perfs.map((p) => {
        const slug = p.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60);
        return {
          id: `${slug || "theyyam"}-${Math.random().toString(36).slice(2, 7)}`,
          title: p.title.trim(),
          category: p.category,
          subcategory: p.subcategory.trim(),
          description: place.description.trim(),
          date: p.date,
          endDate: p.endDate || p.date,
          startTime: p.startTime,
          endTime: p.endTime || null,
          venue: kavu.name,
          kavuId: kavu.id,
          locality: kavu.locality,
          district: kavu.district,
          lat: kavu.lat,
          lng: kavu.lng,
          // Theyyam performances are open to all; the database fields stay for older rows.
          entry: "free",
          fee: null,
          registrationStart: null,
          registrationEnd: null,
          contact: place.contact.trim() || null,
          ticketUrl: normUrl(place.ticketUrl) || null,
          instagram: normInsta(place.instagram) || null,
          website: normUrl(place.website) || null,
          otherUrl: normUrl(place.otherUrl) || null,
          sourceTypes: sources,
          imageUrl,
          imageCandidates: [],
        };
      });

      // All performances are saved together in one request.
      await addEvents(list);

      const first = list[0];
      if (list.length === 1 && first) {
        await nav({ to: "/event/$id", params: { id: first.id } });
      } else {
        await nav({ to: "/", search: { q: place.venue.trim() } });
      }
    } catch (error) {
      console.error("Submission failed:", error);
      setFail(
        "We couldn't publish these performances. Check your connection and try again. Your details are still here.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />

      <main className="relative flex-1">
        {/* The portrait fills the page behind the content, under a low dark gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-full overflow-hidden lg:w-[42%]"
        >
          <picture>
            <source srcSet="/post-theyyam.webp" type="image/webp" />
            <img
              src="/post-theyyam.jpg"
              alt=""
              width={1024}
              height={1536}
              className="h-full w-full object-cover object-[30%_18%]"
            />
          </picture>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(8,11,14,0.55), rgba(8,11,14,0.3), rgba(8,11,14,0.75))",
            }}
          />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1400px] gap-6 px-3 py-5 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-8">
          {/* Right: heading and form. The left column is left open so the portrait shows. */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-2">
            <div>
              <h1 className="ke-title text-[22px] leading-tight text-primary sm:text-[28px] lg:text-[32px]">
                Post a Theyyam performance
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                Share an upcoming or ongoing Theyyam. If a temple has several Theyyams, add them all
                here with their own days and times.
              </p>
            </div>

            {/* Right: the form */}
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6"
            >
              {/* Location */}
              <section className="space-y-3">
                <SectionTitle>Location details</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <KavuPicker
                      value={place.venue}
                      onValue={(text) => setP({ venue: text, kavuId: null })}
                      kavus={kavus}
                      loading={kavuQuery.isLoading}
                      selected={selectedKavu}
                      onSelect={chooseKavu}
                      onChange={changeKavu}
                      error={errs["venue"]}
                    />
                  </div>
                  <Field label="Town or locality" error={errs["locality"]}>
                    <input
                      className={input}
                      value={place.locality}
                      maxLength={100}
                      readOnly={!!place.kavuId}
                      onChange={(e) => setP({ locality: e.target.value })}
                      placeholder="e.g. Payyanur"
                    />
                  </Field>
                  <Field label="District" error={errs["district"]}>
                    <select
                      className={input}
                      value={place.district}
                      disabled={!!place.kavuId}
                      onChange={(e) => setP({ district: e.target.value })}
                    >
                      <option value="">Select district</option>
                      {DISTRICTS.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">Exact position</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {place.kavuId
                      ? "Position of the chosen kavu."
                      : place.pos
                        ? `Pinned at ${place.pos.lat.toFixed(4)}, ${place.pos.lng.toFixed(4)}. Drag the pin to adjust.`
                        : "Search for the place or tap the map to drop a pin."}
                  </p>
                  <div className="h-64 overflow-hidden rounded-xl border border-gold-line bg-raised sm:h-72">
                    <ClientOnly fallback={<div className="h-full bg-raised" />}>
                      <Suspense fallback={<div className="h-full bg-raised" />}>
                        <EventMap
                          events={[]}
                          pick={place.pos}
                          onPick={place.kavuId ? noopPick : onPick}
                          onLocate={place.kavuId ? noopPick : onPick}
                        />
                      </Suspense>
                    </ClientOnly>
                  </div>
                  {errs["pos"] && (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {errs["pos"]}
                    </p>
                  )}
                </div>
              </section>

              {/* Performances */}
              <section className="space-y-3">
                <SectionTitle>
                  {perfs.length === 1 ? "Performance details" : `Performances (${perfs.length})`}
                </SectionTitle>
                <p className="text-xs text-muted-foreground">
                  Times are Kerala time (IST). Theyyams often run overnight: set the end date to the
                  next day.
                </p>

                {perfs.map((p, i) => (
                  <PerfCard
                    key={p.key}
                    index={i}
                    perf={p}
                    errs={errs}
                    canRemove={perfs.length > 1}
                    onChange={(patch) => setPerf(p.key, patch)}
                    onRemove={() => setPerfs((list) => list.filter((x) => x.key !== p.key))}
                  />
                ))}

                {perfs.length < MAX_PERFORMANCES && (
                  <button
                    type="button"
                    onClick={() => setPerfs((list) => [...list, blankPerf(list[list.length - 1])])}
                    className="tap inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-gold-line text-sm font-semibold text-gold hover:border-gold hover:bg-accent"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add another Theyyam at this place
                  </button>
                )}
              </section>

              {/* Description and image */}
              <section className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Description"
                  error={errs["description"]}
                  hint={`${place.description.length}/300. The festival, the order of performances, or anything a visitor should know.`}
                >
                  <textarea
                    className={`${box.replace("h-11", "h-36")} w-full resize-none px-3 py-2`}
                    value={place.description}
                    maxLength={300}
                    onChange={(e) => setP({ description: e.target.value })}
                    placeholder="Brief details about the performance…"
                  />
                </Field>

                <Field
                  label="Upload image (optional)"
                  error={errs["poster"]}
                  hint="JPG, PNG or WebP, up to 10 MB. Used for every performance above."
                >
                  <span className="relative flex h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-dashed border-input bg-background text-center text-xs text-muted-foreground hover:border-gold">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Selected"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <Upload size={22} className="text-gold" aria-hidden="true" />
                        <span className="px-3">Click to upload or drag and drop</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(e) => setP({ poster: e.target.files?.[0] ?? null })}
                    />
                  </span>
                  {place.poster && (
                    <button
                      type="button"
                      onClick={() => setP({ poster: null })}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                    >
                      <ImagePlus size={12} aria-hidden="true" />
                      Remove {place.poster.name}
                    </button>
                  )}
                </Field>
              </section>

              {/* Optional extras */}
              <details className="group rounded-xl border border-border">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
                  More information{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </summary>
                <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
                  <Field label="Temple or committee page" error={errs["website"]}>
                    <input
                      className={input}
                      inputMode="url"
                      value={place.website}
                      onChange={(e) => setP({ website: e.target.value })}
                      placeholder="https://"
                    />
                  </Field>
                  <Field label="Instagram" error={errs["instagram"]}>
                    <input
                      className={input}
                      value={place.instagram}
                      onChange={(e) => setP({ instagram: e.target.value })}
                      placeholder="@handle or link"
                    />
                  </Field>
                  <Field label="Event or notice link" error={errs["ticketUrl"]}>
                    <input
                      className={input}
                      inputMode="url"
                      value={place.ticketUrl}
                      onChange={(e) => setP({ ticketUrl: e.target.value })}
                      placeholder="https://"
                    />
                  </Field>
                  <Field label="Other useful link" error={errs["otherUrl"]}>
                    <input
                      className={input}
                      inputMode="url"
                      value={place.otherUrl}
                      onChange={(e) => setP({ otherUrl: e.target.value })}
                      placeholder="https://"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label="Contact"
                      error={errs["contact"]}
                      hint="Shown publicly. A temple committee number is ideal."
                    >
                      <input
                        className={input}
                        value={place.contact}
                        maxLength={100}
                        onChange={(e) => setP({ contact: e.target.value })}
                        placeholder="Phone or email"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium">Where did you hear about it?</p>
                    <div className="flex flex-wrap gap-2">
                      {sourceOptions.map(([key, label]) => {
                        const selected = place.sourceTypes.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setP({
                                sourceTypes: selected
                                  ? place.sourceTypes.filter((s) => s !== key)
                                  : [...place.sourceTypes, key],
                              })
                            }
                            className={pill(selected)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </details>

              {fail && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {fail}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <Link
                  to="/"
                  className="tap inline-flex h-11 items-center rounded-md border border-border px-5 text-sm font-semibold hover:bg-accent"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={busy}
                  className="tap h-11 rounded-md bg-gold px-6 text-sm font-bold text-background hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Posting…" : "POST"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
