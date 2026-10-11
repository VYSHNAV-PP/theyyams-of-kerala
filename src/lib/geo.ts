export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  Thiruvananthapuram: [8.5241, 76.9366],
  Kollam: [8.8932, 76.6141],
  Pathanamthitta: [9.2648, 76.787],
  Alappuzha: [9.4981, 76.3388],
  Kottayam: [9.5916, 76.5222],
  Idukki: [9.8494, 76.972],
  Ernakulam: [9.9816, 76.2999],
  Thrissur: [10.5276, 76.2144],
  Palakkad: [10.7867, 76.6548],
  Malappuram: [11.051, 76.0711],
  Kozhikode: [11.2588, 75.7804],
  Wayanad: [11.6854, 76.132],
  Kannur: [11.8745, 75.3704],
  Kasaragod: [12.4996, 74.9869],
};
export const DISTRICTS = Object.keys(DISTRICT_CENTERS);

/**
 * Deepest point of each district (pole of inaccessibility): [lat, lng, km to the nearest border].
 * Computed from public/data/kerala-districts.geojson. It is the point farthest from every
 * border, so a bubble placed here has the most room inside its own district.
 * The third number lets the map size each bubble so it fits within the district at any zoom.
 */
export const DISTRICT_MIDDLE: Record<string, [number, number, number]> = {
  Alappuzha: [9.228, 76.5196, 10.2],
  Ernakulam: [10.0524, 76.4722, 22.3],
  Idukki: [9.8921, 77.0044, 23.2],
  Kannur: [11.9445, 75.5601, 20.4],
  Kasaragod: [12.3876, 75.2091, 16.4],
  Kollam: [8.9616, 76.9373, 17.1],
  Kottayam: [9.6546, 76.6508, 19.2],
  Kozhikode: [11.4048, 75.8932, 17.6],
  Malappuram: [11.0677, 76.0457, 21.1],
  Palakkad: [10.6164, 76.6315, 20.2],
  Pathanamthitta: [9.2928, 76.8432, 16.4],
  Thiruvananthapuram: [8.5955, 77.0448, 19.5],
  Thrissur: [10.4251, 76.2816, 20.6],
  Wayanad: [11.6867, 76.086, 18.3],
};
export const KERALA_BOUNDS: [[number, number], [number, number]] = [
  [8.17, 74.85],
  [12.8, 77.45],
];

// Bundled with the app (public/data). The GitHub copy is only a fallback.
const GEO_LOCAL = "/data/kerala-districts.geojson";
const GEO_REMOTE =
  "https://raw.githubusercontent.com/geohacker/kerala/master/geojsons/district.geojson";
type Ring = number[][];
type GeoJ = {
  features: {
    properties: { DISTRICT: string };
    geometry: { type: string; coordinates: Ring[][] | Ring[] };
  }[];
};
let geoPromise: Promise<GeoJ | null> | undefined;

async function fetchGeo(url: string): Promise<GeoJ | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as GeoJ) : null;
  } catch {
    return null;
  }
}

export function loadDistrictGeo(): Promise<GeoJ | null> {
  geoPromise ??= fetchGeo(GEO_LOCAL).then((g) => g ?? fetchGeo(GEO_REMOTE));
  return geoPromise;
}

function inRing(x: number, y: number, r: Ring) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i] as [number, number];
    const [xj, yj] = r[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371,
    rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad,
    dLng = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestDistrict(lat: number, lng: number, maxKm: number): string | null {
  let best: string | null = null,
    bd = maxKm;
  for (const [d, c] of Object.entries(DISTRICT_CENTERS)) {
    const km = haversineKm([lat, lng], c);
    if (km < bd) {
      bd = km;
      best = d;
    }
  }
  return best;
}

/** District containing a point, or null when outside Kerala. Falls back to nearest centre if boundaries can't load. */
export async function districtAt(lat: number, lng: number): Promise<string | null> {
  const [[s, w], [n, e]] = KERALA_BOUNDS;
  if (lat < s || lat > n || lng < w || lng > e) return null;
  const g = await loadDistrictGeo();
  if (!g) return nearestDistrict(lat, lng, 70);
  for (const f of g.features) {
    const polys = (
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates
    ) as Ring[][];
    if (polys.some((p) => p[0] && inRing(lng, lat, p[0]))) {
      return DISTRICTS.includes(f.properties.DISTRICT)
        ? f.properties.DISTRICT
        : nearestDistrict(lat, lng, 120);
    }
  }
  return null;
}
