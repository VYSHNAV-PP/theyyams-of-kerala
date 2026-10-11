import { supabase } from "@/integrations/supabase/client";

/** A kavu (temple, grove or tharavad) as stored in the `kavus` table. */
export type Kavu = {
  id: string;
  name: string;
  locality: string;
  district: string;
  lat: number;
  lng: number;
  description: string | null;
  imageUrl: string | null;
};

type Row = {
  id: string;
  name: string;
  locality: string;
  district: string;
  lat: number;
  lng: number;
  description: string | null;
  image_url: string | null;
};

const toKavu = (r: Row): Kavu => ({
  id: r.id,
  name: r.name,
  locality: r.locality,
  district: r.district,
  lat: r.lat,
  lng: r.lng,
  description: r.description,
  imageUrl: r.image_url,
});

/** Every kavu, for the picker and the Temples page. */
export async function fetchKavus(): Promise<Kavu[]> {
  const { data, error } = await supabase
    .from("kavus")
    .select("id,name,locality,district,lat,lng,description,image_url")
    .order("name")
    .limit(2000);

  if (error) throw error;
  return ((data ?? []) as Row[]).map(toKavu);
}

/** Case-insensitive match on name, district and locality: the same place is never entered twice. */
export const sameKavu = (
  a: { name: string; district: string; locality: string },
  b: { name: string; district: string; locality: string },
) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  a.district === b.district &&
  a.locality.trim().toLowerCase() === b.locality.trim().toLowerCase();

export type NewKavu = {
  name: string;
  locality: string;
  district: string;
  lat: number;
  lng: number;
  description?: string | null;
};

/**
 * Add a kavu and return it. If the same place is already listed (a race between two posters,
 * or a case-only difference the picker missed), the existing kavu is returned instead.
 */
export async function addKavu(input: NewKavu): Promise<Kavu> {
  const { data, error } = await supabase
    .from("kavus")
    .insert({
      name: input.name.trim(),
      locality: input.locality.trim(),
      district: input.district,
      lat: input.lat,
      lng: input.lng,
      description: input.description?.trim() || null,
    })
    .select("id,name,locality,district,lat,lng,description,image_url")
    .single();

  if (!error && data) return toKavu(data as Row);

  // 23505 = unique violation: the place already exists.
  if (error?.code === "23505") {
    const all = await fetchKavus();
    const found = all.find((k) => sameKavu(k, input));
    if (found) return found;
  }
  throw error ?? new Error("Could not add the kavu");
}
