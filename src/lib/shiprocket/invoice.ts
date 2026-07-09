/**
 * Invoice generation.
 *
 * Asks Shiprocket to generate a printable tax invoice PDF for the given
 * order id(s) and returns the downloadable URL.
 */

import { shiprocketRequest } from './client';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import { toShipmentIdArray } from './utils';
import type { InvoiceResult, ShipmentIdInput } from './types';

interface RawInvoiceResponse {
  is_invoice_created?: boolean;
  invoice_url?: string;
  not_created?: number[];
  message?: string;
}

/**
 * Generates a printable invoice for the given Shiprocket order id(s).
 *
 * Note: Shiprocket's invoice endpoint keys on ORDER ids (not shipment ids),
 * so callers should pass the Shiprocket order id here.
 *
 * @param input - one or more Shiprocket order ids (as `shipmentId`).
 * @returns the invoice creation status + downloadable PDF URL.
 * @throws {ShiprocketError} when no invoice URL is returned.
 */
export async function generateInvoice(input: ShipmentIdInput): Promise<InvoiceResult> {
  const ids = toShipmentIdArray(input.shipmentId);
  shiprocketLogger.info('invoice', 'Generating invoice', { ids });

  const response = await shiprocketRequest<RawInvoiceResponse>({
    method: 'POST',
    path: '/orders/print/invoice',
    scope: 'invoice',
    body: { ids },
  });

  if (!response?.invoice_url) {
    throw new ShiprocketError(
      response?.message || 'Failed to generate invoice',
      'UPSTREAM_ERROR',
      502,
      response
    );
  }

  return {
    invoiceCreated: Boolean(response.is_invoice_created),
    invoiceUrl: String(response.invoice_url),
  };
}
