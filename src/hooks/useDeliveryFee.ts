import {deliveryFeeByDistance} from '../services';
import {
  useResolvedDeliveryCoords,
  type SupplierLocation,
} from './useDeliveryEstimate';

/**
 * Delivery fee (AED) from the customer's location to the supplier's, by
 * straight-line distance (see `deliveryFeeByDistance`). Uses stored
 * coordinates when present on either side, otherwise geocodes the address
 * (cached across the app). Returns null while unresolved or when neither
 * side has a usable location — callers should fall back to a stored/default
 * fee in that case.
 */
export function useDeliveryFee(supplier: SupplierLocation): number | null {
  const {customerCoords, supplierCoords} = useResolvedDeliveryCoords(supplier);
  return deliveryFeeByDistance(customerCoords, supplierCoords);
}
