import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

import {GOOGLE_MAPS_API_KEY} from '../config';

// Without this, the native module defaults to Android's legacy raw
// LocationManager/GPS_PROVIDER path, which waits for a full satellite lock
// and is noticeably slow on physical devices (especially indoors). Google
// Play Services' fused provider blends GPS with Wi-Fi/cell and is already a
// bundled dependency of this library — just unused until configured here.
//
// skipPermissionRequests: permissions are handled by
// requestLocationPermission() below. Left to the library, every
// getCurrentPosition() call re-prompts whenever the user granted only
// "Approximate" location, because the library only treats FINE as granted.
if (Platform.OS === 'android') {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: true,
    locationProvider: 'playServices',
  });
}

export type Coords = {
  latitude: number;
  longitude: number;
};

export type GeocodedAddress = {
  // Short, single-line label for the header (street + area).
  label: string;
  // Full formatted address for the location sheet.
  address: string;
  // Pieces for pre-filling the address form, when Google returned them.
  parts?: AddressParts;
};

export type AddressParts = {
  // Building / tower / villa name.
  building: string | null;
  // "12 Al Wasl Road", or the neighbourhood when the point has no street.
  street: string | null;
  // Google's region name, e.g. "Dubai", "Ras Al Khaimah".
  emirate: string | null;
};

export type ResolvedLocation = GeocodedAddress & {
  coords: Coords;
};

// A one-off / retryable denial — re-requesting can still show the OS
// permission dialog in-app.
export class LocationPermissionError extends Error {
  constructor() {
    super('location-permission-denied');
    this.name = 'LocationPermissionError';
  }
}

// The OS will no longer show the permission dialog at all (Android's "Deny
// & don't ask again", or any denial on iOS, which only prompts once per
// install) — an in-app retry can't do anything; only Settings can fix this.
export class LocationPermissionBlockedError extends Error {
  constructor() {
    super('location-permission-blocked');
    this.name = 'LocationPermissionBlockedError';
  }
}

// Permission is granted but the device has no GPS/network location
// provider turned on (the user disabled Location in system settings).
export class LocationServicesDisabledError extends Error {
  constructor() {
    super('location-services-disabled');
    this.name = 'LocationServicesDisabledError';
  }
}

/**
 * Android only: shows the native Play Services "Turn on Location" dialog
 * in-app (the Settings API resolution flow) instead of sending the user to
 * the system Settings screen. Resolves true once location services are on
 * (already were, or the user just accepted the dialog); throws if the
 * native module isn't available or there's no resolvable dialog to show,
 * so callers can fall back to deep-linking to Settings.
 */
export async function promptEnableLocationServices(): Promise<boolean> {
  const native = NativeModules.LocationSettings;
  if (Platform.OS !== 'android' || !native) {
    throw new Error('location-settings-prompt-unavailable');
  }
  return native.promptEnable();
}

/**
 * Android only: checks the current permission WITHOUT prompting, so a
 * pre-permission screen can decide whether to show at all. iOS has no
 * equivalent non-prompting check without an extra native dependency, and
 * doesn't need one — its own OS dialog already carries the developer's
 * rationale string (Info.plist's NSLocationWhenInUseUsageDescription), so
 * callers should just skip the custom priming screen on iOS.
 */
export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  // Android 12+ lets the user pick "Approximate" (COARSE only) in the
  // permission dialog — that's still a grant, and checking FINE alone would
  // make the app keep re-prompting for a permission the user already gave.
  const [fine, coarse] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION),
  ]);
  return fine || coarse;
}

/**
 * Ask for foreground location access. Resolves silently if granted; throws
 * LocationPermissionError if denied but retryable in-app (Android will
 * still show its OS dialog on the next call), or
 * LocationPermissionBlockedError if the OS won't show the dialog again at
 * all (Android "don't ask again", or any iOS denial — iOS only prompts
 * once per install) — that case needs Settings, an in-app retry can't help.
 */
export async function requestLocationPermission(): Promise<void> {
  if (Platform.OS === 'ios') {
    // Wait for the actual native prompt to resolve — firing-and-forgetting
    // this let getCurrentCoords() run before the user answered the dialog,
    // so the very first launch (no cached location yet, permission not yet
    // granted) always failed silently and the header never auto-fetched a
    // building on that first run.
    const granted = await new Promise<boolean>(resolve => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      );
    });
    if (!granted) {
      throw new LocationPermissionBlockedError();
    }
    return;
  }

  // Already granted (precise or approximate) — don't show the OS dialog
  // again. Requesting FINE while only COARSE is held re-opens the "upgrade
  // to precise" dialog on every call.
  if (await hasLocationPermission()) {
    return;
  }

  // Android 12+ ignores / mishandles a FINE-only request; FINE and COARSE
  // must be requested together so the user gets the Precise/Approximate
  // choice.
  const {ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION} = PermissionsAndroid.PERMISSIONS;
  const results = await PermissionsAndroid.requestMultiple([
    ACCESS_FINE_LOCATION,
    ACCESS_COARSE_LOCATION,
  ]);
  const fine = results[ACCESS_FINE_LOCATION];
  const coarse = results[ACCESS_COARSE_LOCATION];
  if (
    fine === PermissionsAndroid.RESULTS.GRANTED ||
    coarse === PermissionsAndroid.RESULTS.GRANTED
  ) {
    return;
  }
  if (
    fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
    coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
  ) {
    throw new LocationPermissionBlockedError();
  }
  throw new LocationPermissionError();
}

