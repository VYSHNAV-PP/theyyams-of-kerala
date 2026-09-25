import {
  createFileRoute,
  useNavigate,
  ClientOnly,
} from "@tanstack/react-router";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import { z } from "zod";

import { ImagePlus } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";

import { CategoryBadge } from "@/components/EventViews";

import {
  CATEGORIES,
  CATEGORY_META,
  DISTRICTS,
  SUBCATEGORIES,
  addEvent,
  findEventImage,
  fmtDate,
  fmtTime,
  shrinkImage,
  uploadPoster,
  type Category,
  type EntryStatus,
  type NewEvent,
} from "@/lib/events";

import { districtAt } from "@/lib/geo";

const EventMap = lazy(() => import("@/components/EventMap"));

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Post an event — Kerala Events" },
      {
        name: "description",
        content:
          "Add your event to the Kerala Events map in a few steps.",
      },
      {
        property: "og:title",
        content: "Post an event — Kerala Events",
      },
      {
        property: "og:description",
        content: "Put your Kerala event on the community map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Submit,
});

type Draft = {
  title: string;
  category: Category;
  subcategory: string;
  description: string;
  poster: File | null;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  locality: string;
  district: string;
  pos: { lat: number; lng: number } | null;
  entry: EntryStatus;
  fee: string;
  ticketUrl: string;
  instagram: string;
  website: string;
  contact: string;
  otherUrl: string;
};

const EMPTY: Draft = {
  title: "",
  category: "Sports",
  subcategory: "",
  description: "",
  poster: null,
  date: "",
  endDate: "",
  startTime: "",
  endTime: "",
  venue: "",
  locality: "",
  district: "",
  pos: null,
  entry: "free",
  fee: "",
  ticketUrl: "",
  instagram: "",
  website: "",
  contact: "",
  otherUrl: "",
};

type Errs = Record<string, string>;

const STEPS = [
  "Event details",
  "Date & location",
  "Additional information",
  "Review & submit",
];

function normUrl(s: string): string {
  const t = s.trim();

  return !t
    ? ""
    : /^https?:\/\//i.test(t)
      ? t.replace(/^http:/i, "https:")
      : "https://" + t;
}

function normInsta(s: string): string {
  const t = s.trim().replace(/^@/, "");

  return !t
    ? ""
    : /^https?:\/\//i.test(t)
      ? normUrl(t)
      : `https://instagram.com/${t}`;
}

const urlSchema = z
  .string()
  .url("Enter a valid link")
  .max(300, "Link is too long");

const today = () => {
  const d = new Date();

  return new Date(
    d.getTime() - d.getTimezoneOffset() * 6e4,
  )
    .toISOString()
    .slice(0, 10);
};

const msOf = (date: string, time: string) =>
  new Date(`${date}T${time}`).getTime();

/* ============================================================
   12-HOUR TIME PICKER
   ============================================================ */

function splitTime(time: string) {
  if (!time) {
    return {
      hour: "",
      minute: "",
      period: "AM" as "AM" | "PM",
    };
  }

  const [h, m] = time.split(":");
  const hour24 = Number(h);

  const period: "AM" | "PM" =
    hour24 >= 12 ? "PM" : "AM";

  const hour12 = hour24 % 12 || 12;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute: m ?? "00",
    period,
  };
}

function to24Hour(
  hour: string,
  minute: string,
  period: "AM" | "PM",
) {
  if (!hour || !minute) return "";

  let h = Number(hour);

  if (period === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }

  return `${String(h).padStart(2, "0")}:${minute}`;
}

