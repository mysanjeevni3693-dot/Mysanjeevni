/**
 * Shipment tracking + status normalization.
 *
 * Tracks a shipment by AWB (preferred) or shipment id and maps Shiprocket's
 * many free-text statuses onto our small, canonical `ShipmentStatus` union so
 * the rest of the app never has to deal with raw courier strings.
 */

import { shiprocketRequest } from './client';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import type {
  ShipmentStatus,
  TrackInput,
  TrackingActivity,
  TrackingResult,
} from './types';

interface RawActivity {
  date?: string;
  status?: string;
  activity?: string;
  location?: string;
  'sr-status-label'?: string;
}

interface RawTrackData {
  track_status?: number;
  shipment_status?: number;
  shipment_track?: Array<{
    awb_code?: string;
    courier_name?: string;
    current_status?: string;
    delivered_date?: string;
    edd?: string;
  }>;
  shipment_track_activities?: RawActivity[];
  track_url?: string;
  etd?: string;
  error?: string;
}

interface RawTrackResponse {
  tracking_data?: RawTrackData;
}

/**
 * Maps a raw Shiprocket status string (from tracking or webhook) to our
 * canonical `ShipmentStatus`. Matching is keyword based and case-insensitive so
 * it is resilient to Shiprocket's inconsistent labels.
 *
 * @param raw - the raw status string from Shiprocket.
 * @returns the canonical shipment status.
 */
export function mapShipmentStatus(raw: string | number | undefined | null): ShipmentStatus {
  const value = String(raw ?? '').toLowerCase().trim();
  if (!value) return 'UNKNOWN';

  // Order matters: check the most specific / terminal states first.
  if (/(rto)/.test(value)) return 'RTO';
  if (/(cancel)/.test(value)) return 'CANCELLED';
  if (/(delivered)/.test(value)) return 'DELIVERED';
  if (/(out for delivery|ofd)/.test(value)) return 'OUT_FOR_DELIVERY';
  if (/(in transit|intransit|shipped|dispatch)/.test(value)) return 'IN_TRANSIT';
  if (/(picked up|picked-up|pickup done|pickup completed|out for pickup)/.test(value)) return 'PICKED_UP';
  if (/(pickup scheduled|pickup generated|pickup queued|manifest)/.test(value)) return 'PICKUP_SCHEDULED';
  if (/(pending|new|order placed|awb assigned|label)/.test(value)) return 'PENDING';

  return 'UNKNOWN';
}

/**
 * Tracks a shipment by AWB or shipment id and returns a normalized timeline.
 *
 * @param input - must include either `awb` or `shipmentId`.
 * @returns normalized tracking data including canonical status + activities.
 * @throws {ShiprocketError} when neither identifier is provided.
 */
export async function trackShipment(input: TrackInput): Promise<TrackingResult> {
  let path: string;
  if (input.awb) {
    path = `/courier/track/awb/${encodeURIComponent(input.awb)}`;
  } else if (input.shipmentId) {
    path = `/courier/track/shipment/${encodeURIComponent(input.shipmentId)}`;
  } else {
    throw new ShiprocketError('AWB or shipmentId is required for tracking', 'VALIDATION_ERROR', 422);
  }

  shiprocketLogger.info('tracking', 'Tracking shipment', { awb: input.awb, shipmentId: input.shipmentId });

  const response = await shiprocketRequest<RawTrackResponse>({
    method: 'GET',
    path,
    scope: 'tracking',
  });

  const data = response?.tracking_data;
  const track = data?.shipment_track?.[0];
  const rawStatus = track?.current_status ?? '';

  const activities: TrackingActivity[] = (data?.shipment_track_activities ?? []).map((activity) => ({
    date: String(activity.date ?? ''),
    status: String(activity['sr-status-label'] ?? activity.status ?? ''),
    activity: String(activity.activity ?? ''),
    location: String(activity.location ?? ''),
  }));

  return {
    awb: String(track?.awb_code ?? input.awb ?? ''),
    courierName: String(track?.courier_name ?? ''),
    currentStatus: mapShipmentStatus(rawStatus || data?.shipment_status),
    rawStatus: String(rawStatus),
    estimatedDelivery: String(track?.edd ?? data?.etd ?? ''),
    trackUrl: String(data?.track_url ?? ''),
    activities,
  };
}
