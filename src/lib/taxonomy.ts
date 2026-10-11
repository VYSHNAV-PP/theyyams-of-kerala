/**
 * Theyyam taxonomy.
 *
 * The database columns are still called `category` and `subcategory`:
 *   category    → the family a Theyyam belongs to (e.g. "Goddess")
 *   subcategory → the named form being performed (e.g. "Muchilottu Bhagavathi")
 */

export const CATEGORIES = [
  "Goddess",
  "Vishnu & Shiva",
  "Heroes & Ancestors",
  "Spirits & Guardians",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type CategoryIconKey = "flower" | "sun" | "swords" | "shield" | "landmark";

// Colour is never the only signal: every family also has an icon and a text label.
export const CATEGORY_META: Record<
  Category,
  { icon: CategoryIconKey; hex: string; blurb: string }
> = {
  Goddess: { icon: "flower", hex: "#d9896e", blurb: "Bhagavathi and Chamundi forms of the Mother" },
  "Vishnu & Shiva": {
    icon: "sun",
    hex: "#d6b264",
    blurb: "Forms of Vishnu, Shiva and their attendants",
  },
  "Heroes & Ancestors": {
    icon: "swords",
    hex: "#9dbb84",
    blurb: "Warriors and ancestors worshipped as deities",
  },
  "Spirits & Guardians": { icon: "shield", hex: "#8fb0dc", blurb: "Guardian and folk spirits" },
  Other: { icon: "landmark", hex: "#9aa3ab", blurb: "Any form not listed here" },
};

export type TheyyamForm = {
  name: string;
  /** Malayalam name, shown beside the English name. */
  ml: string;
  family: Category;
  line: string;
  /** Shown first in the "Explore Theyyam forms" strip. */
  featured?: boolean;
};

export const FORMS: TheyyamForm[] = [
  {
    name: "Muchilottu Bhagavathi",
    ml: "മുച്ചിലോട്ട് ഭഗവതി",
    family: "Goddess",
    line: "Fierce and compassionate, the guardian mother.",
    featured: true,
  },
  {
    name: "Raktha Chamundi",
    ml: "രക്തചാമുണ്ഡി",
    family: "Goddess",
    line: "The fierce form of the divine mother.",
    featured: true,
  },
  {
    name: "Puthiya Bhagavathi",
    ml: "പുതിയ ഭഗവതി",
    family: "Goddess",
    line: "A goddess honoured in many kavus of North Malabar.",
  },
  {
    name: "Bhadrakali",
    ml: "ഭദ്രകാളി",
    family: "Goddess",
    line: "The goddess in her fiercest, protective form.",
  },
  {
    name: "Kurathi",
    ml: "കുറത്തി",
    family: "Goddess",
    line: "The goddess in the guise of a hill soothsayer.",
  },
  {
    name: "Vishnumoorthi",
    ml: "വിഷ്ണുമൂർത്തി",
    family: "Vishnu & Shiva",
    line: "The protector, the divine manifestation.",
    featured: true,
  },
  {
    name: "Muthappan",
    ml: "മുത്തപ്പൻ",
    family: "Vishnu & Shiva",
    line: "The beloved deity of Parassinikkadavu and beyond.",
  },
  {
    name: "Pottan Theyyam",
    ml: "പൊട്ടൻ തെയ്യം",
    family: "Vishnu & Shiva",
    line: "The rustic deity, full of power.",
    featured: true,
  },
  {
    name: "Vettakkorumakan",
    ml: "വേട്ടയ്ക്കൊരുമകൻ",
    family: "Vishnu & Shiva",
    line: "The divine hunter, a son of Shiva.",
  },
  {
    name: "Kshetrapalan",
    ml: "ക്ഷേത്രപാലൻ",
    family: "Vishnu & Shiva",
    line: "Guardian of the temple precinct.",
  },
  {
    name: "Bhairavan",
    ml: "ഭൈരവൻ",
    family: "Vishnu & Shiva",
    line: "A fierce guardian form of Shiva.",
  },
  {
    name: "Kandanar Kelan",
    ml: "കണ്ടനാർ കേളൻ",
    family: "Heroes & Ancestors",
    line: "The warrior, the forest lord.",
    featured: true,
  },
  {
    name: "Kathivanoor Veeran",
    ml: "കതിവന്നൂർ വീരൻ",
    family: "Heroes & Ancestors",
    line: "A hero of North Malabar legend.",
  },
  {
    name: "Pulimaranja Thondachan",
    ml: "പുലിമറഞ്ഞ തൊണ്ടച്ചൻ",
    family: "Heroes & Ancestors",
    line: "An ancestral hero worshipped as a deity.",
  },
  {
    name: "Vayanattu Kulavan",
    ml: "വയനാട്ടുകുലവൻ",
    family: "Heroes & Ancestors",
    line: "A warrior-guardian deity of North Malabar.",
  },
  {
    name: "Gulikan",
    ml: "ഗുളികൻ",
    family: "Spirits & Guardians",
    line: "The horse-riding spirit, brings justice.",
    featured: true,
  },
  {
    name: "Kuttichathan",
    ml: "കുട്ടിച്ചാത്തൻ",
    family: "Spirits & Guardians",
    line: "A mischievous child spirit of Kerala folk belief.",
  },
];

/** Catch-all choice offered at the end of each family's list in the Post form. */
export const OTHER_FORM: Record<Exclude<Category, "Other">, string> = {
  Goddess: "Other goddess form",
  "Vishnu & Shiva": "Other Vishnu or Shiva form",
  "Heroes & Ancestors": "Other hero or ancestor form",
  "Spirits & Guardians": "Other spirit or guardian form",
};

export const SUBCATEGORIES: Record<Category, string[]> = {
  Goddess: [...FORMS.filter((f) => f.family === "Goddess").map((f) => f.name), OTHER_FORM.Goddess],
  "Vishnu & Shiva": [
    ...FORMS.filter((f) => f.family === "Vishnu & Shiva").map((f) => f.name),
    OTHER_FORM["Vishnu & Shiva"],
  ],
  "Heroes & Ancestors": [
    ...FORMS.filter((f) => f.family === "Heroes & Ancestors").map((f) => f.name),
    OTHER_FORM["Heroes & Ancestors"],
  ],
  "Spirits & Guardians": [
    ...FORMS.filter((f) => f.family === "Spirits & Guardians").map((f) => f.name),
    OTHER_FORM["Spirits & Guardians"],
  ],
  Other: [], // free-text
};

/** Families the database accepted before the Theyyam edition. Those rows are archived by the migration. */
export function asCategory(s: string): Category {
  return (CATEGORIES as readonly string[]).includes(s) ? (s as Category) : "Other";
}

export function formByName(name: string | null | undefined): TheyyamForm | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return FORMS.find((f) => f.name.toLowerCase() === n);
}

export const REPORT_REASONS = [
  { value: "cancelled", label: "Performance cancelled" },
  { value: "wrong_datetime", label: "Wrong date or time" },
  { value: "wrong_location", label: "Wrong temple or location" },
  { value: "incorrect_info", label: "Incorrect information" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "ended", label: "Performance already ended" },
  { value: "spam", label: "Spam or inappropriate" },
  { value: "other", label: "Something else" },
] as const;