function TimePicker({
  value,
  onChange,
  optional = false,
}: {
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const initial = splitTime(value);

  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(
    initial.minute,
  );
  const [period, setPeriod] = useState<
    "AM" | "PM"
  >(initial.period);

  useEffect(() => {
    const next = splitTime(value);

    setHour(next.hour);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [value]);

  const commit = (
    nextHour: string,
    nextMinute: string,
    nextPeriod: "AM" | "PM",
  ) => {
    setHour(nextHour);
    setMinute(nextMinute);
    setPeriod(nextPeriod);

    if (!nextHour || !nextMinute) {
      onChange("");
      return;
    }

    const h = Number(nextHour);
    const m = Number(nextMinute);

    if (
      !Number.isInteger(h) ||
      h < 1 ||
      h > 12 ||
      !Number.isInteger(m) ||
      m < 0 ||
      m > 59
    ) {
      return;
    }

    onChange(
      to24Hour(
        String(h),
        String(m).padStart(2, "0"),
        nextPeriod,
      ),
    );
  };

  const handleHourChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    let next = e.target.value;

    // Allow empty while editing.
    if (next === "") {
      commit("", minute, period);
      return;
    }

    // Numbers only.
    if (!/^\d{1,2}$/.test(next)) return;

    const n = Number(next);

    if (n < 1 || n > 12) return;

    commit(next, minute, period);
  };

  const handleMinuteChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    let next = e.target.value;

    // Allow empty while editing.
    if (next === "") {
      commit(hour, "", period);
      return;
    }

    // Numbers only.
    if (!/^\d{1,2}$/.test(next)) return;

    const n = Number(next);

    if (n < 0 || n > 59) return;

    commit(hour, next, period);
  };

  const handleHourBlur = () => {
    if (!hour) return;

    const h = Number(hour);

    if (h >= 1 && h <= 12) {
      const formatted = String(h).padStart(
        2,
        "0",
      );

      setHour(formatted);

      if (minute) {
        onChange(
          to24Hour(
            formatted,
            minute.padStart(2, "0"),
            period,
          ),
        );
      }
    }
  };

  const handleMinuteBlur = () => {
    if (!minute) return;

    const m = Number(minute);

    if (m >= 0 && m <= 59) {
      const formatted = String(m).padStart(
        2,
        "0",
      );

      setMinute(formatted);

      if (hour) {
        onChange(
          to24Hour(
            hour.padStart(2, "0"),
            formatted,
            period,
          ),
        );
      }
    }
  };

  const handlePeriodChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next =
      e.target.value as "AM" | "PM";

    setPeriod(next);

    if (hour && minute) {
      onChange(
        to24Hour(
          hour,
          minute.padStart(2, "0"),
          next,
        ),
      );
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        aria-label="Hour"
        min={1}
        max={12}
        step={1}
        inputMode="numeric"
        placeholder={optional ? "Hour" : "HH"}
        value={hour}
        onChange={handleHourChange}
        onBlur={handleHourBlur}
        className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-center text-sm focus-visible:outline-2 focus-visible:outline-ring"
      />

      <span className="shrink-0 text-lg">
        :
      </span>

      <input
        type="number"
        aria-label="Minute"
        min={0}
        max={59}
        step={1}
        inputMode="numeric"
        placeholder={optional ? "Min" : "MM"}
        value={minute}
        onChange={handleMinuteChange}
        onBlur={handleMinuteBlur}
        className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-center text-sm focus-visible:outline-2 focus-visible:outline-ring"
      />

      <select
        aria-label="AM or PM"
        value={period}
        onChange={handlePeriodChange}
        className="h-11 w-20 shrink-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
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

function validate(
  step: number,
  d: Draft,
): Errs {
  const e: Errs = {};

  const chk = (
    key: string,
    r:
      | { success: true }
      | {
          success: false;
          error: {
            issues: {
              message: string;
            }[];
          };
        },
  ) => {
    if (!r.success) {
      e[key] =
        r.error.issues[0]?.message ??
        "Invalid value";
    }
  };

  if (step === 0) {
    chk(
      "title",
      z
        .string()
        .trim()
        .min(
          3,
          "Give the event a name (3+ characters)",
        )
        .max(
          100,
          "Keep the name under 100 characters",
        )
        .safeParse(d.title),
    );

    chk(
      "subcategory",
      z
        .string()
        .trim()
        .min(
          2,
          d.category === "Other"
            ? "Describe the type of event"
            : "Choose a subcategory",
        )
        .max(50, "Too long")
        .safeParse(d.subcategory),
    );

    chk(
      "description",
      z
        .string()
        .trim()
        .min(
          10,
          "Add a short description (10+ characters)",
        )
        .max(
          300,
          "Keep it under 300 characters",
        )
        .safeParse(d.description),
    );

    if (
      d.poster &&
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(d.poster.type)
    ) {
      e["poster"] =
        "Poster must be a JPG, PNG or WebP image";
    } else if (
      d.poster &&
      d.poster.size >
        10 * 1024 * 1024
    ) {
      e["poster"] =
        "Poster must be under 10 MB";
    }
  }

  if (step === 1) {
    if (!d.date) {
      e["date"] = "Pick a date";
    } else if (d.date < today()) {
      e["date"] =
        "Date can't be in the past";
    }

    if (!d.startTime) {
      e["startTime"] =
        "Pick a start time";
    }

    if (
      d.endDate &&
      d.endDate < d.date
    ) {
      e["endDate"] =
        "End date can't be before the start date";
    }

    const endDate =
      d.endDate || d.date;

    if (
      d.endTime &&
      d.startTime &&
      d.date &&
      msOf(
        endDate,
        d.endTime,
      ) <=
        msOf(
          d.date,
          d.startTime,
        )
    ) {
      e["endTime"] =
        "End time must be after the start time";
    }

    if (
      !e["date"] &&
      !e["startTime"] &&
      !e["endTime"] &&
      d.date &&
      d.startTime
    ) {
      const end = d.endTime
        ? msOf(
            endDate,
            d.endTime,
          )
        : msOf(
            d.date,
            d.startTime,
          ) +
          3 * 36e5;

      if (end < Date.now()) {
        e["startTime"] =
          "This event would already be over";
      }
    }

    chk(
      "venue",
      z
        .string()
        .trim()
        .min(
          2,
          "Enter the venue",
        )
        .max(
          150,
          "Too long",
        )
        .safeParse(d.venue),
    );

    chk(
      "locality",
      z
        .string()
        .trim()
        .min(
          2,
          "Enter the town or locality",
        )
        .max(
          100,
          "Too long",
        )
        .safeParse(d.locality),
    );

    if (!d.district) {
      e["district"] =
        "Choose a district";
    }

    if (!d.pos) {
      e["pos"] =
        "Tap the map to place the event";
    }
  }

  if (step === 2) {
    if (d.entry === "paid") {
      chk(
        "fee",
        z
          .string()
          .trim()
          .min(
            1,
            "Enter the entry fee",
          )
          .max(
            60,
            "Too long",
          )
          .safeParse(d.fee),
      );
    }

    for (
      const [k, v] of [
        [
          "ticketUrl",
          normUrl(d.ticketUrl),
        ],
        [
          "website",
          normUrl(d.website),
        ],
        [
          "otherUrl",
          normUrl(d.otherUrl),
        ],
        [
          "instagram",
          normInsta(d.instagram),
        ],
      ] as const
    ) {
      if (v) {
        chk(
          k,
          urlSchema.safeParse(v),
        );
      }
    }

    if (d.contact.length > 100) {
      e["contact"] =
        "Too long";
    }
  }

  return e;
}

const input =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">
        {label}
      </span>

      {children}

      {hint && !error && (
        <span className="mt-1 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}

      {error && (
        <span
          role="alert"
          className="mt-1 block text-xs text-destructive"
        >
          {error}
        </span>
      )}
    </label>
  );
}

/* ============================================================
   SUBMIT
   ============================================================ */

function Submit() {
  const nav = useNavigate();

  const [step, setStep] =
    useState(0);

  const [d, setD] =
    useState<Draft>(EMPTY);

  const [errs, setErrs] =
    useState<Errs>({});

  const [busy, setBusy] =
    useState(false);

  const [fail, setFail] =
    useState("");

  const [preview, setPreview] =
    useState<string | null>(null);

  const set = (
    p: Partial<Draft>,
  ) =>
    setD((x) => ({
      ...x,
      ...p,
    }));

  useEffect(() => {
    if (!d.poster) {
      setPreview(null);
      return;
    }

    const u =
      URL.createObjectURL(
        d.poster,
      );

    setPreview(u);

    return () =>
      URL.revokeObjectURL(u);
  }, [d.poster]);

  const onPick = useCallback(
    (
      lat: number,
      lng: number,
    ) => {
      setD((x) => ({
        ...x,
        pos: {
          lat,
          lng,
        },
      }));

      void districtAt(
        lat,
        lng,
      ).then((dist) => {
        if (dist) {
          setD((x) => ({
            ...x,
            district: dist,
          }));

          setErrs((x) => ({
            ...x,
            pos: "",
            district: "",
          }));
        } else {
          setErrs((x) => ({
            ...x,
            pos:
              "That spot is outside Kerala — choose a place inside a district.",
          }));
        }
      });
    },
    [],
  );

  function next() {
    const e =
      validate(
        step,
        d,
      );

    setErrs(e);

    if (
      Object.keys(e).length
    ) {
      return;
    }

    setStep(
      step + 1,
    );

    window.scrollTo({
      top: 0,
    });
  }

  async function submit() {
    const e =
      [0, 1, 2].reduce<Errs>(
        (a, s) => ({
          ...a,
          ...validate(
            s,
            d,
          ),
        }),
        {},
      );

    if (
      Object.keys(e).length ||
      !d.pos
    ) {
      setErrs(e);

      setFail(
        "Some details need fixing — go back and check the highlighted fields.",
      );

      return;
    }

    setBusy(true);
    setFail("");

    try {
      /*
       * Manual poster always has priority.
       *
       * If the user does not upload a poster,
       * search automatically using the event details.
       */

      const imageUrl = d.poster
        ? await uploadPoster(
            await shrinkImage(
              d.poster,
            ),
          )
        : await findEventImage({
            title:
              d.title.trim(),
            category:
              d.category,
            subcategory:
              d.subcategory.trim(),
            venue:
              d.venue.trim(),
            locality:
              d.locality.trim(),
            district:
              d.district,
          });

      const id =
        d.title
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-",
          )
          .replace(
            /^-|-$/g,
            "",
          )
          .slice(
            0,
            60,
          ) +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 7);

      const ev: NewEvent = {
        id,
        title:
          d.title.trim(),
        category:
          d.category,
        subcategory:
          d.subcategory.trim(),
        description:
          d.description.trim(),
        date:
          d.date,
        endDate:
          d.endDate ||
          d.date,
        startTime:
          d.startTime,
        endTime:
          d.endTime ||
          null,
        venue:
          d.venue.trim(),
        locality:
          d.locality.trim(),
        district:
          d.district,
        lat:
          d.pos.lat,
        lng:
          d.pos.lng,
        entry:
          d.entry,
        fee:
          d.entry === "paid"
            ? d.fee.trim()
            : null,
        contact:
          d.contact.trim() ||
          null,
        ticketUrl:
          normUrl(
            d.ticketUrl,
          ) || null,
        instagram:
          normInsta(
            d.instagram,
          ) || null,
        website:
          normUrl(
            d.website,
          ) || null,
        otherUrl:
          normUrl(
            d.otherUrl,
          ) || null,
        imageUrl,
      };

      await addEvent(
        ev,
      );

      await nav({
        to: "/event/$id",
        params: {
          id,
        },
      });
    } catch {
      setFail(
        "We couldn't publish your event. Check your connection and try again — your details are still here.",
      );

      setBusy(false);
    }
  }

  const subs =
    SUBCATEGORIES[
      d.category
    ];

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <p className="text-xs font-medium text-muted-foreground">
          Step {step + 1} of{" "}
          {STEPS.length}
        </p>

        <h1 className="text-xl font-bold">
          {STEPS[step]}
        </h1>

        <div
          className="mt-2 h-1.5 overflow-hidden rounded bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={
            step + 1
          }
        >
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${
                ((step + 1) / 4) *
                100
              }%`,
            }}
          />
        </div>

        <div className="mt-5 space-y-4">
          {step === 0 && (
            <>
              <Field
                label="Event name"
                error={
                  errs["title"]
                }
              >
                <input
                  className={input}
                  value={d.title}
                  maxLength={100}
                  onChange={(e) =>
                    set({
                      title:
                        e.target
                          .value,
                    })
                  }
                  autoComplete="off"
                />
              </Field>

              <div className="text-sm">
                <span className="mb-1 block font-medium">
                  Category
                </span>

                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Category"
                >
                  {CATEGORIES.map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={
                          d.category ===
                          c
                        }
                        onClick={() =>
                          set({
                            category:
                              c,
                            subcategory:
                              "",
                          })
                        }
                        style={
                          d.category ===
                          c
                            ? {
                                background:
                                  CATEGORY_META[
                                    c
                                  ].hex,
                                borderColor:
                                  CATEGORY_META[
                                    c
                                  ].hex,
                                color:
                                  "#fff",
                              }
                            : undefined
                        }
                        className="flex h-10 items-center gap-1 rounded-full border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span aria-hidden="true">
                          {
                            CATEGORY_META[
                              c
                            ].icon
                          }
                        </span>

                        {c}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {d.category ===
              "Other" ? (
                <Field
                  label="What kind of event is it?"
                  error={
                    errs[
                      "subcategory"
                    ]
                  }
                >
                  <input
                    className={input}
                    value={
                      d.subcategory
                    }
                    maxLength={50}
                    onChange={(e) =>
                      set({
                        subcategory:
                          e.target
                            .value,
                      })
                    }
                    placeholder="e.g. Book fair, Blood donation camp"
                  />
                </Field>
              ) : (
                <Field
                  label="Subcategory"
                  error={
                    errs[
                      "subcategory"
                    ]
                  }
                >
                  <select
                    className={input}
                    value={
                      d.subcategory
                    }
                    onChange={(e) =>
                      set({
                        subcategory:
                          e.target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Select…
                    </option>

                    {subs.map(
                      (s) => (
                        <option
                          key={s}
                        >
                          {s}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              )}

              <Field
                label="Short description"
                error={
                  errs[
                    "description"
                  ]
                }
                hint={`${d.description.length}/300 — one or two sentences is plenty.`}
              >
                <textarea
                  className={`${input} h-28 py-2`}
                  value={
                    d.description
                  }
                  maxLength={300}
                  onChange={(e) =>
                    set({
                      description:
                        e.target
                          .value,
                    })
                  }
                />
              </Field>

              <Field
                label="Poster or image (optional)"
                error={
                  errs["poster"]
                }
              >
                <span className="flex items-center gap-3">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Poster preview"
                      className="h-20 w-20 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                      <ImagePlus
                        size={22}
                        aria-hidden="true"
                      />
                    </span>
                  )}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-sm"
                    onChange={(e) =>
                      set({
                        poster:
                          e.target
                            .files?.[0] ??
                          null,
                      })
                    }
                  />
                </span>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Date"
                  error={
                    errs["date"]
                  }
                >
                  <input
                    type="date"
                    className={input}
                    min={today()}
                    value={d.date}
                    onChange={(e) =>
                      set({
                        date:
                          e.target
                            .value,
                      })
                    }
                  />
                </Field>

                <Field
                  label="End date (if multi-day)"
                  error={
                    errs["endDate"]
                  }
                >
                  <input
                    type="date"
                    className={input}
                    min={
                      d.date ||
                      today()
                    }
                    value={
                      d.endDate
                    }
                    onChange={(e) =>
                      set({
                        endDate:
                          e.target
                            .value,
                      })
                    }
                  />
                </Field>

                <Field
                  label="Start time"
                  error={
                    errs[
                      "startTime"
                    ]
                  }
                >
                  <TimePicker
                    value={
                      d.startTime
                    }
                    onChange={(
                      value,
                    ) =>
                      set({
                        startTime:
                          value,
                      })
                    }
                  />
                </Field>

                <Field
                  label="End time (optional)"
                  error={
                    errs[
                      "endTime"
                    ]
                  }
                >
                  <TimePicker
                    value={
                      d.endTime
                    }
                    onChange={(
                      value,
                    ) =>
                      set({
                        endTime:
                          value,
                      })
                    }
                    optional
                  />
                </Field>
              </div>

              <Field
                label="Venue"
                error={
                  errs["venue"]
                }
              >
                <input
                  className={input}
                  value={d.venue}
                  maxLength={150}
                  onChange={(e) =>
                    set({
                      venue:
                        e.target
                          .value,
                    })
                  }
                  placeholder="e.g. Municipal Stadium"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Town / locality"
                  error={
                    errs[
                      "locality"
                    ]
                  }
                >
                  <input
                    className={input}
                    value={
                      d.locality
                    }
                    maxLength={100}
                    onChange={(e) =>
                      set({
                        locality:
                          e.target
                            .value,
                      })
                    }
                    placeholder="e.g. Payyanur"
                  />
                </Field>

                <Field
                  label="District"
                  error={
                    errs[
                      "district"
                    ]
                  }
                >
                  <select
                    className={input}
                    value={
                      d.district
                    }
                    onChange={(e) =>
                      set({
                        district:
                          e.target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Select…
                    </option>

                    {DISTRICTS.map(
                      (x) => (
                        <option
                          key={x}
                        >
                          {x}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">
                  Exact position
                </p>

                <p className="mb-2 text-xs text-muted-foreground">
                  {d.pos
                    ? `Pinned at ${d.pos.lat.toFixed(
                        4,
                      )}, ${d.pos.lng.toFixed(
                        4,
                      )} — drag the pin to adjust.`
                    : "Tap the map to drop a pin, or use the locate button."}
                </p>

                <div className="h-72 overflow-hidden rounded-lg border border-border">
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
                        events={[]}
                        pick={d.pos}
                        onPick={
                          onPick
                        }
                        onLocate={
                          onPick
                        }
                      />
                    </Suspense>
                  </ClientOnly>
                </div>

                {errs["pos"] && (
                  <p
                    role="alert"
                    className="mt-1 text-xs text-destructive"
                  >
                    {errs["pos"]}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-sm">
                <span className="mb-1 block font-medium">
                  Entry
                </span>

                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Entry"
                >
                  {(
                    [
                      [
                        "free",
                        "Free",
                      ],
                      [
                        "paid",
                        "Paid",
                      ],
                      [
                        "registration",
                        "Registration required",
                      ],
                    ] as const
                  ).map(
                    ([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={
                          d.entry ===
                          k
                        }
                        onClick={() =>
                          set({
                            entry:
                              k,
                          })
                        }
                        className={`h-10 rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-ring ${
                          d.entry ===
                          k
                            ? "border-foreground bg-foreground text-background"
                            : "border-border"
                        }`}
                      >
                        {l}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {d.entry ===
                "paid" && (
                <Field
                  label="Entry fee"
                  error={
                    errs["fee"]
                  }
                >
                  <input
                    className={input}
                    value={d.fee}
                    maxLength={60}
                    onChange={(e) =>
                      set({
                        fee: e
                          .target
                          .value,
                      })
                    }
                    placeholder="e.g. ₹200 or ₹100–₹500"
                  />
                </Field>
              )}

              <Field
                label="Ticket / registration link (optional)"
                error={
                  errs[
                    "ticketUrl"
                  ]
                }
              >
                <input
                  className={input}
                  inputMode="url"
                  value={
                    d.ticketUrl
                  }
                  onChange={(e) =>
                    set({
                      ticketUrl:
                        e.target
                          .value,
                    })
                  }
                  placeholder="https://"
                />
              </Field>

              <Field
                label="Instagram (optional)"
                error={
                  errs[
                    "instagram"
                  ]
                }
              >
                <input
                  className={input}
                  value={
                    d.instagram
                  }
                  onChange={(e) =>
                    set({
                      instagram:
                        e.target
                          .value,
                    })
                  }
                  placeholder="@handle or link"
                />
              </Field>

              <Field
                label="Official website (optional)"
                error={
                  errs["website"]
                }
              >
                <input
                  className={input}
                  inputMode="url"
                  value={
                    d.website
                  }
                  onChange={(e) =>
                    set({
                      website:
                        e.target
                          .value,
                    })
                  }
                  placeholder="https://"
                />
              </Field>

              <Field
                label="Other useful link (optional)"
                error={
                  errs["otherUrl"]
                }
              >
                <input
                  className={input}
                  inputMode="url"
                  value={
                    d.otherUrl
                  }
                  onChange={(e) =>
                    set({
                      otherUrl:
                        e.target
                          .value,
                    })
                  }
                  placeholder="https://"
                />
              </Field>

              <Field
                label="Contact information (optional)"
                error={
                  errs["contact"]
                }
                hint="Shown publicly on the event page."
              >
                <input
                  className={input}
                  value={
                    d.contact
                  }
                  maxLength={100}
                  onChange={(e) =>
                    set({
                      contact:
                        e.target
                          .value,
                    })
                  }
                  placeholder="Phone or email"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <article className="overflow-hidden rounded-lg border border-border bg-card">
              {preview && (
                <img
                  src={preview}
                  alt="Poster"
                  className="max-h-64 w-full object-cover"
                />
              )}

              <div className="space-y-2 p-4 text-sm">
                <CategoryBadge
                  e={{
                    category:
                      d.category,
                    subcategory:
                      d.subcategory,
                  }}
                />

                <h2 className="text-lg font-bold">
                  {d.title}
                </h2>

                <p>
                  {d.description}
                </p>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">
                    When
                  </dt>

                  <dd>
                    {fmtDate(
                      d.date,
                    )}

                    {d.endDate &&
                    d.endDate !==
                      d.date
                      ? ` – ${fmtDate(
                          d.endDate,
                        )}`
                      : ""}

                    {" · "}

                    {d.startTime &&
                      fmtTime(
                        d.startTime,
                      )}

                    {d.endTime &&
                      ` – ${fmtTime(
                        d.endTime,
                      )}`}
                  </dd>

                  <dt className="text-muted-foreground">
                    Where
                  </dt>

                  <dd>
                    {d.venue},{" "}
                    {d.locality},{" "}
                    {d.district}
                  </dd>

                  <dt className="text-muted-foreground">
                    Entry
                  </dt>

                  <dd>
                    {d.entry ===
                    "free"
                      ? "Free"
                      : d.entry ===
                          "paid"
                        ? `Paid · ${d.fee}`
                        : "Registration required"}
                  </dd>

                  {d.contact && (
                    <>
                      <dt className="text-muted-foreground">
                        Contact
                      </dt>

                      <dd>
                        {d.contact}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            </article>
          )}

          {fail && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {fail}
            </p>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3">
          <div className="mx-auto flex max-w-2xl gap-2">
            {step > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep(
                    step - 1,
                  );
                  setFail("");
                }}
                className="h-11 rounded-md border border-border px-5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="h-11 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void submit()
                }
                className="h-11 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {busy
                  ? "Publishing…"
                  : "Publish event"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}