type PositionOptions = {
  enableHighAccuracy: boolean;
  maximumAge: number;
  timeout: number;
};

function getCoords(options: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      error => {
        // Android reports this when GPS/network location is switched off
        // system-wide, not when the app itself lacks permission.
        if (error.code === 2) {
          reject(new LocationServicesDisabledError());
          return;
        }
        reject(error);
      },
      options,
    );
  });
}

// A full GPS lock (enableHighAccuracy) can take 10-20s+ on many Android
// devices, especially indoors — too slow to block the header on. This tier
// accepts a cached/network fix up to 5 minutes old, which the fused
// provider almost always has ready instantly, so the UI can paint right
// away; resolveCurrentLocation() refines it with a precise fix afterwards.
const FAST_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 5 * 60_000,
  timeout: 8_000,
};

const PRECISE_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 60_000,
  timeout: 15_000,
};

export function getCurrentCoords(): Promise<Coords> {
  return getCoords(PRECISE_OPTIONS);
}

function getFastCoords(): Promise<Coords> {
  return getCoords(FAST_OPTIONS);
}

type GeocodeComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const FALLBACK: GeocodedAddress = {
  label: 'Current location',
  address: 'Current location',
};

/** Form pieces out of a Geocoding result's address_components. */
function addressPartsFrom(
  components: GeocodeComponent[] | undefined,
  building: string | null,
): AddressParts {
  const pick = (type: string) =>
    components?.find(component => component.types.includes(type))?.long_name;
  const route = pick('route');
  const street = route
    ? [pick('street_number'), route].filter(Boolean).join(' ')
    : pick('neighborhood') || pick('sublocality') || null;
  return {
    building: building || pick('premise') || null,
    street: street ? stripPlusCode(street) || null : null,
    emirate: pick('administrative_area_level_1') || pick('locality') || null,
  };
}

function haversineMeters(a: Coords, b: Coords): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Only trust a Places result as "the building" if it's this close to the
// device fix — otherwise it's a different building on the same block.
const NEAREST_PLACE_MAX_METERS = 40;

// Below this, a precise fix can't land on a different building than the fast
// one did, so the extra reverse-geocode is skipped.
const REFINE_MIN_METERS = 10;

// Ask Places (not Geocoding) what's actually at this exact point. Google
// recommends Nearby Search for "what business/building is here" — the
// Geocoding API's premise/POI match can snap to a neighboring address on
// the same street segment instead of the one directly under the user.
async function fetchNearestPlace(
  coords: Coords,
): Promise<{name: string; distance: number} | null> {
  const url =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
    `?location=${coords.latitude},${coords.longitude}` +
    '&rankby=distance' +
    '&type=point_of_interest' +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as {
      results?: {
        name?: string;
        geometry?: {location?: {lat: number; lng: number}};
      }[];
    };
    const nearest = data.results?.[0];
    const location = nearest?.geometry?.location;
    if (!nearest?.name || !location) {
      return null;
    }
    return {
      name: nearest.name,
      distance: haversineMeters(coords, {
        latitude: location.lat,
        longitude: location.lng,
      }),
    };
  } catch {
    return null;
  }
}

// Named-place types Google Geocoding API puts at the *result* level (not on
// any address_component) when a coordinate lands on a specific building,
// landmark, or business. Google doesn't put the actual name anywhere in
// address_components or formatted_address for these — only a Places Details
// lookup on the result's place_id returns it.
const NAMED_PLACE_TYPES = ['premise', 'point_of_interest', 'establishment', 'landmark'];

// Look up a place's display name (e.g. the building's actual name) from its
// place_id via the Places Details API.
async function fetchPlaceName(placeId: string): Promise<string | null> {
  const url =
    'https://maps.googleapis.com/maps/api/place/details/json' +
    `?place_id=${encodeURIComponent(placeId)}` +
    '&fields=name' +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as { result?: { name?: string } };
    return data.result?.name?.trim() || null;
  } catch {
    return null;
  }
}

