/**
 * Shipment level operations: AWB (courier) assignment and cancellation.
 *
 * Assigning an AWB tells Shiprocket which courier will carry the shipment and
 * returns the tracking (AWB) number that the customer will use.
 */

import { shiprocketRequest } from './client';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import type {
  AssignAwbInput,
  AssignAwbResult,
  CancelShipmentInput,
  CancelShipmentResult,
} from './types';

interface RawAwbResponse {
  awb_assign_status?: number;
  response?: {
    data?: {
      awb_code?: string;
      courier_name?: string;
      courier_company_id?: number;
      shipment_id?: number | string;
    };
  };
  message?: string;
}

/**
 * Assigns a courier + AWB to a shipment.
 *
 * @param input - shipment id and optional preferred courier id.
 * @returns the assigned AWB code + courier name.
 * @throws {ShiprocketError} when Shiprocket fails to allocate an AWB.
 */
export async function assignAwb(input: AssignAwbInput): Promise<AssignAwbResult> {
  shiprocketLogger.info('shipment', 'Assigning AWB', { shipmentId: input.shipmentId });

  const response = await shiprocketRequest<RawAwbResponse>({
    method: 'POST',
    path: '/courier/assign/awb',
    scope: 'shipment',
    body: {
      shipment_id: input.shipmentId,
      courier_id: input.courierId,
    },
  });

  const data = response?.response?.data;

  if (!data?.awb_code) {
    throw new ShiprocketError(
      response?.message || 'Failed to assign AWB for shipment',
      'UPSTREAM_ERROR',
      502,
      response
    );
  }

  shiprocketLogger.info('shipment', 'AWB assigned', {
    shipmentId: input.shipmentId,
    awb: data.awb_code,
    courier: data.courier_name,
  });

  return {
    awbCode: String(data.awb_code),
    courierName: String(data.courier_name ?? ''),
    courierCompanyId: Number(data.courier_company_id ?? 0),
    shipmentId: String(data.shipment_id ?? input.shipmentId),
  };
}

interface RawCancelResponse {
  status?: number;
  message?: string;
}

/**
 * Cancels one or more orders in Shiprocket.
 *
 * @param input - list of Shiprocket order ids to cancel.
 * @returns whether the cancellation was accepted.
 */
export async function cancelShipment(input: CancelShipmentInput): Promise<CancelShipmentResult> {
  shiprocketLogger.info('shipment', 'Cancelling order(s)', { orderIds: input.orderIds });

  const response = await shiprocketRequest<RawCancelResponse>({
    method: 'POST',
    path: '/orders/cancel',
    scope: 'shipment',
    body: { ids: input.orderIds },
  });

  const cancelled = Number(response?.status ?? 0) === 200 || /cancel/i.test(response?.message ?? '');

  return {
    cancelled,
    message: response?.message ?? (cancelled ? 'Order cancelled' : 'Cancellation could not be confirmed'),
  };
}
