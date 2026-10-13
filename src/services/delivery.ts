import { GOOGLE_MAPS_API_KEY } from '../config';
import { geocodeText, type Coords } from './location';

const EARTH_RADIUS_KM = 6371;
// Packing / handover time before a rider leaves the store.
const PREP_MINUTES = 10;
// Assumed city rider average, door to door.
const AVG_SPEED_KMH = 22;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

type MaybeCoords = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

function normalise(value: MaybeCoords | null | undefined): Coords | null {
  if (
    !value ||
    typeof value.latitude !== 'number' ||
    typeof value.longitude !== 'number'
  ) {
    return null;
  }
  return { latitude: value.latitude, longitude: value.longitude };
}

/**
 * Estimated delivery time ("20 min") from the customer's latitude /
 * longitude to the supplier's. Returns null when either point is unknown —
 * callers hide the delivery time rather than show a made-up one that
 * ignores where the customer actually is.
 */
export function deliveryEstimate(
  customer: MaybeCoords | null | undefined,
  supplier: MaybeCoords | null | undefined,
): string | null {
  const from = normalise(customer);
  const to = normalise(supplier);
  if (!from || !to) {
    return null;
  }

  return deliveryWindow((haversineKm(from, to) / AVG_SPEED_KMH) * 60);
}

/** "25 min" for a given travel time, after adding store prep time. */
export function deliveryWindow(travelMinutes: number): string {
  const minutes = PREP_MINUTES + travelMinutes;
  return `${Math.max(1, Math.round(minutes))} min`;
}

// Driving times by rounded origin/destination (~100 m), so reopening a
// product or two items from the same supplier don't refetch.
const drivingCache = new Map<string, Promise<number | null>>();

/**
 * Real road travel time in minutes (current traffic) from the supplier to
 * the customer via the Google Distance Matrix API, or null if Google can't
 * route it. Cached per ~100 m origin/destination pair.
 */
export function fetchDrivingMinutes(
  supplier: Coords,
  customer: Coords,
): Promise<number | null> {
  const point = (c: Coords) =>
    `${c.latitude.toFixed(3)},${c.longitude.toFixed(3)}`;
  const key = `${point(supplier)}|${point(customer)}`;
  let pending = drivingCache.get(key);
  if (!pending) {
    const url =
      'https://maps.googleapis.com/maps/api/distancematrix/json' +
      `?origins=${supplier.latitude},${supplier.longitude}` +
      `&destinations=${customer.latitude},${customer.longitude}` +
      '&mode=driving&departure_time=now' +
      `&key=${GOOGLE_MAPS_API_KEY}`;
    pending = fetch(url)
      .then(response => response.json())
      .then(
        (data: {
          rows?: {
            elements?: {
              status?: string;
              duration?: { value: number };
              duration_in_traffic?: { value: number };
            }[];
          }[];
        }) => {
          const element = data.rows?.[0]?.elements?.[0];
          const seconds =
            element?.status === 'OK'
              ? element.duration_in_traffic?.value ?? element.duration?.value
              : undefined;
          return typeof seconds === 'number' ? seconds / 60 : null;
        },
      )
      .catch(() => {
        drivingCache.delete(key); // allow a retry later
        return null;
      });
    drivingCache.set(key, pending);
  }
  return pending;
}

// Flat delivery fee within this radius; +1 AED per additional km beyond it.
const BASE_DELIVERY_RADIUS_KM = 10;
const BASE_DELIVERY_FEE_AED = 20;
const EXTRA_FEE_AED_PER_KM = 1;

/**
 * Delivery fee (AED) for a given straight-line distance: a flat
 * {@link BASE_DELIVERY_FEE_AED} within {@link BASE_DELIVERY_RADIUS_KM}, plus
 * {@link EXTRA_FEE_AED_PER_KM} per additional (fractional) kilometre.
 */
export function deliveryFeeForDistance(distanceKm: number): number {
  if (distanceKm <= BASE_DELIVERY_RADIUS_KM) {
    return BASE_DELIVERY_FEE_AED;
  }
  return (
    BASE_DELIVERY_FEE_AED +
    (distanceKm - BASE_DELIVERY_RADIUS_KM) * EXTRA_FEE_AED_PER_KM
  );
}

/**
 * Delivery fee (AED) from the customer's location to the supplier's, by
 * straight-line distance. Returns null when either point is unknown, so
 * callers can fall back to a stored/default fee.
 */
export function deliveryFeeByDistance(
  customer: MaybeCoords | null | undefined,
  supplier: MaybeCoords | null | undefined,
): number | null {
  const from = normalise(customer);
  const to = normalise(supplier);
  if (!from || !to) {
    return null;
  }
  return deliveryFeeForDistance(haversineKm(from, to));
}

// Geocode a free-text address once and share the result.
const geocodeCache = new Map<string, Promise<Coords | null>>();

/**
 * Resolve an address string to coordinates (cached). Used as a fallback for
 * a supplier with no stored latitude/longitude, and for a customer whose
 * active location was picked manually (no live GPS fix, so no coords).
 */
export function geocodeAddressCached(
  address: string | null | undefined,
): Promise<Coords | null> {
  const key = address?.trim().toLowerCase();
  if (!key) {
    return Promise.resolve(null);
  }
  let pending = geocodeCache.get(key);
  if (!pending) {
    pending = geocodeText(key)
      .then(result => result?.coords ?? null)
      .catch(() => {
        geocodeCache.delete(key); // allow a retry later
        return null;
      });
    geocodeCache.set(key, pending);
  }
  return pending;
}
