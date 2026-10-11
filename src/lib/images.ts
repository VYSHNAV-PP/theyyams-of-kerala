/**
 * Image slots.
 *
 * Form cards and temple cards leave room for a picture. To fill a slot, drop a file into
 * public/forms or public/temples named after the item, in lower case with dashes:
 *
 *   public/forms/muchilottu-bhagavathi.jpg
 *   public/forms/raktha-chamundi.jpg
 *   public/temples/kalarivathukkal-bhagavathy-temple.jpg
 *
 * Until a file exists the card simply shows its placeholder.
 */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const formImageUrl = (name: string) => `/forms/${slugify(name)}.jpg`;
export const templeImageUrl = (name: string) => `/temples/${slugify(name)}.jpg`;
