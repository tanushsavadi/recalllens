/**
 * US state centroids (approximate geographic centers) for STATE-GRANULARITY
 * markers only. CDC reports outbreak data at the state level — we deliberately
 * place one marker at each affected state's centroid and NEVER at a fabricated
 * case or facility coordinate. The marker represents "this state is affected",
 * not any specific location.
 */
export interface StateCentroid {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const STATE_CENTROIDS: Record<string, StateCentroid> = {
  Indiana: { code: "IN", name: "Indiana", lat: 39.9, lng: -86.3 },
  Kentucky: { code: "KY", name: "Kentucky", lat: 37.5, lng: -85.3 },
  Michigan: { code: "MI", name: "Michigan", lat: 44.3, lng: -85.6 },
  Ohio: { code: "OH", name: "Ohio", lat: 40.2, lng: -82.7 },
  "West Virginia": { code: "WV", name: "West Virginia", lat: 38.6, lng: -80.6 },
  Illinois: { code: "IL", name: "Illinois", lat: 40.0, lng: -89.2 },
  Pennsylvania: { code: "PA", name: "Pennsylvania", lat: 40.9, lng: -77.8 },
  Tennessee: { code: "TN", name: "Tennessee", lat: 35.9, lng: -86.4 },
  Virginia: { code: "VA", name: "Virginia", lat: 37.5, lng: -78.8 },
  Wisconsin: { code: "WI", name: "Wisconsin", lat: 44.6, lng: -89.9 },
};

/** Approximate geographic center of the affected-states cluster (Midwest). */
export const OUTBREAK_FOCUS = { lat: 39.5, lng: -83.5, altitude: 1.15 };
export const US_VIEW = { lat: 39.5, lng: -98.35, altitude: 1.8 };

export function centroidFor(stateName: string): StateCentroid | undefined {
  return STATE_CENTROIDS[stateName];
}