// Reverse-geocode with the Google Geocoding API into a short label + full address.
// A Google Plus Code ("79W6+CWV", or the full "7HQQ79W6+CWV"), plus the
// " - " / ", " separator Google puts after it in formatted addresses.
const PLUS_CODE =
  /(^|[^0-9A-Z])[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}(?![0-9A-Z])\s*(?:[-,]\s*)?/gi;

/**
 * Removes Plus Codes from a Google address: "79W6+CWV - Al Barsha - Dubai"
 * → "Al Barsha - Dubai". Google puts one in place of a street address when
 * it has none on file, which is common across the UAE; to a customer it's
 * meaningless.
 */
export function stripPlusCode(text: string): string {
  return text
    .replace(PLUS_CODE, '$1')
    .replace(/^[\s,-]+|[\s,-]+$/g, '')
    .trim();
}

export async function reverseGeocode(coords: Coords): Promise<GeocodedAddress> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[location] reverseGeocode skipped: GOOGLE_MAPS_API_KEY is empty');
    return FALLBACK;
  }

  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    `?latlng=${coords.latitude},${coords.longitude}` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  const [response, nearestPlace] = await Promise.all([
    fetch(url),
    fetchNearestPlace(coords),
  ]);
  const data = (await response.json()) as {
    status?: string;
    error_message?: string;
    results?: {
      address_components?: GeocodeComponent[];
      formatted_address?: string;
      geometry?: {
        location?: {lat: number; lng: number};
        location_type?: string;
      };
      place_id?: string;
      types?: string[];
    }[];
  };

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    // Surfaces API-key/quota problems (e.g. REQUEST_DENIED from a
    // referrer-restricted key called from a mobile app) instead of letting
    // them look identical to "no location found".
    console.warn(
      `[location] Geocoding API returned ${data.status}${
        data.error_message ? `: ${data.error_message}` : ''
      }`,
    );
  }

  const results = data.results ?? [];
  if (results.length === 0) {
    return FALLBACK;
  }

  // A "plus_code" result (Google's Open Location Code, e.g. "79W6+CWV") is
  // what Google returns when it has no proper street address on file for
  // this point — common across much of the UAE. It carries no usable
  // address_components (no route/locality to build a readable address
  // from), and its formatted_address is just the raw code, so prefer any
  // other result type when one exists.
  const nonPlusCodeResults = results.filter(
    result => !(result.types ?? []).includes('plus_code'),
  );
  const candidates = nonPlusCodeResults.length > 0 ? nonPlusCodeResults : results;

  // Google can list a coarser, interpolated result before a precise one —
  // prefer whichever candidate is actually closest to the device fix, and
  // among those prefer rooftop precision over an interpolated/approximate
  // match.
  const ranked = candidates
    .map(result => ({
      result,
      distance: result.geometry?.location
        ? haversineMeters(coords, {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
          })
        : Infinity,
    }))
    .sort((a, b) => a.distance - b.distance);
  const rooftop = ranked.find(
    candidate => candidate.result.geometry?.location_type === 'ROOFTOP',
  );
  const first = (rooftop ?? ranked[0]).result;

  const pick = (type: string) =>
    first.address_components?.find(component => component.types.includes(type))
      ?.long_name;

  // A "premise" address_component does occasionally carry the building name
  // directly, but for most ordinary buildings Google tags the *result*
  // itself (not any component) as a premise/POI/establishment/landmark and
  // leaves the name out of both address_components and formatted_address —
  // that name only comes back from a Places Details lookup on place_id.
  const isNamedPlace = (first.types ?? []).some(type =>
    NAMED_PLACE_TYPES.includes(type),
  );
  // Places Nearby Search answers "what's actually at this point" more
  // reliably than the Geocoding API's premise/POI match, but only trust it
  // when it's genuinely close — otherwise it's a different building nearby.
  const building =
    (nearestPlace && nearestPlace.distance <= NEAREST_PLACE_MAX_METERS
      ? nearestPlace.name
      : null) ||
    pick('premise') ||
    pick('subpremise') ||
    (isNamedPlace && first.place_id
      ? await fetchPlaceName(first.place_id)
      : null);
  const route = pick('route');
  const area =
    pick('sublocality') ||
    pick('locality') ||
    pick('neighborhood') ||
    pick('administrative_area_level_2') ||
    pick('administrative_area_level_1');

  // Don't fall back to the street/route as a stand-in "building" — if the
  // GPS fix is just on a road with no named premise/POI nearby, show the
  // area instead of pretending a street name is a building.
  const place = building;
  // Even non-plus_code results often lead with a Plus Code ("79W6+CWV -
  // Al Barsha - Dubai"), and when every result was one, formatted_address
  // is just the code — so strip it and keep whatever address is left.
  const addressCore =
    stripPlusCode(first.formatted_address ?? '') ||
    [pick('street_number'), route, area].filter(Boolean).join(' ') ||
    'Current location';
  // Lead with the building name when one was found (Places Nearby Search,
  // a "premise" component, or a Places Details lookup) — the Geocoding
  // API's formatted_address never includes it on its own.
  const address =
    place && !addressCore.includes(place)
      ? `${place}, ${addressCore}`
      : addressCore;
  // Pair a found building with its area, falling back to the street when the
  // area component is missing, so a real building is never shown bare.
  const companion = area || route;
  const label = place
    ? companion && companion !== place
      ? `${place}, ${companion}`
      : place
    : area || address;

  return {label, address, parts: addressPartsFrom(first.address_components, place)};
}

