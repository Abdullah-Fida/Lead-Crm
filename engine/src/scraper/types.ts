export interface PlaceResult {
  /** Google place id (Places API) or the Maps feature id (browser) — used for dedupe. */
  placeId: string | null;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  /** OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | null */
  businessStatus: string | null;
}

export interface QualifyRules {
  min_rating?: number;
  min_reviews?: number;
  require_mobile?: boolean;
  skip_closed?: boolean;
  website?: 'any' | 'with' | 'without';
  exclude_keywords?: string[];
}
