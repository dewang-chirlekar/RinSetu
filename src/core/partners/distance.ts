/**
 * src/core/partners/distance.ts
 *
 * Haversine great-circle distance. No PostGIS — ROADMAP §3: we have ~150
 * partners, and distance over 150 rows in plain JS is sub-millisecond. Revisit
 * only if the registry passes roughly 50,000 rows.
 *
 * Returns kilometres. Straight-line, not road distance; the UI must say so
 * rather than implying travel time we have not computed.
 */

/** IUGG mean Earth radius in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088;

export interface LatLng {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance to one decimal place, or null when either point is unknown.
 *
 * Null rather than a fallback: an applicant who has not shared a location gets
 * "distance unknown", never a distance measured from a district centroid we
 * silently substituted.
 */
export function distanceKmOrNull(from: LatLng | null, to: LatLng | null): number | null {
  if (!from || !to) return null;
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return null;
  if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return null;
  return Math.round(haversineKm(from, to) * 10) / 10;
}