export type PlacePrediction = {
  id: string; // place_id
  primary: string; // building / street / place name
  secondary: string; // city, region, country
  description: string; // full one-line text
};

// Restrict place search to the United Arab Emirates.
const PLACES_COUNTRY = 'ae';

// Google Places Autocomplete. Requires the Places API enabled on the key.
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const input = query.trim();
  if (!GOOGLE_MAPS_API_KEY || input.length < 2) {
    return [];
  }

  const url =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
    `?input=${encodeURIComponent(input)}` +
    `&components=country:${PLACES_COUNTRY}` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url, {signal});
  const data = (await response.json()) as {
    predictions?: {
      place_id: string;
      description: string;
      structured_formatting?: {main_text?: string; secondary_text?: string};
    }[];
  };

  return (data.predictions ?? []).map(prediction => ({
    id: prediction.place_id,
    primary:
      prediction.structured_formatting?.main_text || prediction.description,
    secondary: prediction.structured_formatting?.secondary_text || '',
    description: prediction.description,
  }));
}

// Forward-geocode free text (or a Places description) to coordinates + address.
export async function geocodeText(
  query: string,
  // The place's name from search ("Marina Heights"), used as the building
  // when the match is a named place — Geocoding results omit the name.
  placeName?: string,
): Promise<{coords: Coords; address: string; parts: AddressParts} | null> {
  const q = query.trim();
  if (!GOOGLE_MAPS_API_KEY || !q) {
    return null;
  }

  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    `?address=${encodeURIComponent(q)}` +
    `&components=country:${PLACES_COUNTRY}` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = (await response.json()) as {
    results?: {
      address_components?: GeocodeComponent[];
      geometry?: {location?: {lat: number; lng: number}};
      formatted_address?: string;
      types?: string[];
    }[];
  };

  const first = data.results?.[0];
  const location = first?.geometry?.location;
  if (!first || !location) {
    return null;
  }

  return {
    coords: {latitude: location.lat, longitude: location.lng},
    address: stripPlusCode(first.formatted_address ?? '') || q,
    parts: addressPartsFrom(
      first.address_components,
      placeName &&
        (first.types ?? []).some(type => NAMED_PLACE_TYPES.includes(type))
        ? placeName
        : null,
    ),
  };
}

/**
 * Permission -> coordinates -> human-readable label + full address.
 *
 * Resolves quickly with a fast/approximate fix (cached or network-based, not
 * a full GPS lock) so callers aren't blocked for up to 20s. If `onRefine` is
 * given and a subsequent high-accuracy fix lands somewhere meaningfully
 * different, it's called once more with the refined result.
 */
export async function resolveCurrentLocation(
  onRefine?: (refined: ResolvedLocation) => void,
): Promise<ResolvedLocation> {
  await requestLocationPermission();

  let coords: Coords;
  try {
    coords = await getFastCoords();
  } catch {
    // No cached/network fix available (e.g. very first launch) — fall back
    // to waiting for a real GPS lock instead of failing outright.
    coords = await getCurrentCoords();
  }
  const geocoded = await reverseGeocode(coords).catch(() => FALLBACK);
  const fast: ResolvedLocation = {coords, ...geocoded};

  if (onRefine) {
    getCurrentCoords()
      .then(async preciseCoords => {
        // The fast fix can be ~100m+ off, and the building is matched within
        // NEAREST_PLACE_MAX_METERS of it — so even a small correction can
        // mean a different building. Re-geocode unless the fix barely moved,
        // and apply it whenever the resulting address actually differs.
        if (haversineMeters(coords, preciseCoords) < REFINE_MIN_METERS) {
          return;
        }
        const preciseGeocoded = await reverseGeocode(preciseCoords).catch(
          () => null,
        );
        if (
          preciseGeocoded &&
          (preciseGeocoded.label !== geocoded.label ||
            preciseGeocoded.address !== geocoded.address)
        ) {
          onRefine({coords: preciseCoords, ...preciseGeocoded});
        }
      })
      .catch(() => {});
  }

  return fast;
}
