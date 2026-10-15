/**
 * Google Places Text Search (New) — server-only key, explicit field mask always.
 * A browser key (if ever added) must be VITE_-prefixed and HTTP-referrer restricted.
 */
import { fetchWithTimeout, redact } from "@/lib/outbound-guard";

export const PLACES_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location";

export function placesRequest(query: string, key: string) {
  return {
    url: "https://places.googleapis.com/v1/places:searchText",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACES_FIELD_MASK },
      body: JSON.stringify({ textQuery: query.slice(0, 200), regionCode: "BD", maxResultCount: 10 }),
    } satisfies RequestInit,
  };
}

export async function searchPlaces(query: string) {
  const q = query.trim();
  if (q.length < 2 || q.length > 200) return { ok: false as const, error: "invalid_query" };
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) return { ok: false as const, error: "not_configured" };
  const { url, init } = placesRequest(q, key);
  try {
    const res = await fetchWithTimeout(url, init, 8_000);
    const text = await res.text();
    if (!res.ok) {
      console.error(`places search failed [${res.status}]: ${redact(text)}`);
      return { ok: false as const, error: `provider_${res.status}` };
    }
    const j = JSON.parse(text) as { places?: Array<{ id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }> };
    return {
      ok: true as const,
      places: (j.places ?? []).map((p) => ({ id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? "", lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null })),
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error && e.name === "AbortError" ? "timeout" : "network_error" };
  }
}
