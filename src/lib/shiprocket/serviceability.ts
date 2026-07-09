/**
 * Serviceability + rate check.
 *
 * Given a destination pincode (and optional weight / COD flag) this module asks
 * Shiprocket which couriers can deliver, at what price, expected delivery time,
 * and whether COD is supported. The response is normalized into a
 * `ServiceabilityResult` that the checkout can render directly.
 */

import { shiprocketConfig } from './config';
import { shiprocketRequest } from './client';
import { shiprocketLogger } from './logger';
import type { CourierOption, ServiceabilityInput, ServiceabilityResult } from './types';

/** Raw shape of a courier entry inside Shiprocket's serviceability response. */
interface RawCourier {
  courier_company_id?: number;
  courier_name?: string;
  rate?: number;
  freight_charge?: number;
  cod_charges?: number;
  etd?: string;
  estimated_delivery_days?: string;
  cod?: number;
  rating?: number;
}

interface RawServiceabilityResponse {
  status?: number;
  data?: {
    available_courier_companies?: RawCourier[];
  };
}

/**
 * Checks courier serviceability + rates for a route.
 *
 * @param input - validated serviceability input.
 * @returns normalized serviceability result (never throws on "not serviceable";
 *          it returns `serviceable: false` with an empty courier list instead).
 */
export async function checkServiceability(input: ServiceabilityInput): Promise<ServiceabilityResult> {
  const pickupPincode = input.pickupPincode || shiprocketConfig.pickupPincode;

  shiprocketLogger.info('serviceability', 'Checking serviceability', {
    from: pickupPincode,
    to: input.deliveryPincode,
    cod: input.cod,
  });

  const response = await shiprocketRequest<RawServiceabilityResponse>({
    method: 'GET',
    path: '/courier/serviceability/',
    scope: 'serviceability',
    query: {
      pickup_postcode: pickupPincode,
      delivery_postcode: input.deliveryPincode,
      weight: input.weight,
      cod: input.cod ? 1 : 0,
      declared_value: input.declaredValue,
    },
  });

  const rawCouriers = response?.data?.available_courier_companies ?? [];

  const couriers: CourierOption[] = rawCouriers
    .map(normalizeCourier)
    .filter((courier): courier is CourierOption => courier !== null)
    .sort((a, b) => a.rate - b.rate);

  const codAvailable = couriers.some((courier) => courier.codAvailable);

  return {
    serviceable: couriers.length > 0,
    deliveryPincode: input.deliveryPincode,
    pickupPincode,
    recommended: couriers[0] ?? null,
    couriers,
    codAvailable,
  };
}

/** Converts a raw Shiprocket courier entry into our normalized shape. */
function normalizeCourier(raw: RawCourier): CourierOption | null {
  if (!raw?.courier_company_id || !raw?.courier_name) return null;

  const rate = Number(raw.rate ?? raw.freight_charge ?? 0) || 0;

  return {
    courierCompanyId: Number(raw.courier_company_id),
    courierName: String(raw.courier_name),
    rate,
    estimatedDeliveryDate: String(raw.etd ?? ''),
    estimatedDeliveryDays: String(raw.estimated_delivery_days ?? ''),
    codAvailable: Number(raw.cod ?? 0) === 1,
    rating: Number(raw.rating ?? 0) || 0,
  };
}
