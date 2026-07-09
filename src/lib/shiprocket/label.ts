/**
 * Shipping label generation.
 *
 * Asks Shiprocket to generate a printable shipping label PDF for the given
 * shipment id(s) and returns the downloadable URL.
 */

import { shiprocketRequest } from './client';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import { toShipmentIdArray } from './utils';
import type { LabelResult, ShipmentIdInput } from './types';

interface RawLabelResponse {
  label_created?: number;
  label_url?: string;
  response?: string;
  message?: string;
}

/**
 * Generates a shipping label for the given shipment id(s).
 *
 * @param input - one or more Shiprocket shipment ids.
 * @returns the label creation status + downloadable PDF URL.
 * @throws {ShiprocketError} when no label URL is returned.
 */
export async function generateLabel(input: ShipmentIdInput): Promise<LabelResult> {
  const shipmentIds = toShipmentIdArray(input.shipmentId);
  shiprocketLogger.info('label', 'Generating label', { shipmentIds });

  const response = await shiprocketRequest<RawLabelResponse>({
    method: 'POST',
    path: '/courier/generate/label',
    scope: 'label',
    body: { shipment_id: shipmentIds },
  });

  if (!response?.label_url) {
    throw new ShiprocketError(
      response?.response || response?.message || 'Failed to generate shipping label',
      'UPSTREAM_ERROR',
      502,
      response
    );
  }

  return {
    labelCreated: Number(response.label_created ?? 0) === 1,
    labelUrl: String(response.label_url),
  };
}
