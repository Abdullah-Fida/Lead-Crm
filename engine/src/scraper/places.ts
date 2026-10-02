/**
 * Google Places API (New) — Text Search. Reliable and ToS-compliant; returns up
 * to 60 results per query (3 pages of 20).
 */
import type { PlaceResult } from './types';

const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.location',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'nextPageToken',
].join(',');

interface ApiPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
}

export class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function toResult(p: ApiPlace): PlaceResult {
  const comp = (type: string) => p.addressComponents?.find((c) => c.types?.includes(type));
  return {
    placeId: p.id ?? null,
    name: p.displayName?.text?.trim() || 'Unknown business',
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    address: p.formattedAddress ?? null,
    city: comp('locality')?.longText ?? comp('administrative_area_level_2')?.longText ?? null,
    country: comp('country')?.shortText ?? null,
    category: p.primaryTypeDisplayName?.text ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviews: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    mapsUrl: p.googleMapsUri ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    businessStatus: p.businessStatus ?? null,
  };
}

export async function searchPlaces(apiKey: string, query: string, max: number, opts: { regionCode?: string; isCancelled?: () => Promise<boolean> } = {}): Promise<PlaceResult[]> {
  const out: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && out.length < max; page++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({
        textQuery: query,
        pageSize: Math.min(20, max - out.length),
        languageCode: 'en',
        ...(opts.regionCode ? { regionCode: opts.regionCode } : {}),
        ...(pageToken ? { pageToken } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { places?: ApiPlace[]; nextPageToken?: string; error?: { message?: string; status?: string } };
    if (!res.ok) {
      const msg = body.error?.message ?? res.statusText;
      if (res.status === 403) throw new PlacesApiError(`Google rejected the API key: ${msg}. Enable “Places API (New)” for this key.`, 403);
      if (res.status === 429) throw new PlacesApiError('Google Places quota exceeded. Try again later or raise your quota.', 429);
      throw new PlacesApiError(`Google Places error (${res.status}): ${msg}`, res.status);
    }
    for (const p of body.places ?? []) out.push(toResult(p));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
    if (opts.isCancelled && (await opts.isCancelled())) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return out.slice(0, max);
}
