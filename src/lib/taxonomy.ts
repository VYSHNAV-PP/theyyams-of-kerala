export const CATEGORIES = [
  "Sports", "Cultural", "Religious", "Entertainment", "Educational", "Community/Public", "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Color is never the only signal: every category also has an icon and a text label.
export const CATEGORY_META: Record<Category, { icon: string; hex: string }> = {
  Sports: { icon: "⚽", hex: "#2563eb" },
  Cultural: { icon: "🎭", hex: "#15803d" },
  Religious: { icon: "🛕", hex: "#7c3aed" },
  Entertainment: { icon: "🎵", hex: "#c2410c" },
  Educational: { icon: "🎓", hex: "#a16207" },
  "Community/Public": { icon: "🤝", hex: "#dc2626" },
  Other: { icon: "📍", hex: "#64748b" },
};

export const SUBCATEGORIES: Record<Category, string[]> = {
  Sports: ["Football", "Cricket", "Volleyball", "Badminton", "Basketball", "Athletics", "Other Sports"],
  Cultural: ["Dance", "Drama", "Art", "Literature", "Traditional Programme", "Other Cultural Events"],
  Religious: ["Religious Festival", "Procession", "Temple Programme", "Church Programme", "Mosque Programme", "Other Religious Events"],
  Entertainment: ["Concert", "Live Music", "Comedy", "Movie Screening", "DJ/Performance", "Other Entertainment"],
  Educational: ["Workshop", "Seminar", "Conference", "Training", "Exhibition", "Competition", "Other Educational"],
  "Community/Public": ["Fair", "Community Gathering", "Charity Event", "Public Programme", "Local Festival", "Other Community Events"],
  Other: [], // free-text classification
};

export function asCategory(s: string): Category {
  return (CATEGORIES as readonly string[]).includes(s) ? (s as Category) : "Other";
}

export const REPORT_REASONS = [
  { value: "cancelled", label: "Event cancelled" },
  { value: "wrong_datetime", label: "Wrong date/time" },
  { value: "wrong_location", label: "Wrong location" },
  { value: "incorrect_info", label: "Incorrect information" },
  { value: "duplicate", label: "Duplicate" },
  { value: "ended", label: "Event already ended" },
  { value: "spam", label: "Spam/inappropriate" },
  { value: "other", label: "Other" },
] as const;
