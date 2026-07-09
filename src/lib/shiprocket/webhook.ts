/**
 * Webhook verification + parsing.
 *
 * Shiprocket authenticates webhook calls with an `x-api-key` header whose value
 * you configure in the Shiprocket panel. We compare that header (in constant
 * time) against `SHIPROCKET_WEBHOOK_SECRET`. The payload is then normalized into
 * a `WebhookEvent` with a canonical status so the API route can update the DB.
 */

import crypto from 'crypto';
import { shiprocketConfig } from './config';
import { shiprocketLogger } from './logger';
import { mapShipmentStatus } from './tracking';
import type { WebhookEvent } from './types';

/**
 * Verifies the webhook `x-api-key` header against the configured secret using a
 * timing-safe comparison.
 *
 * If no secret is configured, verification is skipped (returns true) but a
 * warning is logged — configure `SHIPROCKET_WEBHOOK_SECRET` in production.
 *
 * @param apiKeyHeader - value of the incoming `x-api-key` header.
 * @returns whether the request is authentic.
 */
export function verifyWebhookSignature(apiKeyHeader: string | null): boolean {
  const secret = shiprocketConfig.webhookSecret;

  if (!secret) {
    shiprocketLogger.warn('webhook', 'SHIPROCKET_WEBHOOK_SECRET not set – skipping verification');
    return true;
  }

  if (!apiKeyHeader) return false;

  const expected = Buffer.from(secret);
  const received = Buffer.from(apiKeyHeader);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

/** Raw Shiprocket webhook payload shape (fields are all optional / loose). */
interface RawWebhookPayload {
  awb?: string | number;
  current_status?: string;
  current_status_id?: number;
  shipment_status?: string;
  order_id?: string | number;
  sr_order_id?: string | number;
  shipment_id?: string | number;
  courier_name?: string;
  etd?: string;
  current_timestamp?: string;
}

/**
 * Parses and normalizes a raw Shiprocket webhook payload.
 *
 * @param payload - the JSON body sent by Shiprocket.
 * @returns a normalized `WebhookEvent`.
 */
export function parseWebhookEvent(payload: unknown): WebhookEvent {
  const raw = (payload ?? {}) as RawWebhookPayload;
  const rawStatus = raw.current_status ?? raw.shipment_status ?? '';

  return {
    awb: String(raw.awb ?? ''),
    courierName: String(raw.courier_name ?? ''),
    currentStatus: mapShipmentStatus(rawStatus || raw.current_status_id),
    rawStatus: String(rawStatus),
    shiprocketOrderId: String(raw.sr_order_id ?? raw.order_id ?? ''),
    shipmentId: String(raw.shipment_id ?? ''),
    estimatedDelivery: String(raw.etd ?? ''),
    timestamp: String(raw.current_timestamp ?? new Date().toISOString()),
  };
}
