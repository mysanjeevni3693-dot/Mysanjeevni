/**
 * Small internal helpers shared across Shiprocket modules.
 */

/**
 * Normalizes a single id or array of ids into a numeric array, which is the
 * shape most Shiprocket "bulk" endpoints (pickup/label/manifest) expect.
 *
 * @param value - a single shipment id or an array of shipment ids.
 * @returns an array of numeric ids (non-numeric values are dropped).
 */
export function toShipmentIdArray(value: string | string[]): number[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
}
