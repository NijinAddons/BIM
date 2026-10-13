import { useEffect, useState } from 'react';

import {
  deliveryEstimate,
  deliveryWindow,
  fetchDrivingMinutes,
  geocodeAddressCached,
  type Coords,
} from '../services';
import { useLocation } from './useLocation';

export type SupplierLocation = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  address?: string | null;
};

/**
 * Resolves both sides of a delivery distance: the customer's active location
 * and a supplier's. Uses stored coordinates when present, otherwise geocodes
 * the address (cached across the app). Shared by `useDeliveryEstimate` and
 * `useDeliveryFee`, which just turn the resolved coordinates into different
 * numbers.
 */
export function useResolvedDeliveryCoords(supplier: SupplierLocation): {
  customerCoords: Coords | null;
  supplierCoords: Coords | null;
} {
  const { coords, address: customerAddress } = useLocation();
  const [supplierGeocoded, setSupplierGeocoded] = useState<Coords | null>(null);
  const [customerGeocoded, setCustomerGeocoded] = useState<Coords | null>(null);

  const { latitude, longitude } = supplier;
  const supplierAddress = supplier.address ?? null;
  const hasSupplierCoords =
    typeof latitude === 'number' && typeof longitude === 'number';

  useEffect(() => {
    if (hasSupplierCoords || !supplierAddress) {
      setSupplierGeocoded(null);
      return;
    }
    let cancelled = false;
    geocodeAddressCached(supplierAddress)
      .then(result => {
        if (!cancelled) {
          setSupplierGeocoded(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSupplierGeocoded(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasSupplierCoords, supplierAddress]);

  // The active location has no live GPS fix (it was picked manually via
  // search/saved address) — geocode its address so distance still resolves
  // instead of silently falling back to the generic default estimate.
  useEffect(() => {
    if (coords || !customerAddress) {
      setCustomerGeocoded(null);
      return;
    }
    let cancelled = false;
    geocodeAddressCached(customerAddress)
      .then(result => {
        if (!cancelled) {
          setCustomerGeocoded(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomerGeocoded(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [coords, customerAddress]);

  const supplierCoords = hasSupplierCoords
    ? { latitude: latitude as number, longitude: longitude as number }
    : supplierGeocoded;
  const customerCoords = coords ?? customerGeocoded;

  return { customerCoords, supplierCoords };
}

/**
 * Delivery-time string ("20 min") from the supplier to the customer:
 * store prep time plus Google's real road travel time with current traffic
 * (see `fetchDrivingMinutes`), between the customer's latitude/longitude and
 * the supplier's (Supplier > Location Details; its Google Address is
 * geocoded only when those are empty). Shows the straight-line estimate
 * until Google answers, or if it can't route the trip. Null when either
 * side has no location — callers hide the delivery time.
 *
 * Google answers are cached per supplier/customer spot, so a whole list of
 * product cards costs one request per distinct supplier, not per product.
 */
export function useDeliveryEstimate(supplier: SupplierLocation): string | null {
  const { customerCoords, supplierCoords } =
    useResolvedDeliveryCoords(supplier);
  const [drivingMinutes, setDrivingMinutes] = useState<number | null>(null);

  const fromLat = supplierCoords?.latitude;
  const fromLng = supplierCoords?.longitude;
  const toLat = customerCoords?.latitude;
  const toLng = customerCoords?.longitude;

  useEffect(() => {
    setDrivingMinutes(null);
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return;
    }
    let cancelled = false;
    fetchDrivingMinutes(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
    ).then(minutes => {
      if (!cancelled) {
        setDrivingMinutes(minutes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fromLat, fromLng, toLat, toLng]);

  if (drivingMinutes != null) {
    return deliveryWindow(drivingMinutes);
  }
  return deliveryEstimate(customerCoords, supplierCoords);
}
