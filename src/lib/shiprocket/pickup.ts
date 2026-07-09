/**
 * Pickup generation.
 *
 * Requests Shiprocket to schedule a courier pickup for one or more shipments.
 */

import { shiprocketRequest } from './client';
import { shiprocketLogger } from './logger';
import { toShipmentIdArray } from './utils';
import type { PickupResult, ShipmentIdInput } from './types';

interface RawPickupResponse {
  pickup_status?: number;
  response?: {
    pickup_status?: number;
    pickup_scheduled_date?: string;
    pickup_token_number?: string;
    status?: string;
    data?: string;
  };
  message?: string;
}

/**
 * Schedules a pickup for the given shipment id(s).
 *
 * @param input - one or more Shiprocket shipment ids.
 * @returns normalized pickup status details.
 */
export async function generatePickup(input: ShipmentIdInput): Promise<PickupResult> {
  const shipmentIds = toShipmentIdArray(input.shipmentId);
  shiprocketLogger.info('pickup', 'Generating pickup', { shipmentIds });

  const response = await shiprocketRequest<RawPickupResponse>({
    method: 'POST',
    path: '/courier/generate/pickup',
    scope: 'pickup',
    body: { shipment_id: shipmentIds },
  });

  const scheduled =
    Number(response?.pickup_status ?? response?.response?.pickup_status ?? 0) === 1 ||
    /scheduled|success/i.test(response?.response?.status ?? '');

  return {
    pickupScheduled: scheduled,
    pickupStatus: response?.response?.status ?? (scheduled ? 'Scheduled' : 'Pending'),
    pickupTokenNumber: String(response?.response?.pickup_token_number ?? ''),
    pickupDate: String(response?.response?.pickup_scheduled_date ?? ''),
  };
}
