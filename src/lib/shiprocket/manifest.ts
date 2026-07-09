/**
 * Manifest generation.
 *
 * Generates and then fetches the printable manifest PDF for the given shipment
 * id(s). Shiprocket exposes two steps: `/manifests/generate` creates the
 * manifest, and `/manifests/print` returns a downloadable URL.
 */

import { shiprocketRequest } from './client';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import { toShipmentIdArray } from './utils';
import type { ManifestResult, ShipmentIdInput } from './types';

interface RawGenerateManifestResponse {
  status?: number;
  manifest_url?: string;
  message?: string;
}

interface RawPrintManifestResponse {
  manifest_url?: string;
  status?: string;
  message?: string;
}

/**
 * Generates a manifest for the given shipment id(s) and returns its PDF URL.
 *
 * @param input - one or more Shiprocket shipment ids.
 * @returns manifest generation status + downloadable PDF URL.
 * @throws {ShiprocketError} when no manifest URL can be obtained.
 */
export async function generateManifest(input: ShipmentIdInput): Promise<ManifestResult> {
  const shipmentIds = toShipmentIdArray(input.shipmentId);
  shiprocketLogger.info('manifest', 'Generating manifest', { shipmentIds });

  const generateResponse = await shiprocketRequest<RawGenerateManifestResponse>({
    method: 'POST',
    path: '/manifests/generate',
    scope: 'manifest',
    body: { shipment_id: shipmentIds },
  });

  // Some accounts return the URL directly from generate; otherwise call print.
  let manifestUrl = generateResponse?.manifest_url ?? '';

  if (!manifestUrl) {
    const printResponse = await shiprocketRequest<RawPrintManifestResponse>({
      method: 'POST',
      path: '/manifests/print',
      scope: 'manifest',
      body: { shipment_id: shipmentIds },
    });
    manifestUrl = printResponse?.manifest_url ?? '';
  }

  if (!manifestUrl) {
    throw new ShiprocketError(
      generateResponse?.message || 'Failed to generate manifest',
      'UPSTREAM_ERROR',
      502,
      generateResponse
    );
  }

  return {
    manifestGenerated: true,
    manifestUrl: String(manifestUrl),
  };
}
